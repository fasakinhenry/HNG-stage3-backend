import { Request, Response } from 'express';
import { config } from '../config/env';
import { User } from '../models/User';
import {
  exchangeCodeForToken,
  getGitHubUser,
  getGitHubUserEmail,
} from '../services/github';
import {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  verifyRefreshToken,
  isRefreshTokenValid,
} from '../utils/jwt';
import { sendError } from '../utils/response';
import { csrfCookieName, generateCsrfToken } from '../utils/csrf';

// ─── In-memory PKCE store ─────────────────────────────────────────────────────
// Maps state → { codeVerifier, cliCallbackUrl }
// Short-lived; for production use Redis with a 10-minute TTL.
interface PkceEntry {
  codeVerifier: string;
  cliCallbackUrl?: string;
  createdAt: number;
}
const pkceStore = new Map<string, PkceEntry>();

// Prune stale entries every minute (entries older than 10 minutes)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pkceStore.entries()) {
    if (val.createdAt < cutoff) pkceStore.delete(key);
  }
}, 60_000);

// ─── Helper: build user info object ──────────────────────────────────────────
function userInfo(user: InstanceType<typeof User>) {
  return {
    id: user._id as string,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    role: user.role,
  };
}

// ─── Helper: upsert GitHub user ───────────────────────────────────────────────
async function upsertGitHubUser(githubUserId: number, login: string, email: string, avatarUrl: string) {
  const isAdmin = config.admin.githubUsername === login;
  let user = await User.findOne({ github_id: String(githubUserId) });

  if (!user) {
    user = await User.create({
      github_id: String(githubUserId),
      username: login,
      email,
      avatar_url: avatarUrl,
      role: isAdmin ? 'admin' : 'analyst',
      is_active: true,
      last_login_at: new Date(),
    });
  } else {
    user.username = login;
    user.avatar_url = avatarUrl;
    if (email) user.email = email;
    // Promote to admin if matches bootstrap username but isn't yet
    if (isAdmin && user.role !== 'admin') user.role = 'admin';
    user.last_login_at = new Date();
    await user.save();
  }

  return user;
}

// ─── Helper: issue a token pair and store refresh token ──────────────────────
async function issueTokens(user: InstanceType<typeof User>) {
  const userId = user._id as string;
  const payload = { sub: userId, username: user.username, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await storeRefreshToken(userId, refreshToken);
  return { accessToken, refreshToken };
}

// ─── GET /api/v1/auth/github ──────────────────────────────────────────────────
// Redirects to GitHub OAuth. Stores PKCE params in memory keyed by state.
export async function githubLogin(req: Request, res: Response): Promise<void> {
  const state = (req.query.state as string) || crypto.randomUUID();
  const codeVerifier = req.query.code_verifier as string | undefined;
  const codeChallenge = req.query.code_challenge as string | undefined;
  const codeChallengeMethod = (req.query.code_challenge_method as string) || 'S256';
  const cliCallbackUrl = req.query.cli_callback as string | undefined;

  // Store PKCE entry — keyed by state so callback can retrieve it
  if (codeVerifier) {
    pkceStore.set(state, { codeVerifier, cliCallbackUrl, createdAt: Date.now() });
  }

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
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
export async function githubCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code) {
    sendError(res, 'Missing OAuth code', 400);
    return;
  }

  try {
    // Pull PKCE entry from store (and remove it — single use)
    let codeVerifier: string | undefined;
    let cliCallbackUrl: string | undefined;

    if (state) {
      const entry = pkceStore.get(state);
      if (entry) {
        codeVerifier = entry.codeVerifier;
        cliCallbackUrl = entry.cliCallbackUrl;
        pkceStore.delete(state); // consumed
      }
    }

    // Exchange auth code → GitHub access token
    const githubToken = await exchangeCodeForToken(code, codeVerifier);
    const githubUser = await getGitHubUser(githubToken.access_token);
    const email = githubUser.email || (await getGitHubUserEmail(githubToken.access_token));

    const user = await upsertGitHubUser(githubUser.id, githubUser.login, email, githubUser.avatar_url);

    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 403);
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
      secure: config.web.cookieSecure,
      sameSite: 'lax',
      domain: config.web.cookieDomain,
      maxAge: 3 * 60 * 1000, // 3 min
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: config.web.cookieSecure,
      sameSite: 'lax',
      domain: config.web.cookieDomain,
      maxAge: 5 * 60 * 1000, // 5 min
      path: '/api/v1/auth/refresh',
    });
    res.cookie(csrfCookieName(), generateCsrfToken(), {
      httpOnly: false,
      secure: config.web.cookieSecure,
      sameSite: 'lax',
      domain: config.web.cookieDomain,
      maxAge: 60 * 60 * 1000,
    });

    res.redirect(`${config.web.origin}/dashboard`);
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    sendError(res, 'Authentication failed', 500);
  }
}

