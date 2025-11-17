import { supabaseAdmin } from "../../utils/supabaseClient";
import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.LINE_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

if (!process.env.LINE_ENCRYPTION_KEY) {
  console.warn("⚠️ LINE_ENCRYPTION_KEY not set - using random key (credentials will not persist across restarts)");
}

interface EncryptedData {
  iv: string;
  authTag: string;
  encrypted: string;
}

export function encryptValue(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex").slice(0, 32),
    iv
  );

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const result: EncryptedData = {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted,
  };

  return JSON.stringify(result);
}

export function decryptValue(encryptedValue: string): string {
  const data: EncryptedData = JSON.parse(encryptedValue);
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex").slice(0, 32),
    Buffer.from(data.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(data.authTag, "hex"));

  let decrypted = decipher.update(data.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export async function getLineCredentials(tenantId: string): Promise<{
  channelAccessToken: string;
  channelSecret: string;
  channelId: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("tenant_secrets")
    .select("line_channel_id, line_access_token_encrypted, line_channel_secret_encrypted")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data || !data.line_access_token_encrypted || !data.line_channel_secret_encrypted || !data.line_channel_id) {
    return null;
  }

  try {
    return {
      channelAccessToken: decryptValue(data.line_access_token_encrypted),
      channelSecret: decryptValue(data.line_channel_secret_encrypted),
      channelId: data.line_channel_id,
    };
  } catch (decryptError) {
    console.error("Failed to decrypt LINE credentials:", decryptError);
    return null;
  }
}

export async function saveLineCredentials(
  tenantId: string,
  channelAccessToken: string,
  channelSecret: string,
  channelId: string
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    line_channel_id: channelId,
    line_access_token_encrypted: encryptValue(channelAccessToken),
    line_channel_secret_encrypted: encryptValue(channelSecret),
  };

  const { error } = await supabaseAdmin
    .from("tenant_secrets")
    .upsert(payload, { 
      onConflict: "tenant_id",
      ignoreDuplicates: false 
    });

  if (error) {
    console.error("Error saving LINE credentials:", error);
    throw new Error(`Failed to save LINE credentials: ${error.message}`);
  }
}

export async function getCredentialsByBotUserId(botUserId: string): Promise<{
  tenantId: string;
  channelAccessToken: string;
  channelSecret: string;
  channelId: string;
} | null> {
  const { data: secrets } = await supabaseAdmin
    .from("tenant_secrets")
    .select("tenant_id, line_channel_id, line_access_token_encrypted, line_channel_secret_encrypted")
    .eq("line_channel_id", botUserId);

  if (!secrets || secrets.length === 0) {
    return null;
  }

  const secret = secrets[0];
  
  try {
    return {
      tenantId: secret.tenant_id,
      channelAccessToken: decryptValue(secret.line_access_token_encrypted),
      channelSecret: decryptValue(secret.line_channel_secret_encrypted),
      channelId: secret.line_channel_id,
    };
  } catch (error) {
    console.error(`Failed to decrypt credentials for bot ${botUserId}:`, error);
    return null;
  }
}
