"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubLogin = githubLogin;
exports.githubCallback = githubCallback;
exports.cliTokenExchange = cliTokenExchange;
exports.refreshTokens = refreshTokens;
exports.logout = logout;
exports.getMe = getMe;
const env_1 = require("../config/env");
const User_1 = require("../models/User");
const github_1 = require("../services/github");
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const csrf_1 = require("../utils/csrf");
const pkceStore = new Map();
// Prune stale entries every minute (entries older than 10 minutes)
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of pkceStore.entries()) {
        if (val.createdAt < cutoff)
            pkceStore.delete(key);
    }
}, 60_000);
// ─── Helper: build user info object ──────────────────────────────────────────
function userInfo(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
    };
}
// ─── Helper: upsert GitHub user ───────────────────────────────────────────────
async function upsertGitHubUser(githubUserId, login, email, avatarUrl) {
    const isAdmin = env_1.config.admin.githubUsername === login;
    let user = await User_1.User.findOne({ github_id: String(githubUserId) });
    if (!user) {
        user = await User_1.User.create({
            github_id: String(githubUserId),
            username: login,
            email,
            avatar_url: avatarUrl,
            role: isAdmin ? 'admin' : 'analyst',
            is_active: true,
            last_login_at: new Date(),
        });
    }
    else {
        user.username = login;
        user.avatar_url = avatarUrl;
        if (email)
            user.email = email;
        // Promote to admin if matches bootstrap username but isn't yet
        if (isAdmin && user.role !== 'admin')
            user.role = 'admin';
        user.last_login_at = new Date();
        await user.save();
    }
    return user;
}
// ─── Helper: issue a token pair and store refresh token ──────────────────────
async function issueTokens(user) {
    const userId = user._id;
    const payload = { sub: userId, username: user.username, role: user.role };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    await (0, jwt_1.storeRefreshToken)(userId, refreshToken);
    return { accessToken, refreshToken };
}
// ─── GET /api/v1/auth/github ──────────────────────────────────────────────────
// Redirects to GitHub OAuth. Stores PKCE params in memory keyed by state.
async function githubLogin(req, res) {
    const state = req.query.state || crypto.randomUUID();
    const codeVerifier = req.query.code_verifier;
    const codeChallenge = req.query.code_challenge;
    const codeChallengeMethod = req.query.code_challenge_method || 'S256';
    const cliCallbackUrl = req.query.cli_callback;
    // Store PKCE entry — keyed by state so callback can retrieve it
    if (codeVerifier) {
        pkceStore.set(state, { codeVerifier, cliCallbackUrl, createdAt: Date.now() });
    }
    const params = new URLSearchParams({
        client_id: env_1.config.github.clientId,
        redirect_uri: env_1.config.github.callbackUrl,
        scope: 'read:user user:email',
        state,
    });
    // GitHub supports PKCE for OAuth Apps (optional but included for completeness)
    if (codeChallenge) {
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', codeChallengeMethod);
    }
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
// ─── GET /api/v1/auth/github/callback ────────────────────────────────────────
// GitHub redirects here after user authorises.
async function githubCallback(req, res) {
    const code = req.query.code;
    const state = req.query.state;
    if (!code) {
        (0, response_1.sendError)(res, 'Missing OAuth code', 400);
        return;
    }
    try {
        // Pull PKCE entry from store (and remove it — single use)
        let codeVerifier;
        let cliCallbackUrl;
        if (state) {
            const entry = pkceStore.get(state);
            if (entry) {
                codeVerifier = entry.codeVerifier;
                cliCallbackUrl = entry.cliCallbackUrl;
                pkceStore.delete(state); // consumed
            }
        }
        // Exchange auth code → GitHub access token
        const githubToken = await (0, github_1.exchangeCodeForToken)(code, codeVerifier);
        const githubUser = await (0, github_1.getGitHubUser)(githubToken.access_token);
        const email = githubUser.email || (await (0, github_1.getGitHubUserEmail)(githubToken.access_token));
        const user = await upsertGitHubUser(githubUser.id, githubUser.login, email, githubUser.avatar_url);
        if (!user.is_active) {
            (0, response_1.sendError)(res, 'Account is deactivated', 403);
            return;
        }
        const { accessToken, refreshToken } = await issueTokens(user);
        // ── CLI flow: redirect to localhost callback with tokens in query ──────
        if (cliCallbackUrl) {
            const qs = new URLSearchParams({
                access_token: accessToken,
                refresh_token: refreshToken,
                user: JSON.stringify(userInfo(user)),
                state: state || '',
            });
            res.redirect(`${cliCallbackUrl}?${qs.toString()}`);
            return;
        }
        // ── Web flow: HTTP-only cookies + redirect to portal dashboard ─────────
        res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: env_1.config.web.cookieSecure,
            sameSite: 'lax',
            domain: env_1.config.web.cookieDomain,
            maxAge: 3 * 60 * 1000, // 3 min
        });
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: env_1.config.web.cookieSecure,
            sameSite: 'lax',
            domain: env_1.config.web.cookieDomain,
            maxAge: 5 * 60 * 1000, // 5 min
            path: '/api/v1/auth/refresh',
        });
        res.cookie((0, csrf_1.csrfCookieName)(), (0, csrf_1.generateCsrfToken)(), {
            httpOnly: false,
            secure: env_1.config.web.cookieSecure,
            sameSite: 'lax',
            domain: env_1.config.web.cookieDomain,
            maxAge: 60 * 60 * 1000,
        });
        res.redirect(`${env_1.config.web.origin}/dashboard`);
    }
    catch (err) {
        console.error('GitHub OAuth callback error:', err);
        (0, response_1.sendError)(res, 'Authentication failed', 500);
    }
}
// ─── POST /api/v1/auth/cli/exchange ──────────────────────────────────────────
// CLI-only: accepts the raw code + code_verifier, handles the GitHub exchange
// server-side, and returns tokens as JSON. Used as the fallback flow when the
// backend cannot redirect to localhost (e.g. strict firewall).
async function cliTokenExchange(req, res) {
    const { code, code_verifier } = req.body;
    if (!code) {
        (0, response_1.sendError)(res, 'code is required', 400);
        return;
    }
    if (!code_verifier) {
        (0, response_1.sendError)(res, 'code_verifier is required', 400);
        return;
    }
    try {
        const githubToken = await (0, github_1.exchangeCodeForToken)(code, code_verifier);
        const githubUser = await (0, github_1.getGitHubUser)(githubToken.access_token);
        const email = githubUser.email || (await (0, github_1.getGitHubUserEmail)(githubToken.access_token));
        const user = await upsertGitHubUser(githubUser.id, githubUser.login, email, githubUser.avatar_url);
        if (!user.is_active) {
            (0, response_1.sendError)(res, 'Account is deactivated', 403);
            return;
        }
        const { accessToken, refreshToken } = await issueTokens(user);
        res.json({
            status: 'success',
            access_token: accessToken,
            refresh_token: refreshToken,
            user: userInfo(user),
        });
    }
    catch (err) {
        console.error('CLI token exchange error:', err);
        (0, response_1.sendError)(res, 'Token exchange failed', 500);
    }
}
// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
// Single-use refresh: old token is revoked immediately, new pair is issued.
async function refreshTokens(req, res) {
    const token = req.body?.refresh_token || req.cookies?.refresh_token;
    if (!token) {
        (0, response_1.sendError)(res, 'Refresh token required', 400);
        return;
    }
    try {
        let payload;
        try {
            payload = (0, jwt_1.verifyRefreshToken)(token);
        }
        catch {
            (0, response_1.sendError)(res, 'Invalid or expired refresh token', 401);
            return;
        }
        if (payload.type !== 'refresh') {
            (0, response_1.sendError)(res, 'Invalid token type', 401);
            return;
        }
        const isValid = await (0, jwt_1.isRefreshTokenValid)(token);
        if (!isValid) {
            (0, response_1.sendError)(res, 'Refresh token has been revoked', 401);
            return;
        }
        // Find user by _id (UUID stored in JWT sub)
        const user = await User_1.User.findById(payload.sub);
        if (!user || !user.is_active) {
            (0, response_1.sendError)(res, 'User not found or deactivated', 403);
            return;
        }
        // Revoke old token first (single-use guarantee)
        await (0, jwt_1.revokeRefreshToken)(token);
        const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
        // Refresh cookies for web portal
        if (req.cookies?.refresh_token) {
            res.cookie('access_token', accessToken, {
                httpOnly: true,
                secure: env_1.config.web.cookieSecure,
                sameSite: 'lax',
                domain: env_1.config.web.cookieDomain,
                maxAge: 3 * 60 * 1000,
            });
            res.cookie('refresh_token', newRefreshToken, {
                httpOnly: true,
                secure: env_1.config.web.cookieSecure,
                sameSite: 'lax',
                domain: env_1.config.web.cookieDomain,
                maxAge: 5 * 60 * 1000,
                path: '/api/v1/auth/refresh',
            });
        }
        res.json({
            status: 'success',
            access_token: accessToken,
            refresh_token: newRefreshToken,
        });
    }
    catch (err) {
        console.error('Token refresh error:', err);
        (0, response_1.sendError)(res, 'Token refresh failed', 500);
    }
}
// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
async function logout(req, res) {
    const token = req.body?.refresh_token || req.cookies?.refresh_token;
    if (token)
        await (0, jwt_1.revokeRefreshToken)(token);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    res.clearCookie((0, csrf_1.csrfCookieName)());
    res.json({ status: 'success', message: 'Logged out successfully' });
}
// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────
async function getMe(req, res) {
    try {
        const user = await User_1.User.findById(req.user.sub);
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        res.json({
            status: 'success',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url,
                role: user.role,
                is_active: user.is_active,
                last_login_at: user.last_login_at,
                created_at: user.created_at,
            },
        });
    }
    catch (err) {
        (0, response_1.sendError)(res, 'Failed to retrieve user', 500);
    }
}
