import { Hono } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { AuditController } from "../controllers/AuditController";
import { authMiddleware } from "../middleware/auth";

const auditRoutes = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

auditRoutes.use('*', authMiddleware);

auditRoutes.post('/', AuditController.auditar);
auditRoutes.get('/history/:projectId', AuditController.listarHistorico);
auditRoutes.get('/report/:projectId/:filename', AuditController.obterRelatorio);

export default auditRoutes;
