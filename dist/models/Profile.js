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
exports.Profile = void 0;
exports.getAgeGroup = getAgeGroup;
const mongoose_1 = __importStar(require("mongoose"));
const uuid_1 = require("uuid");
const profileSchema = new mongoose_1.Schema({
    _id: { type: String, default: () => (0, uuid_1.v7)() },
    name: { type: String, required: true, unique: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    gender_probability: { type: Number, required: true },
    age: { type: Number, required: true },
    age_group: { type: String, enum: ['child', 'teenager', 'adult', 'senior'], required: true },
    country_id: { type: String, required: true },
    country_name: { type: String, required: true },
    country_probability: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
}, {
    versionKey: false,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        },
    },
    toObject: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        },
    },
});
profileSchema.index({ gender: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ age_group: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ created_at: 1 });
function getAgeGroup(age) {
    if (age < 13)
        return 'child';
    if (age < 18)
        return 'teenager';
    if (age < 65)
        return 'adult';
    return 'senior';
}
exports.Profile = mongoose_1.default.model('Profile', profileSchema);
