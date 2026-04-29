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

// In-memory PKCE state store (per request, short-lived).
// For production, use Redis. Here a simple Map suffices.
const pkceStore = new Map<string, { codeVerifier: string; cliCallback?: string; createdAt: number }>();

// In-memory CLI token store: state → tokens (short-lived, CLI polling)
const cliTokenStore = new Map<string, {
  access_token: string;
  refresh_token: string;
  user: object;
  createdAt: number;
}>();

// Cleanup CLI token store every minute
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, val] of cliTokenStore.entries()) {
    if (val.createdAt < cutoff) cliTokenStore.delete(key);
  }
}, 60_000);

// Clean up stale entries periodically (older than 10 minutes)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pkceStore.entries()) {
    if (val.createdAt < cutoff) pkceStore.delete(key);
  }
}, 60_000);

/**
 * GET /api/v1/auth/github
 * Redirects to GitHub OAuth page.
 * Supports optional ?state and ?code_challenge for PKCE (CLI flow).
 */
export async function githubLogin(req: Request, res: Response): Promise<void> {
  const state = (req.query.state as string) || crypto.randomUUID();
  const codeChallenge = req.query.code_challenge as string | undefined;
  const codeChallengeMethod = (req.query.code_challenge_method as string) || 'S256';
  const codeVerifier = req.query.code_verifier as string | undefined;

  // Store code_verifier + optional CLI callback URL mapped to state
  if (codeVerifier) {
    const cliCallback = req.query.cli_callback as string | undefined;
    pkceStore.set(state, { codeVerifier, cliCallback, createdAt: Date.now() });
  }

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'read:user user:email',
    state,
  });

  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', codeChallengeMethod);
  }

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

/**
 * GET /api/v1/auth/github/callback
 * Handles OAuth callback from GitHub.
 * Supports both CLI (JSON response) and web (cookie + redirect) flows.
 */
export async function githubCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const codeVerifier = req.query.code_verifier as string | undefined;

  if (!code) {
    sendError(res, 'Missing OAuth code', 400);
    return;
  }

  try {
    // Resolve code_verifier: from query or from PKCE store (keyed by state)
    let resolvedCodeVerifier = codeVerifier;
    if (!resolvedCodeVerifier && state) {
      const stored = pkceStore.get(state);
      if (stored) {
        resolvedCodeVerifier = stored.codeVerifier;
        pkceStore.delete(state);
      }
    }

    // Exchange code with GitHub
    const githubToken = await exchangeCodeForToken(code, resolvedCodeVerifier);
    const githubUser = await getGitHubUser(githubToken.access_token);
    const email = githubUser.email || (await getGitHubUserEmail(githubToken.access_token));

    // Upsert user
    let user = await User.findOne({ github_id: String(githubUser.id) });
    const isAdmin = config.admin.githubUsername === githubUser.login;

    if (!user) {
      user = await User.create({
        github_id: String(githubUser.id),
        username: githubUser.login,
        email: email || '',
        avatar_url: githubUser.avatar_url,
        role: isAdmin ? 'admin' : 'analyst',
        is_active: true,
        last_login_at: new Date(),
      });
    } else {
      user.username = githubUser.login;
      user.avatar_url = githubUser.avatar_url;
      if (email) user.email = email;
      if (isAdmin && user.role !== 'admin') user.role = 'admin';
      user.last_login_at = new Date();
      await user.save();
    }

    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 403);
      return;
    }

    // Issue tokens
    const tokenPayload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    await storeRefreshToken(user.id, refreshToken);

    // Detect CLI flow: has cli_callback URL in PKCE store
    const storedEntry = state ? pkceStore.get(state) : undefined;
    const cliCallbackUrl = storedEntry?.cliCallback;
    const isCli = !!cliCallbackUrl || req.query.cli === '1';

    if (isCli && cliCallbackUrl) {
      // Redirect to CLI local server with tokens in query params
      const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      };
      const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: JSON.stringify(userInfo),
        state: state || '',
      });
      res.redirect(`${cliCallbackUrl}?${params.toString()}`);
      return;
    }

    if (isCli) {
      // Fallback: plain JSON response (e.g. Accept: application/json)
      res.json({
        status: 'success',
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          role: user.role,
        },
      });
      return;
    }

    // Web flow: set HTTP-only cookies, redirect to dashboard
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: config.web.cookieSecure,
      sameSite: 'lax',
      domain: config.web.cookieDomain,
      maxAge: 3 * 60 * 1000, // 3 minutes
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: config.web.cookieSecure,
      sameSite: 'lax',
      domain: config.web.cookieDomain,
      maxAge: 5 * 60 * 1000, // 5 minutes
      path: '/api/v1/auth/refresh',
    });

    // Redirect to web portal dashboard
    res.redirect(`${config.web.origin}/dashboard`);
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    sendError(res, 'Authentication failed', 500);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Issues a new access + refresh token pair. Invalidates the old refresh token.
 */
