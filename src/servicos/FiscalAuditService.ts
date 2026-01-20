import { RelatorioAuditoria, ItemDivergencia, NotaFiscalShort, ResumoImpacto } from "../dominios/fisco/types";
import { LineSplitter } from "../utils/streams";

export class FiscalAuditService {

    // CFOPs que indicam movimentação de estoque (Compra/Venda de mercadorias)
    // Lista simplificada para exemplo
    private static readonly CFOPS_ESTOQUE = new Set([
        '1101', '1102', '1201', '1202', '2101', '2102', '2201', '2202',
        '5101', '5102', '5201', '5202', '6101', '6102', '6201', '6202'
    ]);

    static async processarAuditoria(
        file: File,
        r2Bucket: R2Bucket,
        cnpjProjeto: string,
        usuarioEmail: string,
        idProjeto: string
    ): Promise<RelatorioAuditoria> {

        // 1. Parse SPED (Streaming)
        const mapaSped = await this.parseSpedBlockC100(file);

        const divergencias: ItemDivergencia[] = [];
        const resumo: ResumoImpacto = {
            totalSobrasXml: 0,
            totalSobrasSped: 0,
            totalCreditoIcmsPotencial: 0,
            valorTotalOperacoes: 0,
            estimativaMulta: 0
        };

        // 2. Varrer R2 (Arquivos XML)
        const prefixo = `${cnpjProjeto}/inbound/`; // Assumindo pasta inbound
        let cursor: string | undefined;

        console.log(`[Audit] Iniciando varredura no R2: ${prefixo}`);

        do {
            // Listagem paginada
            const lista = await r2Bucket.list({ prefix: prefixo, cursor, limit: 1000 });
            cursor = lista.truncated ? lista.cursor : undefined;

            for (const obj of lista.objects) {
                // Ignorar arquivos que não pareçam XML de NFe
                if (!obj.key.toLowerCase().endsWith('.xml')) continue;

                // Tentar extrair dados dos metadados customizados (se existirem) 
                // ou do nome do arquivo (se tiver padrão) ou baixando o arquivo.
                // Ordem: Custom Metadata -> Parse Content

                let nfR2: Partial<NotaFiscalShort> | null = null;

                try {
                    nfR2 = await this.extrairDadosXml(obj, r2Bucket);
                } catch (e) {
                    console.warn(`[Audit] Falha ao ler XML ${obj.key}:`, e);
                    continue;
                }

                if (!nfR2 || !nfR2.chave) continue; // Não conseguiu identificar essa nota

                // Match
                const noSped = mapaSped.get(nfR2.chave);

                if (noSped) {
                    noSped.validado = true;
                    // Futuro: Comparar valores (DIVERGENCIA_VALOR)
                } else {
                    // SOBRA_XML
                    divergencias.push({
                        tipo: 'SOBRA_XML',
                        chaveAcesso: nfR2.chave,
                        serie: nfR2.serie,
                        numero: nfR2.numero,
                        valorTotal: nfR2.vlTotal,
                        valorIcms: nfR2.vlIcms,
                        descricao: `XML encontrado no R2 mas não escriturado no SPED`,
                        afetaEstoque: false // Sem CFOP seguro no XML de fácil acesso (tem que parsear item)
                    });

                    resumo.totalSobrasXml++;
                    resumo.totalCreditoIcmsPotencial += (nfR2.vlIcms || 0);
                    resumo.valorTotalOperacoes += (nfR2.vlTotal || 0);
                }
            }

        } while (cursor);

        // 3. Sobras SPED (O que estava no Map e não foi validado)
        for (const nota of mapaSped.values()) {
            if (!nota.validado) {
                const afeta = this.CFOPS_ESTOQUE.has(nota.cfop || '');
                divergencias.push({
                    tipo: 'SOBRA_SPED',
                    chaveAcesso: nota.chave,
                    serie: nota.serie,
                    numero: nota.numero,
                    modelo: nota.modelo,
                    dataEmissao: nota.dtEmi,
                    valorTotal: nota.vlTotal,
                    valorIcms: nota.vlIcms,
                    cfop: nota.cfop,
                    afetaEstoque: afeta,
                    descricao: `Nota ${nota.numero} (Série ${nota.serie}) no SPED sem XML correspondente`
                });
                resumo.totalSobrasSped++;
                if (afeta) {
                    // Multa ou risco maior
                }
            }
        }

        // 4. Quebra de Sequência (Opcional - implementação simplificada)
        // Agrupar por Série e Model, verificar buracos.
        // (Deixado para V2 ou se der tempo, focar em persistência agora)

        // Calcular multa estimada (ex: 1% sobre operações não escrituradas ou com problemas)
        resumo.estimativaMulta = resumo.valorTotalOperacoes * 0.01;

        // 5. Montar Relatório
        const idAuditoria = crypto.randomUUID();
        const dataAgora = new Date().toISOString();

        const relatorio: RelatorioAuditoria = {
            idAuditoria,
            idProjeto,
            dataAuditoria: dataAgora,
            arquivoSped: file.name,
            usuarioResponsavel: usuarioEmail,
            divergencias,
            resumo
        };

        // 6. Persistir no R2
        const jsonContent = JSON.stringify(relatorio, null, 2);
        const reportKey = `${cnpjProjeto}/auditorias/${dataAgora}_relatorio.json`;

        await r2Bucket.put(reportKey, jsonContent, {
            httpMetadata: {
                contentType: 'application/json'
            }
        });

        console.log(`[Audit] Relatório gerado e salvo: ${reportKey}`);

        return relatorio;
    }

