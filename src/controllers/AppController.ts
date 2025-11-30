import { Context } from "hono";
import { TEMPLATE_DASHBOARD_HTML } from "../apresentacao/templates/dashboard";
import { Ambiente, Variaveis } from "../config/ambiente";

export class AppController {

    static async dashboard(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>) {
        const usuario = c.get("usuario");
        const email = c.get("email");

        let html = TEMPLATE_DASHBOARD_HTML;

        // Substituição simples de placeholders
        // Em um cenário mais complexo, usaríamos um motor de template real ou React/JSX
        const nomeExibicao = usuario.nome || "Usuário";
        const iniciais = nomeExibicao.substring(0, 2).toUpperCase();

        html = html.replace(/{{NOME}}/g, nomeExibicao);
        html = html.replace(/{{EMAIL}}/g, email);
        html = html.replace(/{{INICIAIS}}/g, iniciais);

        // Injetar dados do usuário como objeto JS global se necessário para o frontend
        // html = html.replace('// {{DADOS_USUARIO}}', \`window.USER = \${JSON.stringify(usuario)};\`);

        return c.html(html);
    }
}
