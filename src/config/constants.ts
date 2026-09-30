export const SERVICE_NAME = "hob-ai-bot";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const HISTORY_LIMIT = 20;
export const TELEGRAM_CHUNK_SIZE = 4000;
export const TELEGRAM_TIMEOUT_MS = 10_000;
export const GEMINI_TIMEOUT_MS = 20_000;
export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export const DEFAULT_SYSTEM_INSTRUCTION = [
  "You are HOB, a helpful AI assistant running inside Telegram.",
  "Answer clearly, accurately, and concisely.",
  "When the user asks for code, provide practical working examples.",
  "If you are uncertain, say so rather than inventing facts."
].join("\n");

export const GENERIC_USER_ERROR =
  "Sorry, I could not process that right now. Please try again in a moment.";
