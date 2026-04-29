"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profiles_controller_1 = require("../controllers/profiles.controller");
const auth_1 = require("../middleware/auth");
const csrf_1 = require("../middleware/csrf");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// All profile routes require: auth, API version header, and rate limiting
router.use(auth_1.authenticate);
router.use(auth_1.requireApiVersion);
router.use(rateLimiter_1.apiRateLimiter);
// Analyst + Admin
router.get('/', profiles_controller_1.getProfiles);
router.get('/export', profiles_controller_1.exportProfiles);
router.get('/search', profiles_controller_1.searchProfiles);
router.get('/:id', profiles_controller_1.getProfileById);
// Admin only
router.post('/', csrf_1.requireCsrf, (0, auth_1.requireRole)('admin'), profiles_controller_1.createProfile);
router.delete('/:id', csrf_1.requireCsrf, (0, auth_1.requireRole)('admin'), profiles_controller_1.deleteProfile);
exports.default = router;
