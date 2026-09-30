import type { TelegramMessage, TelegramUpdate } from "../telegram/types";

export interface UpdateHandlers {
  handleCommand(command: string, message: TelegramMessage): Promise<void>;
  handleMessage(message: TelegramMessage): Promise<void>;
}

export type RouteResult = "command" | "message" | "ignored";

export function extractCommand(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }

  const firstToken = trimmed.split(/\s+/u, 1)[0];
  if (!firstToken) {
    return undefined;
  }

  const command = firstToken.slice(1).split("@", 1)[0]?.toLowerCase();
  return command || undefined;
}

export class UpdateRouter {
  constructor(private readonly handlers: UpdateHandlers) {}

  async route(update: TelegramUpdate): Promise<RouteResult> {
    const message = update.message;
    const text = message?.text?.trim();

    if (!message || !text) {
      return "ignored";
    }

    const command = extractCommand(text);
    if (command) {
      await this.handlers.handleCommand(command, message);
      return "command";
    }

    await this.handlers.handleMessage(message);
    return "message";
  }
}
