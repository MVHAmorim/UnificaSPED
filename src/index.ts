import { Hono } from "hono";
import { cors } from "hono/cors";
import { Ambiente, Variaveis } from "./config/ambiente";
import authRoutes from "./routes/auth";
import appRoutes from "./routes/app";
import projetosRoutes from "./routes/projetos";
import uploadRoutes from "./routes/upload";
import { AuthController } from "./controllers/AuthController";
import { AsaasWebhookController } from "./controllers/AsaasWebhookController";

const app = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

// Middleware Global
app.use("*", cors());

// Error Handling Global
app.onError((err, c) => {
    console.error(err);
    return c.json({ erro: err.message }, 500);
});

// Rotas Públicas
app.get("/", AuthController.page);
app.route("/api/autenticacao", authRoutes);

// Webhooks
app.post("/webhooks/asaas", AsaasWebhookController.handleWebhook);

// Rotas Protegidas (App)
app.route("/app", appRoutes);
app.route("/api/app/projetos", projetosRoutes);
app.route("/api/app/upload", uploadRoutes);

// Rota Seed (Dev)
app.get("/seed", async (c) => {
    const email = c.req.query("email") || "teste@spedito.com.br";
    const usuarioTeste = {
        nome: "Usuário Teste",
        vencimento: "2026-12-31",
        features: ["all"]
    };
    await c.env.UNIFICASPED_USUARIOS.put(email, JSON.stringify(usuarioTeste));
    return c.text(`Usuário ${email} criado!`);
});

export default app;
