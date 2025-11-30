import { Ambiente } from "../config/ambiente";
import { realizarLogin, verificarToken } from "../servicos/autenticacao";
import { TEMPLATE_LOGIN_HTML } from "../apresentacao/templates/login";

export class ControladorAutenticacao {

    static async lidarPaginaLogin(): Promise<Response> {
        return new Response(TEMPLATE_LOGIN_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }

    static async lidarLogin(requisicao: Request, env: Ambiente, origem: string): Promise<Response> {
        if (requisicao.method !== "POST") return new Response("Método não permitido", { status: 405 });

        try {
            const corpo = await requisicao.json() as { email: string };

            const resultado = await realizarLogin(corpo.email, env.UsuariosSpedito, env.SessoesSpedito, origem, {
                regiao: env.AWS_REGION,
                idChaveAcesso: env.AWS_ACCESS_KEY_ID,
                chaveAcessoSecreta: env.AWS_SECRET_ACCESS_KEY,
                emailRemetente: env.SES_FROM_EMAIL
            });

            return new Response(JSON.stringify(resultado), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            return new Response(JSON.stringify({ sucesso: false, mensagem: (e as Error).message }), { status: 500 });
        }
    }

    static async lidarVerificacao(url: URL, env: Ambiente): Promise<Response> {
        const token = url.searchParams.get("token");
        if (!token) return new Response("Token obrigatório", { status: 400 });

        const resultado = await verificarToken(token, env.UsuariosSpedito, env.SessoesSpedito);

        if (resultado) {
            return new Response(JSON.stringify({ valido: true, email: resultado.email, usuario: resultado.usuario }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            return new Response(JSON.stringify({ valido: false }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
    }
}
