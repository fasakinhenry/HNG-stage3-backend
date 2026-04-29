import { Request, Response } from 'express';
import { User } from '../models/User';
import { sendError } from '../utils/response';

/**
 * GET /api/v1/users  [admin only]
 * List all users with pagination
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      status: 'success',
      page,
      limit,
      total,
      total_pages: totalPages,
      data: users,
    });
  } catch {
    sendError(res, 'Failed to retrieve users', 500);
  }
}

/**
 * GET /api/v1/users/:id  [admin only]
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findOne({ id: req.params.id }).lean();
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }
    res.json({ status: 'success', data: user });
  } catch {
    sendError(res, 'Failed to retrieve user', 500);
  }
}

/**
 * PATCH /api/v1/users/:id/role  [admin only]
 * Update a user's role
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'analyst'].includes(role)) {
      sendError(res, 'Role must be "admin" or "analyst"', 400);
      return;
    }

    const user = await User.findOneAndUpdate(
      { id: req.params.id },
      { role },
      { new: true }
    ).lean();

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    res.json({ status: 'success', data: user });
  } catch {
    sendError(res, 'Failed to update user role', 500);
  }
}

/**
 * PATCH /api/v1/users/:id/status  [admin only]
 * Activate or deactivate a user
 */
export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      sendError(res, 'is_active must be a boolean', 400);
      return;
    }

    const user = await User.findOneAndUpdate(
      { id: req.params.id },
      { is_active },
      { new: true }
    ).lean();

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    res.json({ status: 'success', data: user });
  } catch {
    sendError(res, 'Failed to update user status', 500);
  }
}
