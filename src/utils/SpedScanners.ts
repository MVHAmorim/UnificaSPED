import { LineSplitter } from "./streams";
import { AGGREGATION_CONFIG, SpedUnificationState } from "../dominios/unificacao";

export class SpedPreScanner {
    static async scan(fileStream: ReadableStream, state: SpedUnificationState, isMatriz: boolean): Promise<void> {
        const reader = fileStream
            .pipeThrough(new TextDecoderStream('latin1'))
            .pipeThrough(new LineSplitter())
            .getReader();

        while (true) {
            const { done, value: line } = await reader.read();
            if (done) break;

            if (!line || line.trim() === '') continue;

            // Simple parse
            // Validar pipe start
            if (line.charCodeAt(0) !== 124) continue; // '|'

            const parts = line.split('|');
            if (parts.length < 2) continue;

            const reg = parts[1];
            if (!reg) continue;

            // Detectar Blocos com Dados (exceto 0 e 9 e M/P que sao tratados especiais)
            const bloco = reg.charAt(0);
            if (['A', 'C', 'D', 'F', 'I', 'P', '1'].includes(bloco)) {
                // Ignorar abertura/fechamento
                if (!reg.endsWith('001') && !reg.endsWith('990')) {
                    state.blocosComDados.add(bloco);
                }
            }

            // Regra 0140
            if (reg === '0140') {
                if (!state.blocos0140.includes(line)) {
                    state.blocos0140.push(line);
                }
            }

            // Regra M e P: Agregação
            if (reg.startsWith('M') || reg.startsWith('P')) {
                const config = AGGREGATION_CONFIG[reg];
                if (config) {
                    SpedPreScanner.aggregate(line, parts, config, reg.startsWith('M') ? state.somaM : state.somaP);
                }
            }
        }
    }

    private static aggregate(line: string, parts: string[], config: { keyIndices: number[], valueIndices: number[] }, target: Record<string, number[]>) {
        const key = config.keyIndices.map(i => parts[i]).join('|');
        const compositeKey = `${parts[1]}|${key}`;

        const storage = target;

        if (!storage[compositeKey]) {
            storage[compositeKey] = new Array(config.valueIndices.length).fill(0);
        }

        const currentValues = storage[compositeKey];

        config.valueIndices.forEach((idx, i) => {
            const rawVal = parts[idx]?.replace(',', '.') || '0';
            const val = parseFloat(rawVal) || 0;
            currentValues[i] += val;
        });
    }
}
