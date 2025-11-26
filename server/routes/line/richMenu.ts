import { Router } from "express";
import multer from "multer";
import { verifySupabaseAuth, checkTenantAccess, AuthenticatedRequest } from "../../utils/auth";
import { getLineCredentials } from "../../services/line/credentials";
import { LineClient } from "../../services/line/lineClient";
import { supabaseAdmin } from "../../utils/supabaseClient";
import { uploadRichMenuImage, deleteRichMenuImage } from "../../utils/setupStorage";

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

    // Variables for rollback tracking
    let imageUrl: string | null = null;

    try {
      // 1. Upload image to Supabase Storage FIRST (for backup and preview)
      const contentType = imageFile.mimetype || "image/png";
      try {
        imageUrl = await uploadRichMenuImage(tenantId, result.richMenuId, imageFile.buffer, contentType);
      } catch (storageError: any) {
        console.error("Failed to upload image to Supabase Storage:", storageError);
        // Rollback: Delete the newly created LINE menu
        try {
          await lineClient.deleteRichMenu(result.richMenuId);
        } catch (rollbackError) {
          console.error("⚠️ ALERT: Failed to cleanup LINE menu after storage upload failure:", result.richMenuId, rollbackError);
        }
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // 2. Upload image to LINE API (for LINE to serve to users)
      try {
        await lineClient.uploadRichMenuImage(result.richMenuId, imageFile.buffer, contentType);
      } catch (lineUploadError: any) {
        console.error("Failed to upload image to LINE:", lineUploadError);
        // Rollback: Delete from Storage and LINE menu
        try {
          await deleteRichMenuImage(imageUrl);
          await lineClient.deleteRichMenu(result.richMenuId);
        } catch (rollbackError) {
          console.error("⚠️ ALERT: Failed to cleanup after LINE upload failure:", result.richMenuId, rollbackError);
        }
        throw new Error(`LINE image upload failed: ${lineUploadError.message}`);
      }

      // 3. Set as default in LINE if requested
      const shouldSetAsDefault = setAsDefault === "true";
      if (shouldSetAsDefault) {
        try {
          await lineClient.setDefaultRichMenu(result.richMenuId);
        } catch (defaultError: any) {
          console.error("Failed to set rich menu as default:", defaultError);
          // Rollback: Delete from Storage and LINE
          try {
            await deleteRichMenuImage(imageUrl);
            await lineClient.deleteRichMenu(result.richMenuId);
          } catch (rollbackError) {
            console.error("⚠️ ALERT: Failed to cleanup after default setting failure:", result.richMenuId, rollbackError);
          }
          throw new Error(`Failed to set menu as default: ${defaultError.message}`);
        }
      }

      // 4. Save rich menu metadata to database (with image_url)
      const { data: dbRichMenu, error: dbError } = await supabaseAdmin
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
          image_url: imageUrl, // Store Supabase Storage URL
          areas: parsedAreas,
          created_by: req.user!.id
        })
        .select()
        .single();

      if (dbError) {
        console.error("Error saving rich menu to database:", dbError);
        // Rollback: Delete from Storage and LINE
        try {
          await deleteRichMenuImage(imageUrl);
          await lineClient.deleteRichMenu(result.richMenuId);
        } catch (rollbackError) {
          console.error("⚠️ ALERT: Failed to cleanup after DB save failure:", result.richMenuId, rollbackError);
        }
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      return res.json({
        success: true,
        richMenuId: result.richMenuId,
        dbRichMenuId: dbRichMenu?.rich_menu_id,
        imageUrl: imageUrl,
        message: "Rich menu created successfully"
      });
    } catch (error: any) {
      // Error already handled in try-catch blocks above with proper rollback
      throw error;
    }
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

    // Delete from Supabase Storage if image exists
    if (richMenu?.image_url) {
      try {
        await deleteRichMenuImage(richMenu.image_url);
      } catch (error) {
        console.warn("Failed to delete image from Storage (non-critical):", error);
      }
    }

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
    const { tenantId, name, chatBarText, areas, selected, setAsDefault } = req.body;
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

    // Parse selected and setAsDefault
    const updatedSelected = selected !== undefined ? selected === "true" : richMenu.selected;
    const shouldSetAsDefault = setAsDefault === "true";

    // CRITICAL: Snapshot currently default menus BEFORE any DB mutations
    // This preserves the original LINE IDs for rollback
    const { data: previousDefaults } = shouldSetAsDefault ? await supabaseAdmin
      .from("rich_menus")
      .select("rich_menu_id, line_rich_menu_id, is_default")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
    : { data: null };

    const lineClient = new LineClient(credentials.channelAccessToken);
    
    // Create new rich menu in LINE with updated data (BEFORE deleting old one)
    const richMenuData = {
      size: {
        width: richMenu.image_width,
        height: richMenu.image_height
      },
      selected: updatedSelected,
      name: name,
      chatBarText: chatBarText,
      areas: parsedAreas
    };

    const result = await lineClient.createRichMenu(richMenuData);

    // Variables for tracking uploads (for rollback if needed)
    let newImageUrl: string | null = richMenu.image_url; // Default to existing URL
    let oldImageUrl: string | null = richMenu.image_url; // Keep track of old URL for cleanup
    let imageBuffer: Buffer;

    // Upload image (new or existing) with rollback on failure
    try {
      if (imageFile) {
        // Case 1: User uploaded a new image
        console.log("Uploading NEW image to Storage and LINE");
        imageBuffer = imageFile.buffer;
        const contentType = imageFile.mimetype || "image/png";

        // 1a. Upload to Supabase Storage first (get new URL)
        try {
          newImageUrl = await uploadRichMenuImage(tenantId, result.richMenuId, imageBuffer, contentType);
          console.log("New image uploaded to Storage:", newImageUrl);
        } catch (storageError: any) {
          console.error("Failed to upload new image to Storage:", storageError);
          // Rollback: Delete LINE menu
          try {
            await lineClient.deleteRichMenu(result.richMenuId);
          } catch (rollbackError) {
            console.error("⚠️ ALERT: Failed to cleanup LINE menu after storage upload failure:", result.richMenuId, rollbackError);
          }
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        // 1b. Upload to LINE
        try {
          await lineClient.uploadRichMenuImage(result.richMenuId, imageBuffer, contentType);
        } catch (lineUploadError: any) {
          console.error("Failed to upload new image to LINE:", lineUploadError);
          // Rollback: Delete NEW image from Storage and LINE menu (keep old image)
          try {
            await deleteRichMenuImage(newImageUrl);
            await lineClient.deleteRichMenu(result.richMenuId);
          } catch (rollbackError) {
            console.error("⚠️ ALERT: Failed to cleanup after LINE upload failure:", result.richMenuId, rollbackError);
          }
          throw new Error(`LINE image upload failed: ${lineUploadError.message}`);
        }
      } else {
        // Case 2: No new image - reuse existing from Supabase Storage
        console.log("Reusing existing image from Storage");
        newImageUrl = richMenu.image_url; // Keep existing URL

        try {
          // Try to download from Supabase Storage first (preferred)
          if (richMenu.image_url) {
            console.log("Fetching image from Supabase Storage:", richMenu.image_url);
            const response = await fetch(richMenu.image_url);
            if (!response.ok) {
              throw new Error(`Storage fetch failed: ${response.status}`);
            }
            imageBuffer = Buffer.from(await response.arrayBuffer());
          } else {
            throw new Error("No image_url in database");
          }
        } catch (storageError: any) {
          console.warn("Failed to fetch from Storage, trying LINE as fallback:", storageError.message);
          // Fallback: Try downloading from LINE
          try {
            imageBuffer = await lineClient.downloadRichMenuImage(richMenu.line_rich_menu_id);
          } catch (lineDownloadError: any) {
            console.error("Failed to download from both Storage and LINE:", lineDownloadError);
            // Rollback: Delete LINE menu
            try {
              await lineClient.deleteRichMenu(result.richMenuId);
            } catch (rollbackError) {
              console.error("⚠️ ALERT: Failed to cleanup LINE menu:", result.richMenuId, rollbackError);
            }
            throw new Error("Cannot find original image. Please upload a new image to update this menu.");
          }
        }

        // Upload to new LINE menu
        try {
          await lineClient.uploadRichMenuImage(result.richMenuId, imageBuffer, "image/png");
        } catch (lineUploadError: any) {
          console.error("Failed to upload existing image to new LINE menu:", lineUploadError);
          // Rollback: Delete LINE menu
          try {
            await lineClient.deleteRichMenu(result.richMenuId);
          } catch (rollbackError) {
            console.error("⚠️ ALERT: Failed to cleanup LINE menu:", result.richMenuId, rollbackError);
          }
          throw new Error(`LINE image upload failed: ${lineUploadError.message}`);
        }
      }
    } catch (imageError: any) {
      console.error("Image handling failed:", imageError);
      return res.status(500).json({ error: imageError.message || "Failed to upload image to rich menu" });
    }

    // Update database record FIRST (before deleting old menu or changing defaults)
    const { data: updatedMenu, error: updateError } = await supabaseAdmin
      .from("rich_menus")
      .update({
        line_rich_menu_id: result.richMenuId,
        name,
        chat_bar_text: chatBarText,
        selected: updatedSelected,
        is_default: shouldSetAsDefault,
        image_url: newImageUrl, // Save new image URL (or keep existing if no new upload)
        areas: parsedAreas,
      })
      .eq("rich_menu_id", richMenu.rich_menu_id)
      .eq("tenant_id", tenantId) // Double-check tenant for safety
      .select()
      .single();

    if (updateError) {
      console.error("Error updating rich menu in database:", updateError);
      // Rollback: Delete the newly created menu from LINE and cleanup NEW storage image (keep old)
      try {
        if (imageFile && newImageUrl && newImageUrl !== oldImageUrl) {
          await deleteRichMenuImage(newImageUrl); // Delete NEW image, keep old
        }
        await lineClient.deleteRichMenu(result.richMenuId);
        console.log("Rollback: Deleted newly created rich menu:", result.richMenuId);
      } catch (rollbackError) {
        console.error("Rollback failed - orphaned rich menu in LINE:", result.richMenuId, rollbackError);
      }
      return res.status(500).json({ error: "Failed to update database record" });
    }

    // Handle default menu setting (BEFORE deleting old image, so rollback can restore it)
    if (shouldSetAsDefault) {
      // Flags to track mutation progress (for deterministic rollback)
      // previousDefaults was already captured at the top of the function
      let lineDefaultSet = false;
      let dbDefaultsCleared = false;

      try {
        // 2. Set default in LINE
        await lineClient.setDefaultRichMenu(result.richMenuId);
        lineDefaultSet = true;

        // 3. Clear previous defaults in DB (unset old defaults)
        if (previousDefaults && previousDefaults.length > 0) {
          const prevDefaultIds = previousDefaults
            .filter(m => m.rich_menu_id !== richMenu.rich_menu_id)
            .map(m => m.rich_menu_id);

          if (prevDefaultIds.length > 0) {
            const { error: clearDefaultsError } = await supabaseAdmin
              .from("rich_menus")
              .update({ is_default: false })
              .eq("tenant_id", tenantId)
              .in("rich_menu_id", prevDefaultIds);
            
            if (clearDefaultsError) {
              throw new Error(`Failed to clear previous defaults: ${clearDefaultsError.message}`);
            }
          }
        }
        dbDefaultsCleared = true;
      } catch (defaultError: any) {
        console.error("Failed to set menu as default:", defaultError);
        
        // ROLLBACK MATRIX: Restore state based on mutation progress flags
        try {
          // Step 1: Restore LINE default state if we changed it
          if (lineDefaultSet) {
            // Cancel the new default in LINE
            try {
              await lineClient.cancelDefaultRichMenu();
              console.log("Rollback: Cancelled new default in LINE");
            } catch (cancelError) {
              console.warn("Failed to cancel LINE default during rollback:", cancelError);
            }
            
            // Restore previous LINE default (if there was one)
            if (previousDefaults && previousDefaults.length > 0) {
              const prevLineDefault = previousDefaults[0]; // There should only be one
              try {
                await lineClient.setDefaultRichMenu(prevLineDefault.line_rich_menu_id);
                console.log("Rollback: Restored previous LINE default:", prevLineDefault.line_rich_menu_id);
              } catch (lineRestoreError) {
                console.warn("Failed to restore previous LINE default:", lineRestoreError);
              }
            }
          }
          
          // Step 2: Restore DB default flags if we cleared them
          if (dbDefaultsCleared && previousDefaults && previousDefaults.length > 0) {
            // Restore all previously default menus (excluding the edited one if it was default)
            const menusToRestore = previousDefaults.filter(m => m.rich_menu_id !== richMenu.rich_menu_id);
            if (menusToRestore.length > 0) {
              await supabaseAdmin
                .from("rich_menus")
                .update({ is_default: true })
                .eq("tenant_id", tenantId)
                .in("rich_menu_id", menusToRestore.map(m => m.rich_menu_id));
              console.log("Rollback: Restored", menusToRestore.length, "previously default menu(s)");
            }
          }
          
          // Step 3: Revert edited menu's database record to original state
          await supabaseAdmin
            .from("rich_menus")
            .update({ 
              line_rich_menu_id: richMenu.line_rich_menu_id,
              name: richMenu.name,
              chat_bar_text: richMenu.chat_bar_text,
              selected: richMenu.selected,
              is_default: richMenu.is_default, // Restore original default status
              image_url: oldImageUrl, // Revert to old image URL
              areas: richMenu.areas
            })
            .eq("rich_menu_id", richMenu.rich_menu_id)
            .eq("tenant_id", tenantId);
          console.log("Rollback: Reverted edited menu to original state");
        } catch (dbRollbackError) {
          console.error("⚠️ ALERT: Rollback failed - manual intervention required:", dbRollbackError);
        }
        
        // Step 4: Delete NEW image from Storage and the newly created menu from LINE (restore old state)
        try {
          if (imageFile && newImageUrl && newImageUrl !== oldImageUrl) {
            await deleteRichMenuImage(newImageUrl); // Delete NEW image, old URL is back in DB
          }
          await lineClient.deleteRichMenu(result.richMenuId);
          console.log("Rollback: Deleted newly created rich menu due to default setting failure:", result.richMenuId);
        } catch (deleteError) {
          console.error("⚠️ ALERT: Failed to cleanup new menu after default setting failure:", result.richMenuId, deleteError);
        }
        
        return res.status(500).json({ error: "Failed to set menu as default" });
      }
    } else if (richMenu.is_default && !shouldSetAsDefault) {
      // User is unsetting default - unset in LINE as well
      try {
        await lineClient.cancelDefaultRichMenu();
      } catch (error) {
        console.warn("Failed to cancel default rich menu in LINE (non-critical):", error);
      }
    }

    // NOW delete old rich menu from LINE (after DB points to new one)
    try {
      await lineClient.deleteRichMenu(richMenu.line_rich_menu_id);
    } catch (error) {
      console.error("Failed to delete old rich menu, continuing:", error);
      // Non-critical: new menu is already created, DB updated, and default set
    }

    // FINALLY: Delete OLD image from Storage (after ALL operations succeed)
    // This is done LAST so rollback can restore oldImageUrl if anything fails
    if (imageFile && oldImageUrl && newImageUrl !== oldImageUrl) {
      try {
        await deleteRichMenuImage(oldImageUrl);
        console.log("Deleted old image from Storage:", oldImageUrl);
      } catch (deleteError) {
        console.warn("Failed to delete old image from Storage (non-critical):", deleteError);
      }
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

// Rich Menu Alias endpoints
router.get("/alias/list", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
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
    const result = await lineClient.getRichMenuAliasList();

    return res.json({ aliases: result.aliases || [] });
  } catch (error: any) {
    console.error("Error fetching rich menu aliases:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/alias", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, richMenuAliasId, richMenuId } = req.body;

    if (!tenantId || !richMenuAliasId || !richMenuId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate alias format (1-32 chars, alphanumeric, dash, underscore)
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(richMenuAliasId)) {
      return res.status(400).json({ 
        error: "Invalid alias format. Use 1-32 characters: letters, numbers, dash, underscore only" 
      });
    }

    const hasAccess = await checkTenantAccess(req.user!.id, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await getLineCredentials(tenantId);
    if (!credentials) {
      return res.status(404).json({ error: "LINE not configured" });
    }

    // Find rich menu in database to get LINE rich menu ID
    let lineRichMenuId = richMenuId;
    const { data: richMenu } = await supabaseAdmin
      .from("rich_menus")
      .select("line_rich_menu_id, rich_menu_id")
      .eq("tenant_id", tenantId)
      .eq("rich_menu_id", richMenuId)
      .maybeSingle();

    if (richMenu?.line_rich_menu_id) {
      lineRichMenuId = richMenu.line_rich_menu_id;
    }

    const lineClient = new LineClient(credentials.channelAccessToken);
    await lineClient.createRichMenuAlias(richMenuAliasId, lineRichMenuId);

    // Update database with alias
    if (richMenu) {
      await supabaseAdmin
        .from("rich_menus")
        .update({ alias_id: richMenuAliasId })
        .eq("rich_menu_id", richMenu.rich_menu_id)
        .eq("tenant_id", tenantId);
    }

    return res.json({ success: true, richMenuAliasId });
  } catch (error: any) {
    console.error("Error creating rich menu alias:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/alias/:aliasId", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    const { aliasId } = req.params;

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
    await lineClient.deleteRichMenuAlias(aliasId);

    // Update database to clear alias
    await supabaseAdmin
      .from("rich_menus")
      .update({ alias_id: null })
      .eq("alias_id", aliasId)
      .eq("tenant_id", tenantId);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting rich menu alias:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
