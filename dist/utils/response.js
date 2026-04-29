"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.buildPaginationLinks = buildPaginationLinks;
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ status: 'success', data });
}
function sendError(res, message, statusCode = 400) {
    return res.status(statusCode).json({ status: 'error', message });
}
function buildPaginationLinks(base, page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    return {
        self: `${base}?page=${page}&limit=${limit}`,
        next: page < totalPages ? `${base}?page=${page + 1}&limit=${limit}` : null,
        prev: page > 1 ? `${base}?page=${page - 1}&limit=${limit}` : null,
    };
}
