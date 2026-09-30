export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export interface GeminiPart {
  text?: string;
}

export interface GeminiContent {
  role: ChatRole;
  parts: GeminiPart[];
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface GenerateTextParams {
  systemInstruction: string;
  history: readonly ChatMessage[];
  message: string;
  generationConfig?: GenerationConfig;
}

export interface GeminiCandidate {
  content?: {
    role?: string;
    parts?: GeminiPart[];
  };
  finishReason?: string;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}
