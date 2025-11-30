import { Hono } from "hono";
import { AuthController } from "../controllers/AuthController";
import { Ambiente } from "../config/ambiente";

const auth = new Hono<{ Bindings: Ambiente }>();

auth.post("/login", AuthController.login);
auth.get("/verify", AuthController.verify);
auth.post("/logout", AuthController.logout);

export default auth;
