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

    // Auto-create payment record for visitor
    let visitorFee = 0;

    if (meeting_id) {
      // Get visitor_fee from meeting
      const { data: meetingData } = await adminClient
        .from("meetings")
        .select("visitor_fee")
        .eq("meeting_id", meeting_id)
        .single();
      
      visitorFee = meetingData?.visitor_fee || 0;
    } else {
      // Get default_visitor_fee from tenant_settings
      const { data: settingsData } = await adminClient
        .from("tenant_settings")
        .select("default_visitor_fee")
        .eq("tenant_id", tenant_id)
        .single();
      
      visitorFee = settingsData?.default_visitor_fee || 650;
    }

    // Create payment record with status = 'pending' if fee > 0
    if (visitorFee > 0) {
      const { error: paymentError } = await adminClient
        .from("payments")
        .insert({
          tenant_id: tenant_id,
          participant_id: participant.participant_id,
          meeting_id: meeting_id || null,
          amount: visitorFee,
          currency: "THB",
          method: "transfer",
          status: "pending",
          notes: "Auto-generated payment record upon registration"
        });

      if (paymentError) {
        console.error("Failed to create payment record:", paymentError);
        // Don't throw error because participant is already created
      } else {
        console.log("Payment record created with amount:", visitorFee);
      }
    }

    return new Response(
      JSON.stringify({ participant_id: participant.participant_id }),
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
