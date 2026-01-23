export interface SpedUnificationState {
    blocos0140: string[];
    somaM: Record<string, number[]>;
    somaP: Record<string, number[]>; // Manter por compatibilidade de tipo, mas ficará vazio
    contadoresBloco9: Map<string, number>;
    totalLinhas: number;

    // Controle de Estrutura e Dados
    blocosComDados: Set<string>;
    registrosCount: Map<string, number>;
    idsCadastros: Set<string>;
}

export interface ArquivoSpedMetadata {
    key: string;
    cnpj: string; // 14 digitos
    dtIni: string; // DDMMAAAA
    dtFin: string;
    isMatriz: boolean;
}

export interface EstabelecimentoUnificacao {
    cnpj: string;
    isMatriz: boolean;
    arquivos: ArquivoSpedMetadata[]; // Lista temporal (Ex: 01-15 e 16-30)
    periodoConsolidado: { dtIni: string, dtFin: string }; // Min/Max datas
}

export interface ContextoCompetencia {
    chave: string; // "MMAAAA_CNPJBASE"
    competencia: string; // "MM/AAAA"
    cnpjBase: string;
    matriz?: EstabelecimentoUnificacao;
    filiais: Map<string, EstabelecimentoUnificacao>; // CNPJ -> Est
}

export type SpedBlockChar = '0' | 'A' | 'C' | 'D' | 'F' | 'I' | 'M' | 'P' | '1' | '9';

// Adicionado 'P' na ordem de processamento direto
export const BLOCO_ORDER: SpedBlockChar[] = ['A', 'C', 'D', 'F', 'I'];

export const AGGREGATION_CONFIG: Record<string, { keyIndices: number[], valueIndices: number[] }> = {
    // --- PIS (M) ---
    // Créditos PIS'
    'M100': { keyIndices: [2, 3, 5, 7], valueIndices: [4, 6, 8, 9, 10, 11, 12, 14, 15] },
    'M105': { keyIndices: [2, 3], valueIndices: [4, 5, 6, 8, 9] },
    'M110': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M115': { keyIndices: [3, 8], valueIndices: [2, 4, 5] },

    // Contribuição PIS
    'M200': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    'M205': { keyIndices: [2, 3], valueIndices: [4] },
    'M210': { keyIndices: [2, 8, 10], valueIndices: [3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16] },
    'M211': { keyIndices: [2], valueIndices: [3, 4, 5, 6] },
    'M215': { keyIndices: [2, 4, 5, 8], valueIndices: [3] },
    'M220': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M225': { keyIndices: [3, 8], valueIndices: [2, 4, 5] },
    'M230': { keyIndices: [2, 7], valueIndices: [3, 4, 5, 6] },

    // Outros PIS
    'M300': { keyIndices: [2, 4, 7, 8], valueIndices: [3, 5, 6] },
    'M350': { keyIndices: [5], valueIndices: [2, 3, 4, 6] },

    'M400': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M410': { keyIndices: [2, 4, 5], valueIndices: [3] },

    // --- COFINS (M) ---
    // Créditos COFINS
    'M500': { keyIndices: [2, 3, 5, 7], valueIndices: [4, 6, 8, 9, 10, 11, 12, 14, 15] },
    'M505': { keyIndices: [2, 3], valueIndices: [4, 5, 6, 8, 9] },
    'M510': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M515': { keyIndices: [3, 8], valueIndices: [2, 4, 5] },

    // Contribuição COFINS
    'M600': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    'M605': { keyIndices: [2, 3], valueIndices: [4] },
    'M610': { keyIndices: [2, 8, 10], valueIndices: [3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16] },
    'M611': { keyIndices: [2], valueIndices: [3, 4, 5, 6] },
    'M615': { keyIndices: [2, 4, 5, 8], valueIndices: [3] },
    'M620': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M625': { keyIndices: [3, 8], valueIndices: [2, 4, 5] },
    'M630': { keyIndices: [2, 7], valueIndices: [3, 4, 5, 6] },

    // Outros COFINS
    'M700': { keyIndices: [2, 4, 7, 8], valueIndices: [3, 5, 6] },

    'M800': { keyIndices: [2, 4, 5], valueIndices: [3] },
    'M810': { keyIndices: [2, 4, 5], valueIndices: [3] },
};

export const createInitialState = (): SpedUnificationState => ({
    blocos0140: [],
    somaM: {},
    somaP: {},
    contadoresBloco9: new Map<string, number>(),
    totalLinhas: 0,
    blocosComDados: new Set<string>(),
    registrosCount: new Map<string, number>(),
    idsCadastros: new Set<string>()
});
