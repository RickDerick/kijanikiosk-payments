'use strict';

const { normalisePhone, toMinorUnits, validatePayment, MAX_AMOUNT } = require('../src/payments');

const validRequest = () => ({
  amount: 1500,
  currency: 'KES',
  phone: '0712345678',
  reference: 'ORDER-1001',
});

describe('normalisePhone', () => {
  test.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['0712 345 678', '254712345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  test.each(['', '12345', '0812345678', '25471234567', 712345678, null])(
    'rejects %p',
    (input) => {
      expect(normalisePhone(input)).toBeNull();
    },
  );
});

describe('toMinorUnits', () => {
  test('converts shillings to integer cents without float errors', () => {
    expect(toMinorUnits(10.1)).toBe(1010);
    expect(toMinorUnits(0.29)).toBe(29);
  });

  test('rejects more than two decimal places', () => {
    expect(toMinorUnits(10.123)).toBeNull();
  });

  test('rejects non-numbers', () => {
    expect(toMinorUnits('100')).toBeNull();
    expect(toMinorUnits(NaN)).toBeNull();
    expect(toMinorUnits(Infinity)).toBeNull();
  });
});

describe('validatePayment', () => {
  test('accepts a valid request and normalises it', () => {
    expect(validatePayment(validRequest())).toEqual({
      valid: true,
      payment: {
        amountCents: 150000,
        currency: 'KES',
        phone: '254712345678',
        reference: 'ORDER-1001',
      },
    });
  });

  test('accepts the maximum amount exactly', () => {
    const result = validatePayment({ ...validRequest(), amount: MAX_AMOUNT });
    expect(result.valid).toBe(true);
  });

  test.each([
    ['zero amount', { amount: 0 }, 'amount must be greater than zero'],
    ['negative amount', { amount: -50 }, 'amount must be greater than zero'],
    ['amount over the limit', { amount: MAX_AMOUNT + 1 }, `amount must not exceed ${MAX_AMOUNT} KES`],
    ['wrong currency', { currency: 'USD' }, 'currency must be KES'],
    ['invalid phone', { phone: '12345' }, 'phone must be a valid Kenyan mobile number'],
    ['blank reference', { reference: '   ' }, 'reference must be 1-20 characters'],
    ['reference too long', { reference: 'X'.repeat(21) }, 'reference must be 1-20 characters'],
  ])('rejects %s', (_label, change, message) => {
    const result = validatePayment({ ...validRequest(), ...change });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(message);
  });

  test('reports every problem at once', () => {
    const result = validatePayment({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});

test('ci-pipeline-verification: deliberate failure', () => {
  expect(true).toBe(false);
});
