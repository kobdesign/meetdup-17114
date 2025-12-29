/**
 * Usage Limit Middleware
 * 
 * Middleware to check if a tenant has exceeded their plan limits
 * before allowing certain operations (create member, create meeting, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../stripe/subscriptionService';

type LimitType = 'members' | 'meetings' | 'ai_queries';

interface LimitCheckRequest extends Request {
  limitCheck?: {
    exceeded: boolean;
    current: number;
    limit: number;
    percentage: number;
  };
}

export function checkLimit(limitType: LimitType) {
  return async (req: LimitCheckRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.body?.tenant_id || req.params?.tenantId || req.query?.tenant_id;
      
      if (!tenantId) {
        console.warn(`[UsageLimitMiddleware] No tenant_id found in request`);
        return next();
      }

      const check = await subscriptionService.checkLimitExceeded(tenantId as string, limitType);
      req.limitCheck = check;

      if (check.exceeded) {
        const limitLabels: Record<LimitType, string> = {
          members: 'active members',
          meetings: 'meetings per month',
          ai_queries: 'AI queries per month'
        };

        return res.status(403).json({
          error: 'LIMIT_EXCEEDED',
          message: `You have reached your plan limit of ${check.limit} ${limitLabels[limitType]}. Please upgrade your plan to continue.`,
          current: check.current,
          limit: check.limit,
          limitType
        });
      }

      next();
    } catch (error: any) {
      console.error(`[UsageLimitMiddleware] Error checking ${limitType} limit:`, error);
      next();
    }
  };
}

export const checkMemberLimit = checkLimit('members');
export const checkMeetingLimit = checkLimit('meetings');
export const checkAIQueryLimit = checkLimit('ai_queries');

export async function getUsageWarnings(tenantId: string): Promise<{
  warnings: Array<{
    type: LimitType;
    level: 'warning' | 'critical' | 'exceeded';
    message: string;
    current: number;
    limit: number;
  }>;
}> {
  const warnings: Array<{
    type: LimitType;
    level: 'warning' | 'critical' | 'exceeded';
    message: string;
    current: number;
    limit: number;
  }> = [];

  const limitTypes: LimitType[] = ['members', 'meetings', 'ai_queries'];
  
  for (const type of limitTypes) {
    const result = await subscriptionService.getWarningLevel(tenantId, type);
    if (result.level !== 'ok') {
      warnings.push({
        type,
        level: result.level as 'warning' | 'critical' | 'exceeded',
        message: result.message,
        current: result.current,
        limit: result.limit
      });
    }
  }

  return { warnings };
}
