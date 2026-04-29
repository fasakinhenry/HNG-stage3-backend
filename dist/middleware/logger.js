"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const morgan_1 = __importDefault(require("morgan"));
// Custom token: log response time in ms
morgan_1.default.token('response-time-ms', (_req, res) => {
    // morgan's :response-time already provides ms
    return undefined;
});
// Format: METHOD ENDPOINT STATUS_CODE RESPONSE_TIME
exports.requestLogger = (0, morgan_1.default)(':method :url :status :response-time ms');
