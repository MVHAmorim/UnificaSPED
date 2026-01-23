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

    // NOVO: Analisar Cenário (Dispatcher)
    static async analisarCenario(bucket: R2Bucket, keys: string[]): Promise<Map<string, ContextoCompetencia>> {
        const contextos = new Map<string, ContextoCompetencia>();

        for (const key of keys) {
            const obj = await bucket.get(key);
            if (!obj) continue;

            // Ler apenas o header (0000)
            const reader = obj.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();
            const { value: line } = await reader.read();
            reader.cancel();

            if (!line) continue;

            const parts = line.split('|');
            if (parts[1] !== '0000') continue;

            const dtIni = parts[4]; // DDMMAAAA
            const dtFin = parts[5];
            const cnpj = parts[9];

            if (!dtIni || !cnpj) continue;

            // Chave de Competência: MMAAAA + CNPJ_BASE (8 digitos)
            const mesAno = dtIni.substring(2, 8); // DDMMAAAA -> MMAAAA
            const cnpjBase = cnpj.substring(0, 8);
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
            const cnpjClean = cnpj.replace(/\D/g, '');
            const isMatriz = cnpjClean.endsWith('0001'); // Simplificação MVP

            // Metadados do Arquivo
            const meta: ArquivoSpedMetadata = {
                key,
                cnpj: cnpjClean,
                dtIni,
                dtFin,
                isMatriz
            };

            // Agrupar por Estabelecimento
            // Matriz é tratada como um Estabelecimento especial + Flag
            if (isMatriz) {
                if (!ctx.matriz) {
                    ctx.matriz = {
                        cnpj: cnpjClean,
                        isMatriz: true,
                        arquivos: [],
                        periodoConsolidado: { dtIni, dtFin }
                    };
                }
                ctx.matriz.arquivos.push(meta);
                // Expandir periodo se necessario (Min/Max)
                // MVP: Assumindo que o usuario manda arquivos coerentes
            } else {
                if (!ctx.filiais.has(cnpjClean)) {
                    ctx.filiais.set(cnpjClean, {
                        cnpj: cnpjClean,
                        isMatriz: false,
                        arquivos: [],
                        periodoConsolidado: { dtIni, dtFin }
                    });
                }
                ctx.filiais.get(cnpjClean)!.arquivos.push(meta);
            }
        }

        return contextos;
    }

    // SIGNATURE ALTERADA: Recebe Contexto
    static async unificar(bucket: R2Bucket, contexto: ContextoCompetencia): Promise<ReadableStream> {
        const state = createInitialState();

        // Coletar todos os arquivos do contexto para o Pre-Scan
        const estabelecimentos = [];
        if (contexto.matriz) estabelecimentos.push(contexto.matriz);
        estabelecimentos.push(...contexto.filiais.values());

        const allKeys: string[] = [];
        let matrizKey = '';

        for (const est of estabelecimentos) {
            for (const arq of est.arquivos) {
                allKeys.push(arq.key);
                if (est.isMatriz && !matrizKey) matrizKey = arq.key; // Pega o primeiro da matriz como referencia
            }
        }

        if (!contexto.matriz || !matrizKey) {
            throw new Error("Matriz não encontrada no contexto de unificação.");
        }

        // PASSO 1: Pre-Scan (Iterar sobre chaves puras funciona, pois o estado é global)
        for (const key of allKeys) {
            const obj = await bucket.get(key);
            if (!obj) continue;
            // isMatriz flag apenas indica se é o arquivo MESTRE de estrutura? 
            // Para Agregação (PreScanner), tanto faz se é matriz ou filial, ele soma tudo.
            // A flag isMatriz no Scan serve apenas para logs ou regras especificas?
            // No scanner atual: "isMatriz" não é usado na lógica de soma, apenas passada.
            await SpedPreScanner.scan(obj.body, state, key === matrizKey);
        }

        // PASSO 2: Output Stream
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
            try {
                // 1. Bloco 0 (Hierarquia: Matriz Header -> 0140s de todos)
                await UnificacaoService.streamBloco0Unificado(bucket, contexto, writer, state);

                // 2. Blocos Ordenados (Iterar por estabelecimentos)
                for (const bloco of BLOCO_ORDER) {
                    await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, bloco, writer, state);
                }

                // 3. Blocos Calculados (M)
                await UnificacaoService.streamCalculatedBlocks(writer, state);

                // 3.1 Bloco P (Após M) - AGORA USANDO A LISTA DE ESTABELECIMENTOS
                await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, 'P', writer, state);

                // 4. Bloco 1
                await UnificacaoService.streamBlocoGlobal(bucket, estabelecimentos, '1', writer, state);

                // 5. Bloco 9
                await UnificacaoService.streamBloco9(writer, state);

                await writer.close();

            } catch (err) {
                console.error("Erro no stream de unificação:", err);
                await writer.abort(err);
            }
        })();

        return readable;
    }

    // Helper de escrita que atualiza contadores
    private static async writeLine(writer: WritableStreamDefaultWriter, line: string, state: SpedUnificationState) {
        // Incrementa total
        state.totalLinhas++;

        // Incrementa por registro
        const parts = line.split('|');
        if (parts.length > 1) {
            const reg = parts[1];
            const current = state.registrosCount.get(reg) || 0;
            state.registrosCount.set(reg, current + 1);
        }

        // ENCODE MANUAL LATIN1
        const buffer = encodeLatin1(line + '\r\n');
        await writer.write(buffer);
    }

    private static async streamBloco0Unificado(bucket: R2Bucket, contexto: ContextoCompetencia, writer: WritableStreamDefaultWriter, state: SpedUnificationState) {
        const REGS_LOCAIS = ['0150', '0190', '0200', '0400', '0450', '0460'];
        const REGS_GLOBAIS = ['0500', '0600'];

        if (!contexto.matriz || contexto.matriz.arquivos.length === 0) return;

        // 1. Header da Matriz (0000 até 0110 - antes de 0140)
        // Usa o PRIMEIRO arquivo da Matriz como base do Header
        const arqMatriz = contexto.matriz.arquivos[0];
        const objMatriz = await bucket.get(arqMatriz.key);

        if (objMatriz) {
            const reader = objMatriz.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();
            while (true) {
                const { done, value: line } = await reader.read();
                if (done) break;
                if (!line) continue;

                const reg = line.split('|')[1];
                if (reg === '0140' || reg === '0990') break;

                // TODO: Atualizar DT_INI/DT_FIN no 0000 com contexto.matriz.periodoConsolidado? 
                // MVP: Mantem file original
                await UnificacaoService.writeLine(writer, line, state);
            }
        }

        // Preparar lista hierárquica (Matriz primeiro, depois Filiais)
        const estabelecimentos = [];
        estabelecimentos.push(contexto.matriz);
        estabelecimentos.push(...contexto.filiais.values());

        // 2. Loop de Estabelecimentos (0140) + Cadastros Locais
        for (const est of estabelecimentos) {
            // Para cada estabelecimento, processa seus arquivos em ordem (ex: 01-15, 16-30)
            const localDedup = new Set<string>();

            let isFirstFileOfEst = true;

            for (const arq of est.arquivos) {
                const obj = await bucket.get(arq.key);
                if (!obj) continue;

                const reader = obj.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();

                while (true) {
                    const { done, value: line } = await reader.read();
                    if (done) break;
                    if (!line) continue;

                    const parts = line.split('|');
                    const reg = parts[1];

                    if (reg === '0990') break;
                    if (reg && ['A', 'C', 'D', 'F', 'I', 'M', 'P', '1', '9'].includes(reg.charAt(0))) break;

                    if (reg === '0140') {
                        // Só escreve 0140 uma vez por estabelecimento (do primeiro arquivo)
                        // Assumindo que os dados cadastrais da filial não mudam no mês
                        if (isFirstFileOfEst) {
                            await UnificacaoService.writeLine(writer, line, state);
                            isFirstFileOfEst = false;
                        }
                        continue;
                    }

                    if (REGS_LOCAIS.includes(reg)) {
                        const codigo = parts[2];
                        const chaveDedup = `${reg}|${codigo}`;

                        if (!localDedup.has(chaveDedup)) {
                            localDedup.add(chaveDedup);
                            await UnificacaoService.writeLine(writer, line, state);
                        }
                    }
                }
            }
        }

        // 3. Cadastros Globais (Iterar tudo novamente?)
        // Sim, para garantir correta ordem.
        for (const est of estabelecimentos) {
            for (const arq of est.arquivos) {
                const obj = await bucket.get(arq.key);
                if (!obj) continue;
                const reader = obj.body.pipeThrough(new TextDecoderStream('latin1')).pipeThrough(new LineSplitter()).getReader();

                while (true) {
                    const { done, value: line } = await reader.read();
                    if (done) break;
                    if (!line) continue;
                    const parts = line.split('|');
                    const reg = parts[1];
                    if (reg === '0990') break;

                    if (REGS_GLOBAIS.includes(reg)) {
                        const codigo = parts[2];
                        const chaveDedup = `${reg}|${codigo}`;
                        if (!state.idsCadastros.has(chaveDedup)) {
                            state.idsCadastros.add(chaveDedup);
                            await UnificacaoService.writeLine(writer, line, state);
                        }
                    }
                }
            }
        }

        // 4. Fechamento Bloco 0
        let countB0 = 0;
        state.registrosCount.forEach((v, k) => {
            if (k.startsWith('0')) countB0 += v;
        });
        countB0++;

        await UnificacaoService.writeLine(writer, `|0990|${countB0}|`, state);
    }

    // Adaptado para aceitar lista de Estabelecimentos
    private static async streamBlocoGlobal(bucket: R2Bucket, estabelecimentos: EstabelecimentoUnificacao[], blocoChar: string, writer: WritableStreamDefaultWriter, state: SpedUnificationState) {

        const temDados = state.blocosComDados.has(blocoChar);
        const indMov = temDados ? '0' : '1';
        let countLocal = 0;

        await UnificacaoService.writeLine(writer, `|${blocoChar}001|${indMov}|`, state);
        countLocal++;

        if (temDados) {
            for (const est of estabelecimentos) {
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
                            await UnificacaoService.writeLine(writer, value, state);
                            countLocal++;
                        }
                    }
                }
            }
        }

        countLocal++;
        await UnificacaoService.writeLine(writer, `|${blocoChar}990|${countLocal}|`, state);
    }

    private static async streamCalculatedBlocks(writer: WritableStreamDefaultWriter, state: SpedUnificationState) {
        const somaM = state.somaM as unknown as Record<string, number[]>;
        const somaP = state.somaP as unknown as Record<string, number[]>;

        // M
        let countM = 0;
        const temM = Object.keys(somaM).length > 0;
        const indMovM = temM ? '0' : '1';

        await UnificacaoService.writeLine(writer, `|M001|${indMovM}|`, state);
        countM++;

        if (temM) {
            for (const [key, values] of Object.entries(somaM)) {
                const parts = key.split('|');
                const reg = parts[0];
                const valoresFmt = values.map(v => v.toFixed(2).replace('.', ',')).join('|');

                let line = '';
                // Custom formatting for interleaved Key/Value blocks
                if (['M400', 'M410', 'M800', 'M810'].includes(reg)) {
                    const keyData = parts.slice(1); // [CST, COD, DESC]
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
            }
        }
        countM++;
        await UnificacaoService.writeLine(writer, `|M990|${countM}|`, state);
    }

    private static async streamBloco9(writer: WritableStreamDefaultWriter, state: SpedUnificationState) {

        state.registrosCount.set('9001', 1);
        state.registrosCount.set('9990', 1);
        state.registrosCount.set('9999', 1);

        const qtdTiposRegistros = state.registrosCount.size; // Já inclui 9001, 9990, 9999 e 9900 (porque size conta chaves)
        // Oops, 9900 não está no map ainda.
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
