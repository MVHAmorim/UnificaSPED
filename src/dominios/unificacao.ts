export interface SpedUnificationState {
    blocos0140: string[];
    somaM: Record<string, number>;
    somaP: Record<string, number>;
    contadoresBloco9: Map<string, number>;
    totalLinhas: number;
}

export type SpedBlockChar = '0' | 'A' | 'C' | 'D' | 'F' | 'I' | 'M' | 'P' | '1' | '9';

export const BLOCO_ORDER: SpedBlockChar[] = ['A', 'C', 'D', 'F', 'I'];

// Configuração de Agregação (Simplified for MVP)
// Chave: Registro
// IndicesChave: Posições no Pipe para formar a chave única de soma (ex: CST + Alíquota)
// IndicesValor: Posições no Pipe para somar
export const AGGREGATION_CONFIG: Record<string, { keyIndices: number[], valueIndices: number[] }> = {
    // PIS
    'M200': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, // Consolidação PIS
    'M210': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] }, // Detalhamento
    'M600': { keyIndices: [], valueIndices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, // Consolidação COFINS
    'M610': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] },

    // CPRB
    'P100': { keyIndices: [2, 3, 4], valueIndices: [5, 6, 7, 8, 9] },
    'P200': { keyIndices: [2, 3], valueIndices: [4, 5, 6, 7, 8] }
};

export const createInitialState = (): SpedUnificationState => ({
    blocos0140: [],
    somaM: {},
    somaP: {},
    contadoresBloco9: new Map<string, number>(),
    totalLinhas: 0
});
