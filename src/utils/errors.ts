export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class TelegramApiError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
  }
}

export class GeminiApiError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export function errorDetails(error: unknown): Record<string, string | number | undefined> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error instanceof AppError ? error.statusCode : undefined
    };
  }

  return { message: String(error) };
}

export function logError(context: string, error: unknown): void {
  console.error(JSON.stringify({ context, error: errorDetails(error) }));
}
