import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UsePipelineRealtimeOptions {
  tenantId: string | null;
  enabled?: boolean;
}

export function usePipelineRealtime({ tenantId, enabled = true }: UsePipelineRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!tenantId || !enabled) {
      return;
    }

    const channelName = `pipeline-realtime-${tenantId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkins",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("[PipelineRealtime] Checkin change detected:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats", tenantId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_records",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("[PipelineRealtime] Pipeline record change detected:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/kanban", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats", tenantId] });
        }
      )
      .subscribe((status) => {
        console.log("[PipelineRealtime] Subscription status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("[PipelineRealtime] Cleaning up subscription");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tenantId, enabled]);

  return null;
}
