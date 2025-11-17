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
    .select("secret_key, secret_value")
    .eq("tenant_id", tenantId)
    .in("secret_key", ["line_channel_access_token", "line_channel_secret", "line_channel_id"]);

  if (error || !data || data.length === 0) {
    return null;
  }

  const secrets = Object.fromEntries(
    data.map((item) => [item.secret_key, decryptValue(item.secret_value)])
  );

  if (!secrets.line_channel_access_token || !secrets.line_channel_secret || !secrets.line_channel_id) {
    return null;
  }

  return {
    channelAccessToken: secrets.line_channel_access_token,
    channelSecret: secrets.line_channel_secret,
    channelId: secrets.line_channel_id,
  };
}

export async function saveLineCredentials(
  tenantId: string,
  channelAccessToken: string,
  channelSecret: string,
  channelId: string
): Promise<void> {
  const secrets = [
    {
      tenant_id: tenantId,
      secret_key: "line_channel_access_token",
      secret_value: encryptValue(channelAccessToken),
    },
    {
      tenant_id: tenantId,
      secret_key: "line_channel_secret",
      secret_value: encryptValue(channelSecret),
    },
    {
      tenant_id: tenantId,
      secret_key: "line_channel_id",
      secret_value: encryptValue(channelId),
    },
  ];

  for (const secret of secrets) {
    const { error } = await supabaseAdmin
      .from("tenant_secrets")
      .upsert(secret, { onConflict: "tenant_id,secret_key" });
    
    if (error) {
      console.error("Error saving LINE credential:", error);
      throw new Error(`Failed to save LINE credentials: ${error.message}`);
    }
  }
}

export async function getCredentialsByBotUserId(botUserId: string): Promise<{
  tenantId: string;
  channelAccessToken: string;
  channelSecret: string;
  channelId: string;
} | null> {
  const { data: channelIdSecrets } = await supabaseAdmin
    .from("tenant_secrets")
    .select("tenant_id, secret_value")
    .eq("secret_key", "line_channel_id");

  if (!channelIdSecrets || channelIdSecrets.length === 0) {
    return null;
  }

  for (const item of channelIdSecrets) {
    try {
      const decryptedChannelId = decryptValue(item.secret_value);
      if (decryptedChannelId === botUserId) {
        const credentials = await getLineCredentials(item.tenant_id);
        if (credentials) {
          return {
            tenantId: item.tenant_id,
            ...credentials,
          };
        }
      }
    } catch (error) {
      console.error(`Failed to decrypt channel ID for tenant ${item.tenant_id}:`, error);
    }
  }

  return null;
}
