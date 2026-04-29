import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { Request, Response } from 'express';

const rateLimitResponse = (_req: Request, res: Response) => {
  res.status(429).json({
    status: 'error',
    message: 'Too many requests, please try again later.',
  });
};

export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  handler: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyGenerator: (req) => {
    // Per user if authenticated, otherwise per IP
    return (req as any).user?.sub || req.ip || 'unknown';
  },
  handler: rateLimitResponse,
  standardHeaders: true,
  legacyHeaders: false,
});
