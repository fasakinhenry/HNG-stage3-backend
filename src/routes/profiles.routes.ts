import { Router } from 'express';
import {
  getProfiles,
  getProfileById,
  searchProfiles,
  createProfile,
  deleteProfile,
  exportProfiles,
} from '../controllers/profiles.controller';
import { authenticate, requireRole, requireApiVersion } from '../middleware/auth';
import { requireCsrf } from '../middleware/csrf';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All profile routes require: auth, API version header, and rate limiting
router.use(authenticate);
router.use(requireApiVersion);
router.use(apiRateLimiter);

// Analyst + Admin
router.get('/', getProfiles);
router.get('/export', exportProfiles);
router.get('/search', searchProfiles);
router.get('/:id', getProfileById);

// Admin only
router.post('/', requireCsrf, requireRole('admin'), createProfile);
router.delete('/:id', requireCsrf, requireRole('admin'), deleteProfile);

export default router;
