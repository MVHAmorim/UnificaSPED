import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verificarToken } from "../servicos/autenticacao";
import { Ambiente, Variaveis } from "../config/ambiente";

export async function authMiddleware(c: Context<{ Bindings: Ambiente, Variables: Variaveis }>, next: Next) {
    // 1. Prioridade: Cookie
    let token = getCookie(c, "auth_token");

    // 2. Fallback: Header Authorization
    if (!token) {
        const authHeader = c.req.header("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    if (!token) {
        return c.json({ erro: "Não autorizado: Token não encontrado" }, 401);
    }

    const resultado = await verificarToken(token, c.env.UsuariosSpedito, c.env.SessoesSpedito);

    if (!resultado) {
        return c.json({ erro: "Não autorizado: Token inválido ou expirado" }, 401);
    }

    // Injetar usuário no contexto
    c.set("usuario", resultado.usuario);
    c.set("email", resultado.email);

    await next();
}
