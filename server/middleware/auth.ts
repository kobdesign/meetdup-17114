import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabaseClient';
import { getAuthContext } from '../services/db/auth';
import { AuthContext } from '../services/db/types';

/**
 * Extended Express Request with user info and auth context
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  authContext?: AuthContext;
}

/**
 * Middleware to extract userId and build AuthContext once
 * 
 * This middleware:
 * 1. Verifies Supabase JWT token
 * 2. Calls getAuthContext() ONCE to get user roles and tenant access
 * 3. Attaches authContext to request for reuse by services
 * 
 * This prevents duplicate DB queries for authorization checks.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify JWT using Supabase Admin
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Get authorization context (user roles, tenant access, super admin status)
    // This queries user_roles table ONCE and caches result in request
    try {
      const authContext = await getAuthContext(user.id);
      
      // Attach to request for reuse
      req.userId = user.id;
      req.userEmail = user.email;
      req.authContext = authContext;

      next();
    } catch (authError: any) {
      // User has no assigned roles
      res.status(403).json({ 
        error: 'Forbidden',
        message: authError.message || 'User has no assigned roles'
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
