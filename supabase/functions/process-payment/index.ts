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

    const body = await req.json();
    const { participant_id, amount, currency, slip_base64, slip_filename } = body;

    console.log("process-payment called for participant:", participant_id);

    if (!participant_id) {
      return new Response(
        JSON.stringify({ error: "participant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate participant exists
    const { data: participant, error: pError } = await admin
      .from("participants")
      .select("participant_id, tenant_id, status, full_name")
      .eq("participant_id", participant_id)
      .single();

    if (pError || !participant) {
      console.error("Participant not found:", pError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: allow payments regardless of participant status


    // 2. Create payment record
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        tenant_id: participant.tenant_id,
        participant_id: participant.participant_id,
        amount: amount || 650,
        currency: currency || "THB",
        method: "transfer",
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw paymentError;
    }

    console.log("Payment record created:", payment.payment_id);

    // 3. Upload slip to storage if provided
    if (slip_base64) {
      try {
        const buffer = Uint8Array.from(atob(slip_base64), c => c.charCodeAt(0));
        const fileExt = slip_filename?.split(".").pop() || "jpg";
        const fileName = `${payment.payment_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await admin.storage
          .from("payment-slips")
          .upload(fileName, buffer, {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = admin.storage
          .from("payment-slips")
          .getPublicUrl(fileName);

        // Update payment with slip URL
        await admin
          .from("payments")
          .update({ slip_url: publicUrl })
          .eq("payment_id", payment.payment_id);

        console.log("Payment slip uploaded successfully");
      } catch (uploadErr) {
        console.error("Error uploading slip:", uploadErr);
        // Continue even if upload fails
      }
    }

    // Participant status is no longer updated here; payments tracked in payments table only


    return new Response(
      JSON.stringify({ 
        success: true, 
        payment_id: payment.payment_id,
        message: "Payment recorded successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
