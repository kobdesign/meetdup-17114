import crypto from "crypto";

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  message?: {
    type: string;
    id?: string;
    text?: string;
    [key: string]: any;
  };
  postback?: {
    data: string;
    params?: any;
  };
  [key: string]: any;
}

export interface LineWebhookPayload {
  destination: string;
  events: LineWebhookEvent[];
}

export function validateLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

export async function processWebhookEvents(
  events: LineWebhookEvent[],
  tenantId: string
): Promise<void> {
  console.log(`[LINE Webhook] Processing ${events.length} events for tenant ${tenantId}`);
  
  for (const event of events) {
    console.log(`[LINE Webhook] Event type: ${event.type}`, {
      source: event.source,
      hasMessage: !!event.message,
      hasPostback: !!event.postback,
    });

    // TODO: Implement actual event processing
    // - Store events in database
    // - Process message events
    // - Handle postback events
    // - Trigger appropriate actions
  }
}
