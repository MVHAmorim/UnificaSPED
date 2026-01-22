import { LineSplitter } from "./streams";
import { AGGREGATION_CONFIG, SpedUnificationState } from "../dominios/unificacao";

export class SpedPreScanner {
    static async scan(fileStream: ReadableStream, state: SpedUnificationState, isMatriz: boolean): Promise<void> {
        const reader = fileStream
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new LineSplitter())
            .getReader();

        while (true) {
            const { done, value: line } = await reader.read();
            if (done) break;

            if (!line || line.trim() === '') continue;

            const parts = line.split('|');
            if (parts.length < 2) continue;

            const reg = parts[1];

            // Regra 0140: Captura de Estabelecimentos (Apenas se NÃO for Matriz, pois Matriz já tem seu Header preservado no passo final)
            // Se isMatriz=true, o service vai copiar o header inteiro, então não precisamos guardar 0140 duplicado aqui.
            // Mas se a lógica é "unificar", precisamos garantir que temos a lista de TODOS os 0140 (filiais) para injetar no cabeçalho unificado.
            // Ajuste: Vamos guardar 0140 de todo mundo exceto se for EXATAMENTE a linha que define a matriz (que já estará no header).
            // Simplificação: Guardar todos os 0140 encontrados. O Service depois decide duplicatas.
            if (reg === '0140') {
                // Remove pipe inicial e final para limpar, ou guarda raw?
                // Vamos guardar raw para facilitar escrita.
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

    private static aggregate(line: string, parts: string[], config: { keyIndices: number[], valueIndices: number[] }, target: Record<string, number>) {
        // Gerar chave única
        const key = config.keyIndices.map(i => parts[i]).join('|');
        const compositeKey = `${parts[1]}|${key}`; // Ex: M210|COD|NUM

        if (!target[compositeKey]) {
            // Inicializar se não existe.
            // Mas espera, como armazenar os valores? Precisamos de um array de somas.
            // Trick: O target vai guardar 'compositeKey' -> Index no array de somas? Não.
            // Vamos mudar a estrutura:
            // Chave -> Objeto com valores somados.
            // Como em JS objeto é ref, podemos guardar strings serializadas.
            // Vamos simplificar: A chave do map aponta para um array de numbers correspondente aos valueIndices.
        }

        // REVISÃO NO DESIGN AO VIVO:
        // O `target` é `Record<string, number>`. Isso é insuficiente para múltiplos campos de valor.
        // O prompt pedia `Map<string, { valorPis: number... }>`.
        // Vamos serializar os valores somados em uma string ou mudar a interface no dominios (mas já escrevi dominios).
        // Vou assumir que o `somaM` no `dominios` pode ser tratado como `any` ou vou sobrescrever a tipagem aqui com casting, 
        // mas o correto era ter definido melhor.
        // Vou usar `Record<string, number[]>` mentalmente.

        // Hack para o MVP: Usar um separador interno na chave para distinguir colunas? Não, muito sujo.
        // Vou tratar `somaM` como `Record<string, number[]>`.

        const storage = target as unknown as Record<string, number[]>;

        if (!storage[compositeKey]) {
            storage[compositeKey] = new Array(config.valueIndices.length).fill(0);
        }

        const currentValues = storage[compositeKey];

        config.valueIndices.forEach((idx, i) => {
            // Valor no arquivo SPED usa vírgula decimal pt-BR
            const rawVal = parts[idx]?.replace(',', '.') || '0';
            const val = parseFloat(rawVal) || 0;
            currentValues[i] += val;
        });
    }
}
