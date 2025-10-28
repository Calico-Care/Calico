import { redact } from '../redact';

describe('redact', () => {
  it('redacts sensitive keys recursively', () => {
    const payload = {
      patient: 'Alice',
      nested: {
        address: '123 Main Street',
        safe: 'value',
      },
      list: [{ phone: '555-111-2222' }],
    };

    expect(redact(payload)).toEqual({
      patient: '[REDACTED]',
      nested: {
        address: '[REDACTED]',
        safe: 'value',
      },
      list: [{ phone: '[REDACTED]' }],
    });
  });

  it('redacts emails and ssn patterns in strings', () => {
    const text =
      'Contact patient alice@example.com with SSN 123-45-6789 or phone +1 (555) 987-6543 today.';

    expect(redact(text)).toBe(
      'Contact patient [REDACTED] with SSN [REDACTED] or phone [REDACTED] today.'
    );
  });

  it('leaves non-sensitive primitives untouched', () => {
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });
});
