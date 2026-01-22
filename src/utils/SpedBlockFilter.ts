export class SpedBlockFilter extends TransformStream<string, string> {
    constructor(targetBlock: string) {
        super({
            transform(line, controller) {
                if (!line || line.length < 2) return;

                // Linha SPED começa com |
                // Ex: |A100|...
                // parts[0] = ""
                // parts[1] = "A100"

                // Otimização: Checar charAt
                // pipe no 0. Bloco no 1.
                // Ex: |A...

                if (line.charCodeAt(0) === 124) { // '|'
                    const bloco = line.charAt(1);
                    if (bloco === targetBlock) {
                        // Ignorar Abertura e Fechamento do próprio bloco para não duplicar, 
                        // pois o Service vai gerar um Wrapper global para o bloco.
                        // Ex: |A001| e |A990|
                        const reg = line.substring(1, 5); // A001, A100...
                        if (reg.endsWith('001') || reg.endsWith('990')) {
                            return;
                        }

                        controller.enqueue(line);
                    }
                }
            }
        });
    }
}
