import { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { Ambiente } from "../config/ambiente";
import { realizarLogin, verificarToken } from "../servicos/autenticacao";
import { TEMPLATE_LOGIN_HTML } from "../apresentacao/templates/login";

export class AuthController {

    static async page(c: Context) {
        return c.html(TEMPLATE_LOGIN_HTML);
    }

    static async login(c: Context<{ Bindings: Ambiente }>) {
        const body = await c.req.json() as { email: string };
        const origem = new URL(c.req.url).origin;

        try {
            const resultado = await realizarLogin(body.email, c.env.UsuariosSpedito, c.env.SessoesSpedito, origem, {
                regiao: c.env.AWS_REGION,
                idChaveAcesso: c.env.AWS_ACCESS_KEY_ID,
                chaveAcessoSecreta: c.env.AWS_SECRET_ACCESS_KEY,
                emailRemetente: c.env.SES_FROM_EMAIL
            });

            return c.json(resultado);
        } catch (e) {
            return c.json({ sucesso: false, mensagem: (e as Error).message }, 500);
        }
    }

    static async verify(c: Context<{ Bindings: Ambiente }>) {
        const token = c.req.query("token");

        if (!token) {
            return c.json({ valido: false, erro: "Token obrigatório" }, 400);
        }

        const resultado = await verificarToken(token, c.env.UsuariosSpedito, c.env.SessoesSpedito);

        if (resultado) {
            // Segurança: Definir Cookie HttpOnly
            setCookie(c, "auth_token", token, {
                httpOnly: true,
                secure: true, // Importante: Requer HTTPS
                sameSite: "Strict",
                path: "/",
                maxAge: 86400 // 24 horas
            });

            return c.json({
                valido: true,
                email: resultado.email,
                usuario: resultado.usuario
            });
        } else {
            return c.json({ valido: false }, 401);
        }
    }

    static async logout(c: Context<{ Bindings: Ambiente }>) {
        // Limpar Cookie
        deleteCookie(c, "auth_token");

        // Opcional: Invalidar sessão no KV (se tivermos o token)
        // Por simplicidade, apenas limpamos o cookie aqui.

        return c.json({ sucesso: true });
    }
}
