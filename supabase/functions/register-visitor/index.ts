import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      tenant_id,
      meeting_id,
      full_name,
      email,
      phone,
      company,
      business_type,
      goal,
      notes,
    } = body;

    console.log("Registering visitor:", { tenant_id, full_name, email, meeting_id });

    // Validate required fields
    if (!tenant_id || !full_name || !email || !phone) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, full_name, email, phone" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert participant with service role (bypasses RLS)
    const { data: participant, error: insertError } = await adminClient
      .from("participants")
      .insert({
        tenant_id,
        full_name,
        email,
        phone,
        company,
        business_type,
        goal,
        notes,
        status: "prospect",
      })
      .select("participant_id")
      .single();

    if (insertError) {
      console.error("Error inserting participant:", insertError);
      throw insertError;
    }

    console.log("Participant created:", participant.participant_id);

    // If meeting_id is provided, create registration record
    if (meeting_id && participant?.participant_id) {
      const { error: regError } = await adminClient
        .from("meeting_registrations")
        .insert({
          meeting_id: meeting_id,
          participant_id: participant.participant_id,
          tenant_id: tenant_id,
          registration_status: "registered",
        });

      if (regError) {
        console.error("Failed to create registration record:", regError);
        // Don't throw error because participant is already created
      } else {
        console.log("Registration created for meeting:", meeting_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        participant_id: participant.participant_id,
        message: "ลงทะเบียนสำเร็จ! ขอบคุณที่สนใจเข้าร่วมงาน"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in register-visitor function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
