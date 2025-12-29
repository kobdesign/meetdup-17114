/**
 * Scheduled Jobs API
 * 
 * Endpoints for running scheduled maintenance tasks.
 * These can be called by external cron services (e.g., cron-job.org)
 * or manually by super admins.
 */

import { Router, Request, Response } from 'express';
import { sendTrialExpirationNotifications, checkAndDowngradeExpiredTrials } from '../services/notifications/trialNotificationService';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || 'default-cron-secret';

function validateCronAuth(req: Request, res: Response): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

router.post('/trial-notifications', async (req: Request, res: Response) => {
  if (!validateCronAuth(req, res)) return;

  try {
    console.log('[ScheduledJobs] Running trial notifications job...');
    const results = await sendTrialExpirationNotifications();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error('[ScheduledJobs] Trial notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/trial-downgrade', async (req: Request, res: Response) => {
  if (!validateCronAuth(req, res)) return;

  try {
    console.log('[ScheduledJobs] Running trial downgrade job...');
    const results = await checkAndDowngradeExpiredTrials();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      downgraded: results.filter(r => r.status === 'downgraded_to_free').length,
      results
    });
  } catch (error: any) {
    console.error('[ScheduledJobs] Trial downgrade error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/all', async (req: Request, res: Response) => {
  if (!validateCronAuth(req, res)) return;

  try {
    console.log('[ScheduledJobs] Running all scheduled jobs...');
    
    const [notifications, downgrades] = await Promise.all([
      sendTrialExpirationNotifications(),
      checkAndDowngradeExpiredTrials()
    ]);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      notifications: {
        processed: notifications.length,
        results: notifications
      },
      downgrades: {
        processed: downgrades.length,
        results: downgrades
      }
    });
  } catch (error: any) {
    console.error('[ScheduledJobs] All jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
