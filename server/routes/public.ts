import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { createBusinessCardFlexMessage, BusinessCardData } from "../services/line/templates/businessCard";
import { getProductionBaseUrl } from "../utils/getProductionUrl";
import { getLineCredentials } from "../services/line/credentials";
import { LineClient } from "../services/line/lineClient";
import { getShareEnabled, getShareServiceUrl } from "../utils/liffConfig";

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
        full_name_th,
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
      .order("full_name_th", { ascending: true });

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
        full_name_th,
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

/**
 * Get Flex Message JSON for sharing via LIFF shareTargetPicker
 * Returns the same business card format used by LINE bot
 */
router.get("/share-flex/:participantId", async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).slice(2, 10);
  const logPrefix = `[share-flex:${requestId}]`;
  
  try {
    const { participantId } = req.params;
    const tenantId = req.query.tenantId as string | undefined;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!participantId) {
      return res.status(400).json({ success: false, error: "Missing participantId" });
    }

    if (!uuidRegex.test(participantId)) {
      return res.status(400).json({ success: false, error: "Invalid participantId format" });
    }

    // Tenant isolation: require tenantId for security
    if (!tenantId) {
      return res.status(400).json({ success: false, error: "Missing tenantId - required for tenant isolation" });
    }

    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({ success: false, error: "Invalid tenantId format" });
    }

    console.log(`${logPrefix} Fetching flex message for participant:`, participantId, "tenant:", tenantId);

    // Build query with tenant isolation
    const { data: member, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name_th,
        nickname_th,
        company,
        position,
        tagline,
        photo_url,
        company_logo_url,
        phone,
        email,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        line_id,
        business_address,
        tags,
        onepage_url
      `)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .in("status", ["member", "visitor"])
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log(`${logPrefix} Member not found`);
        return res.status(404).json({ success: false, error: "Member not found" });
      }
      console.error(`${logPrefix} Database error:`, error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    // Generate signed URLs for private storage images
    let signedPhotoUrl = member.photo_url;
    let signedCompanyLogoUrl = member.company_logo_url;
    
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
            .createSignedUrl(path, 60 * 60 * 24);
          if (signedData?.signedUrl) {
            signedPhotoUrl = signedData.signedUrl;
          }
        }
      } catch (err) {
        console.error(`${logPrefix} Error generating signed URL for photo:`, err);
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
            .createSignedUrl(path, 60 * 60 * 24);
          if (signedData?.signedUrl) {
            signedCompanyLogoUrl = signedData.signedUrl;
          }
        }
      } catch (err) {
        console.error(`${logPrefix} Error generating signed URL for company logo:`, err);
      }
    }

    // Prepare business card data
    const cardData: BusinessCardData = {
      participant_id: member.participant_id,
      tenant_id: member.tenant_id,
      full_name_th: member.full_name_th,
      nickname_th: member.nickname_th,
      position: member.position,
      company: member.company,
      tagline: member.tagline,
      photo_url: signedPhotoUrl,
      company_logo_url: signedCompanyLogoUrl,
      email: member.email,
      phone: member.phone,
      website_url: member.website_url,
      facebook_url: member.facebook_url,
      instagram_url: member.instagram_url,
      linkedin_url: member.linkedin_url,
      line_id: member.line_id,
      business_address: member.business_address,
      tags: member.tags,
      onepage_url: member.onepage_url
    };

    // Use production URL for sharing - consistent with LINE bot
    const baseUrl = getProductionBaseUrl();
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();
    
    // Check if raw format requested (for external share service)
    const format = req.query.format as string;
    
    // Generate the Flex Message using the same template as LINE bot
    // Share button is now enabled on shared cards so recipients can share further
    const flexMessage = createBusinessCardFlexMessage(cardData, baseUrl, { 
      shareEnabled,
      shareServiceUrl
    });

    console.log(`${logPrefix} Generated flex message for:`, member.full_name_th, format === 'raw' ? '(raw format)' : '');

    // Return raw format for external share service (CORS enabled)
    // LINE shareTargetPicker expects an array of messages
    if (format === 'raw') {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Content-Type', 'application/json; charset=utf-8');
      // Wrap in array as LINE expects messages array format
      return res.send(JSON.stringify([flexMessage]));
    }

    return res.json({
      success: true,
      flexMessage,
      memberName: member.full_name_th
    });
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/liff-config", async (req: Request, res: Response) => {
  try {
    const { getLiffConfig, getShareServiceUrl } = await import("../utils/liffConfig");
    const config = await getLiffConfig();
    const shareServiceUrl = await getShareServiceUrl();

    return res.json({
      liff_id: config.liffId,
      liff_enabled: config.liffEnabled,
      environment: config.environment,
      share_service_url: shareServiceUrl
    });
  } catch (error: any) {
    console.error("Error in getLiffConfig:", error);
    return res.json({ liff_id: null, liff_enabled: false, environment: "unknown", share_service_url: "https://line-share-flex-api.lovable.app" });
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
        full_name_th,
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
      .order("full_name_th", { ascending: true });

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

    // Verify power team belongs to the specified tenant (tenant isolation)
    const { data: powerTeam, error: ptError } = await supabaseAdmin
      .from("power_teams")
      .select("name, description")
      .eq("power_team_id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (ptError || !powerTeam) {
      return res.status(404).json({ error: "Power team not found" });
    }

    // Get member IDs with tenant-isolated join
    const { data: memberIds, error: memberError } = await supabaseAdmin
      .from("power_team_members")
      .select("participant_id, participants!inner(tenant_id)")
      .eq("power_team_id", id)
      .eq("participants.tenant_id", tenantId);

    if (memberError) {
      console.error("Error fetching power team members:", memberError);
      return res.status(500).json({ error: "Database error" });
    }

    const participantIds = (memberIds || []).map(m => m.participant_id);

    if (participantIds.length === 0) {
      return res.json({ 
        members: [],
        powerTeam: powerTeam,
        total: 0
      });
    }

    const { data: members, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name_th,
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
      .order("full_name_th", { ascending: true });

    if (error) {
      console.error("Error fetching members:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ 
      members: members || [],
      powerTeam: powerTeam,
      total: members?.length || 0
    });
  } catch (error: any) {
    console.error("Error in getMembersByPowerTeam:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Verify LIFF access token and get user profile
 * Returns verified userId if valid, null otherwise
 */
interface TokenVerifyResponse {
  expires_in: number;
  client_id?: string;
  scope?: string;
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

async function verifyLiffToken(accessToken: string): Promise<{ userId: string } | null> {
  try {
    // Verify token with LINE API
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify?access_token=" + accessToken);
    if (!verifyRes.ok) {
      console.log("[LIFF-Verify] Token verification failed:", verifyRes.status);
      return null;
    }
    
    const verifyData = await verifyRes.json() as TokenVerifyResponse;
    if (verifyData.expires_in <= 0) {
      console.log("[LIFF-Verify] Token expired");
      return null;
    }
    
    // Get user profile using the verified token
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!profileRes.ok) {
      console.log("[LIFF-Verify] Profile fetch failed:", profileRes.status);
      return null;
    }
    
    const profile = await profileRes.json() as LineProfile;
    return { userId: profile.userId };
  } catch (error) {
    console.error("[LIFF-Verify] Error:", error);
    return null;
  }
}

/**
 * LIFF Category Search - Push business cards to LINE chat
 * Called from LIFF when user selects a category
 * Requires LIFF access token for authentication
 */
router.post("/liff/search-by-category", async (req: Request, res: Response) => {
  const logPrefix = "[LIFF-CategorySearch]";
  
  try {
    const { accessToken, tenantId, categoryCode } = req.body;

    // Validate inputs
    if (!accessToken || !tenantId || !categoryCode) {
      return res.status(400).json({ 
        error: "Missing required parameters",
        details: "accessToken, tenantId, and categoryCode are required" 
      });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    if (!/^[0-9]{2}$/.test(categoryCode)) {
      return res.status(400).json({ error: "Invalid category code format" });
    }

    // Verify LIFF token and get authenticated user ID
    const verifiedUser = await verifyLiffToken(accessToken);
    if (!verifiedUser) {
      return res.status(401).json({ error: "Invalid or expired LIFF token" });
    }

    const lineUserId = verifiedUser.userId;
    console.log(`${logPrefix} Verified request:`, { lineUserId, tenantId, categoryCode });

    // Get LINE credentials for this tenant
    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      console.error(`${logPrefix} No LINE credentials for tenant: ${tenantId}`);
      return res.status(400).json({ error: "LINE integration not configured for this chapter" });
    }

    // Get category name for display
    const { data: category } = await supabaseAdmin
      .from("business_categories")
      .select("name_th")
      .eq("category_code", categoryCode)
      .single();

    const categoryName = category?.name_th || `หมวดหมู่ ${categoryCode}`;

    // Search for members by category
    const { data: members, error: searchError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        tenant_id,
        full_name_th,
        nickname_th,
        position,
        company,
        tagline,
        photo_url,
        company_logo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        linkedin_url,
        line_id,
        business_address,
        tags,
        onepage_url
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .eq("business_type_code", categoryCode)
      .order("full_name_th", { ascending: true })
      .limit(12); // LINE carousel max is 12 bubbles

    if (searchError) {
      console.error(`${logPrefix} Search error:`, searchError);
      return res.status(500).json({ error: "Database search error" });
    }

    if (!members || members.length === 0) {
      // Push a text message saying no members found
      const lineClient = new LineClient(credentials.channelAccessToken);
      await lineClient.pushMessage(lineUserId, {
        type: "text",
        text: `ไม่พบสมาชิกในหมวดหมู่ "${categoryName}"`
      });
      
      return res.json({ 
        success: true, 
        message: "No members found",
        count: 0 
      });
    }

    // Get tenant info for branding
    const { data: tenantInfo } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name, logo_url")
      .eq("tenant_id", tenantId)
      .single();

    // Add tenant info to members for flex message
    const membersWithTenant = members.map(m => ({
      ...m,
      tenants: tenantInfo
    }));

    const baseUrl = getProductionBaseUrl();
    const shareEnabled = await getShareEnabled();
    const shareServiceUrl = await getShareServiceUrl();
    const lineClient = new LineClient(credentials.channelAccessToken);

    // If only one member, send single card
    if (membersWithTenant.length === 1) {
      const flexMessage = createBusinessCardFlexMessage(membersWithTenant[0] as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl });
      await lineClient.pushMessage(lineUserId, flexMessage);
      
      console.log(`${logPrefix} Sent single card for category ${categoryCode}`);
      return res.json({ 
        success: true, 
        count: 1,
        message: `Sent 1 business card for ${categoryName}` 
      });
    }

    // Multiple members - send carousel
    const carouselContents = membersWithTenant.map(m => {
      const flexMessage = createBusinessCardFlexMessage(m as BusinessCardData, baseUrl, { shareEnabled, shareServiceUrl });
      return flexMessage.contents;
    });

    await lineClient.pushMessage(lineUserId, {
      type: "flex",
      altText: `พบ ${membersWithTenant.length} สมาชิกในหมวดหมู่ "${categoryName}"`,
      contents: {
        type: "carousel",
        contents: carouselContents
      }
    });

    console.log(`${logPrefix} Sent carousel with ${membersWithTenant.length} cards for category ${categoryCode}`);
    
    return res.json({ 
      success: true, 
      count: membersWithTenant.length,
      message: `Sent ${membersWithTenant.length} business cards for ${categoryName}` 
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// LIFF Text Search - search members by name, nickname, company, category, etc.
router.post("/liff/search-members", async (req: Request, res: Response) => {
  const logPrefix = "[LIFF-SearchMembers]";
  
  try {
    const { tenant_id, query } = req.body;

    // Validate inputs
    if (!tenant_id || !query) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required parameters",
        details: "tenant_id and query are required" 
      });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant_id)) {
      return res.status(400).json({ success: false, error: "Invalid tenant_id format" });
    }

    const searchTerm = query.trim();
    if (searchTerm.length < 1) {
      return res.status(400).json({ success: false, error: "Search query too short" });
    }

    console.log(`${logPrefix} Searching for "${searchTerm}" in tenant ${tenant_id}`);

    // First, find category codes that match the search term
    const { data: matchingCategories } = await supabaseAdmin
      .from("business_categories")
      .select("category_code")
      .or(`name_th.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`);
    
    const matchingCategoryCodes = (matchingCategories || []).map(c => c.category_code);
    console.log(`${logPrefix} Found ${matchingCategoryCodes.length} matching categories`);

    // Search across multiple fields including business_type_code for category matches
    const searchPattern = `%${searchTerm}%`;
    
    // Build query with OR conditions
    let orConditions = `full_name_th.ilike.${searchPattern},full_name_en.ilike.${searchPattern},nickname_th.ilike.${searchPattern},nickname_en.ilike.${searchPattern},company.ilike.${searchPattern},position.ilike.${searchPattern},tagline.ilike.${searchPattern}`;
    
    // Add category code matches if any
    if (matchingCategoryCodes.length > 0) {
      const categoryConditions = matchingCategoryCodes.map(code => `business_type_code.eq.${code}`).join(",");
      orConditions += `,${categoryConditions}`;
    }

    const { data: participants, error: searchError } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name_th,
        full_name_en,
        nickname_th,
        nickname_en,
        position,
        company,
        phone,
        email,
        photo_url,
        tagline,
        line_id,
        onepage_url,
        business_type_code
      `)
      .eq("tenant_id", tenant_id)
      .eq("status", "member")
      .or(orConditions)
      .order("full_name_th", { ascending: true })
      .limit(50);

    if (searchError) {
      console.error(`${logPrefix} Database error:`, searchError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    console.log(`${logPrefix} Found ${participants?.length || 0} members matching "${searchTerm}"`);

    return res.json({ 
      success: true, 
      participants: participants || [],
      count: participants?.length || 0
    });

  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
