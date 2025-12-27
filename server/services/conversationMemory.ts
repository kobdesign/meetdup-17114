import { supabaseAdmin } from "../utils/supabaseClient";
import OpenAI from "openai";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 10;
const CONVERSATION_TIMEOUT_MINUTES = 30;

export async function getConversationHistory(
  tenantId: string,
  lineUserId: string
): Promise<ConversationMessage[]> {
  try {
    await cleanupExpiredConversations();

    const { data, error } = await supabaseAdmin
      .from("ai_conversations")
      .select("role, content, created_at")
      .eq("tenant_id", tenantId)
      .eq("line_user_id", lineUserId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);

    if (error) {
      console.error("[ConversationMemory] Error fetching history:", error);
      return [];
    }

    return (data || []).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    }));
  } catch (error) {
    console.error("[ConversationMemory] Error:", error);
    return [];
  }
}

export async function saveConversationMessage(
  tenantId: string,
  lineUserId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CONVERSATION_TIMEOUT_MINUTES);

    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .insert({
        tenant_id: tenantId,
        line_user_id: lineUserId,
        role,
        content,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      console.error("[ConversationMemory] Error saving message:", error);
    }

    await trimConversationHistory(tenantId, lineUserId);
  } catch (error) {
    console.error("[ConversationMemory] Error:", error);
  }
}

async function trimConversationHistory(
  tenantId: string,
  lineUserId: string
): Promise<void> {
  try {
    const { data: allMessages } = await supabaseAdmin
      .from("ai_conversations")
      .select("id, created_at")
      .eq("tenant_id", tenantId)
      .eq("line_user_id", lineUserId)
      .order("created_at", { ascending: false });

    if (allMessages && allMessages.length > MAX_HISTORY_MESSAGES) {
      const idsToDelete = allMessages
        .slice(MAX_HISTORY_MESSAGES)
        .map(m => m.id);

      await supabaseAdmin
        .from("ai_conversations")
        .delete()
        .in("id", idsToDelete);
    }
  } catch (error) {
    console.error("[ConversationMemory] Error trimming history:", error);
  }
}

async function cleanupExpiredConversations(): Promise<void> {
  try {
    await supabaseAdmin
      .from("ai_conversations")
      .delete()
      .lt("expires_at", new Date().toISOString());
  } catch (error) {
    console.error("[ConversationMemory] Error cleaning up:", error);
  }
}

export async function refreshConversationExpiry(
  tenantId: string,
  lineUserId: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CONVERSATION_TIMEOUT_MINUTES);

    await supabaseAdmin
      .from("ai_conversations")
      .update({ expires_at: expiresAt.toISOString() })
      .eq("tenant_id", tenantId)
      .eq("line_user_id", lineUserId);
  } catch (error) {
    console.error("[ConversationMemory] Error refreshing expiry:", error);
  }
}

export async function clearConversation(
  tenantId: string,
  lineUserId: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from("ai_conversations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("line_user_id", lineUserId);
  } catch (error) {
    console.error("[ConversationMemory] Error clearing:", error);
  }
}

export function buildMessagesWithHistory(
  systemPrompt: string,
  history: ConversationMessage[],
  currentMessage: string
): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt }
  ];

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  }

  messages.push({ role: "user", content: currentMessage });

  return messages;
}
