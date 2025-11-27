import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";

const router = Router();

interface CategoryWithCount {
  category_code: string;
  name_th: string;
  name_en: string | null;
  member_count: number;
}

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const { data: categories, error: catError } = await supabaseAdmin
      .from("business_categories")
      .select("category_code, name_th, name_en, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (catError) {
      console.error("Error fetching categories:", catError);
      return res.status(500).json({ error: "Database error fetching categories" });
    }

    const { data: participants, error: partError } = await supabaseAdmin
      .from("participants")
      .select("business_type_code")
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .not("business_type_code", "is", null);

    if (partError) {
      console.error("Error fetching participants:", partError);
      return res.status(500).json({ error: "Database error counting members" });
    }

    const countMap = new Map<string, number>();
    for (const p of participants || []) {
      if (p.business_type_code) {
        countMap.set(p.business_type_code, (countMap.get(p.business_type_code) || 0) + 1);
      }
    }

    const categoriesWithCount: CategoryWithCount[] = (categories || []).map(cat => ({
      category_code: cat.category_code,
      name_th: cat.name_th,
      name_en: cat.name_en,
      member_count: countMap.get(cat.category_code) || 0
    }));

    return res.json({ categories: categoriesWithCount });
  } catch (error: any) {
    console.error("Error in getCategories:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members/by-category/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    if (!code || !/^[0-9]{2}$/.test(code)) {
      return res.status(400).json({ error: "Invalid category code format" });
    }

    const { data: members, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        nickname,
        company,
        position,
        tagline,
        photo_url,
        business_type,
        business_type_code,
        phone,
        email,
        website_url,
        facebook_url,
        instagram_url,
        line_id,
        tags
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", code)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching members by category:", error);
      return res.status(500).json({ error: "Database error fetching members" });
    }

    const { data: category } = await supabaseAdmin
      .from("business_categories")
      .select("name_th, name_en")
      .eq("category_code", code)
      .single();

    return res.json({ 
      members: members || [],
      category: category || { name_th: "ไม่ระบุ", name_en: "Unknown" },
      total: members?.length || 0
    });
  } catch (error: any) {
    console.error("Error in getMembersByCategory:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/member/:participantId", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    const tenantId = req.query.tenantId as string;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId" });
    }

    if (!uuidRegex.test(participantId)) {
      return res.status(400).json({ error: "Invalid participantId format" });
    }

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId - required for tenant isolation" });
    }

    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const { data: member, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name,
        nickname,
        company,
        position,
        tagline,
        photo_url,
        company_logo_url,
        business_type,
        business_type_code,
        phone,
        email,
        website_url,
        facebook_url,
        instagram_url,
        line_id,
        business_address,
        notes,
        tags,
        onepage_url,
        tenants!inner (tenant_name, logo_url)
      `)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Member not found" });
      }
      console.error("Error fetching member:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    let categoryName = null;
    if (member.business_type_code) {
      const { data: cat } = await supabaseAdmin
        .from("business_categories")
        .select("name_th, name_en")
        .eq("category_code", member.business_type_code)
        .single();
      categoryName = cat;
    }

    return res.json({ 
      member,
      category: categoryName
    });
  } catch (error: any) {
    console.error("Error in getMember:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenant/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id, tenant_name, logo_url, subdomain")
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Tenant not found" });
      }
      console.error("Error fetching tenant:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.json({ tenant });
  } catch (error: any) {
    console.error("Error in getTenant:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