export async function refreshTokens(req: Request, res: Response): Promise<void> {
  // Support token from body (CLI) or HTTP-only cookie (web)
  const token: string | undefined =
    req.body?.refresh_token || req.cookies?.refresh_token;

  if (!token) {
    sendError(res, 'Refresh token required', 400);
    return;
  }

  try {
    // Verify JWT
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      sendError(res, 'Invalid or expired refresh token', 401);
      return;
    }

    if (payload.type !== 'refresh') {
      sendError(res, 'Invalid token type', 401);
      return;
    }

    // Verify token is in DB and not revoked
    const isValid = await isRefreshTokenValid(token);
    if (!isValid) {
      sendError(res, 'Refresh token is invalid or revoked', 401);
      return;
    }

    // Check user still active
    const user = await User.findOne({ id: payload.sub });
    if (!user || !user.is_active) {
      sendError(res, 'User not found or deactivated', 403);
      return;
    }

    // Revoke old token (one-time use)
    await revokeRefreshToken(token);

    // Issue new pair
    const tokenPayload = { sub: user.id, username: user.username, role: user.role };
    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);
    await storeRefreshToken(user.id, newRefreshToken);

    // Web: update cookies
    if (req.cookies?.refresh_token) {
      res.cookie('access_token', newAccessToken, {
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
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    sendError(res, 'Token refresh failed', 500);
  }
}

/**
 * POST /api/v1/auth/logout
 * Revokes the refresh token server-side.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const token: string | undefined =
    req.body?.refresh_token || req.cookies?.refresh_token;

  if (token) {
    await revokeRefreshToken(token);
  }

  // Clear cookies (web portal)
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

  res.json({ status: 'success', message: 'Logged out successfully' });
}

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await User.findOne({ id: req.user!.sub });
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }
  res.json({
    status: 'success',
    data: {
      id: user.id,
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

/**
 * POST /api/v1/auth/cli/exchange
 * CLI-only endpoint: exchanges GitHub code + PKCE code_verifier for tokens.
 * Used when the CLI local server receives the redirect and extracts code/state.
 */
export async function cliTokenExchange(req: Request, res: Response): Promise<void> {
  const { code, code_verifier, state } = req.body as {
    code?: string;
    code_verifier?: string;
    state?: string;
  };

  if (!code) {
    sendError(res, 'code is required', 400);
    return;
  }

  if (!code_verifier) {
    sendError(res, 'code_verifier is required', 400);
    return;
  }

  try {
    const githubToken = await exchangeCodeForToken(code, code_verifier);
    const githubUser = await getGitHubUser(githubToken.access_token);
    const email = githubUser.email || (await getGitHubUserEmail(githubToken.access_token));

    let user = await User.findOne({ github_id: String(githubUser.id) });
    const isAdmin = config.admin.githubUsername === githubUser.login;

    if (!user) {
      user = await User.create({
        github_id: String(githubUser.id),
        username: githubUser.login,
        email: email || '',
        avatar_url: githubUser.avatar_url,
        role: isAdmin ? 'admin' : 'analyst',
        is_active: true,
        last_login_at: new Date(),
      });
    } else {
      user.username = githubUser.login;
      user.avatar_url = githubUser.avatar_url;
      if (email) user.email = email;
      if (isAdmin && user.role !== 'admin') user.role = 'admin';
      user.last_login_at = new Date();
      await user.save();
    }

    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 403);
      return;
    }

    const tokenPayload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('CLI token exchange error:', err);
    sendError(res, 'Token exchange failed', 500);
  }
}
