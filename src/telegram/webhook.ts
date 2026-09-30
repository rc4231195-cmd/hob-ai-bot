import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_SYSTEM_INSTRUCTION,
  GENERIC_USER_ERROR,
  MAX_WEBHOOK_BODY_BYTES
} from "../config/constants";
import type { Env } from "../env";
import { GeminiClient } from "../gemini/client";
import { CommandHandler } from "../handlers/commands";
import { MessageHandler } from "../handlers/message";
import { UpdateRouter } from "../router/update-router";
import { ConversationService } from "../services/conversation";
import { UserService } from "../services/user";
import { logError, ValidationError } from "../utils/errors";
import { parseTelegramUpdate, validateRequiredEnv, validateWebhookSecret } from "../utils/validation";
import { TelegramApiClient } from "./api";
import type { TelegramUpdate } from "./types";

export type ProcessResult = "processed" | "duplicate" | "ignored" | "error";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_WEBHOOK_BODY_BYTES) {
    throw new ValidationError("Telegram webhook payload is too large");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_WEBHOOK_BODY_BYTES) {
    throw new ValidationError("Telegram webhook payload is too large");
  }
  return body;
}

async function sendGenericError(telegram: TelegramApiClient, update: TelegramUpdate): Promise<void> {
  const chatId = update.message?.chat.id;
  if (chatId === undefined) {
    return;
  }

  try {
    await telegram.sendMessage({ chatId, text: GENERIC_USER_ERROR });
  } catch (error) {
    logError("telegram.error_response", error);
  }
}

export async function processTelegramUpdate(update: TelegramUpdate, env: Env): Promise<ProcessResult> {
  const telegram = new TelegramApiClient({ token: env.TELEGRAM_BOT_TOKEN });
  const conversations = new ConversationService(env.DB);
  const users = new UserService(env.DB);
  const gemini = new GeminiClient({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  });
  const router = new UpdateRouter({
    handleCommand: (command, message) => new CommandHandler(telegram, conversations).handle(command, message),
    handleMessage: (message) =>
      new MessageHandler({
        telegram,
        gemini,
        conversations,
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION
      }).handle(message)
  });

  try {
    const isNewUpdate = await conversations.tryMarkUpdateProcessed(update.update_id);
    if (!isNewUpdate) {
      return "duplicate";
    }

    if (update.message?.from) {
      await users.upsertUser(update.message.from);
    }

    const result = await router.route(update);
    return result === "ignored" ? "ignored" : "processed";
  } catch (error) {
    logError("telegram.update_processing", error);
    await sendGenericError(telegram, update);
    return "error";
  }
}

export async function handleTelegramWebhookRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    validateRequiredEnv(env);
  } catch (error) {
    logError("telegram.webhook_configuration", error);
    return jsonResponse({ ok: false, error: "Service is not configured" }, 500);
  }

  if (!validateWebhookSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let update: TelegramUpdate;
  try {
    const body = await readBoundedBody(request);
    update = parseTelegramUpdate(JSON.parse(body));
  } catch (error) {
    logError("telegram.webhook_validation", error);
    return jsonResponse({ ok: false, error: "Invalid Telegram update" }, 400);
  }

  ctx.waitUntil(
    processTelegramUpdate(update, env).catch((error: unknown) => {
      logError("telegram.background_processing", error);
    })
  );

  return jsonResponse({ ok: true });
}
