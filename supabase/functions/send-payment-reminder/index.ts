import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminderRequest {
  tenant_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id }: PaymentReminderRequest = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Fetch LINE credentials for this tenant
    const { data: secrets, error: secretsError } = await supabase
      .from("tenant_secrets")
      .select("line_access_token, line_channel_id")
      .eq("tenant_id", tenant_id)
      .single();

    if (secretsError || !secrets?.line_access_token) {
      return new Response(
        JSON.stringify({ error: "LINE credentials not configured for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Get participants with PENDING payments (not from participant status)
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        participant_id,
        status,
        participants:participant_id (
          participant_id,
          full_name,
          line_user_id,
          email,
          phone
        )
      `)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending");

    if (paymentsError) {
      throw new Error("Failed to fetch pending payments: " + paymentsError.message);
    }

    const visitors = (pendingPayments || [])
      .map((p: any) => p.participants)
      .filter((v: any) => !!v);

    if (!visitors || visitors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No visitors with pending payments found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const visitor of visitors) {
      if (!visitor.line_user_id) {
        // Skip if no LINE id
        continue;
      }

      try {
        const message = {
          to: visitor.line_user_id,
          messages: [
            {
              type: "text",
              text: `สวัสดีคุณ ${visitor.full_name}\n\nเรายังไม่ได้รับการชำระค่าเข้าร่วมงานจากคุณ กรุณาชำระเงินและอัปโหลดสลิปเพื่อยืนยันการเข้าร่วม\n\nขอบคุณค่ะ`,
            },
          ],
        };

        const response = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.line_access_token}`,
          },
          body: JSON.stringify(message),
        });

        if (response.ok) {
          sentCount++;
        } else {
          const errorText = await response.text();
          errors.push(`Failed to send to ${visitor.full_name}: ${errorText}`);
        }
      } catch (err: any) {
        errors.push(`Error sending to ${visitor.full_name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} reminders`,
        sent: sentCount,
        total: visitors.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-payment-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
