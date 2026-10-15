'use strict';

// Business rules for a KijaniKiosk payment request.
const CURRENCY = 'KES';
const MAX_AMOUNT = 150000; // per-transaction limit, in shillings
const MAX_REFERENCE_LENGTH = 20;

// Kenyan mobile numbers in international form: 254 followed by 7xx or 1xx
const PHONE_PATTERN = /^254(7|1)\d{8}$/;

/**
 * Convert common Kenyan phone formats to 2547XXXXXXXX / 2541XXXXXXXX.
 * Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX and 2547XXXXXXXX.
 * Returns null if the input cannot be normalised.
 */
function normalisePhone(input) {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '');
  let phone = digits;
  if (/^0(7|1)\d{8}$/.test(digits)) {
    phone = `254${digits.slice(1)}`;
  }
  return PHONE_PATTERN.test(phone) ? phone : null;
}

/**
 * Convert shillings to cents as an integer, avoiding floating-point errors.
 * 10.1 -> 1010. Returns null for more than two decimal places.
 */
function toMinorUnits(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  if (Math.abs(cents - amount * 100) > 1e-6) return null;
  return cents;
}

/**
 * Validate a payment request.
 * Returns { valid: true, payment } with normalised values,
 * or { valid: false, errors: [...] }.
 */
function validatePayment(request) {
  const errors = [];
  const body = request || {};

  const cents = toMinorUnits(body.amount);
  if (cents === null) {
    errors.push('amount must be a number with at most two decimal places');
  } else if (cents <= 0) {
    errors.push('amount must be greater than zero');
  } else if (cents > MAX_AMOUNT * 100) {
    errors.push(`amount must not exceed ${MAX_AMOUNT} ${CURRENCY}`);
  }

  if (body.currency !== CURRENCY) {
    errors.push(`currency must be ${CURRENCY}`);
  }

  const phone = normalisePhone(body.phone);
  if (phone === null) {
    errors.push('phone must be a valid Kenyan mobile number');
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (reference.length === 0 || reference.length > MAX_REFERENCE_LENGTH) {
    errors.push(`reference must be 1-${MAX_REFERENCE_LENGTH} characters`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payment: { amountCents: cents, currency: CURRENCY, phone, reference },
  };
}

module.exports = {
  CURRENCY,
  MAX_AMOUNT,
  normalisePhone,
  toMinorUnits,
  validatePayment,
};
