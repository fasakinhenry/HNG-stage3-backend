import crypto from 'crypto';
import { config } from '../config/env';

const CSRF_COOKIE = 'csrf_token';

export function csrfCookieName() {
  return CSRF_COOKIE;
}

export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const signature = crypto
    .createHmac('sha256', config.csrf.secret)
    .update(nonce)
    .digest('hex');

  return `${nonce}.${signature}`;
}

export function isCsrfTokenValid(token: string): boolean {
  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', config.csrf.secret)
    .update(nonce)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
