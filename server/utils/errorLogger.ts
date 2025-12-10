import { supabaseAdmin } from "./supabaseClient";

interface ErrorLogEntry {
  category: string;
  tenantId?: string;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, any>;
}

/**
 * Log errors to Supabase for production debugging
 * Falls back to console logging if table doesn't exist
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  const { category, tenantId, errorMessage, errorStack, context } = entry;
  
  // Always console log
  console.error(`[ErrorLog] ${category}:`, errorMessage);
  if (context) {
    console.error(`[ErrorLog] Context:`, JSON.stringify(context));
  }
  if (errorStack) {
    console.error(`[ErrorLog] Stack:`, errorStack);
  }

  // Try to log to database
  try {
    const { error } = await supabaseAdmin
      .from("error_logs")
      .insert({
        category,
        tenant_id: tenantId || null,
        error_message: errorMessage,
        error_stack: errorStack || null,
        context: context || null
      });
    
    if (error) {
      // Table might not exist yet - silently ignore
      if (error.code !== "42P01") {
        console.error("[ErrorLog] Failed to save to database:", error.message);
      }
    }
  } catch (e) {
    // Ignore database logging failures
  }
}

/**
 * Log LINE webhook errors with context
 */
export async function logLineWebhookError(
  tenantId: string,
  event: any,
  error: Error | any,
  context?: Record<string, any>
): Promise<void> {
  await logError({
    category: "LINE_WEBHOOK",
    tenantId,
    errorMessage: error?.message || String(error),
    errorStack: error?.stack,
    context: {
      eventType: event?.type,
      userId: event?.source?.userId,
      messageType: event?.message?.type,
      messageText: event?.message?.text?.substring(0, 100),
      ...context
    }
  });
}

/**
 * Log LINE API reply errors
 */
export async function logLineReplyError(
  tenantId: string,
  replyToken: string,
  messageType: string,
  error: Error | any
): Promise<void> {
  await logError({
    category: "LINE_REPLY",
    tenantId,
    errorMessage: error?.message || String(error),
    errorStack: error?.stack,
    context: {
      replyToken: replyToken?.substring(0, 20) + "...",
      messageType
    }
  });
}
