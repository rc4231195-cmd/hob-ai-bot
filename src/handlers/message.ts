import { TELEGRAM_CHUNK_SIZE } from "../config/constants";
import type { GeminiClient } from "../gemini/client";
import type { ConversationService } from "../services/conversation";
import type { TelegramApiClient } from "../telegram/api";
import type { TelegramMessage } from "../telegram/types";
import { chunkText } from "../utils/chunk";

interface MessageHandlerOptions {
  telegram: TelegramApiClient;
  gemini: GeminiClient;
  conversations: ConversationService;
  systemInstruction: string;
}

export class MessageHandler {
  constructor(private readonly options: MessageHandlerOptions) {}

  async handle(message: TelegramMessage): Promise<void> {
    const text = message.text?.trim();
    if (!message.from || !text) {
      return;
    }

    const telegramUserId = String(message.from.id);
    const history = await this.options.conversations.loadRecentHistory(telegramUserId);
    const reply = await this.options.gemini.generateReply({
      systemInstruction: this.options.systemInstruction,
      history,
      message: text
    });

    await this.options.conversations.saveMessage(telegramUserId, "user", text);
    await this.options.conversations.saveMessage(telegramUserId, "model", reply);

    for (const chunk of chunkText(reply, TELEGRAM_CHUNK_SIZE)) {
      await this.options.telegram.sendMessage({
        chatId: message.chat.id,
        text: chunk,
        replyToMessageId: message.message_id
      });
    }
  }
}
