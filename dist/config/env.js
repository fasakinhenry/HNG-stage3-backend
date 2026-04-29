"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    mongoUri: process.env.MONGODB_URI || '',
    github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        callbackUrl: process.env.GITHUB_OAUTH_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/github/callback',
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-prod',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod',
        accessTtl: process.env.ACCESS_TOKEN_TTL || '3m',
        refreshTtl: process.env.REFRESH_TOKEN_TTL || '5m',
    },
    web: {
        origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
        cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',
        cookieSecure: process.env.COOKIE_SECURE === 'true',
    },
    csrf: {
        secret: process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-prod',
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
        authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    },
    admin: {
        githubUsername: process.env.ADMIN_GITHUB_USERNAME || '',
    },
};
