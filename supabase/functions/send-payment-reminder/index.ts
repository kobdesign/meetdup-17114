import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentReminderRequest {
  tenant_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id }: PaymentReminderRequest = await req.json();

    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }

    console.log("Fetching LINE credentials for tenant:", tenant_id);

    // Get LINE credentials from tenant_secrets
    const { data: secrets, error: secretsError } = await supabase
      .from('tenant_secrets')
      .select('line_access_token, line_channel_id')
      .eq('tenant_id', tenant_id)
      .single();

    if (secretsError || !secrets?.line_access_token) {
      throw new Error("LINE credentials not configured for this tenant");
    }

    console.log("Fetching pending payment visitors");

    // Get visitors with pending payments
    const { data: visitors, error: visitorsError } = await supabase
      .from('participants')
      .select('participant_id, full_name, line_user_id, email, phone')
      .eq('tenant_id', tenant_id)
      .eq('status', 'visitor_pending_payment');

    if (visitorsError) {
      throw new Error("Failed to fetch visitors: " + visitorsError.message);
    }

    if (!visitors || visitors.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No visitors with pending payments found",
          sent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${visitors.length} visitors with pending payments`);

    let sentCount = 0;
    const errors: string[] = [];

    // Send LINE notification to each visitor
    for (const visitor of visitors) {
      if (!visitor.line_user_id) {
        console.log(`Skipping ${visitor.full_name} - no LINE user ID`);
        continue;
      }

      try {
        const message = {
          to: visitor.line_user_id,
          messages: [
            {
              type: 'text',
              text: `สวัสดีคุณ ${visitor.full_name}\n\nเรายังไม่ได้รับการชำระค่าเข้าร่วมงานจากคุณ กรุณาชำระเงินและอัปโหลดสลิปเพื่อยืนยันการเข้าร่วม\n\nขอบคุณค่ะ`
            }
          ]
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secrets.line_access_token}`
          },
          body: JSON.stringify(message)
        });

        if (response.ok) {
          sentCount++;
          console.log(`Sent reminder to ${visitor.full_name}`);
        } else {
          const errorText = await response.text();
          errors.push(`Failed to send to ${visitor.full_name}: ${errorText}`);
          console.error(`Failed to send to ${visitor.full_name}:`, errorText);
        }
      } catch (error: any) {
        errors.push(`Error sending to ${visitor.full_name}: ${error.message}`);
        console.error(`Error sending to ${visitor.full_name}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} reminders`,
        sent: sentCount,
        total: visitors.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-payment-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
