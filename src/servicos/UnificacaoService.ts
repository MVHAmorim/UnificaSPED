import { AGGREGATION_CONFIG, BLOCO_ORDER, createInitialState, SpedUnificationState, ArquivoSpedMetadata, ContextoCompetencia, EstabelecimentoUnificacao } from "../dominios/unificacao";
import { SpedPreScanner } from "../utils/SpedScanners";
import { LineSplitter } from "../utils/streams";
import { SpedBlockFilter } from "../utils/SpedBlockFilter";

// Helper para Encoding ISO-8859-1 (Latin1)
function encodeLatin1(text: string): Uint8Array {
    const len = text.length;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        // Mapeamento direto 1:1 para os primeiros 256 code points
        // Qualquer char > 255 vira '?' (63)
        const code = text.charCodeAt(i);
        buf[i] = (code < 256) ? code : 63;
    }
    return buf;
}

export class UnificacaoService {

    // NOVO: Analisar Cenário (Deep Discovery)
    static async analisarCenario(bucket: R2Bucket, keys: string[]): Promise<Map<string, ContextoCompetencia>> {
        const contextos = new Map<string, ContextoCompetencia>();

        for (const key of keys) {
            const obj = await bucket.get(key);
            if (!obj) continue;

            // Deep Discovery: Ler o arquivo todo para encontrar 0000 e TODOS os 0140 presentes
            const reader = obj.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();

            let headerFound = false;
            let dtIni = '', dtFin = '', cnpjFile = '';
            let isMatrizFile = false;
            const estabelecimentosNoArquivo = new Set<string>();

            while (true) {
                const { done, value: line } = await reader.read();
                if (done) break;
                if (!line) continue;

                if (line.startsWith('|0000|')) {
                    const parts = line.split('|');
                    dtIni = parts[6]; // DDMMAAAA
                    dtFin = parts[7];
                    cnpjFile = parts[9];

                    if (dtIni && cnpjFile) {
                        const cnpjClean = cnpjFile.replace(/\D/g, '');
                        // Matriz Check: Raiz 0001
                        isMatrizFile = cnpjClean.substring(8, 12) === '0001';
                        headerFound = true;
                    }
                } else if (line.startsWith('|0140|')) {
                    const parts = line.split('|');
                    const cnpjEst = parts[3]; // COD_EST ? Não, 0140|COD_EST|NOME|CNPJ...
                    // Layout 0140: |REG|COD_EST|NOME|CNPJ|...
                    // Indice: 0=|, 1=REG, 2=COD, 3=NOME, 4=CNPJ
                    // Guia Pratico:
                    // 0140: Campo 04 - CNPJ
                    const cnpj0140 = parts[4];
                    if (cnpj0140) {
                        estabelecimentosNoArquivo.add(cnpj0140.replace(/\D/g, ''));
                    }
                }
            }

            if (!headerFound) continue;

            // Registrar no Contexto
            const mesAno = dtIni.substring(2, 8); // DDMMAAAA -> MMAAAA
            const cnpjBase = cnpjFile.replace(/\D/g, '').substring(0, 8);
            const contextoKey = `${mesAno}_${cnpjBase}`;

            if (!contextos.has(contextoKey)) {
                contextos.set(contextoKey, {
                    chave: contextoKey,
                    competencia: `${mesAno.substring(0, 2)}/${mesAno.substring(2)}`,
                    cnpjBase: cnpjBase,
                    matriz: undefined,
                    filiais: new Map()
                });
            }

            const ctx = contextos.get(contextoKey)!;

            // Metadados
            const meta: ArquivoSpedMetadata = {
                key,
                cnpj: cnpjFile.replace(/\D/g, ''),
                dtIni,
                dtFin,
                isMatriz: isMatrizFile
            };

            // Adicionar arquivo aos estabelecimentos encontrados (Deep Discovery)
            // Se o set estiver vazio (ex: arquivo só com header e sems movimento ou 0140), assume-se o CNPJ do Header?
            // SPED exige pelo menos um 0140 se houver movimento. Se não tiver 0140, é um arquivo "Sem Dados" ou invalido?
            // Vamos adicionar ao estabelecimento do Header por segurança se não achou nenhum 0140 (ex: arquivo vazio só com 0000 e 9999)
            if (estabelecimentosNoArquivo.size === 0) {
                estabelecimentosNoArquivo.add(meta.cnpj);
            }

            for (const cnpjEst of estabelecimentosNoArquivo) {
                const isEstMatriz = cnpjEst.substring(8, 12) === '0001';

                if (isEstMatriz) {
                    if (!ctx.matriz) {
                        ctx.matriz = {
                            cnpj: cnpjEst,
                            isMatriz: true,
                            arquivos: [],
                            periodoConsolidado: { dtIni, dtFin }
                        };
                    }
                    // Evitar duplicar key na lista
                    if (!ctx.matriz.arquivos.some(a => a.key === meta.key)) {
                        ctx.matriz.arquivos.push(meta);
                    }
                } else {
                    if (!ctx.filiais.has(cnpjEst)) {
                        ctx.filiais.set(cnpjEst, {
                            cnpj: cnpjEst,
                            isMatriz: false,
                            arquivos: [],
                            periodoConsolidado: { dtIni, dtFin }
                        });
                    }
                    const filial = ctx.filiais.get(cnpjEst)!;
                    if (!filial.arquivos.some(a => a.key === meta.key)) {
                        filial.arquivos.push(meta);
                    }
                }
            }
        }

        return contextos;
    }

