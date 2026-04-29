"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.storeRefreshToken = storeRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.isRefreshTokenValid = isRefreshTokenValid;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const RefreshToken_1 = require("../models/RefreshToken");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, type: 'access' }, env_1.config.jwt.accessSecret, { expiresIn: env_1.config.jwt.accessTtl });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, type: 'refresh' }, env_1.config.jwt.refreshSecret, { expiresIn: env_1.config.jwt.refreshTtl });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessSecret);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.config.jwt.refreshSecret);
}
/**
 * Parse a duration string like "3m", "5m", "1h" into milliseconds.
 */
function parseTtlMs(ttl) {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match)
        return 5 * 60 * 1000; // default 5 min
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
}
async function storeRefreshToken(userId, token) {
    const expiresAt = new Date(Date.now() + parseTtlMs(env_1.config.jwt.refreshTtl));
    await RefreshToken_1.RefreshToken.create({
        token,
        user_id: userId,
        expires_at: expiresAt,
    });
}
async function revokeRefreshToken(token) {
    await RefreshToken_1.RefreshToken.findOneAndUpdate({ token }, { revoked: true });
}
async function isRefreshTokenValid(token) {
    const record = await RefreshToken_1.RefreshToken.findOne({ token });
    if (!record)
        return false;
    if (record.revoked)
        return false;
    if (record.expires_at < new Date())
        return false;
    return true;
}
