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

const router = Router();

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

// Authenticated user info
router.get('/me', authenticate, getMe);

export default router;
