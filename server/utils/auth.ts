import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "./supabaseClient";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function verifySupabaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export async function checkTenantAccess(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { data: tenantRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("role", ["chapter_admin", "super_admin"])
    .limit(1);

  if (tenantRoles && tenantRoles.length > 0) {
    return true;
  }

  const { data: globalSuperAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1);

  return globalSuperAdmin !== null && globalSuperAdmin.length > 0;
}
