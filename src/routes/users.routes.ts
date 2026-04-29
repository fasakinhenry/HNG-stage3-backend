import { Router } from 'express';
import {
  listUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
} from '../controllers/users.controller';
import { authenticate, requireRole, requireApiVersion } from '../middleware/auth';
import { requireCsrf } from '../middleware/csrf';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All user management routes: authenticated + admin only
router.use(authenticate);
router.use(requireApiVersion);
router.use(requireRole('admin'));
router.use(apiRateLimiter);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.patch('/:id/role', requireCsrf, updateUserRole);
router.patch('/:id/status', requireCsrf, updateUserStatus);

export default router;
