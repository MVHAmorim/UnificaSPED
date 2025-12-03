import { Hono } from "hono";
import { Ambiente, Variaveis } from "../config/ambiente";
import { UploadController } from "../controllers/UploadController";
import { authMiddleware } from "../middleware/auth";

const uploadRoutes = new Hono<{ Bindings: Ambiente, Variables: Variaveis }>();

uploadRoutes.use('*', authMiddleware);

uploadRoutes.post('/', UploadController.upload);

export default uploadRoutes;
