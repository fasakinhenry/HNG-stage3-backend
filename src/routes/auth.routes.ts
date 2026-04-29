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

function methodNotAllowed(allowedMethods: string[]) {
  return (_req: any, res: any): void => {
    res.setHeader('Allow', allowedMethods.join(', '));
    sendError(res, 'Method not allowed', 405);
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

// Token management
router.post('/refresh', requireCsrf, refreshTokens);
router.post('/logout', requireCsrf, logout);
router.all('/refresh', methodNotAllowed(['POST']));
router.all('/logout', methodNotAllowed(['POST']));

// Authenticated user info
router.get('/me', authenticate, getMe);

export default router;
