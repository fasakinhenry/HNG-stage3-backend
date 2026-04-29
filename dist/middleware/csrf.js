"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueCsrfToken = issueCsrfToken;
exports.requireCsrf = requireCsrf;
const response_1 = require("../utils/response");
const csrf_1 = require("../utils/csrf");
const env_1 = require("../config/env");
function issueCsrfToken(req, res) {
    const existing = req.cookies?.[(0, csrf_1.csrfCookieName)()];
    const token = existing && (0, csrf_1.isCsrfTokenValid)(existing) ? existing : (0, csrf_1.generateCsrfToken)();
    res.cookie((0, csrf_1.csrfCookieName)(), token, {
        httpOnly: false,
        secure: env_1.config.web.cookieSecure,
        sameSite: 'lax',
        domain: env_1.config.web.cookieDomain,
        maxAge: 60 * 60 * 1000,
    });
    res.json({
        status: 'success',
        csrf_token: token,
    });
}
function requireCsrf(req, res, next) {
    const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
    const hasCookieSession = Boolean(req.cookies?.access_token || req.cookies?.refresh_token);
    // CLI/Bearer requests skip CSRF checks; browser cookie-auth requests require it.
    if (hasBearer || !hasCookieSession) {
        next();
        return;
    }
    const tokenFromCookie = req.cookies?.[(0, csrf_1.csrfCookieName)()];
    const tokenFromHeader = req.headers['x-csrf-token'];
    if (!tokenFromCookie || !tokenFromHeader) {
        (0, response_1.sendError)(res, 'CSRF token required', 403);
        return;
    }
    if (tokenFromCookie !== tokenFromHeader || !(0, csrf_1.isCsrfTokenValid)(tokenFromHeader)) {
        (0, response_1.sendError)(res, 'Invalid CSRF token', 403);
        return;
    }
    next();
}
