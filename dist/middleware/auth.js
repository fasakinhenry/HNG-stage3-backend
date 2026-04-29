"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireApiVersion = requireApiVersion;
const jwt_1 = require("../utils/jwt");
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
/**
 * authenticate — verifies the Bearer access token (or access_token cookie for web)
 * and attaches decoded payload to req.user.
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
        else if (req.cookies?.access_token) {
            token = req.cookies.access_token;
        }
        if (!token) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        let payload;
        try {
            payload = (0, jwt_1.verifyAccessToken)(token);
        }
        catch {
            (0, response_1.sendError)(res, 'Invalid or expired token', 401);
            return;
        }
        if (payload.type !== 'access') {
            (0, response_1.sendError)(res, 'Invalid token type', 401);
            return;
        }
        // Verify user still exists and is active — _id is the UUID (sub)
        const user = await User_1.User.findById(payload.sub);
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 401);
            return;
        }
        if (!user.is_active) {
            (0, response_1.sendError)(res, 'Account is deactivated', 403);
            return;
        }
        req.user = { ...payload, is_active: user.is_active };
        next();
    }
    catch {
        (0, response_1.sendError)(res, 'Authentication error', 500);
    }
}
/**
 * requireRole — RBAC guard. Call after authenticate.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        if (!roles.includes(req.user.role)) {
            (0, response_1.sendError)(res, 'Insufficient permissions', 403);
            return;
        }
        next();
    };
}
/**
 * requireApiVersion — all /api/v1/* profile & user routes need X-API-Version: 1
 */
function requireApiVersion(req, res, next) {
    const version = req.headers['x-api-version'];
    if (!version) {
        (0, response_1.sendError)(res, 'API version header required', 400);
        return;
    }
    next();
}
