"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.getUserById = getUserById;
exports.updateUserRole = updateUserRole;
exports.updateUserStatus = updateUserStatus;
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
/**
 * GET /api/v1/users  [admin only]
 */
async function listUsers(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User_1.User.find().skip(skip).limit(limit).lean(),
            User_1.User.countDocuments(),
        ]);
        // lean() returns plain objects — _id is already a string UUID, map to id
        const data = users.map((u) => ({ ...u, id: u._id, _id: undefined }));
        res.json({
            status: 'success',
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            data,
        });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to retrieve users', 500);
    }
}
/**
 * GET /api/v1/users/:id  [admin only]
 */
async function getUserById(req, res) {
    try {
        const user = await User_1.User.findById(req.params.id).lean();
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        res.json({ status: 'success', data: { ...user, id: user._id, _id: undefined } });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to retrieve user', 500);
    }
}
/**
 * PATCH /api/v1/users/:id/role  [admin only]
 */
async function updateUserRole(req, res) {
    try {
        const { role } = req.body;
        if (!role || !['admin', 'analyst'].includes(role)) {
            (0, response_1.sendError)(res, 'Role must be "admin" or "analyst"', 400);
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { role }, { new: true }).lean();
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        res.json({ status: 'success', data: { ...user, id: user._id, _id: undefined } });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to update user role', 500);
    }
}
/**
 * PATCH /api/v1/users/:id/status  [admin only]
 */
async function updateUserStatus(req, res) {
    try {
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            (0, response_1.sendError)(res, 'is_active must be a boolean', 400);
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { is_active }, { new: true }).lean();
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        res.json({ status: 'success', data: { ...user, id: user._id, _id: undefined } });
    }
    catch {
        (0, response_1.sendError)(res, 'Failed to update user status', 500);
    }
}
