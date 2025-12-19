import { supabaseAdmin } from "../../utils/supabaseClient";
import { LineClient } from "../line/lineClient";
import { createEventNotificationFlex } from "../line/templates/eventNotificationTemplate";
import { getLineCredentials } from "../line/credentials";

interface SendResult {
  sent: number;
  failed: number;
}

export async function sendEventNotifications(
  meetingId: string,
  tenantId: string,
  notificationType: '7_days' | '1_day' | '2_hours' | 'manual',
  logPrefix: string
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0 };

  try {
    // Get meeting details
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, meeting_time, theme, venue, tenant_id")
      .eq("meeting_id", meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error(`${logPrefix} Meeting not found:`, meetingId);
      return result;
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id, tenant_name")
      .eq("tenant_id", tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error(`${logPrefix} Tenant not found:`, tenantId);
      return result;
    }

    // Get LINE credentials from encrypted tenant_secrets
    const lineCredentials = await getLineCredentials(tenantId);
    if (!lineCredentials) {
      console.error(`${logPrefix} LINE credentials not found for tenant:`, tenantId);
      return result;
    }

    // Get all members with LINE accounts
    const { data: members, error: membersError } = await supabaseAdmin
      .from("participants")
      .select("participant_id, full_name_th, line_user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "member")
      .not("line_user_id", "is", null);

    if (membersError || !members) {
      console.error(`${logPrefix} Failed to fetch members:`, membersError);
      return result;
    }

    console.log(`${logPrefix} Found ${members.length} members to notify`);

    // Get current RSVP counts
    const { data: rsvps } = await supabaseAdmin
      .from("meeting_rsvp")
      .select("rsvp_status")
      .eq("meeting_id", meetingId);

    const confirmedCount = rsvps?.filter(r => r.rsvp_status === "confirmed").length || 0;

    const lineClient = new LineClient(lineCredentials.channelAccessToken);

    // Send to each member
    for (const member of members) {
      try {
        const flexMessage = createEventNotificationFlex({
          meetingId: meeting.meeting_id,
          meetingDate: meeting.meeting_date,
          meetingTime: meeting.meeting_time || "",
          theme: meeting.theme || "ประชุมประจำสัปดาห์",
          venue: meeting.venue || "",
          chapterName: tenant.tenant_name,
          memberName: member.full_name_th,
          notificationType,
          confirmedCount,
          totalMembers: members.length
        });

        await lineClient.pushMessage(member.line_user_id!, flexMessage);

        // Update RSVP record to track notification
        await supabaseAdmin
          .from("meeting_rsvp")
          .upsert({
            tenant_id: tenantId,
            meeting_id: meetingId,
            participant_id: member.participant_id,
            rsvp_status: "pending",
            last_notified_at: new Date().toISOString(),
            notification_count: 1
          }, { 
            onConflict: "meeting_id,participant_id",
            ignoreDuplicates: false 
          });

        result.sent++;
        console.log(`${logPrefix} Sent notification to: ${member.full_name_th}`);

      } catch (sendError) {
        console.error(`${logPrefix} Failed to send to ${member.full_name_th}:`, sendError);
        result.failed++;
      }
    }

    // Log the notification
    await supabaseAdmin
      .from("event_notification_log")
      .upsert({
        tenant_id: tenantId,
        meeting_id: meetingId,
        notification_type: notificationType,
        target_type: "individual",
        total_sent: result.sent,
        total_failed: result.failed,
        sent_at: new Date().toISOString()
      }, { onConflict: "meeting_id,notification_type,target_type" });

    console.log(`${logPrefix} Notification complete: ${result.sent} sent, ${result.failed} failed`);

  } catch (error) {
    console.error(`${logPrefix} Notification service error:`, error);
  }

  return result;
}

export async function checkAndSendScheduledNotifications(logPrefix: string): Promise<void> {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Get all tenants with notification settings
    const { data: settings } = await supabaseAdmin
      .from("event_notification_settings")
      .select("*, tenant:tenants(tenant_id, name)");

    if (!settings || settings.length === 0) {
      console.log(`${logPrefix} No notification settings configured`);
      return;
    }

    for (const setting of settings) {
      const tenantId = setting.tenant_id;
      
      // Get upcoming meetings for this tenant
      const { data: meetings } = await supabaseAdmin
        .from("meetings")
        .select("meeting_id, meeting_date")
        .eq("tenant_id", tenantId)
        .gte("meeting_date", today)
        .order("meeting_date", { ascending: true });

      if (!meetings || meetings.length === 0) continue;

      for (const meeting of meetings) {
        const meetingDate = new Date(meeting.meeting_date);
        const daysUntil = Math.ceil((meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntil = Math.ceil((meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60));

        let notificationType: '7_days' | '1_day' | '2_hours' | null = null;

        if (daysUntil === 7 && setting.notify_7_days_before) {
          notificationType = '7_days';
        } else if (daysUntil === 1 && setting.notify_1_day_before) {
          notificationType = '1_day';
        } else if (hoursUntil <= 2 && hoursUntil > 0 && setting.notify_2_hours_before) {
          notificationType = '2_hours';
        }

        if (notificationType) {
          // Check if already sent
          const { data: existingLog } = await supabaseAdmin
            .from("event_notification_log")
            .select("log_id")
            .eq("meeting_id", meeting.meeting_id)
            .eq("notification_type", notificationType)
            .maybeSingle();

          if (!existingLog) {
            console.log(`${logPrefix} Sending ${notificationType} notification for meeting: ${meeting.meeting_id}`);
            await sendEventNotifications(meeting.meeting_id, tenantId, notificationType, logPrefix);
          }
        }
      }
    }

  } catch (error) {
    console.error(`${logPrefix} Scheduled notification error:`, error);
  }
}
