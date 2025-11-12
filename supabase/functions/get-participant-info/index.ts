import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const participant_id = url.searchParams.get("participant_id");

    console.log("get-participant-info called for:", participant_id);

    if (!participant_id) {
      return new Response(
        JSON.stringify({ error: "participant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get participant with tenant info
    const { data: participant, error: pError } = await admin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        email,
        phone,
        status,
        payment_status,
        tenant_id,
        tenants:tenant_id (
          name,
          slug
        )
      `)
      .eq("participant_id", participant_id)
      .single();

    if (pError || !participant) {
      console.error("Participant not found:", pError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant settings for payment info
    const { data: settings, error: sError } = await admin
      .from("tenant_settings")
      .select("default_visitor_fee, currency")
      .eq("tenant_id", participant.tenant_id)
      .single();

    if (sError) {
      console.error("Settings error:", sError);
    }

    // Get tenant secrets for payment QR
    const { data: secrets, error: secretsError } = await admin
      .from("tenant_secrets")
      .select("payment_qr_payload")
      .eq("tenant_id", participant.tenant_id)
      .single();

    if (secretsError) {
      console.error("Secrets error:", secretsError);
    }

    console.log("Successfully retrieved participant info");

    return new Response(
      JSON.stringify({ 
        participant,
        settings: {
          ...settings,
          payment_qr_payload: secrets?.payment_qr_payload
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("get-participant-info error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
