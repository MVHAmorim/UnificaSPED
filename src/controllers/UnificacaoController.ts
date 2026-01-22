import { Context } from "hono";
import { UnificacaoService } from "../servicos/UnificacaoService";
import { Ambiente, Variaveis } from "../config/ambiente";

export class UnificacaoController {
    static async unificar(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        try {
            const formData = await c.req.parseBody();
            // 'files[]' pode vir como string, File ou array de (string|File)
            const files = formData['files[]'];

            if (!files) {
                return c.json({ erro: 'Nenhum arquivo enviado.' }, 400);
            }

            // Normaliza para array de File
            const fileArray = Array.isArray(files) ? files : [files];
            const validFiles = fileArray.filter(f => f instanceof File) as File[];

            if (validFiles.length < 2) {
                return c.json({ erro: 'É necessário enviar ao menos 2 arquivos para unificação.' }, 400);
            }

            // 1. Upload para R2 (Temp) para permitir múltiplas leituras
            const bucket = c.env.ARQUIVOS_USUARIOS;
            const sessionId = crypto.randomUUID();
            const storedKeys: string[] = [];

            for (const file of validFiles) {
                const key = `temp/${sessionId}/${file.name}`;
                await bucket.put(key, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });
                storedKeys.push(key);
            }

            // 2. Executar Unificação e obter Stream
            const stream = await UnificacaoService.unificar(bucket, storedKeys);

            // 3. Retornar Stream como Download
            return c.body(stream, 200, {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="SPED_Unificado_${sessionId}.txt"`
                // Nota: O Controller não apaga os arquivos temp imediatamente pois o stream é assíncrono.
                // Idealmente teríamos um Worker Cron ou Lifetime policy no R2 para limpar `temp/*`.
            });

        } catch (error: any) {
            console.error('Erro na unificação:', error);
            return c.json({ erro: error.message || 'Erro interno no servidor.' }, 500);
        }
    }
}
