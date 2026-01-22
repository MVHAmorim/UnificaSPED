export interface SpedUnificationState {
    blocos0140: string[];
    somaM: Record<string, number>;
    somaP: Record<string, number>;
    // Novos campos para validação
    blocosComDados: Set<string>; // 'A', 'C', 'D'...
    registrosCount: Map<string, number>; // 'C100' -> 10, '9900' -> ...
    idsCadastros: Set<string>; // '0150|CNPJ', '0200|COD_ITEM' (Deduplicação)
    totalLinhas: number;
}

export type SpedBlockChar = '0' | 'A' | 'C' | 'D' | 'F' | 'I' | 'M' | 'P' | '1' | '9';

export const BLOCO_ORDER: SpedBlockChar[] = ['A', 'C', 'D', 'F', 'I'];

// Configuração de Agregação
export const AGGREGATION_CONFIG: Record<string, { keyIndices: number[], valueIndices: number[] }> = {
    // PIS
    'M200': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    'M210': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] },
    'M600': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    'M610': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] },

    // CPRB
    'P100': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] },
    'P200': { keyIndices: [2, 3], valueIndices: [4, 5, 6, 7, 8] }
};

export const createInitialState = (): SpedUnificationState => ({
    blocos0140: [],
    somaM: {},
    somaP: {},
    blocosComDados: new Set<string>(),
    registrosCount: new Map<string, number>(),
    idsCadastros: new Set<string>(),
    totalLinhas: 0
});
