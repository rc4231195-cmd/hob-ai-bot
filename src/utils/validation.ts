import type { Env } from "../env";
import type { TelegramChat, TelegramMessage, TelegramUpdate, TelegramUser } from "../telegram/types";
import { ConfigurationError, ValidationError } from "./errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`Telegram update field ${key} must be a number`);
  }
  return value;
}

function setOptionalString<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string | undefined
): void {
  if (value !== undefined) {
    target[key] = value as T[K];
  }
}

function parseUser(value: unknown): TelegramUser | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value) || typeof value["id"] !== "number" || typeof value["first_name"] !== "string") {
    throw new ValidationError("Telegram user is malformed");
  }

  const user: TelegramUser = {
    id: value["id"],
    is_bot: value["is_bot"] === true,
    first_name: value["first_name"]
  };
  setOptionalString(user, "last_name", optionalString(value["last_name"]));
  setOptionalString(user, "username", optionalString(value["username"]));
  setOptionalString(user, "language_code", optionalString(value["language_code"]));
  return user;
}

function parseChat(value: unknown): TelegramChat {
  if (!isRecord(value) || typeof value["id"] !== "number" || typeof value["type"] !== "string") {
    throw new ValidationError("Telegram chat is malformed");
  }

  const chat: TelegramChat = {
    id: value["id"],
    type: value["type"]
  };
  setOptionalString(chat, "title", optionalString(value["title"]));
  setOptionalString(chat, "username", optionalString(value["username"]));
  setOptionalString(chat, "first_name", optionalString(value["first_name"]));
  setOptionalString(chat, "last_name", optionalString(value["last_name"]));
  return chat;
}

function parseMessage(value: unknown): TelegramMessage {
  if (!isRecord(value)) {
    throw new ValidationError("Telegram message is malformed");
  }

  const text = value["text"];
  if (text !== undefined && typeof text !== "string") {
    throw new ValidationError("Telegram message text must be a string");
  }

  const message: TelegramMessage = {
    message_id: requiredNumber(value, "message_id"),
    chat: parseChat(value["chat"]),
    date: requiredNumber(value, "date")
  };

  const from = parseUser(value["from"]);
  if (from !== undefined) {
    message.from = from;
  }
  if (typeof text === "string") {
    message.text = text;
  }

  return message;
}

export function parseTelegramUpdate(value: unknown): TelegramUpdate {
  if (!isRecord(value)) {
    throw new ValidationError("Telegram update must be an object");
  }

  const updateId = requiredNumber(value, "update_id");
  if (!Number.isSafeInteger(updateId) || updateId < 0) {
    throw new ValidationError("Telegram update_id must be a non-negative integer");
  }

  if (value["message"] === undefined) {
    return { update_id: updateId };
  }

  return {
    update_id: updateId,
    message: parseMessage(value["message"])
  };
}

export function validateWebhookSecret(request: Request, expectedSecret: string): boolean {
  const actualSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!actualSecret || actualSecret.length !== expectedSecret.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < actualSecret.length; index += 1) {
    difference |= actualSecret.charCodeAt(index) ^ expectedSecret.charCodeAt(index);
  }
  return difference === 0;
}

export function validateRequiredEnv(env: Env): void {
  const missing = [
    ["TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN],
    ["TELEGRAM_WEBHOOK_SECRET", env.TELEGRAM_WEBHOOK_SECRET],
    ["GEMINI_API_KEY", env.GEMINI_API_KEY],
    ["DB", env.DB]
  ]
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new ConfigurationError(`Missing required configuration: ${missing.join(", ")}`);
  }
}
