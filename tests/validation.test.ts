import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { ConfigurationError, ValidationError } from "../src/utils/errors";
import { parseTelegramUpdate, validateRequiredEnv, validateWebhookSecret } from "../src/utils/validation";

function requestWithSecret(secret?: string): Request {
  return new Request("https://example.com/telegram/webhook", {
    method: "POST",
    ...(secret === undefined
      ? {}
      : { headers: { "X-Telegram-Bot-Api-Secret-Token": secret } })
  });
}

describe("webhook secret validation", () => {
  it("accepts a valid webhook secret", () => {
    expect(validateWebhookSecret(requestWithSecret("secret-value"), "secret-value")).toBe(true);
  });

  it("rejects an invalid webhook secret", () => {
    expect(validateWebhookSecret(requestWithSecret("wrong-value"), "secret-value")).toBe(false);
  });

  it("rejects a missing webhook secret", () => {
    expect(validateWebhookSecret(requestWithSecret(), "secret-value")).toBe(false);
  });
});

describe("parseTelegramUpdate", () => {
  it("accepts a valid message update", () => {
    const update = parseTelegramUpdate({
      update_id: 123,
      message: {
        message_id: 7,
        from: { id: 42, is_bot: false, first_name: "Ada", username: "ada" },
        chat: { id: 100, type: "private" },
        date: 1_700_000_000,
        text: "hello"
      }
    });

    expect(update.update_id).toBe(123);
    expect(update.message?.text).toBe("hello");
    expect(update.message?.from?.username).toBe("ada");
  });

  it("accepts an unsupported update with only update_id", () => {
    expect(parseTelegramUpdate({ update_id: 123 }).message).toBeUndefined();
  });

  it("rejects a malformed Telegram update", () => {
    expect(() => parseTelegramUpdate({ update_id: "123" })).toThrow(ValidationError);
    expect(() => parseTelegramUpdate({ update_id: 123, message: { text: "hello" } })).toThrow(ValidationError);
  });
});

describe("validateRequiredEnv", () => {
  it("rejects missing configuration without exposing values", () => {
    const env = {
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      GEMINI_API_KEY: "",
      DB: undefined
    } as unknown as Env;

    expect(() => validateRequiredEnv(env)).toThrow(ConfigurationError);
    expect(() => validateRequiredEnv(env)).toThrow("TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, DB");
  });
});
