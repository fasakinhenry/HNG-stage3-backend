"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const csrf_1 = require("../middleware/csrf");
const rateLimiter_1 = require("../middleware/rateLimiter");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
function enforceMethod(method) {
    return (req, res, next) => {
        if (req.method !== method) {
            res.setHeader('Allow', method);
            (0, response_1.sendError)(res, `${method} method required`, 405);
            return;
        }
        next();
    };
}
// Apply auth rate limiter to all auth routes
router.use(rateLimiter_1.authRateLimiter);
// OAuth flow
router.get('/github', auth_controller_1.githubLogin);
router.get('/github/callback', auth_controller_1.githubCallback);
router.get('/csrf', csrf_1.issueCsrfToken);
// CLI-specific: code exchange (PKCE)
router.post('/cli/exchange', auth_controller_1.cliTokenExchange);
// Token management - enforce POST method first, then handle
router.use('/refresh', enforceMethod('POST'));
router.post('/refresh', csrf_1.requireCsrf, auth_controller_1.refreshTokens);
router.use('/logout', enforceMethod('POST'));
router.post('/logout', csrf_1.requireCsrf, auth_controller_1.logout);
// Authenticated user info
router.get('/me', auth_1.authenticate, auth_controller_1.getMe);
exports.default = router;
