import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { csrfCookieName, generateCsrfToken, isCsrfTokenValid } from '../utils/csrf';
import { config } from '../config/env';

export function issueCsrfToken(req: Request, res: Response): void {
  const existing = req.cookies?.[csrfCookieName()] as string | undefined;
  const token = existing && isCsrfTokenValid(existing) ? existing : generateCsrfToken();

  res.cookie(csrfCookieName(), token, {
    httpOnly: false,
    secure: config.web.cookieSecure,
    sameSite: 'lax',
    domain: config.web.cookieDomain,
    maxAge: 60 * 60 * 1000,
  });

  res.json({
    status: 'success',
    csrf_token: token,
  });
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
  const hasCookieSession = Boolean(req.cookies?.access_token || req.cookies?.refresh_token);

  // CLI/Bearer requests skip CSRF checks; browser cookie-auth requests require it.
  if (hasBearer || !hasCookieSession) {
    next();
    return;
  }

  const tokenFromCookie = req.cookies?.[csrfCookieName()] as string | undefined;
  const tokenFromHeader = req.headers['x-csrf-token'] as string | undefined;

  if (!tokenFromCookie || !tokenFromHeader) {
    sendError(res, 'CSRF token required', 403);
    return;
  }

  if (tokenFromCookie !== tokenFromHeader || !isCsrfTokenValid(tokenFromHeader)) {
    sendError(res, 'Invalid CSRF token', 403);
    return;
  }

  next();
}
