"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const rateLimitResponse = (_req, res) => {
    res.status(429).json({
        status: 'error',
        message: 'Too many requests, please try again later.',
    });
};
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute window
    max: 10, // 10 requests per minute
    handler: rateLimitResponse,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
});
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.config.rateLimit.windowMs,
    max: env_1.config.rateLimit.max,
    keyGenerator: (req) => {
        // Per user if authenticated, otherwise per IP
        return req.user?.sub || req.ip || 'unknown';
    },
    handler: rateLimitResponse,
    standardHeaders: true,
    legacyHeaders: false,
});
