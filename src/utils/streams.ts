/**
 * TransformStream que recebe chunks de texto e emite linhas completas.
 * Lida corretamente com quebras de linha que podem estar divididas entre chunks.
 */
export class LineSplitter extends TransformStream<string, string> {
    constructor() {
        let buffer = '';
        super({
            transform(chunk, controller) {
                buffer += chunk;
                const lines = buffer.split(/\r?\n/);
                // A última parte é sempre o "resto" (pode ser vazio se o chunk acabou em \n)
                buffer = lines.pop() || '';

                for (const line of lines) {
                    controller.enqueue(line);
                }
            },
            flush(controller) {
                if (buffer) {
                    controller.enqueue(buffer);
                }
            }
        });
    }
}
