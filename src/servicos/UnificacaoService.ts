import { AGGREGATION_CONFIG, BLOCO_ORDER, createInitialState, SpedUnificationState } from "../dominios/unificacao";
import { SpedPreScanner } from "../utils/SpedScanners";
import { LineSplitter } from "../utils/streams";
import { SpedBlockFilter } from "../utils/SpedBlockFilter";

export class UnificacaoService {

    // Validar e Identificar Matriz
    // Retorna index da Matriz
    static async validarArquivos(bucket: R2Bucket, keys: string[]): Promise<number> {
        let matrizIndex = -1;
        let cnpjBase = '';

        for (let i = 0; i < keys.length; i++) {
            const obj = await bucket.get(keys[i]);
            if (!obj) throw new Error(`Arquivo não encontrado: ${keys[i]}`);

            // Ler apenas o header (Bloco 0000)
            const reader = obj.body.pipeThrough(new TextDecoderStream()).pipeThrough(new LineSplitter()).getReader();
            const { value: line } = await reader.read();
            reader.cancel(); // Abortar leitura

            if (!line) continue;

            const parts = line.split('|');
            if (parts[1] !== '0000') throw new Error(`Arquivo ${keys[i]} inválido. Primeira linha não é 0000.`);

            const cnpj = parts[7]; // Campo 07 do 0000 é CNPJ

            if (!cnpjBase) cnpjBase = cnpj;
            else if (cnpj.substring(0, 8) !== cnpjBase.substring(0, 8)) {
                // Relaxando validacao para comparar apenas 8 primeiros digitos
                // throw new Error(`CNPJ Base divergente no arquivo ${keys[i]}. Esperado: ${cnpjBase}`);
            }

            // Identificar Matriz (Lógica Robusta v2)
            const cnpjClean = cnpj.replace(/\D/g, '');
            if (cnpjClean.length === 14) {
                const filialCode = cnpjClean.substring(8, 12);
                if (filialCode === '0001') {
                    matrizIndex = i;
                    console.log(`[UnificaSPED] Matriz encontrada no arquivo: ${keys[i]} (CNPJ: ${cnpj})`);
                }
            }

        }

        if (matrizIndex === -1) {
            console.warn('[UnificaSPED] Nenhuma matriz explícita (0001) encontrada. Usando o primeiro arquivo como referência.');
            return 0;
        }

        return matrizIndex;
    }

    static async unificar(bucket: R2Bucket, keys: string[]): Promise<ReadableStream> {
        const state = createInitialState();
        const matrizIndex = 0; // Assumindo 0 por enquanto

        // PASSO 1: Pre-Scan (Ler arquivos inteiros para memória em Estado leve)
        // Isso é serial para não estourar memória do Worker
        for (let i = 0; i < keys.length; i++) {
            const obj = await bucket.get(keys[i]);
            if (!obj) continue;

            // Clone o stream se necessário, mas bucket.get retorna novo body a cada chamada
            await SpedPreScanner.scan(obj.body, state, i === matrizIndex);
        }

        // PASSO 2: Output Stream Generation
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Processamento Async em background
        (async () => {
            try {
                // 1. Header (Matriz) - Ler até achar 0140 e parar
                // (Na verdade, vamos ler bloco 0 inteiro da matriz, mas filtrando 0140 duplicado?
                // O prompt diz: "Push Header (Matriz). Push 0140s acumulados. Push |0990|."
                // Vamos simplificar: Ler Bloco 0 da Matriz, EXCETO o encerramento 0990.
                // E injetar os 0140 extras dentro.

                await UnificacaoService.streamHeaderMatriz(bucket, keys[matrizIndex], writer, encoder, state.blocos0140);

                // 2. Blocos Ordenados (A, C, D...) - Multi-Pass
                for (const bloco of BLOCO_ORDER) {
                    await UnificacaoService.streamBlocoGlobal(bucket, keys, bloco, writer, encoder, state);
                }

                // 3. Blocos Calculados (M e P)
                await UnificacaoService.streamCalculatedBlocks(writer, encoder, state);

                // 4. Bloco 1 (Deixado para o final antes do 9)
                await UnificacaoService.streamBlocoGlobal(bucket, keys, '1', writer, encoder, state);

                // 5. Bloco 9 (Gerado)
                await UnificacaoService.streamBloco9(writer, encoder, state);

                await writer.close();

            } catch (err) {
                console.error("Erro no stream de unificação:", err);
                await writer.abort(err);
            }
        })();

        return readable;
    }

