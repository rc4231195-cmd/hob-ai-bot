import type { D1Database } from "@cloudflare/workers-types";
import type { TelegramUser } from "../telegram/types";
import { DatabaseError } from "../utils/errors";

export class UserService {
  constructor(private readonly db: D1Database) {}

  async upsertUser(user: TelegramUser): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO users (telegram_user_id, username, first_name, last_name)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(telegram_user_id) DO UPDATE SET
             username = excluded.username,
             first_name = excluded.first_name,
             last_name = excluded.last_name,
             updated_at = CURRENT_TIMESTAMP`
        )
        .bind(String(user.id), user.username ?? null, user.first_name, user.last_name ?? null)
        .run();
    } catch (error) {
      throw new DatabaseError(
        `Failed to upsert Telegram user: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }
}
