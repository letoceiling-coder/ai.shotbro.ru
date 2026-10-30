import type { NormalizedProviderError } from "./provider-contracts.js";

export function normalizeHttpProviderError(input: {
  status: number;
  body?: unknown;
  providerId: string;
}): NormalizedProviderError {
  // OpenRouter: {"error":{"message":"..."}}; others: {"error":"..."}.
  const rawError = typeof input.body === "object" && input.body !== null && "error" in input.body ? (input.body as { error?: unknown }).error : undefined;
  const bodyMsg =
    rawError == null
      ? undefined
      : typeof rawError === "object" && typeof (rawError as { message?: unknown }).message === "string"
        ? (rawError as { message: string }).message.slice(0, 500)
        : typeof rawError === "string"
          ? rawError.slice(0, 500)
          : JSON.stringify(rawError).slice(0, 500);

  if (input.status === 401 || input.status === 403) {
    return {
      code: "INVALID_CREDENTIALS",
      message: bodyMsg ?? "Invalid provider credentials",
      retryable: false,
      httpStatus: input.status,
    };
  }
  if (input.status === 422 || input.status === 400) {
    return {
      code: "INVALID_REQUEST",
      message: bodyMsg ?? "Invalid request",
      retryable: false,
      httpStatus: input.status,
    };
  }
  if (input.status === 429) {
    return {
      code: "RATE_LIMITED",
      message: bodyMsg ?? "Rate limited",
      retryable: true,
      httpStatus: input.status,
    };
  }
  if (input.status >= 500) {
    return {
      code: "PROVIDER_5XX",
      message: bodyMsg ?? "Provider server error",
      retryable: true,
      httpStatus: input.status,
    };
  }
  return {
    code: "PROVIDER_HTTP_ERROR",
    message: bodyMsg ?? `HTTP ${input.status}`,
    retryable: input.status >= 500,
    httpStatus: input.status,
  };
}

export function mapTransportError(err: unknown, providerId: string): NormalizedProviderError {
  if (err instanceof Error) {
    if (/timeout|ETIMEDOUT|AbortError/i.test(err.message)) {
      return { code: "TIMEOUT", message: err.message, retryable: true };
    }
    if (/blocked|disabled|MOCK_ONLY|LIVE_CONFIGURED/i.test(err.message)) {
      return { code: "EXECUTION_BLOCKED", message: err.message, retryable: false };
    }
    return { code: `${providerId.toUpperCase()}_ERROR`, message: err.message, retryable: false };
  }
  return { code: "UNKNOWN", message: "Unknown error", retryable: false };
}
