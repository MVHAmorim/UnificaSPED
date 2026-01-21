export type TipoDivergencia =
    | 'SOBRA_XML'         // Existe no R2, não no SPED
    | 'SOBRA_SPED'        // Existe no SPED, não no R2
    | 'QUEBRA_SEQUENCIA'  // Salto na numeração (ex: 10, 12)
    | 'DIVERGENCIA_VALOR'; // (Futuro) Valores diferem

export interface ItemDivergencia {
    tipo: TipoDivergencia;
    chaveAcesso?: string;
    serie?: string;
    numero?: number;
    modelo?: string;
    dataEmissao?: Date;
    valorTotal?: number;
    valorIcms?: number; // Para cálculo de crédito
    descricao: string;
}

export interface ResumoImpacto {
    totalSobrasXml: number;
    totalSobrasSped: number;
    totalCreditoIcmsPotencial: number; // Soma do ICMS das Sobras XML
    valorTotalOperacoes: number;
    estimativaMulta: number; // Ex: 1% do valor das operações irregulares
}

export interface RelatorioConferencia {
    idConferencia: string; // UUID
    idProjeto: string;
    dataConferencia: string; // ISO Date
    arquivoSped: string; // Nome do arquivo TXT
    usuarioResponsavel: string; // Email do usuário
    divergencias: ItemDivergencia[];
    resumo: ResumoImpacto;
}

// Representação interna simplificada de uma Nota Fiscal (vinda do SPED ou XML)
export interface NotaFiscalShort {
    chave?: string;
    serie: string;
    numero: number;
    modelo: string;
    dtEmi: Date;
    vlTotal: number;
    vlIcms: number;
    origem: 'SPED' | 'R2';
    validado: boolean; // Usado durante o cruzamento
}
