import { find } from "./finder";
import { judge } from "./intoyou";

export interface Env {
  AI: { run(model: string, input: object): Promise<{ choices: { message: { content: string } }[] }> };
  TYPESAFE_AI_API_KEY: string;
}

// Each app's page is a static file; the worker only answers its API.
const ROUTES: Record<string, (req: Request, env: Env) => Promise<Response>> = {
  "/api/intoyou": judge,
  "/api/finder": find,
};

export default {
  fetch(req: Request, env: Env) {
    const route = ROUTES[new URL(req.url).pathname];
    return req.method === "POST" && route ? route(req, env) : new Response("Not found", { status: 404 });
  },
};
