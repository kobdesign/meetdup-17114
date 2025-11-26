import { Router } from "express";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest, checkSuperAdmin } from "../../utils/auth";
import { getLineCredentials, saveLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";
import { 
  getSharedLineConfigAsync, 
  getSharedLineConfigStatus, 
  saveSharedLineConfig,
  clearConfigCache 
} from "../../services/line/sharedConfig";

const router = Router();

// Get shared LINE config status (Super Admin only)
router.get("/shared-config", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req.user!.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const status = await getSharedLineConfigStatus();
    return res.json(status);
  } catch (error: any) {
    console.error("Error fetching shared LINE config:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Save shared LINE config (Super Admin only)
router.post("/shared-config", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req.user!.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { channelAccessToken, channelSecret, channelId, liffId } = req.body;

    // Build config object with only non-empty values
    const configToSave: any = {};
    if (channelAccessToken && channelAccessToken.trim()) {
      configToSave.channelAccessToken = channelAccessToken.trim();
    }
    if (channelSecret && channelSecret.trim()) {
      configToSave.channelSecret = channelSecret.trim();
    }
    if (channelId && channelId.trim()) {
      configToSave.channelId = channelId.trim();
    }
    if (liffId && liffId.trim()) {
      configToSave.liffId = liffId.trim();
    }

    if (Object.keys(configToSave).length === 0) {
      return res.status(400).json({ error: "No configuration values provided" });
    }

    await saveSharedLineConfig(configToSave);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving shared LINE config:", error);
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

    const sharedConfig = await getSharedLineConfigAsync();
    
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

// Clear config cache (Super Admin only) - useful after updating config
router.post("/shared-config/clear-cache", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req.user!.id);
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    clearConfigCache();
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error clearing config cache:", error);
    return res.status(500).json({ error: error.message });
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
