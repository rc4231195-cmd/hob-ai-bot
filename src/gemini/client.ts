import { GEMINI_TIMEOUT_MS } from "../config/constants";
import { GeminiApiError } from "../utils/errors";
import type { ChatMessage, GeminiContent, GeminiResponse, GenerateTextParams } from "./types";

interface GeminiClientOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function toGeminiContent(message: ChatMessage): GeminiContent {
  return {
    role: message.role,
    parts: [{ text: message.text }]
  };
}

export class GeminiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: GeminiClientOptions) {
    if (!options.apiKey) {
      throw new GeminiApiError("Gemini API key is required", 500);
    }
    if (!options.model) {
      throw new GeminiApiError("Gemini model is required", 500);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
  }

  async generateReply(params: GenerateTextParams): Promise<string> {
    const message = params.message.trim();
    if (!message) {
      throw new GeminiApiError("Cannot send an empty message to Gemini", 400);
    }

    const response = await this.request({
      systemInstruction: {
        parts: [{ text: params.systemInstruction }]
      },
      contents: [...params.history.map(toGeminiContent), { role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        ...params.generationConfig
      }
    });

    if (response.promptFeedback?.blockReason) {
      throw new GeminiApiError(`Gemini blocked the request: ${response.promptFeedback.blockReason}`, 400);
    }

    const text = response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new GeminiApiError("Gemini returned a malformed or empty response");
    }

    return text;
  }

  private async request(body: Record<string, unknown>): Promise<GeminiResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.options.model
    )}:generateContent`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.options.apiKey
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new GeminiApiError(
        `Gemini request failed: ${error instanceof Error ? error.message : "network error"}`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new GeminiApiError(`Gemini returned invalid JSON with HTTP ${response.status}`);
    }

    if (!response.ok) {
      throw new GeminiApiError(`Gemini API request failed with HTTP ${response.status}`, response.status);
    }

    return payload as GeminiResponse;
  }
}
