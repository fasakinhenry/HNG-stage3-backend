import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { RefreshToken } from '../models/RefreshToken';
import { v7 as uuidv7 } from 'uuid';

export interface TokenPayload {
  sub: string;       // user UUID
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl } as jwt.SignOptions
  );
}

export function signRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTtl } as jwt.SignOptions
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
}

/**
 * Parse a duration string like "3m", "5m", "1h" into milliseconds.
 */
function parseTtlMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 5 * 60 * 1000; // default 5 min
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshTtl));
  await RefreshToken.create({
    token,
    user_id: userId,
    expires_at: expiresAt,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshToken.findOneAndUpdate({ token }, { revoked: true });
}

export async function isRefreshTokenValid(token: string): Promise<boolean> {
  const record = await RefreshToken.findOne({ token });
  if (!record) return false;
  if (record.revoked) return false;
  if (record.expires_at < new Date()) return false;
  return true;
}