    // SIGNATURE ALTERADA: Recebe Contexto
    static async unificar(bucket: R2Bucket, contexto: ContextoCompetencia): Promise<ReadableStream> {
        const state = createInitialState();

        // Coletar todos os arquivos unicos para Pre-Scan
        const allKeys = new Set<string>();
        if (contexto.matriz) contexto.matriz.arquivos.forEach(a => allKeys.add(a.key));
        for (const f of contexto.filiais.values()) {
            f.arquivos.forEach(a => allKeys.add(a.key));
        }

        const uniqueKeys = Array.from(allKeys);
        if (uniqueKeys.length === 0) throw new Error("Nenhum arquivo no contexto.");

        // PASSO 1: Pre-Scan
        for (const key of uniqueKeys) {
            const obj = await bucket.get(key);
            if (!obj) continue;
            await SpedPreScanner.scan(obj.body, state, false); // isMatriz param irrelevante aqui
        }

        // PASSO 2: Output Stream
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
            try {
                // 1. Bloco 0 (Deep Discovery + Contextual Buffering)
                await UnificacaoService.streamBloco0Unificado(bucket, contexto, writer, state);

                const estabelecimentos = [];
                if (contexto.matriz) estabelecimentos.push(contexto.matriz);
                estabelecimentos.push(...contexto.filiais.values());

                // 2. Blocos Ordenados (Iterar por estabelecimentos)
                for (const bloco of BLOCO_ORDER) {
                    await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, bloco, writer, state);
                }

                // 3. Blocos Calculados (M)
                await UnificacaoService.streamCalculatedBlocks(writer, state);

                // 3.1 Bloco P
                await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, 'P', writer, state);

