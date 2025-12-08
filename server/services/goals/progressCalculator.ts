import { supabaseAdmin } from "../../utils/supabaseClient";

export async function calculateGoalProgressValue(
  tenantId: string,
  metricType: string,
  startDate: string,
  endDate: string,
  meetingId: string | null = null
): Promise<number> {
  try {
    switch (metricType) {
      case "meeting_visitors": {
        if (!meetingId) {
          console.error("[GoalProgress] meeting_visitors requires meeting_id");
          return 0;
        }
        console.log(`[GoalProgress] Calculating meeting_visitors for meeting ${meetingId}`);
        
        const { data, error } = await supabaseAdmin
          .from("meeting_registrations")
          .select(`
            registration_id,
            registered_at,
            participant:participants!inner(participant_id, status)
          `)
          .eq("meeting_id", meetingId)
          .in("registration_status", ["registered", "attended"]);

        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        
        console.log(`[GoalProgress] Raw registrations found:`, data?.length || 0);
        
        const visitorCount = data?.filter((r: any) => 
          r.participant?.status === 'visitor' || r.participant?.status === 'prospect'
        ).length || 0;
        
        console.log(`[GoalProgress] Found ${visitorCount} visitors/prospects for meeting`);
        return visitorCount;
      }

      case "meeting_checkins": {
        if (!meetingId) {
          console.error("[GoalProgress] meeting_checkins requires meeting_id");
          return 0;
        }
        console.log(`[GoalProgress] Calculating meeting_checkins for meeting ${meetingId}`);
        
        const { count, error } = await supabaseAdmin
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .eq("meeting_id", meetingId)
          .eq("status", "approved");

        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        
        console.log(`[GoalProgress] Found ${count} checkins for meeting`);
        return count || 0;
      }

      case "weekly_visitors":
      case "monthly_visitors": {
        const endDateWithTime = endDate + "T23:59:59.999Z";
        console.log(`[GoalProgress] Calculating ${metricType} for tenant ${tenantId}`);
        console.log(`[GoalProgress] Date range: ${startDate} to ${endDateWithTime}`);
        
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("participant_id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .in("status", ["visitor", "prospect"])
          .gte("created_at", startDate)
          .lte("created_at", endDateWithTime);

        if (error) {
          console.error(`[GoalProgress] Error:`, error);
          throw error;
        }
        return count || 0;
      }

      case "total_members": {
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "member");

        if (error) throw error;
        return count || 0;
      }

      case "weekly_checkins":
      case "monthly_checkins": {
        const { data: meetings } = await supabaseAdmin
          .from("meetings")
          .select("meeting_id")
          .eq("tenant_id", tenantId);

        if (!meetings || meetings.length === 0) return 0;

        const meetingIds = meetings.map(m => m.meeting_id);

        const { count, error } = await supabaseAdmin
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .in("meeting_id", meetingIds)
          .gte("checkin_time", startDate)
          .lte("checkin_time", endDate + "T23:59:59.999Z");

        if (error) throw error;
        return count || 0;
      }

      case "weekly_referrals":
      case "monthly_referrals": {
        const { count, error } = await supabaseAdmin
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("referred_by_participant_id", "is", null)
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59.999Z");

        if (error) throw error;
        return count || 0;
      }

      default:
        return 0;
    }
  } catch (error) {
    console.error(`[GoalProgress] Error calculating ${metricType}:`, error);
    return 0;
  }
}
