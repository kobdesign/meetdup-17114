import { Router } from "express";
import multer from "multer";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest } from "../../utils/auth";
import { getLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";

const upload = multer({ storage: multer.memoryStorage() });
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
      return res.status(404).json({ error: "LINE not configured" });
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    const result = await lineClient.getRichMenuList();

    return res.json(result);
  } catch (error: any) {
    console.error("Error fetching rich menu list:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/", verifySupabaseAuth, upload.single("image"), async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, name, chatBarText, imageHeight, areas, selected, setAsDefault } = req.body;
    const imageFile = req.file;

    // Validate required fields
    if (!tenantId || !name || !chatBarText || !imageHeight || !areas || !imageFile) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    // Parse areas JSON
    let parsedAreas;
    try {
      parsedAreas = JSON.parse(areas);
    } catch (error) {
      return res.status(400).json({ error: "Invalid areas JSON format" });
    }

    // Build rich menu object
    const richMenuData = {
      size: {
        width: 2500,
        height: parseInt(imageHeight)
      },
      selected: selected === "true",
      name: name,
      chatBarText: chatBarText,
      areas: parsedAreas
    };

    const lineClient = new LineClient(credentials.channelAccessToken);

    // Create rich menu in LINE
    const result = await lineClient.createRichMenu(richMenuData);

    // Upload image to the created rich menu
    const contentType = imageFile.mimetype || "image/png";
    await lineClient.uploadRichMenuImage(result.richMenuId, imageFile.buffer, contentType);

    // Set as default if requested
    if (setAsDefault === "true") {
      await lineClient.setDefaultRichMenu(result.richMenuId);
    }

    return res.json({ 
      success: true, 
      richMenuId: result.richMenuId,
      message: "Rich menu created successfully"
    });
  } catch (error: any) {
    console.error("Error creating rich menu:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/:richMenuId", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    const { richMenuId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    await lineClient.deleteRichMenu(richMenuId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting rich menu:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/set-default", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, richMenuId } = req.body;

    if (!tenantId || !richMenuId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    await lineClient.setDefaultRichMenu(richMenuId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error setting default rich menu:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/upload-image", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    const { richMenuId, imageData, contentType } = req.body;

    if (!tenantId || !richMenuId || !imageData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    const imageBuffer = Buffer.from(imageData, "base64");
    const lineClient = new LineClient(credentials.channelAccessToken);
    await lineClient.uploadRichMenuImage(richMenuId, imageBuffer, contentType || "image/png");

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error uploading rich menu image:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
