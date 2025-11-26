import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";

const router = Router();

/**
 * Get LIFF context - participant and tenant info for a LINE user
 */
router.get("/context", async (req: Request, res: Response) => {
  try {
    const lineUserId = req.query.line_user_id as string;

    if (!lineUserId) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing line_user_id parameter" 
      });
    }

    // Find participant by LINE user ID
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, tenant_id, full_name, nickname, phone, status")
      .eq("line_user_id", lineUserId)
      .eq("status", "active")
      .single();

    if (participantError || !participant) {
      return res.json({
        success: true,
        participant: null,
        tenant: null,
        message: "User not linked to any chapter"
      });
    }

    // Get tenant info
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("id, name, subdomain, logo_url")
      .eq("id", participant.tenant_id)
      .single();

    // Get branding color
    const { data: settings } = await supabaseAdmin
      .from("tenant_settings")
      .select("branding_color")
      .eq("tenant_id", participant.tenant_id)
      .single();

    const tenant = tenantData ? {
      tenant_id: tenantData.id,
      name: tenantData.name,
      subdomain: tenantData.subdomain,
      logo_url: tenantData.logo_url,
      branding_color: settings?.branding_color || "#1E3A5F"
    } : null;

    return res.json({
      success: true,
      participant: {
        participant_id: participant.id,
        tenant_id: participant.tenant_id,
        full_name: participant.full_name,
        nickname: participant.nickname,
        phone: participant.phone,
        status: participant.status
      },
      tenant
    });
  } catch (error: any) {
    console.error("[LIFF Context] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Search business cards for LIFF
 */
router.get("/cards/search", async (req: Request, res: Response) => {
  try {
    const lineUserId = req.query.line_user_id as string;
    const searchTerm = (req.query.q as string || "").trim();

    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: "Missing line_user_id parameter"
      });
    }

    // Find participant to get tenant
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("tenant_id")
      .eq("line_user_id", lineUserId)
      .eq("status", "active")
      .single();

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: "User not linked to any chapter"
      });
    }

    const tenantId = participant.tenant_id;

    // Search participants in the same chapter
    let query = supabaseAdmin
      .from("participants")
      .select(`
        id,
        full_name,
        nickname,
        position,
        company,
        tagline,
        photo_url,
        email,
        phone,
        website_url,
        facebook_url,
        instagram_url,
        line_id,
        business_address,
        tags,
        onepage_url
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("full_name");

    if (searchTerm) {
      // Sanitize search term
      const sanitized = searchTerm
        .replace(/%/g, "")
        .replace(/_/g, "")
        .replace(/'/g, "")
        .replace(/"/g, "")
        .replace(/;/g, "");

      query = query.or(`full_name.ilike.%${sanitized}%,nickname.ilike.%${sanitized}%,company.ilike.%${sanitized}%,position.ilike.%${sanitized}%`);
    }

    const { data: cards, error } = await query.limit(20);

    if (error) {
      throw error;
    }

    // If search term provided, also search in tags
    let tagResults: any[] = [];
    if (searchTerm) {
      const sanitized = searchTerm
        .replace(/%/g, "")
        .replace(/_/g, "")
        .replace(/'/g, "")
        .replace(/"/g, "")
        .replace(/;/g, "");

      const { data: tagData } = await supabaseAdmin
        .from("participants")
        .select(`
          id,
          full_name,
          nickname,
          position,
          company,
          tagline,
          photo_url,
          email,
          phone,
          website_url,
          facebook_url,
          instagram_url,
          line_id,
          business_address,
          tags,
          onepage_url
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .contains("tags", [sanitized]);

      tagResults = tagData || [];
    }

    // Merge and deduplicate results
    const allResults = [...(cards || [])];
    const cardIds = new Set(allResults.map(c => c.id));
    
    for (const tagResult of tagResults) {
      if (!cardIds.has(tagResult.id)) {
        allResults.push(tagResult);
      }
    }

    return res.json({
      success: true,
      cards: allResults
    });
  } catch (error: any) {
    console.error("[LIFF Cards Search] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get business card flex message for sharing
 */
router.get("/cards/:participantId/flex", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    const lineUserId = req.query.line_user_id as string;

    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: "Missing line_user_id parameter"
      });
    }

    // Verify requester is in the same tenant
    const { data: requester } = await supabaseAdmin
      .from("participants")
      .select("tenant_id")
      .eq("line_user_id", lineUserId)
      .eq("status", "active")
      .single();

    if (!requester) {
      return res.status(403).json({
        success: false,
        error: "User not linked to any chapter"
      });
    }

    // Get participant data
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .eq("tenant_id", requester.tenant_id)
      .single();

    if (error || !participant) {
      return res.status(404).json({
        success: false,
        error: "Business card not found"
      });
    }

    // Import and create flex message
    const { createBusinessCardFlexMessage } = await import("../services/line/templates/businessCard");
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    const flexMessage = createBusinessCardFlexMessage({
      participant_id: participant.id,
      tenant_id: participant.tenant_id,
      full_name: participant.full_name,
      nickname: participant.nickname,
      position: participant.position,
      company: participant.company,
      tagline: participant.tagline,
      photo_url: participant.photo_url,
      email: participant.email,
      phone: participant.phone,
      website_url: participant.website_url,
      facebook_url: participant.facebook_url,
      instagram_url: participant.instagram_url,
      line_id: participant.line_id,
      business_address: participant.business_address,
      tags: participant.tags,
      onepage_url: participant.onepage_url
    }, baseUrl);

    return res.json({
      success: true,
      flexMessage
    });
  } catch (error: any) {
    console.error("[LIFF Card Flex] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