    // --- Helpers ---

    private static async parseSpedBlockC100(file: File): Promise<Map<string, NotaFiscalShort>> {
        const map = new Map<string, NotaFiscalShort>();

        // Stream do arquivo
        const textStream = file.stream().pipeThrough(new TextDecoderStream());
        const lines = textStream.pipeThrough(new LineSplitter());
        const reader = lines.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const line = value;
            if (!line) continue;

            // Verificação rápida se é C100
            if (line.startsWith('|C100|')) {
                const parts = line.split('|');
                // Layout resumido:
                // 1: REG, 5: COD_MOD, 6: COD_SIT, 7: SER, 8: NUM_DOC, 9: CHV_NFE
                // 10: DT_DOC, 12: VL_DOC, 22: VL_ICMS (varia conforme versão, assumindo posição comum ou buscando)

                const reg = parts[1];
                const codSit = parts[6]; // 00 = Regular, banir cancelados (02, 03, etc)?
                // Vamos focar nos Regulares (00) ou Extemporâneos (01)

                if (codSit !== '00' && codSit !== '01') continue;

                const modelo = parts[5];
                // C100 refere-se a NF (01), NFe (55), NFCe (65)...

                const chave = parts[9];
                const serie = parts[7];
                const numero = parseInt(parts[8]);
                const dtEmiStr = parts[10]; // DDMMAAAA
                const vlTotal = this.parseDecimal(parts[12]);
                const vlIcms = this.parseDecimal(parts[22]); // Verificar index exato depois

                // Melhor chave de mapa: CHAVE NFE se tiver, senão SERIE+NUM+MOD
                const mapKey = chave && chave.length === 44 ? chave : `${modelo}|${serie}|${numero}`;

                map.set(mapKey, {
                    chave,
                    serie,
                    numero,
                    modelo,
                    dtEmi: this.parseSpedDate(dtEmiStr),
                    vlTotal,
                    vlIcms,
                    origem: 'SPED',
                    validado: false,
                    cfop: '' // C100 não tem CFOP, tem nos filhos C170/C190. 
                    // Simplificação: Se precisar de CFOP, teria que ler C190 logo abaixo.
                    // POR ENQUANTO: Deixar vazio ou implementar leitura de estado mini-machine.
                });
            }
            // TODO (Melhoria): Ler C190 para pegar CFOP predominante?
            // Para "afetaEstoque", vamos assumir false se não lermos os itens, 
            // ou deixar para V2 a leitura dos filhos.
        }

        return map;
    }

    private static async extrairDadosR2(obj: any): Promise<any> {
        // ... (Implementado dentro do loop principal via extrairDadosXml)
        return null;
    }

    private static async extrairDadosXml(obj: R2Object, bucket: R2Bucket): Promise<Partial<NotaFiscalShort>> {
        // Tentar metadata primeiro
        if (obj.customMetadata && obj.customMetadata['nNF']) {
            return {
                chave: obj.customMetadata['chNFe'],
                numero: parseInt(obj.customMetadata['nNF'] || '0'),
                serie: obj.customMetadata['serie'],
                vlTotal: parseFloat(obj.customMetadata['vNF'] || '0'),
                vlIcms: parseFloat(obj.customMetadata['vICMS'] || '0')
            };
        }

        // Fallback: Baixar e parsear regex
        const bodyObj = await bucket.get(obj.key);
        if (!bodyObj) return {};

        const text = await bodyObj.text();

        // Regex de extração rápida
        const chNFe = this.extractTag(text, 'chNFe');
        const nNF = this.extractTag(text, 'nNF');
        const serie = this.extractTag(text, 'serie');
        const vNF = this.extractTag(text, 'vNF');

        // vICMS geralmente está dentro de <ICMSTot>
        // Regex um pouco mais esperta pra pegar o bloco total, ou pegar o primeiro vICMS solto (perigoso)
        // Tentativa segura: Buscar <ICMSTot>...<vICMS>...
        const icmsMatch = text.match(/<ICMSTot>[\s\S]*?<vICMS>(.*?)<\/vICMS>/);
        const vICMS = icmsMatch ? icmsMatch[1] : '0.00';

        return {
            chave: chNFe,
            numero: parseInt(nNF || '0'),
            serie: serie || '',
            vlTotal: parseFloat(vNF || '0'),
            vlIcms: parseFloat(vICMS || '0')
        };
    }

    private static extractTag(xml: string, tag: string): string | undefined {
        const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`);
        const match = xml.match(regex);
        return match ? match[1] : undefined;
    }

    private static parseDecimal(str: string): number {
        if (!str) return 0;
        return parseFloat(str.replace(',', '.'));
    }

    private static parseSpedDate(str: string): Date {
        if (!str || str.length !== 8) return new Date();
        const dia = parseInt(str.slice(0, 2));
        const mes = parseInt(str.slice(2, 4));
        const ano = parseInt(str.slice(4, 8));
        return new Date(ano, mes - 1, dia);
    }
}
