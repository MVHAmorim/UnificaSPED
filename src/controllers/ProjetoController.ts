import { Context } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { Projeto } from "../dominios/projeto";

export class ProjetoController {
    static async listar(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        if (!email) {
            return c.json({ erro: 'Usuário não autenticado' }, 401);
        }

        try {
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = projetosJson as Projeto[] || [];
            return c.json(projetos);
        } catch (erro) {
            console.error('Erro ao listar projetos:', erro);
            return c.json({ erro: 'Erro interno ao listar projetos' }, 500);
        }
    }

    static async criar(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const email = c.get('email');
        if (!email) {
            return c.json({ erro: 'Usuário não autenticado' }, 401);
        }

        try {
            const body = await c.req.json<{ nome: string; cnpj: string }>();

            if (!body.nome || !body.cnpj) {
                return c.json({ erro: 'Nome e CNPJ são obrigatórios' }, 400);
            }

            // Limpar CNPJ (manter apenas números)
            const cnpjLimpo = body.cnpj.replace(/\D/g, '');

            const novoProjeto: Projeto = {
                id: crypto.randomUUID(),
                nome: body.nome,
                cnpj: cnpjLimpo,
                dataCriacao: new Date().toISOString()
            };

            // Recuperar lista atual
            const projetosJson = await c.env.ProjetosSpedito.get(`PROJETOS:${email}`, 'json');
            const projetos = (projetosJson as Projeto[]) || [];

            // Adicionar novo projeto
            projetos.push(novoProjeto);

            // Salvar no KV
            await c.env.ProjetosSpedito.put(`PROJETOS:${email}`, JSON.stringify(projetos));

            return c.json(novoProjeto, 201);
        } catch (erro) {
            console.error('Erro ao criar projeto:', erro);
            return c.json({ erro: 'Erro interno: ' + (erro instanceof Error ? erro.message : String(erro)) }, 500);
        }
    }
}
