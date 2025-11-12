type ErrorLogger = (message: string, context: Record<string, unknown>) => void;

const defaultLogger: ErrorLogger = (message, context) => {
  console.error(message, context);
};

function serializeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

export function buildErrorResponse(
  message: string,
  error: unknown,
  logger: ErrorLogger | null = defaultLogger
) {
  const details = serializeErrorDetails(error);

  if (logger) {
    logger("Edge function error", { message, ...details });
  }

  return {
    error: message,
    details: details.message,
  };
}
