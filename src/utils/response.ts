import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, statusCode = 200): Response {
  return res.status(statusCode).json({ status: 'success', data });
}

export function sendError(res: Response, message: string, statusCode = 400): Response {
  return res.status(statusCode).json({ status: 'error', message });
}

export function buildPaginationLinks(
  base: string,
  page: number,
  limit: number,
  total: number
): {
  self: string;
  next: string | null;
  prev: string | null;
} {
  const totalPages = Math.ceil(total / limit);
  return {
    self: `${base}?page=${page}&limit=${limit}`,
    next: page < totalPages ? `${base}?page=${page + 1}&limit=${limit}` : null,
    prev: page > 1 ? `${base}?page=${page - 1}&limit=${limit}` : null,
  };
}
