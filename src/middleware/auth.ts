import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { User } from '../models/User';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { is_active: boolean };
    }
  }
}

/**
 * authenticate — verifies the Bearer access token (or access_token cookie for web)
 * and attaches decoded payload to req.user.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

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

    // Verify user still exists and is active — _id is the UUID (sub)
    const user = await User.findById(payload.sub);
    if (!user) {
      sendError(res, 'User not found', 401);
      return;
    }
    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 403);
      return;
    }

    req.user = { ...payload, is_active: user.is_active };
    next();
  } catch {
    sendError(res, 'Authentication error', 500);
  }
}

/**
 * requireRole — RBAC guard. Call after authenticate.
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
 * requireApiVersion — all /api/v1/* profile & user routes need X-API-Version: 1
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
