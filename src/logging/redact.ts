const SENSITIVE_KEY_REGEX = /(patient|phi|ssn|dob|mrn|address|phone|email)/i;
const REDACTION_PLACEHOLDER = '[REDACTED]';

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu;
const SSN_REGEX = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const PHONE_REGEX = /\+?\d[\d\s\-().]{7,}\d/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_REGEX, REDACTION_PLACEHOLDER)
    .replace(SSN_REGEX, REDACTION_PLACEHOLDER)
    .replace(PHONE_REGEX, REDACTION_PLACEHOLDER);
}

function redactValue<T>(value: T): T {
  if (value === null || typeof value === 'undefined') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item)) as unknown as T;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, val]) => {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = REDACTION_PLACEHOLDER;
      } else {
        result[key] = redactValue(val);
      }
    });
    return result as T;
  }

  if (typeof value === 'string') {
    return sanitizeString(value) as unknown as T;
  }

  return value;
}

export function redact<T>(input: T): T {
  if (typeof input === 'object' && input !== null) {
    return redactValue(input);
  }
  if (typeof input === 'string') {
    return sanitizeString(input) as unknown as T;
  }
  return input;
}

export { REDACTION_PLACEHOLDER };
