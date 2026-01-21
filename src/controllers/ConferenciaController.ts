import { Context } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { Projeto } from "../dominios/projeto";
import { ConferenciaService } from "../servicos/ConferenciaService";

export class ConferenciaController {

    static async conferir(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        if (!email) return c.json({ erro: 'Não autenticado' }, 401);

        const body = await c.req.parseBody();
        const projectId = body['projectId'] as string;
        const file = body['file'];

        if (!projectId) return c.json({ erro: 'Projeto não informado' }, 400);

        const isFile = file && typeof file === 'object' && 'name' in file && 'stream' in file;
        if (!isFile) {
            return c.json({ erro: 'Arquivo SPED inválido ou ausente' }, 400);
        }

        try {
            // Validar Projeto
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];
            const projeto = projetos.find(p => p.id === projectId);

            if (!projeto) return c.json({ erro: 'Projeto não encontrado' }, 404);

            // Executar Conferência
            const relatorio = await ConferenciaService.processarConferencia(
                file as File,
                c.env.ARQUIVOS_USUARIOS,
                projeto.cnpj,
                email,
                projectId
            );

            return c.json(relatorio);

        } catch (erro: any) {
            console.error('[Conferencia] Erro:', erro);
            return c.json({ erro: 'Falha na conferência', detalhes: erro.message }, 500);
        }
    }

    static async listarHistorico(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        const projectId = c.req.param('projectId');

        if (!email || !projectId) return c.json({ erro: 'Dados insuficientes' }, 400);

        try {
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];
            const projeto = projetos.find(p => p.id === projectId);

            if (!projeto) return c.json({ erro: 'Projeto não encontrado' }, 404);

            const prefixo = `${projeto.cnpj}/conferencias/`;
            const lista = await c.env.ARQUIVOS_USUARIOS.list({ prefix: prefixo });

            const historico = lista.objects.map(obj => ({
                key: obj.key,
                data: obj.uploaded,
                tamanho: obj.size,
                nomeArquivo: obj.key.split('/').pop()
            }));

            return c.json(historico);

        } catch (erro: any) {
            console.error('[Conferencia] Erro ao listar histórico:', erro);
            return c.json({ erro: 'Falha ao listar histórico' }, 500);
        }
    }

    static async obterRelatorio(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        const projectId = c.req.param('projectId');
        const filename = c.req.param('filename');

        if (!email || !projectId || !filename) return c.json({ erro: 'Dados insuficientes' }, 400);

        try {
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];
            const projeto = projetos.find(p => p.id === projectId);

            if (!projeto) return c.json({ erro: 'Projeto não encontrado' }, 404);

            const key = `${projeto.cnpj}/conferencias/${filename}`;
            const obj = await c.env.ARQUIVOS_USUARIOS.get(key);

            if (!obj) return c.json({ erro: 'Relatório não encontrado' }, 404);

            return c.body(obj.body, 200, {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`
            });

        } catch (erro: any) {
            console.error('[Conferencia] Erro ao baixar relatório:', erro);
            return c.json({ erro: 'Falha no download' }, 500);
        }
    }
}
