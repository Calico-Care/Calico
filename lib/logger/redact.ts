const MAX_DEPTH = 6;

const KEY_TOKENS = ['patient', 'phi', 'ssn', 'dob', 'mrn', 'address', 'phone', 'email'];

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SSN_REGEX = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]?){13,16}\b/g;
const URL_REGEX = /\bhttps?:\/\/[^\s?#]+(?:[^\s]*)?/gi;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function shouldRedactKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return KEY_TOKENS.some((token) => normalized.includes(token));
}

export function redactString(input: string): string {
  if (!input) {
    return input;
  }
  return input
    .replace(URL_REGEX, '[REDACTED_URL]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(SSN_REGEX, '[REDACTED_SSN]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]')
    .replace(CREDIT_CARD_REGEX, '[REDACTED_CC]');
}

function convertMap(
  map: Map<unknown, unknown>,
  depth: number,
  visited: WeakSet<object>
): JsonValue {
  if (visited.has(map)) {
    return '[CYCLE]';
  }
  visited.add(map);
  const result: Record<string, JsonValue> = {};
  map.forEach((mapValue, mapKey) => {
    const key = typeof mapKey === 'string' ? mapKey : String(mapKey);
    result[key] = redactValue(mapValue, depth + 1, visited);
  });
  visited.delete(map);
  return result;
}

function convertSet(set: Set<unknown>, depth: number, visited: WeakSet<object>): JsonValue {
  if (visited.has(set)) {
    return '[CYCLE]';
  }
  visited.add(set);
  const result = Array.from(set).map((item) => redactValue(item, depth + 1, visited));
  visited.delete(set);
  return result;
}

function redactValue(value: unknown, depth: number, visited: WeakSet<object>): JsonValue {
  if (depth > MAX_DEPTH) {
    return '[TRUNCATED]';
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return '[CYCLE]';
    }
    visited.add(value);
    const result = value.map((item) => redactValue(item, depth + 1, visited));
    visited.delete(value);
    return result;
  }

  if (value instanceof Map) {
    return convertMap(value, depth, visited);
  }

  if (value instanceof Set) {
    return convertSet(value, depth, visited);
  }

  if (typeof value === 'object') {
    if (visited.has(value as object)) {
      return '[CYCLE]';
    }
    visited.add(value as object);
    const entries = Object.entries(value as Record<string, unknown>);
    const result: Record<string, JsonValue> = {};
    for (const [key, entryValue] of entries) {
      if (shouldRedactKey(key)) {
        result[key] = '[REDACTED]';
        continue;
      }
      result[key] = redactValue(entryValue, depth + 1, visited);
    }
    visited.delete(value as object);
    return result;
  }

  return redactString(String(value));
}

export function redactFields(
  value: Record<string, unknown> | undefined
): Record<string, JsonValue> | undefined {
  if (!value) {
    return undefined;
  }

  const visited = new WeakSet<object>();
  return redactValue(value, 0, visited) as Record<string, JsonValue>;
}

export type RedactedContext = Record<string, JsonValue>;

export type { JsonValue };
