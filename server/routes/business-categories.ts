import { Router, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { z } from "zod";

const router = Router();

interface BusinessCategory {
  category_code: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const categorySchema = z.object({
  category_code: z.string().min(1).max(10),
  name_th: z.string().min(1).max(255),
  name_en: z.string().max(255).optional().nullable(),
  description_th: z.string().optional().nullable(),
  description_en: z.string().optional().nullable(),
  sort_order: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const updateCategorySchema = categorySchema.partial().omit({ category_code: true });

async function checkSuperAdminAccess(userId: string): Promise<boolean> {
  const { data: userRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  
  return userRole?.role === "super_admin";
}

router.get("/", async (req, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    
    let query = supabaseAdmin
      .from("business_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    
    const { data: categories, error } = await query;

    if (error) {
      console.error("[BusinessCategories] Error fetching categories:", error);
      return res.status(500).json({ error: "Failed to fetch categories" });
    }

    return res.json({ categories: categories || [] });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:code", async (req, res: Response) => {
  try {
    const { code } = req.params;
    
    const { data: category, error } = await supabaseAdmin
      .from("business_categories")
      .select("*")
      .eq("category_code", code)
      .single();

    if (error || !category) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({ category });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isSuperAdmin = await checkSuperAdminAccess(req.user.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
    }

    const { data: existing } = await supabaseAdmin
      .from("business_categories")
      .select("category_code")
      .eq("category_code", parsed.data.category_code)
      .single();

    if (existing) {
      return res.status(409).json({ error: "Category code already exists" });
    }

    const newSortOrder = parsed.data.sort_order || 0;
    const { data: conflicting } = await supabaseAdmin
      .from("business_categories")
      .select("category_code, sort_order")
      .gte("sort_order", newSortOrder)
      .order("sort_order", { ascending: false });

    if (conflicting && conflicting.length > 0) {
      for (const cat of conflicting) {
        await supabaseAdmin
          .from("business_categories")
          .update({ sort_order: cat.sort_order + 1 })
          .eq("category_code", cat.category_code);
      }
    }

    const { data: category, error } = await supabaseAdmin
      .from("business_categories")
      .insert({
        ...parsed.data,
        sort_order: newSortOrder,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("[BusinessCategories] Error creating category:", error);
      return res.status(500).json({ error: "Failed to create category" });
    }

    return res.status(201).json({ category });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/reorder", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isSuperAdmin = await checkSuperAdminAccess(req.user.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Invalid updates array" });
    }

    for (const update of updates) {
      if (!update.category_code || typeof update.sort_order !== "number") {
        return res.status(400).json({ error: "Each update must have category_code and sort_order" });
      }

      const { error } = await supabaseAdmin
        .from("business_categories")
        .update({ sort_order: update.sort_order })
        .eq("category_code", update.category_code);

      if (error) {
        console.error("[BusinessCategories] Error updating sort order:", error);
        return res.status(500).json({ error: "Failed to update sort order" });
      }
    }

    return res.json({ success: true, message: "Reorder complete" });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:code", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isSuperAdmin = await checkSuperAdminAccess(req.user.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { code } = req.params;
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
    }

    const { data: existing } = await supabaseAdmin
      .from("business_categories")
      .select("category_code")
      .eq("category_code", code)
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Category not found" });
    }

    const { data: category, error } = await supabaseAdmin
      .from("business_categories")
      .update(parsed.data)
      .eq("category_code", code)
      .select()
      .single();

    if (error) {
      console.error("[BusinessCategories] Error updating category:", error);
      return res.status(500).json({ error: "Failed to update category" });
    }

    return res.json({ category });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:code", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isSuperAdmin = await checkSuperAdminAccess(req.user.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { code } = req.params;

    const { count } = await supabaseAdmin
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("business_type_code", code);

    if (count && count > 0) {
      return res.status(400).json({ 
        error: "Cannot delete category", 
        message: `มีสมาชิก ${count} คนที่ใช้หมวดหมู่นี้อยู่ กรุณาย้ายสมาชิกไปหมวดหมู่อื่นก่อน`
      });
    }

    const { error } = await supabaseAdmin
      .from("business_categories")
      .delete()
      .eq("category_code", code);

    if (error) {
      console.error("[BusinessCategories] Error deleting category:", error);
      return res.status(500).json({ error: "Failed to delete category" });
    }

    return res.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/count/:code", async (req, res: Response) => {
  try {
    const { code } = req.params;
    
    const { count, error } = await supabaseAdmin
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("business_type_code", code)
      .eq("status", "member");

    if (error) {
      console.error("[BusinessCategories] Error counting members:", error);
      return res.status(500).json({ error: "Failed to count members" });
    }

    return res.json({ count: count || 0 });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/generate-code", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isSuperAdmin = await checkSuperAdminAccess(req.user.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { data: categories } = await supabaseAdmin
      .from("business_categories")
      .select("category_code")
      .order("category_code", { ascending: false });

    let nextCode = "26";
    if (categories && categories.length > 0) {
      const numericCodes = categories
        .map(c => parseInt(c.category_code, 10))
        .filter(n => !isNaN(n));
      
      if (numericCodes.length > 0) {
        const maxCode = Math.max(...numericCodes);
        nextCode = String(maxCode + 1).padStart(2, "0");
      }
    }

    return res.json({ code: nextCode });
  } catch (error: any) {
    console.error("[BusinessCategories] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
