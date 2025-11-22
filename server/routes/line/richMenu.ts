import { Router } from "express";
import multer from "multer";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest } from "../../utils/auth";
import { getLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";
import { supabaseAdmin } from "../../utils/supabaseClient";

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

    // Query rich menus from database
    const { data: richMenus, error } = await supabaseAdmin
      .from("rich_menus")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rich menus from database:", error);
      return res.status(500).json({ error: "Failed to fetch rich menus" });
    }

    return res.json({ richMenus: richMenus || [] });
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

    // Set as default in LINE if requested
    const shouldSetAsDefault = setAsDefault === "true";
    if (shouldSetAsDefault) {
      await lineClient.setDefaultRichMenu(result.richMenuId);
    }

    // Save rich menu metadata to database
    const { data: dbRichMenu, error: dbError} = await supabaseAdmin
      .from("rich_menus")
      .insert({
        tenant_id: tenantId,
        line_rich_menu_id: result.richMenuId,
        name,
        chat_bar_text: chatBarText,
        selected: selected === "true",
        is_default: shouldSetAsDefault,
        is_active: true,
        image_width: 2500,
        image_height: parseInt(imageHeight),
        areas: parsedAreas,
        created_by: req.user!.id
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving rich menu to database:", dbError);
      // Note: Rich menu already created in LINE, so we warn but don't fail
      console.warn("Rich menu created in LINE but failed to save to database");
    }

    return res.json({ 
      success: true, 
      richMenuId: result.richMenuId,
      dbRichMenuId: dbRichMenu?.rich_menu_id,
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

    // Find rich menu in database first
    // Try by rich_menu_id first, then by line_rich_menu_id
    let richMenu: any = null;
    const { data: byRichMenuId } = await supabaseAdmin
      .from("rich_menus")
      .select("rich_menu_id, line_rich_menu_id")
      .eq("tenant_id", tenantId)
      .eq("rich_menu_id", richMenuId)
      .maybeSingle();
    
    if (byRichMenuId) {
      richMenu = byRichMenuId;
    } else {
      const { data: byLineRichMenuId } = await supabaseAdmin
        .from("rich_menus")
        .select("rich_menu_id, line_rich_menu_id")
        .eq("tenant_id", tenantId)
        .eq("line_rich_menu_id", richMenuId)
        .maybeSingle();
      richMenu = byLineRichMenuId;
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    // Delete from LINE
    const lineClient = new LineClient(credentials.channelAccessToken);
    const lineRichMenuId = richMenu?.line_rich_menu_id || richMenuId;
    await lineClient.deleteRichMenu(lineRichMenuId);

    // Delete from database
    if (richMenu) {
      await supabaseAdmin
        .from("rich_menus")
        .delete()
        .eq("rich_menu_id", richMenu.rich_menu_id)
        .eq("tenant_id", tenantId); // Double-check tenant for safety
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting rich menu:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/:richMenuId", verifySupabaseAuth, upload.single("image"), async (req: AuthenticatedRequest, res) => {
  try {
    const { richMenuId } = req.params;
    const { tenantId, name, chatBarText, areas } = req.body;
    const imageFile = req.file;

    // Validate required fields
    if (!tenantId || !name || !chatBarText || !areas) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Find existing rich menu in database
    let richMenu: any = null;
    const { data: byRichMenuId } = await supabaseAdmin
      .from("rich_menus")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("rich_menu_id", richMenuId)
      .maybeSingle();
    
    if (byRichMenuId) {
      richMenu = byRichMenuId;
    } else {
      const { data: byLineRichMenuId } = await supabaseAdmin
        .from("rich_menus")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("line_rich_menu_id", richMenuId)
        .maybeSingle();
      richMenu = byLineRichMenuId;
    }

    if (!richMenu) {
      return res.status(404).json({ error: "Rich menu not found" });
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

    const lineClient = new LineClient(credentials.channelAccessToken);
    
    // Delete old rich menu from LINE
    await lineClient.deleteRichMenu(richMenu.line_rich_menu_id);

    // Create new rich menu in LINE with updated data
    const richMenuData = {
      size: {
        width: richMenu.image_width,
        height: richMenu.image_height
      },
      selected: richMenu.selected,
      name: name,
      chatBarText: chatBarText,
      areas: parsedAreas
    };

    const result = await lineClient.createRichMenu(richMenuData);

    // Upload image (new or existing)
    if (imageFile) {
      // Upload new image
      const contentType = imageFile.mimetype || "image/png";
      await lineClient.uploadRichMenuImage(result.richMenuId, imageFile.buffer, contentType);
    } else {
      // Download existing image from LINE and re-upload to new rich menu
      try {
        const imageBuffer = await lineClient.downloadRichMenuImage(richMenu.line_rich_menu_id);
        await lineClient.uploadRichMenuImage(result.richMenuId, imageBuffer, "image/png");
      } catch (error) {
        console.error("Failed to copy existing image, continuing without image:", error);
      }
    }

    // Restore default status if it was default
    if (richMenu.is_default) {
      await lineClient.setDefaultRichMenu(result.richMenuId);
    }

    // Update database record
    const { data: updatedMenu, error: updateError } = await supabaseAdmin
      .from("rich_menus")
      .update({
        line_rich_menu_id: result.richMenuId,
        name,
        chat_bar_text: chatBarText,
        areas: parsedAreas,
      })
      .eq("rich_menu_id", richMenu.rich_menu_id)
      .eq("tenant_id", tenantId) // Double-check tenant for safety
      .select()
      .single();

    if (updateError) {
      console.error("Error updating rich menu in database:", updateError);
      return res.status(500).json({ error: "Failed to update database record" });
    }

    return res.json({ 
      success: true, 
      richMenu: updatedMenu
    });
  } catch (error: any) {
    console.error("Error updating rich menu:", error);
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

    // Find rich menu in database
    // Try by rich_menu_id first, then by line_rich_menu_id
    let richMenu: any = null;
    const { data: byRichMenuId } = await supabaseAdmin
      .from("rich_menus")
      .select("rich_menu_id, line_rich_menu_id")
      .eq("tenant_id", tenantId)
      .eq("rich_menu_id", richMenuId)
      .maybeSingle();
    
    if (byRichMenuId) {
      richMenu = byRichMenuId;
    } else {
      const { data: byLineRichMenuId } = await supabaseAdmin
        .from("rich_menus")
        .select("rich_menu_id, line_rich_menu_id")
        .eq("tenant_id", tenantId)
        .eq("line_rich_menu_id", richMenuId)
        .maybeSingle();
      richMenu = byLineRichMenuId;
    }

    if (!richMenu) {
      return res.status(404).json({ error: "Rich menu not found" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    // Set as default in LINE
    const lineClient = new LineClient(credentials.channelAccessToken);
    await lineClient.setDefaultRichMenu(richMenu.line_rich_menu_id!);

    // Update database: unset current default and set new one
    await supabaseAdmin
      .from("rich_menus")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);

    await supabaseAdmin
      .from("rich_menus")
      .update({ is_default: true })
      .eq("rich_menu_id", richMenu.rich_menu_id)
      .eq("tenant_id", tenantId); // Double-check tenant for safety

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
