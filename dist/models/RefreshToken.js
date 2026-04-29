"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshToken = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const uuid_1 = require("uuid");
const refreshTokenSchema = new mongoose_1.Schema({
    _id: { type: String, default: () => (0, uuid_1.v7)() },
    token: { type: String, required: true, unique: true },
    user_id: { type: String, required: true },
    expires_at: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
}, { versionKey: false });
// MongoDB TTL index: auto-deletes documents after expires_at
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Index for fast lookup and revocation
refreshTokenSchema.index({ user_id: 1 });
exports.RefreshToken = mongoose_1.default.model('RefreshToken', refreshTokenSchema);
