import { UnificacaoController } from "../controllers/UnificacaoController";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { AppController } from "../controllers/AppController";
import { Ambiente, Variaveis } from "../config/ambiente";

const app = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

// Aplicar Middleware de Autenticação em todas as rotas deste grupo
app.use("*", authMiddleware);

// Rotas
app.get("/dashboard", AppController.dashboard);
app.post("/unificacao", UnificacaoController.unificar);

// Redirecionar raiz do app para dashboard
app.get("/", (c) => c.redirect("/app/dashboard"));

export default app;
