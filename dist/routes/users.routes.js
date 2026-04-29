"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_1 = require("../middleware/auth");
const csrf_1 = require("../middleware/csrf");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Self-service user info
router.get('/me', auth_1.authenticate, auth_1.requireApiVersion, rateLimiter_1.apiRateLimiter, users_controller_1.getCurrentUser);
// All other user management routes: authenticated + admin only
router.use(auth_1.authenticate);
router.use(auth_1.requireApiVersion);
router.use((0, auth_1.requireRole)('admin'));
router.use(rateLimiter_1.apiRateLimiter);
router.get('/', users_controller_1.listUsers);
router.get('/:id', users_controller_1.getUserById);
router.patch('/:id/role', csrf_1.requireCsrf, users_controller_1.updateUserRole);
router.patch('/:id/status', csrf_1.requireCsrf, users_controller_1.updateUserStatus);
exports.default = router;
