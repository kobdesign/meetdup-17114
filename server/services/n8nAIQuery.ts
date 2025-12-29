/**
 * n8n AI Query Service
 * 
 * Forwards AI queries from LINE webhook to n8n Text-to-SQL workflow
 * for processing, then returns the response to be sent back to LINE.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../utils/supabaseClient';

interface N8nAIQueryRequest {
  tenant_id: string;
  line_user_id: string;
  user_role: 'admin' | 'member' | 'visitor';
  user_name: string;
  message: string;
  session_id: string;
}

interface N8nAIQueryResponse {
  success: boolean;
  response: string;
  error?: string;
  metadata?: {
    sql_query?: string;
    execution_time_ms?: number;
  };
}

// Session storage for conversation continuity (in-memory, resets on restart)
const sessionMap = new Map<string, string>();

/**
 * Get or create a session ID for a LINE user
 * Sessions are used for conversation memory in n8n
 */
function getSessionId(tenantId: string, lineUserId: string): string {
  const key = `${tenantId}:${lineUserId}`;
  
  if (!sessionMap.has(key)) {
    sessionMap.set(key, crypto.randomUUID());
  }
  
  return sessionMap.get(key)!;
}

/**
 * Check if n8n AI Query is enabled
 */
export function isN8nAIEnabled(): boolean {
  return !!process.env.N8N_AI_QUERY_WEBHOOK_URL;
}

/**
 * Log AI usage for tracking/billing purposes
 */
async function logAIUsage(tenantId: string, lineUserId: string, message: string): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabaseAdmin
      .from('ai_conversations')
      .insert({
        tenant_id: tenantId,
        line_user_id: lineUserId,
        role: 'user',
        content: message.substring(0, 500),
        expires_at: expiresAt.toISOString()
      });
  } catch (error) {
    console.error('[n8nAIQuery] Error logging AI usage:', error);
  }
}

/**
 * Forward an AI query to n8n for Text-to-SQL processing
 * 
 * @param tenantId - The chapter/tenant UUID
 * @param lineUserId - LINE user ID of the person asking
 * @param userRole - User's role (admin/member/visitor)
 * @param userName - Display name of the user
 * @param message - The question being asked
 * @returns The AI response text to send back to LINE
 */
export async function forwardToN8nAI(
  tenantId: string,
  lineUserId: string,
  userRole: 'admin' | 'member' | 'visitor',
  userName: string,
  message: string
): Promise<string> {
  const webhookUrl = process.env.N8N_AI_QUERY_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('[n8nAIQuery] N8N_AI_QUERY_WEBHOOK_URL not configured');
    return 'ขออภัย ระบบ AI ยังไม่พร้อมใช้งาน';
  }

  const sessionId = getSessionId(tenantId, lineUserId);
  
  await logAIUsage(tenantId, lineUserId, message);
  
  const requestBody: N8nAIQueryRequest = {
    tenant_id: tenantId,
    line_user_id: lineUserId,
    user_role: userRole,
    user_name: userName,
    message: message,
    session_id: sessionId
  };

  console.log(`[n8nAIQuery] Forwarding query to n8n:`, {
    tenant_id: tenantId,
    user_role: userRole,
    message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
  });

  const startTime = Date.now();

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[n8nAIQuery] n8n returned error status: ${response.status}`);
      return 'ขออภัย ไม่สามารถเชื่อมต่อระบบ AI ได้ กรุณาลองใหม่';
    }

    const result = await response.json() as N8nAIQueryResponse;

    console.log(`[n8nAIQuery] Response received in ${elapsedMs}ms, success: ${result.success}`);

    if (result.success && result.response) {
      return result.response;
    } else {
      console.error(`[n8nAIQuery] n8n returned error:`, result.error);
      return result.response || 'ขออภัย ไม่สามารถประมวลผลคำถามได้ กรุณาลองใหม่';
    }

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[n8nAIQuery] Error after ${elapsedMs}ms:`, error);
    return 'ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่';
  }
}

/**
 * Clear session for a user (e.g., when they say "ลืมทุกอย่าง" or "เริ่มใหม่")
 */
export function clearSession(tenantId: string, lineUserId: string): void {
  const key = `${tenantId}:${lineUserId}`;
  sessionMap.delete(key);
}
