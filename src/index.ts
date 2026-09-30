import { SERVICE_NAME } from "./config/constants";
import type { Env } from "./env";
import { handleTelegramWebhookRequest } from "./telegram/webhook";
import { logError } from "./utils/errors";

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        if (request.method !== "GET") {
          return jsonResponse({ ok: false, error: "Method not allowed" }, 405, { allow: "GET" });
        }
        return jsonResponse({ ok: true, service: SERVICE_NAME });
      }

      if (url.pathname === "/telegram/webhook") {
        return await handleTelegramWebhookRequest(request, env, ctx);
      }

      return jsonResponse({ ok: false, error: "Not found" }, 404);
    } catch (error) {
      logError("worker.fetch", error);
      return jsonResponse({ ok: false, error: "Internal server error" }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
