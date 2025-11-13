import { Router } from "express";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest } from "../../utils/auth";
import { getLineCredentials, saveLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";

const router = Router();

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

    if (!tenantId || !channelAccessToken || !channelSecret || !channelId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    await saveLineCredentials(tenantId, channelAccessToken, channelSecret, channelId);

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
