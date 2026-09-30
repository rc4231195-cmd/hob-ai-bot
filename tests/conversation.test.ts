import type { D1Database } from "@cloudflare/workers-types";
import { describe, expect, it } from "vitest";
import { ConversationService } from "../src/services/conversation";

interface BoundStatement {
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
}

interface MockDatabase {
  db: D1Database;
  calls: Array<{ query: string; bindings: unknown[] }>;
}

function createMockDatabase(options: { changes?: number; rows?: unknown[] } = {}): MockDatabase {
  const calls: Array<{ query: string; bindings: unknown[] }> = [];
  const changes = options.changes ?? 1;
  const rows = options.rows ?? [];

  const db = {
    prepare(query: string) {
      return {
        bind(...bindings: unknown[]): BoundStatement {
          return {
            async run() {
              calls.push({ query, bindings });
              return { success: true, meta: { changes } };
            },
            async all<T>() {
              calls.push({ query, bindings });
              return { results: rows as T[] };
            },
            async first<T>() {
              calls.push({ query, bindings });
              return (rows[0] ?? null) as T | null;
            }
          };
        }
      };
    },
    async batch(statements: unknown[]) {
      const results = [];
      for (const statement of statements as BoundStatement[]) {
        results.push(await statement.run());
      }
      return results;
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("ConversationService", () => {
  it("saves a message and prunes history in one batch", async () => {
    const { db, calls } = createMockDatabase();
    const service = new ConversationService(db, 20);

    await service.saveMessage("42", "user", "hello");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.query).toContain("INSERT INTO messages");
    expect(calls[0]?.bindings).toEqual(["42", "user", "hello"]);
    expect(calls[1]?.query).toContain("DELETE FROM messages");
    expect(calls[1]?.bindings).toEqual(["42", "42", 20]);
  });

  it("loads bounded recent history in chronological order", async () => {
    const { db, calls } = createMockDatabase({
      rows: [
        { role: "user", content: "first" },
        { role: "model", content: "second" }
      ]
    });
    const service = new ConversationService(db, 2);

    await expect(service.loadRecentHistory("42")).resolves.toEqual([
      { role: "user", text: "first" },
      { role: "model", text: "second" }
    ]);
    expect(calls[0]?.bindings).toEqual(["42", 2]);
  });

  it("resets user history", async () => {
    const { db, calls } = createMockDatabase();
    await new ConversationService(db).resetHistory("42");

    expect(calls[0]?.query).toBe("DELETE FROM messages WHERE telegram_user_id = ?");
    expect(calls[0]?.bindings).toEqual(["42"]);
  });

  it("marks a new update as processed", async () => {
    const { db } = createMockDatabase({ changes: 1 });
    await expect(new ConversationService(db).tryMarkUpdateProcessed(123)).resolves.toBe(true);
  });

  it("detects a duplicate update", async () => {
    const { db } = createMockDatabase({ changes: 0 });
    await expect(new ConversationService(db).tryMarkUpdateProcessed(123)).resolves.toBe(false);
  });
});
