import { describe, expect, it, vi } from "vitest";
import { extractCommand, UpdateRouter, type UpdateHandlers } from "../src/router/update-router";
import type { TelegramMessage, TelegramUpdate } from "../src/telegram/types";

function message(text?: string): TelegramMessage {
  return {
    message_id: 1,
    from: { id: 42, is_bot: false, first_name: "Ada" },
    chat: { id: 100, type: "private" },
    date: 1_700_000_000,
    ...(text === undefined ? {} : { text })
  };
}

function update(text?: string): TelegramUpdate {
  return { update_id: 1, message: message(text) };
}

function handlers(): UpdateHandlers & {
  handleCommand: ReturnType<typeof vi.fn>;
  handleMessage: ReturnType<typeof vi.fn>;
} {
  return {
    handleCommand: vi.fn(async () => undefined),
    handleMessage: vi.fn(async () => undefined)
  };
}

describe("UpdateRouter", () => {
  it.each(["start", "help", "reset", "about"])("routes /%s", async (command) => {
    const deps = handlers();
    const router = new UpdateRouter(deps);

    await expect(router.route(update(`/${command}`))).resolves.toBe("command");
    expect(deps.handleCommand).toHaveBeenCalledWith(command, expect.objectContaining({ text: `/${command}` }));
    expect(deps.handleMessage).not.toHaveBeenCalled();
  });

  it("routes bot-mention commands", async () => {
    const deps = handlers();
    await new UpdateRouter(deps).route(update("/start@HOB_Bot"));

    expect(deps.handleCommand).toHaveBeenCalledWith("start", expect.any(Object));
  });

  it("routes unknown commands to the command handler", async () => {
    const deps = handlers();
    await new UpdateRouter(deps).route(update("/unknown"));

    expect(deps.handleCommand).toHaveBeenCalledWith("unknown", expect.any(Object));
  });

  it("routes normal messages", async () => {
    const deps = handlers();
    await expect(new UpdateRouter(deps).route(update("Tell me about Cloudflare"))).resolves.toBe("message");

    expect(deps.handleMessage).toHaveBeenCalledOnce();
    expect(deps.handleCommand).not.toHaveBeenCalled();
  });

  it("ignores unsupported or empty updates", async () => {
    const deps = handlers();
    const router = new UpdateRouter(deps);

    await expect(router.route({ update_id: 1 })).resolves.toBe("ignored");
    await expect(router.route(update("   "))).resolves.toBe("ignored");
    expect(deps.handleCommand).not.toHaveBeenCalled();
    expect(deps.handleMessage).not.toHaveBeenCalled();
  });
});

describe("extractCommand", () => {
  it("extracts normalized commands", () => {
    expect(extractCommand("/HELP now")).toBe("help");
    expect(extractCommand("/about@some_bot")).toBe("about");
    expect(extractCommand("hello")).toBeUndefined();
    expect(extractCommand("/")).toBeUndefined();
  });
});
