import { LineSplitter } from "./streams";
import { AGGREGATION_CONFIG, SpedUnificationState } from "../dominios/unificacao";

export class SpedPreScanner {
    static async scan(fileStream: ReadableStream, state: SpedUnificationState, isMatriz: boolean): Promise<void> {
        const reader = fileStream
            .pipeThrough(new TextDecoderStream('latin1'))
            .pipeThrough(new LineSplitter())
            .getReader();

        let currentM400Key = '';
        let currentM800Key = '';

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
                    const target = reg.startsWith('M') ? state.somaM : state.somaP;

                    // Tratamento Hierárquico para M400/M410 e M800/M810
                    if (reg === 'M400') {
                        const key = SpedPreScanner.getKey(parts, config);
                        currentM400Key = key;
                        SpedPreScanner.aggregateWithKey(parts, config, `M400|${key}`, target);
                    } else if (reg === 'M410') {
                        const key = SpedPreScanner.getKey(parts, config);
                        // Chave Composta: M410 | ParentKey | MyKey
                        SpedPreScanner.aggregateWithKey(parts, config, `M410|${currentM400Key}|${key}`, target);
                    } else if (reg === 'M800') {
                        const key = SpedPreScanner.getKey(parts, config);
                        currentM800Key = key;
                        SpedPreScanner.aggregateWithKey(parts, config, `M800|${key}`, target);
                    } else if (reg === 'M810') {
                        const key = SpedPreScanner.getKey(parts, config);
                        SpedPreScanner.aggregateWithKey(parts, config, `M810|${currentM800Key}|${key}`, target);
                    } else {
                        // Padrão
                        const key = SpedPreScanner.getKey(parts, config);
                        SpedPreScanner.aggregateWithKey(parts, config, `${reg}|${key}`, target);
                    }
                }
            }
        }
    }

    private static getKey(parts: string[], config: { keyIndices: number[] }): string {
        return config.keyIndices.map(i => parts[i]).join('|');
    }

    private static aggregateWithKey(parts: string[], config: { valueIndices: number[] }, compositeKey: string, target: Record<string, number[]>) {
        if (!target[compositeKey]) {
            target[compositeKey] = new Array(config.valueIndices.length).fill(0);
        }

        const currentValues = target[compositeKey];

        config.valueIndices.forEach((idx, i) => {
            const rawVal = parts[idx]?.replace(',', '.') || '0';
            const val = parseFloat(rawVal) || 0;
            currentValues[i] += val;
        });
    }

    // Deprecated but kept for compatibility if needed (replaced by aggregateWithKey logic inline)
    private static aggregate(line: string, parts: string[], config: { keyIndices: number[], valueIndices: number[] }, target: Record<string, number[]>) {
        const key = SpedPreScanner.getKey(parts, config);
        SpedPreScanner.aggregateWithKey(parts, config, `${parts[1]}|${key}`, target);
    }
}
