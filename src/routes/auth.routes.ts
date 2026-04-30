import { Router } from 'express';
import {
  githubLogin,
  githubCallback,
  refreshTokens,
  logout,
  getMe,
  cliTokenExchange,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { issueCsrfToken, requireCsrf } from '../middleware/csrf';
import { authRateLimiter } from '../middleware/rateLimiter';
import { sendError } from '../utils/response';

const router = Router();

function enforceMethod(method: string) {
  return (req: any, res: any, next: any): void => {
    if (req.method !== method) {
      res.setHeader('Allow', method);
      sendError(res, `${method} method required`, 405);
      return;
    }
    next();
  };
}

// Apply auth rate limiter to all auth routes
router.use(authRateLimiter);

// OAuth flow
router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);
router.get('/csrf', issueCsrfToken);

// CLI-specific: code exchange (PKCE)
router.post('/cli/exchange', cliTokenExchange);

// Token management - enforce POST method first, then handle
router.use('/refresh', enforceMethod('POST'));
router.post('/refresh', requireCsrf, refreshTokens);

router.use('/logout', enforceMethod('POST'));
router.post('/logout', requireCsrf, logout);

// Authenticated user info
router.get('/me', authenticate, getMe);

export default router;
