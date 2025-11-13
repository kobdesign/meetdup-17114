import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const LINE_API_BASE = "https://api.line.me/v2/bot/richmenu";
const LINE_API_DATA_BASE = "https://api-data.line.me/v2/bot/richmenu";

interface RichMenuArea {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  action: {
    type: string;
    [key: string]: any;
  };
}

async function verifyTenantAccess(
  supabase: any,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { data: tenantRoles, error: tenantError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("role", ["chapter_admin", "super_admin"])
    .limit(1);

  if (!tenantError && tenantRoles && tenantRoles.length > 0) {
    return true;
  }

  const { data: globalSuperAdmin, error: superAdminError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1);

  return !superAdminError && globalSuperAdmin && globalSuperAdmin.length > 0;
}

async function getTenantCredentials(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_secrets")
    .select("line_access_token")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data || !data.line_access_token) {
    throw new Error("LINE credentials not configured for this tenant");
  }

  return data.line_access_token;
}

async function createRichMenuInLine(
  accessToken: string,
  name: string,
  chatBarText: string,
  imageHeight: number,
  areas: RichMenuArea[],
  selected: boolean
): Promise<string> {
  const richMenuData = {
    size: {
      width: 2500,
      height: imageHeight,
    },
    selected,
    name,
    chatBarText,
    areas,
  };

  const response = await fetch(LINE_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(richMenuData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create rich menu in LINE: ${error}`);
  }

  const result = await response.json();
  return result.richMenuId;
}

async function uploadRichMenuImage(
  accessToken: string,
  richMenuId: string,
  imageData: Uint8Array
): Promise<void> {
  const response = await fetch(`${LINE_API_DATA_BASE}/${richMenuId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: imageData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload rich menu image: ${error}`);
  }
}

async function deleteRichMenuFromLine(
  accessToken: string,
  richMenuId: string
): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/${richMenuId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete rich menu from LINE: ${error}`);
  }
}

async function setDefaultRichMenu(
  accessToken: string,
  richMenuId: string
): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/alias/default`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ richMenuId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set default rich menu: ${error}`);
  }
}

async function linkRichMenuToUser(
  accessToken: string,
  userId: string,
  richMenuId: string
): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/${richMenuId}/bulk/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userIds: [userId] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to link rich menu to user: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace("Bearer ", "");
  
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // GET - List rich menus for tenant
    if (req.method === "GET") {
      const tenantId = url.searchParams.get("tenantId");

      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: "tenantId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasAccess = await verifyTenantAccess(supabaseClient, user.id, tenantId);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Forbidden: No access to this tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: richMenus, error } = await supabaseClient
        .from("rich_menus")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ richMenus: richMenus || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Create new rich menu
    if (req.method === "POST" && !pathname.includes("/link") && !pathname.includes("/set-default")) {
      const formData = await req.formData();
      const tenantId = formData.get("tenantId") as string;
      const name = formData.get("name") as string;
      const chatBarText = formData.get("chatBarText") as string;
      const imageHeight = parseInt(formData.get("imageHeight") as string);
      const areasJson = formData.get("areas") as string;
      const selected = formData.get("selected") === "true";
      const setAsDefault = formData.get("setAsDefault") === "true";
      const imageFile = formData.get("image") as File;

      if (!tenantId || !name || !chatBarText || !imageHeight || !areasJson || !imageFile) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasAccess = await verifyTenantAccess(supabaseClient, user.id, tenantId);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Forbidden: No access to this tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const areas = JSON.parse(areasJson);
      const accessToken = await getTenantCredentials(supabaseClient, tenantId);

      // Create rich menu in LINE
      const lineRichMenuId = await createRichMenuInLine(
        accessToken,
        name,
        chatBarText,
        imageHeight,
        areas,
        selected
      );

      // Upload image
      const imageBuffer = await imageFile.arrayBuffer();
      const imageData = new Uint8Array(imageBuffer);
      await uploadRichMenuImage(accessToken, lineRichMenuId, imageData);

      // Save to database
      const { data: savedRichMenu, error: saveError } = await supabaseClient
        .from("rich_menus")
        .insert({
          tenant_id: tenantId,
          line_rich_menu_id: lineRichMenuId,
          name,
          chat_bar_text: chatBarText,
          selected,
          is_default: setAsDefault,
          image_width: 2500,
          image_height: imageHeight,
          areas,
          created_by: user.id,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Set as default if requested
      if (setAsDefault) {
        await setDefaultRichMenu(accessToken, lineRichMenuId);
      }

      return new Response(
        JSON.stringify({ success: true, richMenu: savedRichMenu }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Delete rich menu
    if (req.method === "DELETE") {
      const richMenuId = url.searchParams.get("richMenuId");

      if (!richMenuId) {
        return new Response(
          JSON.stringify({ error: "richMenuId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get rich menu to verify tenant access
      const { data: richMenu, error: fetchError } = await supabaseClient
        .from("rich_menus")
        .select("tenant_id, line_rich_menu_id")
        .eq("rich_menu_id", richMenuId)
        .single();

      if (fetchError) throw fetchError;
      if (!richMenu) {
        return new Response(
          JSON.stringify({ error: "Rich menu not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasAccess = await verifyTenantAccess(supabaseClient, user.id, richMenu.tenant_id);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Forbidden: No access to this tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = await getTenantCredentials(supabaseClient, richMenu.tenant_id);

      // Delete from LINE API
      if (richMenu.line_rich_menu_id) {
        await deleteRichMenuFromLine(accessToken, richMenu.line_rich_menu_id);
      }

      // Delete from database
      const { error: deleteError } = await supabaseClient
        .from("rich_menus")
        .delete()
        .eq("rich_menu_id", richMenuId);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: "Rich menu deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /set-default - Set rich menu as default
    if (req.method === "POST" && pathname.includes("/set-default")) {
      const { richMenuId, tenantId } = await req.json();

      if (!richMenuId || !tenantId) {
        return new Response(
          JSON.stringify({ error: "Missing richMenuId or tenantId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasAccess = await verifyTenantAccess(supabaseClient, user.id, tenantId);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Forbidden: No access to this tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: richMenu, error: fetchError } = await supabaseClient
        .from("rich_menus")
        .select("line_rich_menu_id")
        .eq("rich_menu_id", richMenuId)
        .eq("tenant_id", tenantId)
        .single();

      if (fetchError) throw fetchError;
      if (!richMenu) {
        return new Response(
          JSON.stringify({ error: "Rich menu not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = await getTenantCredentials(supabaseClient, tenantId);

      // Unset current default
      await supabaseClient
        .from("rich_menus")
        .update({ is_default: false })
        .eq("tenant_id", tenantId)
        .eq("is_default", true);

      // Set new default in DB
      await supabaseClient
        .from("rich_menus")
        .update({ is_default: true })
        .eq("rich_menu_id", richMenuId);

      // Set default in LINE
      await setDefaultRichMenu(accessToken, richMenu.line_rich_menu_id);

      return new Response(
        JSON.stringify({ success: true, message: "Default rich menu updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in line-rich-menu function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
