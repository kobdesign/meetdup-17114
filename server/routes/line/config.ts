import { Router } from "express";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest, checkSuperAdmin } from "../../utils/auth";
import { getLineCredentials, saveLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";
import { getSharedLineConfig } from "../../services/line/sharedConfig";

const router = Router();

// Get shared LINE config status (Super Admin only)
router.get("/shared-config", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req.user!.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const sharedConfig = getSharedLineConfig();
    const liffId = process.env.LIFF_ID || process.env.VITE_LIFF_ID;

    return res.json({
      hasAccessToken: !!sharedConfig?.channelAccessToken,
      hasChannelSecret: !!sharedConfig?.channelSecret,
      hasChannelId: !!sharedConfig?.channelId,
      hasLiffId: !!liffId,
      channelId: sharedConfig?.channelId || null,
      liffId: liffId || null,
      accessTokenPreview: sharedConfig?.channelAccessToken 
        ? "••••" + sharedConfig.channelAccessToken.slice(-4) 
        : null,
      channelSecretPreview: sharedConfig?.channelSecret 
        ? "••••" + sharedConfig.channelSecret.slice(-4) 
        : null,
    });
  } catch (error: any) {
    console.error("Error fetching shared LINE config:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Test shared LINE config connection (Super Admin only)
router.post("/shared-config/test", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req.user!.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const sharedConfig = getSharedLineConfig();
    
    if (!sharedConfig?.channelAccessToken) {
      return res.json({ 
        success: false, 
        error: "LINE_CHANNEL_ACCESS_TOKEN not configured" 
      });
    }

    const lineClient = new LineClient(sharedConfig.channelAccessToken);
    const botInfo = await lineClient.getBotInfo();

    return res.json({
      success: true,
      botName: botInfo.displayName,
      botId: botInfo.userId,
      basicId: botInfo.basicId,
    });
  } catch (error: any) {
    console.error("Error testing LINE connection:", error);
    return res.json({
      success: false,
      error: error.message || "Connection failed",
    });
  }
});

router.get("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);

    if (!credentials) {
      return res.json({ configured: false });
    }

    return res.json({
      configured: true,
      channelAccessToken: "••••" + credentials.channelAccessToken.slice(-4),
      channelSecret: "••••" + credentials.channelSecret.slice(-4),
      channelId: credentials.channelId,
    });
  } catch (error) {
    console.error("Error fetching LINE config:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, channelAccessToken, channelSecret, channelId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    // SECURITY: Check tenant access BEFORE touching any credentials
    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if this is a partial update or full config
    const hasToken = channelAccessToken && channelAccessToken.trim().length > 0;
    const hasSecret = channelSecret && channelSecret.trim().length > 0;
    const hasChannelId = channelId && channelId.trim().length > 0;

    // Get existing credentials to merge with new values (AFTER access check)
    const existingCreds = await getLineCredentials(tenantId);

    // For new config, require all three fields
    if (!existingCreds && (!hasToken || !hasSecret || !hasChannelId)) {
      return res.status(400).json({ error: "Missing required fields for new LINE configuration" });
    }

    // For updates, require at least one field
    if (existingCreds && !hasToken && !hasSecret && !hasChannelId) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Merge with existing values for partial updates
    const finalToken = hasToken ? channelAccessToken : existingCreds?.channelAccessToken || "";
    const finalSecret = hasSecret ? channelSecret : existingCreds?.channelSecret || "";
    const finalChannelId = hasChannelId ? channelId : existingCreds?.channelId || "";

    // Validate we have all required values after merging
    if (!finalToken || !finalSecret || !finalChannelId) {
      return res.status(400).json({ error: "Missing required LINE credentials" });
    }

    await saveLineCredentials(tenantId, finalToken, finalSecret, finalChannelId);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error saving LINE config:", error);
    return res.status(500).json({ error: "Failed to save configuration" });
  }
});

router.post("/validate-token", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing accessToken" });
    }

    const lineClient = new LineClient(accessToken);
    const botInfo = await lineClient.getBotInfo();

    return res.json({
      valid: true,
      botUserId: botInfo.userId,
      displayName: botInfo.displayName,
      pictureUrl: botInfo.pictureUrl,
    });
  } catch (error: any) {
    console.error("Error validating LINE token:", error);
    return res.json({
      valid: false,
      error: error.message || "Invalid LINE Channel Access Token",
    });
  }
});

export default router;
