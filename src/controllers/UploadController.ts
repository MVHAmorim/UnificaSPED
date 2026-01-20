import { Context } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { Projeto } from "../dominios/projeto";

export class UploadController {
    static async upload(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        console.log(`[Upload] Iniciando upload para: ${email}`); // Debug

        if (!email) return c.json({ erro: 'Usuário não autenticado' }, 401);

        try {
            const body = await c.req.parseBody();
            const projectId = body['projectId'] as string;
            // Hono pode retornar um único arquivo ou array. Normalizamos para array.
            const filesInput = body['files[]'];
            const files = Array.isArray(filesInput) ? filesInput : (filesInput ? [filesInput] : []);

            console.log(`[Upload] ProjectId: ${projectId}, Arquivos recebidos: ${files.length}`);

            if (!projectId) return c.json({ erro: 'Projeto não selecionado' }, 400);
            if (files.length === 0) return c.json({ erro: 'Nenhum arquivo enviado' }, 400);

            // 1. Validar Projeto (Segurança)
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];
            const projeto = projetos.find(p => p.id === projectId);

            if (!projeto) {
                console.error(`[Upload] Erro: Projeto ${projectId} não encontrado para ${email}`);
                return c.json({ erro: 'Projeto inválido ou acesso negado' }, 403);
            }

            // 2. Processar Arquivos com Robustez
            let sucessos = 0;
            let falhas = 0;

            for (const file of files) {
                // "Duck Typing": Verifica se parece um arquivo (tem nome e buffer)
                // Isso evita falhas de 'instanceof File' em alguns ambientes Workers
                if (file && typeof file === 'object' && 'name' in file && 'arrayBuffer' in file) {
                    const fileName = (file as File).name;
                    console.log(`[Upload] Processando arquivo: ${fileName}`);

                    try {
                        // Caminho: CNPJ / inbound / Nome
                        const key = `${projeto.cnpj}/inbound/${fileName}`;

                        // Usar arrayBuffer() é mais estável que stream() para arquivos pequenos/médios
                        const content = await (file as File).arrayBuffer();

                        await c.env.ARQUIVOS_USUARIOS.put(key, content);
                        sucessos++;
                    } catch (uploadErr) {
                        console.error(`[Upload] Falha ao salvar ${fileName}:`, uploadErr);
                        falhas++;
                    }
                } else {
                    console.warn('[Upload] Item ignorado (não é um arquivo válido):', file);
                    falhas++;
                }
            }

            console.log(`[Upload] Finalizado. Sucessos: ${sucessos}, Falhas: ${falhas}`);

            return c.json({
                sucesso: true,
                mensagem: `${sucessos} arquivo(s) enviado(s) com sucesso.`,
                detalhes: falhas > 0 ? `${falhas} falharam.` : undefined
            });

        } catch (erro) {
            console.error('[Upload] Erro Crítico no Controller:', erro);
            return c.json({ erro: 'Erro interno ao processar upload. Verifique os logs.' }, 500);
        }
    }
}
