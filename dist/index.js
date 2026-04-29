"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const logger_1 = require("./middleware/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const profiles_routes_1 = __importDefault(require("./routes/profiles.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const app = (0, express_1.default)();
// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    credentials: false,
    exposedHeaders: ['X-API-Version'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(logger_1.requestLogger);
// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});
// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', auth_routes_1.default);
app.use('/api/profiles', profiles_routes_1.default);
app.use('/api/users', users_routes_1.default);
// Legacy v1 routes for backwards compatibility
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/profiles', profiles_routes_1.default);
app.use('/api/v1/users', users_routes_1.default);
// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' });
});
// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
});
// ─── Start ─────────────────────────────────────────────────────────────────────
async function start() {
    await (0, database_1.connectDatabase)();
    app.listen(env_1.config.port, () => {
        console.log(`🚀 Insighta Labs+ API running on http://localhost:${env_1.config.port}`);
        console.log(`📦 API Base: http://localhost:${env_1.config.port}/api/v1`);
    });
}
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
exports.default = app;
