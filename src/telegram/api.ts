import { TELEGRAM_TIMEOUT_MS } from "../config/constants";
import { TelegramApiError } from "../utils/errors";
import type {
  SendMessageOptions,
  SetWebhookOptions,
  TelegramApiEnvelope,
  TelegramMessage,
  TelegramUser,
  WebhookInfo
} from "./types";

interface TelegramClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class TelegramApiClient {
  private readonly baseUrl = "https://api.telegram.org";
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: TelegramClientOptions) {
    if (!options.token) {
      throw new TelegramApiError("Telegram bot token is required", 500);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? TELEGRAM_TIMEOUT_MS;
  }

  async getMe(): Promise<TelegramUser> {
    return this.request<TelegramUser>("getMe");
  }

  async setWebhook(options: SetWebhookOptions): Promise<boolean> {
    return this.request<boolean>("setWebhook", {
      url: options.url,
      secret_token: options.secretToken,
      allowed_updates: options.allowedUpdates ?? ["message"],
      drop_pending_updates: options.dropPendingUpdates ?? false
    });
  }

  async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
    return this.request<boolean>("deleteWebhook", {
      drop_pending_updates: dropPendingUpdates
    });
  }

  async getWebhookInfo(): Promise<WebhookInfo> {
    return this.request<WebhookInfo>("getWebhookInfo");
  }

  async sendMessage(options: SendMessageOptions): Promise<TelegramMessage> {
    return this.request<TelegramMessage>("sendMessage", {
      chat_id: options.chatId,
      text: options.text,
      reply_to_message_id: options.replyToMessageId,
      disable_web_page_preview: true
    });
  }

  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/bot${this.options.token}/${method}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? null : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new TelegramApiError(
        `Telegram request failed: ${error instanceof Error ? error.message : "network error"}`
      );
    }

    let payload: TelegramApiEnvelope<T>;
    try {
      payload = (await response.json()) as TelegramApiEnvelope<T>;
    } catch {
      throw new TelegramApiError(`Telegram returned invalid JSON with HTTP ${response.status}`);
    }

    if (!response.ok || payload.ok !== true || payload.result === undefined) {
      const description = payload.description ?? `HTTP ${response.status}`;
      throw new TelegramApiError(`Telegram API error: ${description}`, response.status);
    }

    return payload.result;
  }
}
