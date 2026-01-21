import { Hono } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { ConferenciaController } from "../controllers/ConferenciaController";
import { authMiddleware } from "../middleware/auth";

const conferenciaRoutes = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

conferenciaRoutes.use('*', authMiddleware);

conferenciaRoutes.post('/', ConferenciaController.conferir);
conferenciaRoutes.get('/history/:projectId', ConferenciaController.listarHistorico);
conferenciaRoutes.get('/report/:projectId/:filename', ConferenciaController.obterRelatorio);

export default conferenciaRoutes;