// ─── POST /api/v1/auth/cli/exchange ──────────────────────────────────────────
// CLI-only: accepts the raw code + code_verifier, handles the GitHub exchange
// server-side, and returns tokens as JSON. Used as the fallback flow when the
// backend cannot redirect to localhost (e.g. strict firewall).
export async function cliTokenExchange(req: Request, res: Response): Promise<void> {
  const { code, code_verifier } = req.body as {
    code?: string;
    code_verifier?: string;
    state?: string;
  };

  if (!code) { sendError(res, 'code is required', 400); return; }
  if (!code_verifier) { sendError(res, 'code_verifier is required', 400); return; }

  try {
    const githubToken = await exchangeCodeForToken(code, code_verifier);
    const githubUser = await getGitHubUser(githubToken.access_token);
    const email = githubUser.email || (await getGitHubUserEmail(githubToken.access_token));

    const user = await upsertGitHubUser(githubUser.id, githubUser.login, email, githubUser.avatar_url);

    if (!user.is_active) { sendError(res, 'Account is deactivated', 403); return; }

    const { accessToken, refreshToken } = await issueTokens(user);

    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userInfo(user),
    });
  } catch (err) {
    console.error('CLI token exchange error:', err);
    sendError(res, 'Token exchange failed', 500);
  }
}

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
// Single-use refresh: old token is revoked immediately, new pair is issued.
export async function refreshTokens(req: Request, res: Response): Promise<void> {
  const token: string | undefined = req.body?.refresh_token || req.cookies?.refresh_token;

  if (!token) { sendError(res, 'Refresh token required', 400); return; }

  try {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      sendError(res, 'Invalid or expired refresh token', 401);
      return;
    }

    if (payload.type !== 'refresh') { sendError(res, 'Invalid token type', 401); return; }

    const isValid = await isRefreshTokenValid(token);
    if (!isValid) { sendError(res, 'Refresh token has been revoked', 401); return; }

    // Find user by _id (UUID stored in JWT sub)
    const user = await User.findById(payload.sub);
    if (!user || !user.is_active) {
      sendError(res, 'User not found or deactivated', 403);
      return;
    }

    // Revoke old token first (single-use guarantee)
    await revokeRefreshToken(token);

    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);

    // Refresh cookies for web portal
    if (req.cookies?.refresh_token) {
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: config.web.cookieSecure,
        sameSite: 'lax',
        domain: config.web.cookieDomain,
        maxAge: 3 * 60 * 1000,
      });
      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: config.web.cookieSecure,
        sameSite: 'lax',
        domain: config.web.cookieDomain,
        maxAge: 5 * 60 * 1000,
        path: '/api/v1/auth/refresh',
      });
    }

    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    sendError(res, 'Token refresh failed', 500);
  }
}

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  const token: string | undefined = req.body?.refresh_token || req.cookies?.refresh_token;
  if (token) await revokeRefreshToken(token);

  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  res.clearCookie(csrfCookieName());
  res.json({ status: 'success', message: 'Logged out successfully' });
}

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.sub);
    if (!user) { sendError(res, 'User not found', 404); return; }

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
  } catch (err) {
    sendError(res, 'Failed to retrieve user', 500);
  }
}
