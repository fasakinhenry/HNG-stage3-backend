import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { User } from '../models/User';
import { sendError } from '../utils/response';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { is_active: boolean };
    }
  }
}

/**
 * authenticate — verifies the Bearer access token and attaches user to req.user
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Support both Bearer header and cookie (web portal)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    let payload: TokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      sendError(res, 'Invalid or expired token', 401);
      return;
    }

    if (payload.type !== 'access') {
      sendError(res, 'Invalid token type', 401);
      return;
    }

    // Check user is still active
    const user = await User.findOne({ id: payload.sub });
    if (!user) {
      sendError(res, 'User not found', 401);
      return;
    }
    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 403);
      return;
    }

    req.user = {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      type: 'access',
      is_active: user.is_active,
    };

    next();
  } catch (err) {
    sendError(res, 'Authentication error', 500);
  }
}

/**
 * requireRole — RBAC guard factory
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}

/**
 * requireApiVersion — enforces X-API-Version header on /api/* routes
 */
export function requireApiVersion(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const version = req.headers['x-api-version'];
  if (!version) {
    sendError(res, 'API version header required', 400);
    return;
  }
  next();
}
