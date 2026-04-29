"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
async function connectDatabase() {
    try {
        await mongoose_1.default.connect(env_1.config.mongoUri);
        console.log('✅ Connected to MongoDB');
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
    mongoose_1.default.connection.on('error', (err) => {
        console.error('MongoDB error:', err);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
    });
}
