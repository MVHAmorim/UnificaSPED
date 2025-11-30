import { Ambiente } from "./config/ambiente";
import { ControladorAutenticacao } from "./controladores/controladorAutenticacao";

export default {
    async fetch(requisicao: Request, env: Ambiente, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(requisicao.url);

        // Headers CORS
        const headersCors = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (requisicao.method === "OPTIONS") {
            return new Response(null, { headers: headersCors });
        }

        try {
            // Rotas da API
            if (url.pathname === '/api/autenticacao/login') {
                const resposta = await ControladorAutenticacao.lidarLogin(requisicao, env, url.origin);
                return adicionarCors(resposta, headersCors);
            }

            if (url.pathname === '/api/autenticacao/verificar') {
                const resposta = await ControladorAutenticacao.lidarVerificacao(url, env);
                return adicionarCors(resposta, headersCors);
            }

            if (url.pathname === '/seed') {
                // Rota para criar usuário de teste
                const usuarioTeste = {
                    nome: "Usuário Teste",
                    vencimento: "2025-12-31",
                    features: ["all"]
                };
                const email = url.searchParams.get("email") || "teste@spedito.com.br";
                await env.UsuariosSpedito.put(email, JSON.stringify(usuarioTeste));
                return new Response(`Usuário ${email} criado!`, { headers: headersCors });
            }

            // Padrão: Servir HTML de Login
            return await ControladorAutenticacao.lidarPaginaLogin();

        } catch (e) {
            return new Response(JSON.stringify({ erro: (e as Error).message }), { status: 500, headers: headersCors });
        }
    },
} satisfies ExportedHandler<Ambiente>;

function adicionarCors(resposta: Response, cors: Record<string, string>): Response {
    const novosHeaders = new Headers(resposta.headers);
    for (const [chave, valor] of Object.entries(cors)) {
        novosHeaders.set(chave, valor);
    }
    return new Response(resposta.body, {
        status: resposta.status,
        statusText: resposta.statusText,
        headers: novosHeaders
    });
}
