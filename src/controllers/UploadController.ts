import { Context } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { Projeto } from "../dominios/projeto";

export class UploadController {
    static async upload(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        if (!email) {
            return c.json({ erro: 'Usuário não autenticado' }, 401);
        }

        try {
            const body = await c.req.parseBody();
            const projectId = body['projectId'] as string;
            const files = body['files[]'];

            if (!projectId) {
                return c.json({ erro: 'Projeto não selecionado' }, 400);
            }

            if (!files) {
                return c.json({ erro: 'Nenhum arquivo enviado' }, 400);
            }

            // 1. Validar Segurança: Verificar se o projeto pertence ao usuário
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];
            const projeto = projetos.find(p => p.id === projectId);

            if (!projeto) {
                return c.json({ erro: 'Projeto inválido ou acesso negado' }, 403);
            }

            // 2. Processar Arquivos
            const fileList = Array.isArray(files) ? files : [files];
            let arquivosProcessados = 0;

            for (const file of fileList) {
                if (file instanceof File) {
                    const key = `${projeto.cnpj}/inbound/${file.name}`;
                    await c.env.ARQUIVOS_USUARIOS.put(key, file.stream());
                    arquivosProcessados++;
                }
            }

            return c.json({
                sucesso: true,
                mensagem: `${arquivosProcessados} arquivo(s) enviado(s) com sucesso para o projeto ${projeto.nome}.`
            });

        } catch (erro) {
            console.error('Erro no upload:', erro);
            return c.json({ erro: 'Erro interno ao processar upload: ' + (erro instanceof Error ? erro.message : String(erro)) }, 500);
        }
    }
}
