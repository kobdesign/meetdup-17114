import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ParticipantService } from '../services/db';
import { UnauthorizedError, ValidationError } from '../services/db/types';

const router = Router();

/**
 * Get visitor pipeline analytics
 * Uses direct PostgreSQL connection to bypass PostgREST cache
 */
router.get('/visitor-analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authContext = req.authContext;
    const { tenant_id } = req.query;

    if (!authContext) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!tenant_id || typeof tenant_id !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'tenant_id is required',
      });
    }

    // Get visitor analytics using ParticipantService
    // Passing authContext avoids duplicate DB queries for authorization
    const analytics = await ParticipantService.getVisitorAnalytics(authContext, tenant_id);

    res.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error('Visitor analytics error:', error);

    if (error instanceof UnauthorizedError) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
