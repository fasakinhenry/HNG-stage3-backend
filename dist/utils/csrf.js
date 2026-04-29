"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfCookieName = csrfCookieName;
exports.generateCsrfToken = generateCsrfToken;
exports.isCsrfTokenValid = isCsrfTokenValid;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const CSRF_COOKIE = 'csrf_token';
function csrfCookieName() {
    return CSRF_COOKIE;
}
function generateCsrfToken() {
    const nonce = crypto_1.default.randomBytes(24).toString('hex');
    const signature = crypto_1.default
        .createHmac('sha256', env_1.config.csrf.secret)
        .update(nonce)
        .digest('hex');
    return `${nonce}.${signature}`;
}
function isCsrfTokenValid(token) {
    const [nonce, signature] = token.split('.');
    if (!nonce || !signature) {
        return false;
    }
    const expected = crypto_1.default
        .createHmac('sha256', env_1.config.csrf.secret)
        .update(nonce)
        .digest('hex');
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