                // 4. Bloco 1
                await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, '1', writer, state);

                // 5. Bloco 9
                await UnificacaoService.streamBloco9(writer, state);

                await writer.close();

            } catch (err) {
                console.error("Erro no stream de unificação:", err);
                await writer.abort(err);
            } finally {
                // CLEANUP: Deletar arquivos originais do R2 para economizar espaço
                const keysToDelete: string[] = [];

                if (contexto.matriz) {
                    contexto.matriz.arquivos.forEach(a => keysToDelete.push(a.key));
                }

                contexto.filiais.forEach(f => {
                    f.arquivos.forEach(a => keysToDelete.push(a.key));
                });

                if (keysToDelete.length > 0) {
                    try {
                        // R2 suporta delete de multiplas keys?
                        // A lib padrao de R2Bucket usually tem delete(key) ou delete([keys])?
                        // Cloudflare Workers R2 API: delete(keys: string | string[])
                        // Mas aws4fetch ou custom wrapper? O usuario passa `bucket: R2Bucket`.
                        // Assumindo Type R2Bucket padrao do Cloudflare:
                        // bucket.delete(key: string | string[])

                        await bucket.delete(keysToDelete);
                        console.log(`Cleanup: ${keysToDelete.length} arquivos removidos com sucesso.`);
                    } catch (cleanupErr) {
                        console.error("Erro no cleanup de arquivos R2:", cleanupErr);
                    }
                }
            }
        })();

        return readable;
    }

    // Helper de escrita que atualiza contadores
    private static async writeLine(writer: WritableStreamDefaultWriter, line: string, state: SpedUnificationState) {
        state.totalLinhas++;
        const parts = line.split('|');
        if (parts.length > 1) {
            const reg = parts[1];
            const current = state.registrosCount.get(reg) || 0;
            state.registrosCount.set(reg, current + 1);
        }
        const buffer = encodeLatin1(line + '\r\n');
        await writer.write(buffer);
    }

    private static async streamBloco0Unificado(bucket: R2Bucket, contexto: ContextoCompetencia, writer: WritableStreamDefaultWriter, state: SpedUnificationState) {
        // Remover 0500 e 0600 da lista de locais, pois serão tratados globalmente (deduplicados)
        const REGS_LOCAIS = ['0150', '0190', '0200', '0300', '0400', '0450', '0460'];

        if (!contexto.matriz || contexto.matriz.arquivos.length === 0) throw new Error("Matriz sem arquivos.");

        // CÁLCULO DE RANGE DE DATAS GLOBAL
        // O Header (0000) deve refletir o período total da unificação (Min da Data Inicial -> Max da Data Final)
        // Coleta metadados de TODOS os arquivos (Matriz + Filiais)
        const allMetas = [...contexto.matriz.arquivos];
        contexto.filiais.forEach(f => allMetas.push(...f.arquivos));

        // Helper para converter DDMMAAAA -> YYYYMMDD (string sortable)
        const toSortable = (d: string) => d ? `${d.substring(4)}${d.substring(2, 4)}${d.substring(0, 2)}` : '';

        let minIni = '';
        let maxFin = '';

        const [mesComp, anoComp] = contexto.competencia.split('/'); // MM/AAAA

        allMetas.forEach(m => {
            // Validação de Segurança: Pertence à competência e raiz CNPJ?
            const mesFile = m.dtIni.substring(2, 4);
            const anoFile = m.dtIni.substring(4, 8);
            const cnpjBaseFile = m.cnpj.substring(0, 8);

            // Filtrar apenas arquivos da mesma competência e raiz CNPJ
            if (mesFile !== mesComp || anoFile !== anoComp) return;
            if (cnpjBaseFile !== contexto.cnpjBase) return;

            const sIni = toSortable(m.dtIni);
            const sFin = toSortable(m.dtFin);

            if (!minIni || (sIni && sIni < toSortable(minIni))) minIni = m.dtIni;
            if (!maxFin || (sFin && sFin > toSortable(maxFin))) maxFin = m.dtFin;
        });

        // 1. Header Global (Matriz 0000-0110)
        const arqMatriz = contexto.matriz.arquivos[0];
        const objMatriz = await bucket.get(arqMatriz.key);

        if (objMatriz) {
            const reader = objMatriz.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();
            while (true) {
                const { done, value: line } = await reader.read();
                if (done) break;
                if (!line) continue;

                const parts = line.split('|');
                const reg = parts[1];

                if (reg === '0000') {
                    // Substituir Datas
                    // |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|...
                    // Indice: 0=|, 1=0000, 2=VER, 3=FIN, 4(??)
                    // Layout: |0000|COD_VER|COD_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|IM|SUFRAMA|IND_PERFIL|IND_ATIV|
                    // SPED FISCAL (EFD ICMS IPI):
                    // |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ...
                    // Indices: 6 e 7?
                    // Vamos verificar o índice nas parts:
                    // 0: ""
                    // 1: "0000"
                    // 2: "015" (COD_VER)
                    // 3: "0" (COD_FIN)
                    // 4: DT_INI ?
                    // 5: DT_FIN ?
                    // 6: NOME ?
                    // 7: CNPJ ?

                    // Conferindo com código anterior (UnificacaoService:37):
                    // const dtIni = parts[6]; // NÃO. Em UnificacaoService:37 era parts[4]?
                    // Vamos olhar UnificacaoService atual.
                    // AnalisarCenario (Line 40-41): 
                    // const dtIni = parts[6];
                    // const dtFin = parts[7];

                    // Se AnalisarCenario usou 6/7 e funcionou, então é EFD Contribuições ou Layout diferente?
                    // EFD Contribuições 0000:
                    // 04: DT_INI
                    // 05: DT_FIN
                    // EFD ICMS/IPI 0000:
                    // 04: DT_INI
                    // 05: DT_FIN

                    // Por que no AnalisarCenario (step 538 da user request) o diff mostra:
                    // - const dtIni = parts[4];
                    // + const dtIni = parts[6];
                    // Se o user alterou para 6, deve ser layout novo?

                    // No step 538 user code:
                    // const dtIni = parts[6];

                    // Entao vou usar 6 e 7.
                    if (minIni && maxFin) {
                        parts[6] = minIni;
                        parts[7] = maxFin;
                        const newLine = parts.join('|');
                        await UnificacaoService.writeLine(writer, newLine, state);
                    } else {
                        await UnificacaoService.writeLine(writer, line, state);
                    }
                } else {
                    if (reg === '0140' || reg === '0990') break;
                    await UnificacaoService.writeLine(writer, line, state);
                }
            }
        }

        // Preparar lista hierárquica
        const estabelecimentos = [];
        estabelecimentos.push(contexto.matriz);
        for (const f of contexto.filiais.values()) estabelecimentos.push(f);

        // Buffer Global para 0500 e 0600 (Dedup)
        const global0500 = new Map<string, string>(); // COD_CTA -> Line
        const global0600 = new Map<string, string>(); // COD_CCUS -> Line

        // 2. Loop de Estabelecimentos (0140) com Contexto + Bufferização
        for (const est of estabelecimentos) {

            // Buckets para ordenar registros deste estabelecimento
            // Mapa: '0150' -> Set(linhas), '0200' -> Set(linhas)
            const bucketsLocal = new Map<string, Set<string>>();
            const idsLocais = new Map<string, Set<string>>(); // Reg -> Set<CODIGO>

            // Flag de controle: Escrever o 0140 apenas uma vez
            let wrote0140 = false;
            let line0140 = '';

            for (const arq of est.arquivos) {
                const obj = await bucket.get(arq.key);
                if (!obj) continue;

                // Stream processing com filtro de bloco '0'
                const stream = obj.body
                    .pipeThrough(new TextDecoderStream('latin1'))
                    .pipeThrough(new LineSplitter())
                    .pipeThrough(new SpedBlockFilter('0'));

                const reader = stream.getReader();

                while (true) {
                    const { done, value: line } = await reader.read();
                    if (done) break;
                    if (line) {
                        const reg = line.split('|')[1];

                        // Captura 0500 Globalmente
                        if (reg === '0500') {
                            const parts = line.split('|');
                            // |0500|DT_ALT|COD_NAT_CC|IND_CTA|NIVEL|COD_CTA|...
                            // Indice 6 é COD_CTA
                            const codCta = parts[6];
                            if (codCta && !global0500.has(codCta)) {
                                global0500.set(codCta, line);
                            }
                            continue; // Não processa como local
                        }

                        // Captura 0600 Globalmente
                        if (reg === '0600') {
                            const parts = line.split('|');
                            // |0600|DT_ALT|COD_CCUS|...
                            // Indice 3 é COD_CCUS
                            const codCcus = parts[3];
                            if (codCcus && !global0600.has(codCcus)) {
                                global0600.set(codCcus, line);
                            }
                            continue; // Não processa como local
                        }

                        if (reg === '0140') {
                            if (!wrote0140) {
                                line0140 = line;
                                wrote0140 = true;
                            }
                        } else if (REGS_LOCAIS.includes(reg)) {
                            // Deduplicação Lógica (0150, 0190, 0200...) perante o Estabelecimento
                            // Índice 2 geralmente é o Código (COD_PART, COD_ITEM, UNID, COD_NAT, etc)
                            const parts = line.split('|');
                            const idLocal = parts[2];

                            if (idLocal) {
                                if (!idsLocais.has(reg)) idsLocais.set(reg, new Set());

                                if (!idsLocais.get(reg)!.has(idLocal)) {
                                    idsLocais.get(reg)!.add(idLocal);

                                    if (!bucketsLocal.has(reg)) bucketsLocal.set(reg, new Set());
                                    bucketsLocal.get(reg)!.add(line);
                                }
                            } else {
                                // Fallback: Dedup textual simples
                                if (!bucketsLocal.has(reg)) bucketsLocal.set(reg, new Set());
                                bucketsLocal.get(reg)!.add(line);
                            }
                        }
                    }
                }
            }

            // Flush do Estabelecimento Atual (0140 + Locais)
            if (wrote0140) {
                await UnificacaoService.writeLine(writer, line0140, state);

                for (const r of REGS_LOCAIS) {
                    if (bucketsLocal.has(r)) {
                        for (const l of bucketsLocal.get(r)!) {
                            await UnificacaoService.writeLine(writer, l, state);
                        }
                    }
                }
            }

        } // Fim Loop Estabelecimentos

        // 3. Flush Global de 0500 e 0600 (Pós-Estabelecimentos, antes de 0990)
        // Segundo Guia Prático, 0500 e 0600 vêm DEPOIS de 0140/0150/0200?
        // Layout: 0000... 0140... 0150... 0200... 0400... 0500... 0600... 0990
        // Como escrevemos 0140+Locais primeiro, 0500 vira "Append".
        // Isso é aceitável, pois 0500 tecnicamente pode estar solto ou vinculado.
        // Mas a ordem estrita do SPED é bloco único sequencial.
        // Se escrevermos:
        // Est1 (0140, 0150, 0200)
        // Est2 (0140, 0150, 0200)
        // Global (0500, 0600)
        // Isso é válido?
        // Sim, 0500 e 0600 são tabelas globais. Não são filhos de 0140.
        // Eles devem aparecer no nível 2.

        for (const line of global0500.values()) {
            await UnificacaoService.writeLine(writer, line, state);
        }
        for (const line of global0600.values()) {
            await UnificacaoService.writeLine(writer, line, state);
        }


        // CÁLCULO TOTAL BLOCO 0 (0990)
        let countB0 = 0;
        for (const [reg, qtd] of state.registrosCount.entries()) {
            if (reg.startsWith('0')) {
                countB0 += qtd;
            }
        }
        countB0++; // Inclui o próprio 0990 (ainda não contabilizado no loop acima)

        await UnificacaoService.writeLine(writer, `|0990|${countB0}|`, state);
    }


    private static async streamBlocoGlobal(bucket: R2Bucket, estabelecimentos: EstabelecimentoUnificacao[], blocoChar: string, writer: WritableStreamDefaultWriter, state: SpedUnificationState) {

        const temDados = state.blocosComDados.has(blocoChar);
        const indMov = temDados ? '0' : '1';
        let countLocal = 0;

        await UnificacaoService.writeLine(writer, `|${blocoChar}001|${indMov}|`, state);
        countLocal++;

        const regHeader = `|${blocoChar}010|`;

        for (const est of estabelecimentos) {
            let header010Escrito = false;

            // BUFFERIZAÇÃO ESTRATÉGICA PARA O BLOCO C
            const isBlocoC = (blocoChar === 'C');
            const bufferC = {
                C1: [] as string[], // NFe (01, 55)
                C3: [] as string[], // Nota Avulsa
                C4: [] as string[], // ECF (2D)
                C8: [] as string[], // SAT (59)
                Outros: [] as string[]
            };

            for (const arq of est.arquivos) {
                const obj = await bucket.get(arq.key);
                if (!obj) continue;

                const stream = obj.body
                    .pipeThrough(new TextDecoderStream('latin1'))
                    .pipeThrough(new LineSplitter())
                    .pipeThrough(new SpedBlockFilter(blocoChar));

                const reader = stream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        if (value.startsWith(regHeader)) {
                            if (!header010Escrito) {
                                await UnificacaoService.writeLine(writer, value, state);
                                countLocal++;
                                header010Escrito = true;
                            }
                        } else {
                            if (isBlocoC) {
                                const reg = value.substring(1, 5); // Ex: C100
                                if (reg.startsWith('C1')) bufferC.C1.push(value);
                                else if (reg.startsWith('C3')) bufferC.C3.push(value);
                                else if (reg.startsWith('C4')) bufferC.C4.push(value);
                                else if (reg.startsWith('C8')) bufferC.C8.push(value);
                                else bufferC.Outros.push(value);
                            } else {
                                await UnificacaoService.writeLine(writer, value, state);
                                countLocal++;
                            }
                        }
                    }
                }
            }

            if (isBlocoC) {
                const grupos = [bufferC.C1, bufferC.C3, bufferC.C4, bufferC.C8, bufferC.Outros];
                for (const grupo of grupos) {
                    for (const line of grupo) {
                        await UnificacaoService.writeLine(writer, line, state);
                        countLocal++;
                    }
                }
            }
        } // Fim if (temDados)

        countLocal++;
        await UnificacaoService.writeLine(writer, `|${blocoChar}990|${countLocal}|`, state);
    }

    private static async streamCalculatedBlocks(writer: WritableStreamDefaultWriter, state: SpedUnificationState) {
        const somaM = state.somaM as unknown as Record<string, number[]>;

        let countM = 0;
        const temM = Object.keys(somaM).length > 0;
        const indMovM = temM ? '0' : '1';

        await UnificacaoService.writeLine(writer, `|M001|${indMovM}|`, state);
        countM++;

        if (temM) {
            // CORREÇÃO: Ordenar chaves para garantir hierarquia (M100 < M200 < M400...)
            const keysSorted = Object.keys(somaM).sort();

            for (const key of keysSorted) {
                // Se for filho (M410/M810), pula (pois será processado pelo pai)
                if (key.startsWith('M410') || key.startsWith('M810')) continue;

                const values = somaM[key];
                const parts = key.split('|');
                const reg = parts[0];
                const valoresFmt = values.map(v => v.toFixed(2).replace('.', ',')).join('|');

                let line = '';

                // Formatação Genérica ou Específica
                // M400/M800: |REG|CST|VALOR|COD|DESC| (conforme observado no código anterior)
                if (['M400', 'M800'].includes(reg)) {
                    const keyData = parts.slice(1);
                    const cst = keyData[0] || '';
                    const cod = keyData[1] || '';
                    const desc = keyData[2] || '';
                    const valor = valoresFmt;

                    line = `|${reg}|${cst}|${valor}|${cod}|${desc}|`;
                } else {
                    const restoChave = parts.slice(1).join('|');
                    const prefixo = restoChave ? `${reg}|${restoChave}` : `${reg}`;
                    line = `|${prefixo}|${valoresFmt}|`;
                }

                await UnificacaoService.writeLine(writer, line, state);
                countM++;

                // Processar Filhos Hierarquicamente
                if (reg === 'M400' || reg === 'M800') {
                    const childReg = (reg === 'M400') ? 'M410' : 'M810';
                    const parentKeySuffix = parts.slice(1).join('|'); // Key pura do pai

                    // Encontrar chaves filhas que tenham o prefixo 'M410|PARENT_KEY|'
                    // Formato gravado no Scanner: M410|PARENT_KEY|CHILD_KEY
                    const childPrefix = `${childReg}|${parentKeySuffix}|`;

                    const childKeys = keysSorted.filter(k => k.startsWith(childPrefix));

                    for (const ck of childKeys) {
                        const cValores = somaM[ck];
                        const cValoresFmt = cValores.map(v => v.toFixed(2).replace('.', ',')).join('|');
                        const cParts = ck.split('|');

                        // Parse da Chave M410/M810
                        // Indices: 0=REG, 1..3=ParentKey (3 partes), 4..6=ChildKey (3 partes)
                        // Ajustar slice conforme tamanho da chave pai.
                        // Key pai tem 3 partes? (CST, COD, DESC). Sim, config [2,4,5].
                        // Entao slice(4) pega a ChildKey.
                        const childKeyData = cParts.slice(4);

                        const nat = childKeyData[0] || '';
                        const cod = childKeyData[1] || '';
                        const desc = childKeyData[2] || '';

                        // Layout M410: |M410|NAT_REC|VL_REC|COD_CTA|DESC_COMPL|
                        const cLine = `|${childReg}|${nat}|${cValoresFmt}|${cod}|${desc}|`;

                        await UnificacaoService.writeLine(writer, cLine, state);
                        countM++;
                    }
                }
            }
        }
        countM++;
        await UnificacaoService.writeLine(writer, `|M990|${countM}|`, state);
    }

    private static async streamBloco9(writer: WritableStreamDefaultWriter, state: SpedUnificationState) {

        state.registrosCount.set('9001', 1);
        state.registrosCount.set('9990', 1);
        state.registrosCount.set('9999', 1);

        const qtdTiposRegistros = state.registrosCount.size;
        const linhas9900 = qtdTiposRegistros + 1;
        state.registrosCount.set('9900', linhas9900);

        let count9 = 0;

        await UnificacaoService.writeLine(writer, '|9001|0|', state);
        count9++;

        const regs = Array.from(state.registrosCount.keys()).sort();

        for (const reg of regs) {
            const qtd = state.registrosCount.get(reg);
            await UnificacaoService.writeLine(writer, `|9900|${reg}|${qtd}|`, state);
            count9++;
        }

        count9++;
        await UnificacaoService.writeLine(writer, `|9990|${count9 + 1}|`, state);

        await UnificacaoService.writeLine(writer, `|9999|${state.totalLinhas + 1}|`, state);
    }
}
