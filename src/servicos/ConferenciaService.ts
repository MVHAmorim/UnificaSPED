import { RelatorioConferencia, ItemDivergencia, NotaFiscalShort, ResumoImpacto } from "../dominios/fisco/types";
import { LineSplitter } from "../utils/streams";

export class ConferenciaService {

    // Simplificação: CFOPS_ESTOQUE removido.
    // Todas as sobras de XML são consideradas potencial crédito.

    static async processarConferencia(
        file: File,
        r2Bucket: R2Bucket,
        cnpjProjeto: string,
        usuarioEmail: string,
        idProjeto: string
    ): Promise<RelatorioConferencia> {

        // 1. Parse SPED (Streaming)
        // Lógica simplificada: Apenas extraímos chaves e valores básicos.
        const mapaSped = await this.parseSpedBlockC100(file);

        const divergencias: ItemDivergencia[] = [];
        const resumo: ResumoImpacto = {
            totalSobrasXml: 0,
            totalSobrasSped: 0,
            totalCreditoIcmsPotencial: 0,
            valorTotalOperacoes: 0,
            estimativaMulta: 0 // Mantido como possível kpi, mas simplificado
        };

        // 2. Varrer R2 (Arquivos XML)
        const prefixo = `${cnpjProjeto}/inbound/`;
        let cursor: string | undefined;

        console.log(`[Conferencia] Iniciando conferência simplificada no R2: ${prefixo}`);

        do {
            const lista = await r2Bucket.list({ prefix: prefixo, cursor, limit: 1000 });
            cursor = lista.truncated ? lista.cursor : undefined;

            for (const obj of lista.objects) {
                if (!obj.key.toLowerCase().endsWith('.xml')) continue;

                let nfR2: Partial<NotaFiscalShort> | null = null;

                try {
                    nfR2 = await this.extrairDadosXml(obj, r2Bucket);
                } catch (e) {
                    // Ignora erro de leitura silenciosamente ou loga se necessário
                    continue;
                }

                if (!nfR2 || !nfR2.chave) continue;

                // Match
                const noSped = mapaSped.get(nfR2.chave);

                if (noSped) {
                    noSped.validado = true;
                } else {
                    // SOBRA_XML (Existe no XML, mas não no SPED)
                    // Pela nova regra: Consideramos TODO XML excedente como potencial crédito
                    divergencias.push({
                        tipo: 'SOBRA_XML',
                        chaveAcesso: nfR2.chave,
                        serie: nfR2.serie,
                        numero: nfR2.numero,
                        valorTotal: nfR2.vlTotal,
                        valorIcms: nfR2.vlIcms,
                        descricao: `XML no R2 ausente na escrituração SPED`,
                    });

                    resumo.totalSobrasXml++;
                    resumo.totalCreditoIcmsPotencial += (nfR2.vlIcms || 0);
                    // Não somamos operations total aqui para multas, pois a multa geralmente é sobre o que falta no XML, mas a regra do usuário pediu apenas "Escriturado sem XML" para o quadro vermelho (outro KPI).
                }
            }

        } while (cursor);

        // 3. Sobras SPED (Existe no SPED, não no R2)
        for (const nota of mapaSped.values()) {
            if (!nota.validado) {
                divergencias.push({
                    tipo: 'SOBRA_SPED',
                    chaveAcesso: nota.chave,
                    serie: nota.serie,
                    numero: nota.numero,
                    modelo: nota.modelo,
                    dataEmissao: nota.dtEmi,
                    valorTotal: nota.vlTotal,
                    valorIcms: nota.vlIcms,
                    descricao: `Documento ${nota.numero} no SPED sem arquivo XML`
                });
                resumo.totalSobrasSped++;
                resumo.valorTotalOperacoes += (nota.vlTotal || 0);
            }
        }

        // 4. Estimativa de Multa (Simplificada sobre o volume de operações sem XML)
        resumo.estimativaMulta = resumo.valorTotalOperacoes * 0.01;

        // 5. Montar Relatório
        const idConferencia = crypto.randomUUID();
        const dataAgora = new Date().toISOString();

        const relatorio: RelatorioConferencia = {
            idConferencia,
            idProjeto,
            dataConferencia: dataAgora,
            arquivoSped: file.name,
            usuarioResponsavel: usuarioEmail,
            divergencias,
            resumo
        };

        // 6. Persistir no R2
        const jsonContent = JSON.stringify(relatorio, null, 2);
        const reportKey = `${cnpjProjeto}/conferencias/${dataAgora}_relatorio.json`;

        await r2Bucket.put(reportKey, jsonContent, {
            httpMetadata: {
                contentType: 'application/json'
            }
        });

        console.log(`[Conferencia] Relatório salvo: ${reportKey}`);

        return relatorio;
    }

    // --- Helpers ---

    private static async parseSpedBlockC100(file: File): Promise<Map<string, NotaFiscalShort>> {
        const map = new Map<string, NotaFiscalShort>();
        const textStream = file.stream().pipeThrough(new TextDecoderStream());
        const lines = textStream.pipeThrough(new LineSplitter());
        const reader = lines.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const line = value;
            if (!line) continue;

            if (line.startsWith('|C100|')) {
                const parts = line.split('|');
                const reg = parts[1];
                const codSit = parts[6];

                // Filtramos apenas notas regulares
                if (codSit !== '00' && codSit !== '01') continue;

                const modelo = parts[5];
                const chave = parts[9];
                const serie = parts[7];
                const numero = parseInt(parts[8]);
                const dtEmiStr = parts[10];
                const vlTotal = this.parseDecimal(parts[12]);
                const vlIcms = this.parseDecimal(parts[22]);

                // Chave ou Chave Composta
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
                    validado: false
                });
            }
        }

        return map;
    }

    private static async extrairDadosXml(obj: R2Object, bucket: R2Bucket): Promise<Partial<NotaFiscalShort>> {
        // Tenta metadata primeiro (muito mais rápido)
        if (obj.customMetadata && obj.customMetadata['nNF']) {
            return {
                chave: obj.customMetadata['chNFe'],
                numero: parseInt(obj.customMetadata['nNF'] || '0'),
                serie: obj.customMetadata['serie'],
                vlTotal: parseFloat(obj.customMetadata['vNF'] || '0'),
                vlIcms: parseFloat(obj.customMetadata['vICMS'] || '0')
            };
        }

        // Fallback: Lê o arquivo (lento)
        const bodyObj = await bucket.get(obj.key);
        if (!bodyObj) return {};

        const text = await bodyObj.text();

        const chNFe = this.extractTag(text, 'chNFe');
        const nNF = this.extractTag(text, 'nNF');
        const serie = this.extractTag(text, 'serie');
        const vNF = this.extractTag(text, 'vNF');

        // Regex simples para pegar valor ICMS Total
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
