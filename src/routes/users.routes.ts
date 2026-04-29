import { Router } from 'express';
import {
  listUsers,
  getCurrentUser,
  getUserById,
  updateUserRole,
  updateUserStatus,
} from '../controllers/users.controller';
import { authenticate, requireRole, requireApiVersion } from '../middleware/auth';
import { requireCsrf } from '../middleware/csrf';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Self-service user info
router.get('/me', authenticate, requireApiVersion, apiRateLimiter, getCurrentUser);

// All other user management routes: authenticated + admin only
router.use(authenticate);
router.use(requireApiVersion);
router.use(requireRole('admin'));
router.use(apiRateLimiter);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.patch('/:id/role', requireCsrf, updateUserRole);
router.patch('/:id/status', requireCsrf, updateUserStatus);

export default router;
