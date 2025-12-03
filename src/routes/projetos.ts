import { Hono } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { ProjetoController } from "../controllers/ProjetoController";
import { authMiddleware } from "../middleware/auth";

const projetosRoutes = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

projetosRoutes.use('*', authMiddleware);

projetosRoutes.get('/', ProjetoController.listar);
projetosRoutes.post('/', ProjetoController.criar);

export default projetosRoutes;
