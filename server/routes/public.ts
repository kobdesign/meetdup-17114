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

    // Generate signed URLs for private storage images
    const memberWithSignedUrls = { ...member };
    
    if (member.photo_url && member.photo_url.includes('supabase')) {
      try {
        const photoPath = member.photo_url.split('/storage/v1/object/public/')[1] || 
                          member.photo_url.split('/storage/v1/object/sign/')[1]?.split('?')[0];
        if (photoPath) {
          const bucketAndPath = photoPath.split('/');
          const bucket = bucketAndPath[0];
          const path = bucketAndPath.slice(1).join('/');
          const { data: signedData } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24); // 24 hours
          if (signedData?.signedUrl) {
            memberWithSignedUrls.photo_url = signedData.signedUrl;
          }
        }
      } catch (err) {
        console.error("[public/member] Error generating signed URL for photo:", err);
      }
    }

    if (member.company_logo_url && member.company_logo_url.includes('supabase')) {
      try {
        const logoPath = member.company_logo_url.split('/storage/v1/object/public/')[1] || 
                         member.company_logo_url.split('/storage/v1/object/sign/')[1]?.split('?')[0];
        if (logoPath) {
          const bucketAndPath = logoPath.split('/');
          const bucket = bucketAndPath[0];
          const path = bucketAndPath.slice(1).join('/');
          const { data: signedData } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24); // 24 hours
          if (signedData?.signedUrl) {
            memberWithSignedUrls.company_logo_url = signedData.signedUrl;
          }
        }
      } catch (err) {
        console.error("[public/member] Error generating signed URL for company logo:", err);
      }
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
      member: memberWithSignedUrls,
      category: categoryName
    });
  } catch (error: any) {
    console.error("Error in getMember:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/liff-config", async (req: Request, res: Response) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["liff_id", "liff_enabled"]);

    if (error) {
      console.error("Error fetching LIFF config:", error);
      return res.json({ liff_id: null, liff_enabled: false });
    }

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) {
      settingsMap[s.setting_key] = s.setting_value || "";
    }

    const liffEnabled = settingsMap.liff_enabled === "true";
    const liffId = settingsMap.liff_id || null;

    return res.json({
      liff_id: liffEnabled && liffId ? liffId : null,
      liff_enabled: liffEnabled
    });
  } catch (error: any) {
    console.error("Error in getLiffConfig:", error);
    return res.json({ liff_id: null, liff_enabled: false });
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

router.get("/positions", async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const { data: participants, error } = await supabaseAdmin
      .from("participants")
      .select("bni_position")
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .not("bni_position", "is", null);

    if (error) {
      console.error("Error fetching positions:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const countMap = new Map<string, number>();
    for (const p of participants || []) {
      if (p.bni_position) {
        countMap.set(p.bni_position, (countMap.get(p.bni_position) || 0) + 1);
      }
    }

    const positions = Array.from(countMap.entries()).map(([position_code, member_count]) => ({
      position_code,
      member_count
    }));

    return res.json({ positions });
  } catch (error: any) {
    console.error("Error in getPositions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members/by-position/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    if (!code) {
      return res.status(400).json({ error: "Invalid position code" });
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
        bni_position,
        tags
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("bni_position", code)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching members by position:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const positionNames: Record<string, { name_th: string; name_en: string }> = {
      president: { name_th: "ประธาน", name_en: "President" },
      vice_president: { name_th: "รองประธาน", name_en: "Vice President" },
      secretary: { name_th: "เลขานุการ", name_en: "Secretary/Treasurer" },
      membership: { name_th: "ฝ่ายสมาชิก", name_en: "Membership Committee" },
      visitor: { name_th: "ฝ่ายต้อนรับ", name_en: "Visitor Host" },
      education: { name_th: "ฝ่ายการศึกษา", name_en: "Education Coordinator" },
      mentor: { name_th: "พี่เลี้ยง", name_en: "Mentor Coordinator" },
      member: { name_th: "สมาชิก", name_en: "Member" }
    };

    return res.json({ 
      members: members || [],
      position: positionNames[code] || { name_th: code, name_en: code },
      total: members?.length || 0
    });
  } catch (error: any) {
    console.error("Error in getMembersByPosition:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/power-teams", async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const { data: powerTeams, error: ptError } = await supabaseAdmin
      .from("power_teams")
      .select("power_team_id, name, description")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (ptError) {
      console.error("Error fetching power teams:", ptError);
      return res.status(500).json({ error: "Database error" });
    }

    const { data: memberships, error: memberError } = await supabaseAdmin
      .from("power_team_members")
      .select("power_team_id, participants!inner(status)")
      .eq("participants.tenant_id", tenantId)
      .eq("participants.status", "member");

    if (memberError) {
      console.error("Error fetching power team memberships:", memberError);
    }

    const countMap = new Map<string, number>();
    for (const m of memberships || []) {
      countMap.set(m.power_team_id, (countMap.get(m.power_team_id) || 0) + 1);
    }

    const powerTeamsWithCount = (powerTeams || []).map(pt => ({
      ...pt,
      member_count: countMap.get(pt.power_team_id) || 0
    }));

    return res.json({ powerTeams: powerTeamsWithCount });
  } catch (error: any) {
    console.error("Error in getPowerTeams:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members/by-powerteam/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId parameter" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid power team ID format" });
    }

    const { data: powerTeam } = await supabaseAdmin
      .from("power_teams")
      .select("name, description")
      .eq("power_team_id", id)
      .single();

    const { data: memberIds, error: memberError } = await supabaseAdmin
      .from("power_team_members")
      .select("participant_id")
      .eq("power_team_id", id);

    if (memberError) {
      console.error("Error fetching power team members:", memberError);
      return res.status(500).json({ error: "Database error" });
    }

    const participantIds = (memberIds || []).map(m => m.participant_id);

    if (participantIds.length === 0) {
      return res.json({ 
        members: [],
        powerTeam: powerTeam || { name: "Unknown", description: null },
        total: 0
      });
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
        tags
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .in("participant_id", participantIds)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching members:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ 
      members: members || [],
      powerTeam: powerTeam || { name: "Unknown", description: null },
      total: members?.length || 0
    });
  } catch (error: any) {
    console.error("Error in getMembersByPowerTeam:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
