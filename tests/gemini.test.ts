import { describe, expect, it, vi } from "vitest";
import { GeminiClient } from "../src/gemini/client";
import { GeminiApiError } from "../src/utils/errors";

function geminiResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text }]
          }
        }
      ]
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("GeminiClient", () => {
  it("returns a successful response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(geminiResponse("Hello from Gemini"));
    const client = new GeminiClient({ apiKey: "test-key", model: "test-model", fetchImpl: fetchMock });

    await expect(
      client.generateReply({
        systemInstruction: "Be helpful",
        history: [{ role: "user", text: "previous" }],
        message: "hello"
      })
    ).resolves.toBe("Hello from Gemini");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("test-model:generateContent");
    expect(init?.headers).toMatchObject({ "x-goog-api-key": "test-key" });

    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string }>;
    };
    expect(body.systemInstruction.parts[0]?.text).toBe("Be helpful");
    expect(body.contents.map((item) => item.role)).toEqual(["user", "user"]);
  });

  it("rejects malformed responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    const client = new GeminiClient({ apiKey: "test-key", model: "test-model", fetchImpl: fetchMock });

    await expect(
      client.generateReply({ systemInstruction: "Be helpful", history: [], message: "hello" })
    ).rejects.toThrow(GeminiApiError);
  });

  it("rejects HTTP failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
    );
    const client = new GeminiClient({ apiKey: "test-key", model: "test-model", fetchImpl: fetchMock });

    await expect(
      client.generateReply({ systemInstruction: "Be helpful", history: [], message: "hello" })
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it("wraps timeout and network errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const client = new GeminiClient({ apiKey: "test-key", model: "test-model", fetchImpl: fetchMock });

    await expect(
      client.generateReply({ systemInstruction: "Be helpful", history: [], message: "hello" })
    ).rejects.toThrow("Gemini request failed");
  });
});
