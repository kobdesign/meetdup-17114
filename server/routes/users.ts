import express from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, type AuthenticatedRequest } from "../utils/auth";

const router = express.Router();

// Middleware to check if user is super admin
async function requireSuperAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", req.user.id);

    const isSuperAdmin = userRoles?.some(r => r.role === "super_admin");

    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    next();
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// IMPORTANT: Specific routes MUST come before dynamic routes in Express!
// Otherwise /api/users/by-email/... would be caught by /:userId

// GET /api/users/by-email/:email - Get user by email
router.get("/by-email/:email", verifySupabaseAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // Use Supabase Admin to list users and find by email
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error || !data) {
      console.error("Error listing users:", error);
      return res.status(500).json({ error: "Failed to search users" });
    }

    // Find user by email (case-insensitive)
    const user = data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      }
    });
  } catch (error: any) {
    console.error("Error in getUserByEmail:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId - Get user by ID
router.get("/:userId", verifySupabaseAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // Use Supabase Admin to access auth.users
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.error("Error fetching user:", error);
      return res.status(404).json({ error: "User not found" });
    }

    if (!data.user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
        last_sign_in_at: data.user.last_sign_in_at,
      }
    });
  } catch (error: any) {
    console.error("Error in getUserById:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
