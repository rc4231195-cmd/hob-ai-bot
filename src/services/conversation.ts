import type { D1Database } from "@cloudflare/workers-types";
import { HISTORY_LIMIT } from "../config/constants";
import type { ChatMessage, ChatRole } from "../gemini/types";
import { DatabaseError } from "../utils/errors";

interface MessageRow {
  role: ChatRole;
  content: string;
}

function databaseMessage(error: unknown, action: string): DatabaseError {
  return new DatabaseError(
    `Failed to ${action}: ${error instanceof Error ? error.message : "unknown error"}`
  );
}

export class ConversationService {
  constructor(
    private readonly db: D1Database,
    private readonly historyLimit = HISTORY_LIMIT
  ) {
    if (!Number.isSafeInteger(historyLimit) || historyLimit <= 0) {
      throw new RangeError("historyLimit must be a positive safe integer");
    }
  }

  async saveMessage(telegramUserId: string, role: ChatRole, content: string): Promise<void> {
    try {
      await this.db.batch([
        this.db
          .prepare("INSERT INTO messages (telegram_user_id, role, content) VALUES (?, ?, ?)")
          .bind(telegramUserId, role, content),
        this.db
          .prepare(
            `DELETE FROM messages
             WHERE telegram_user_id = ?
               AND id NOT IN (
                 SELECT id FROM messages
                 WHERE telegram_user_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?
               )`
          )
          .bind(telegramUserId, telegramUserId, this.historyLimit)
      ]);
    } catch (error) {
      throw databaseMessage(error, "save conversation message");
    }
  }

  async loadRecentHistory(telegramUserId: string): Promise<ChatMessage[]> {
    try {
      const result = await this.db
        .prepare(
          `SELECT role, content FROM (
             SELECT id, role, content, created_at
             FROM messages
             WHERE telegram_user_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?
           )
           ORDER BY created_at ASC, id ASC`
        )
        .bind(telegramUserId, this.historyLimit)
        .all<MessageRow>();

      return (result.results ?? []).map((row) => ({ role: row.role, text: row.content }));
    } catch (error) {
      throw databaseMessage(error, "load conversation history");
    }
  }

  async resetHistory(telegramUserId: string): Promise<void> {
    try {
      await this.db
        .prepare("DELETE FROM messages WHERE telegram_user_id = ?")
        .bind(telegramUserId)
        .run();
    } catch (error) {
      throw databaseMessage(error, "reset conversation history");
    }
  }

  async tryMarkUpdateProcessed(updateId: number): Promise<boolean> {
    try {
      const result = await this.db
        .prepare("INSERT OR IGNORE INTO processed_updates (update_id) VALUES (?)")
        .bind(updateId)
        .run();

      return (result.meta.changes ?? 0) > 0;
    } catch (error) {
      throw databaseMessage(error, "record processed update");
    }
  }
}
