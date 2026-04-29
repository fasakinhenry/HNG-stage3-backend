import morgan from 'morgan';
import { Request, Response } from 'express';

// Custom token: log response time in ms
morgan.token('response-time-ms', (_req, res) => {
  // morgan's :response-time already provides ms
  return undefined;
});

// Format: METHOD ENDPOINT STATUS_CODE RESPONSE_TIME
export const requestLogger = morgan(
  ':method :url :status :response-time ms'
);
