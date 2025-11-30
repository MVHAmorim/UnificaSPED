import { Hono } from "hono";
import { cors } from "hono/cors";
import { Ambiente } from "./config/ambiente";
import authRoutes from "./routes/auth";
import { AuthController } from "./controllers/AuthController";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<{ Bindings: Ambiente }>();

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

// Rotas Protegidas (Exemplo)
// app.use("/api/app/*", authMiddleware);
// app.get("/api/app/me", (c) => c.json(c.get('usuario')));

// Rota Seed (Dev)
app.get("/seed", async (c) => {
    const email = c.req.query("email") || "teste@spedito.com.br";
    const usuarioTeste = {
        nome: "Usuário Teste",
        vencimento: "2025-12-31",
        features: ["all"]
    };
    await c.env.UsuariosSpedito.put(email, JSON.stringify(usuarioTeste));
    return c.text(`Usuário ${email} criado!`);
});

export default app;