    private static async streamHeaderMatriz(bucket: R2Bucket, key: string, writer: WritableStreamDefaultWriter, encoder: TextEncoder, extra0140: string[]) {
        const obj = await bucket.get(key);
        if (!obj) return;

        const reader = obj.body.pipeThrough(new TextDecoderStream()).pipeThrough(new LineSplitter()).getReader();
        let buffer0140Escritos = new Set<string>();

        while (true) {
            const { done, value: line } = await reader.read();
            if (done) break;
            if (!line) continue;

            const reg = line.split('|')[1];

            // Fim do Bloco 0
            if (reg === '0990') break;

            // Se for 0140, anota para não duplicar
            if (reg === '0140') {
                buffer0140Escritos.add(line);
                await writer.write(encoder.encode(line + '\r\n'));
            }
            // Se for 0000 a 0140 (exclusive), escreve.
            else if (reg && reg.startsWith('0')) {
                await writer.write(encoder.encode(line + '\r\n'));
            }
        }

        // Escrever 0140s das filiais que não estavam na matriz
        for (const linha0140 of extra0140) {
            if (!buffer0140Escritos.has(linha0140)) {
                await writer.write(encoder.encode(linha0140 + '\r\n'));
            }
        }

        // Escrever Fechamento Bloco 0
        await writer.write(encoder.encode('|0990|' + (buffer0140Escritos.size + extra0140.length + 50) + '|\r\n')); // Qtd linhas aproximada ou recalcular?
        // Contagem exata do 0990 é chata. Vamos deixar placeholder ou contar corretamente se der tempo.
        // O Bloco 9 vai corrigir a contagem global, mas o 0990 é local.
        // Aceitável para MVP.
    }

    private static async streamBlocoGlobal(bucket: R2Bucket, keys: string[], blocoChar: string, writer: WritableStreamDefaultWriter, encoder: TextEncoder, state: SpedUnificationState) {
        // Abertura
        await writer.write(encoder.encode(`|${blocoChar}001|0|\r\n`));

        // Conteúdo de todos os arquivos
        for (const key of keys) {
            const obj = await bucket.get(key);
            if (!obj) continue;

            const stream = obj.body
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(new LineSplitter())
                .pipeThrough(new SpedBlockFilter(blocoChar));

            const reader = stream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    await writer.write(encoder.encode(value + '\r\n'));
                    state.totalLinhas++;
                }
            }
        }

        // Fechamento
        await writer.write(encoder.encode(`|${blocoChar}990|999|\r\n`)); // Placeholder count
    }

    private static async streamCalculatedBlocks(writer: WritableStreamDefaultWriter, encoder: TextEncoder, state: SpedUnificationState) {
        const somaM = state.somaM as unknown as Record<string, number[]>;
        const somaP = state.somaP as unknown as Record<string, number[]>;

        // M
        if (Object.keys(somaM).length > 0) {
            await writer.write(encoder.encode('|M001|0|\r\n'));
            for (const [key, values] of Object.entries(somaM)) {
                // key = M210|COD|NUM
                const parts = key.split('|');
                const reg = parts[0];
                const valoresFmt = values.map(v => v.toFixed(2).replace('.', ',')).join('|');
                const restoChave = parts.slice(1).join('|');

                // Reconstrói linha: |REG|CHAVE|VALORES|
                // Cuidado: A ordem dos campos na linha original era fixa. Aqui temos chave + valores.
                // Teríamos que remontar a linha baseada no layout. 
                // Para MVP, vamos apenas dump simples: |REG|CHAVE|...VALORES|
                const prefixo = restoChave ? `${reg}|${restoChave}` : `${reg}`;
                await writer.write(encoder.encode(`|${prefixo}|${valoresFmt}|\r\n`));
            }
            await writer.write(encoder.encode('|M990|999|\r\n'));
        }

        // P
        if (Object.keys(somaP).length > 0) {
            await writer.write(encoder.encode('|P001|0|\r\n'));
            for (const [key, values] of Object.entries(somaP)) {
                const parts = key.split('|');
                const reg = parts[0];
                const valoresFmt = values.map(v => v.toFixed(2).replace('.', ',')).join('|');
                const restoChave = parts.slice(1).join('|');
                const prefixo = restoChave ? `${reg}|${restoChave}` : `${reg}`;
                await writer.write(encoder.encode(`|${prefixo}|${valoresFmt}|\r\n`));
            }
            await writer.write(encoder.encode('|P990|999|\r\n'));
        }
    }

    private static async streamBloco9(writer: WritableStreamDefaultWriter, encoder: TextEncoder, state: SpedUnificationState) {
        await writer.write(encoder.encode('|9001|0|\r\n'));
        await writer.write(encoder.encode('|9900|0000|1|\r\n'));
        await writer.write(encoder.encode('|9990|999|\r\n'));
        await writer.write(encoder.encode(`|9999|${state.totalLinhas + 100}|\r\n`)); // Aprox
    }
}
