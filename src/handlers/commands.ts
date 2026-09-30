import type { ConversationService } from "../services/conversation";
import type { TelegramApiClient } from "../telegram/api";
import type { TelegramMessage } from "../telegram/types";

const START_MESSAGE = [
  "Hello — I’m HOB, an AI assistant powered by Google Gemini.",
  "Send me a message and I’ll reply here in Telegram.",
  "Use /help to see what I can do."
].join("\n");

const HELP_MESSAGE = [
  "Available commands:",
  "/start — show the introduction",
  "/help — show this help message",
  "/reset — clear your conversation context",
  "/about — show bot information",
  "",
  "For normal chat, just send a text message."
].join("\n");

const ABOUT_MESSAGE = [
  "HOB Telegram AI",
  "A production-ready Telegram bot powered by Google Gemini and Cloudflare Workers.",
  "Conversation context is stored in Cloudflare D1 and can be cleared with /reset."
].join("\n");

const UNKNOWN_COMMAND_MESSAGE = "Unknown command. Use /help to see the available commands.";

export class CommandHandler {
  constructor(
    private readonly telegram: TelegramApiClient,
    private readonly conversations: ConversationService
  ) {}

  async handle(command: string, message: TelegramMessage): Promise<void> {
    switch (command) {
      case "start":
        await this.reply(message, START_MESSAGE);
        return;
      case "help":
        await this.reply(message, HELP_MESSAGE);
        return;
      case "reset":
        await this.reset(message);
        return;
      case "about":
        await this.reply(message, ABOUT_MESSAGE);
        return;
      default:
        await this.reply(message, UNKNOWN_COMMAND_MESSAGE);
    }
  }

  private async reset(message: TelegramMessage): Promise<void> {
    if (!message.from) {
      await this.reply(message, "I could not identify this Telegram user, so the conversation was not reset.");
      return;
    }

    await this.conversations.resetHistory(String(message.from.id));
    await this.reply(message, "Your conversation context has been reset.");
  }

  private async reply(message: TelegramMessage, text: string): Promise<void> {
    await this.telegram.sendMessage({
      chatId: message.chat.id,
      text,
      replyToMessageId: message.message_id
    });
  }
}
