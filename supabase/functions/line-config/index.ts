// @ts-ignore Deno imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // @ts-ignore Deno runtime
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore Deno runtime
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
    
    // POST /validate-token - Validate LINE Access Token
    if (req.method === "POST" && url.pathname.endsWith('/validate-token')) {
      const { accessToken } = await req.json();

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Missing accessToken" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const lineResponse = await fetch("https://api.line.me/v2/bot/info", {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });

        if (!lineResponse.ok) {
          const errorText = await lineResponse.text();
          console.error("LINE API validation failed:", errorText);
          return new Response(
            JSON.stringify({ 
              valid: false, 
              error: "Invalid LINE Channel Access Token" 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const botInfo = await lineResponse.json();
        return new Response(
          JSON.stringify({ 
            valid: true, 
            botUserId: botInfo.userId,
            displayName: botInfo.displayName,
            pictureUrl: botInfo.pictureUrl
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Error validating LINE token:", error);
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: "Failed to validate token with LINE API" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST / - Save LINE Configuration
    if (req.method === "POST") {
      const { tenantId, channelAccessToken, channelSecret, channelId } = await req.json();

      if (!tenantId || !channelAccessToken || !channelSecret || !channelId) {
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

      const { error } = await supabaseClient
        .from("tenant_secrets")
        .upsert({
          tenant_id: tenantId,
          line_access_token: channelAccessToken,
          line_channel_secret: channelSecret,
          line_channel_id: channelId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id",
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "LINE configuration saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
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

      const { data, error } = await supabaseClient
        .from("tenant_secrets")
        .select("line_access_token, line_channel_secret, line_channel_id")
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data || !data.line_access_token || !data.line_channel_secret) {
        return new Response(
          JSON.stringify({
            configured: false,
            channelAccessToken: "",
            channelSecret: "",
            channelId: "",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const maskSecret = (secret: string) => {
        if (!secret || secret.length < 8) return "••••••••";
        return secret.substring(0, 4) + "••••" + secret.substring(secret.length - 4);
      };

      return new Response(
        JSON.stringify({
          configured: true,
          channelAccessToken: maskSecret(data.line_access_token),
          channelSecret: maskSecret(data.line_channel_secret),
          channelId: data.line_channel_id || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in line-config function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
