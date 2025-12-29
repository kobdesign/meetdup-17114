/**
 * Trial Notification Service
 * 
 * Sends LINE notifications to chapter admins when trial is about to expire.
 * Notifications are sent at 7, 3, and 1 day(s) before trial ends.
 */

import { supabaseAdmin } from '../../utils/supabaseClient';
import { LineClient } from '../line/lineClient';
import { getLineCredentials } from '../line/credentials';
import { getAdminLineUserIds } from '../memberApprovalService';

interface ExpiringTrial {
  tenant_id: string;
  tenant_name: string;
  trial_end: string;
  days_remaining: number;
}

interface NotificationResult {
  tenantId: string;
  tenantName: string;
  daysRemaining: number;
  adminsNotified: number;
  errors: string[];
}

export async function getExpiringTrials(): Promise<ExpiringTrial[]> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: subscriptions, error } = await supabaseAdmin
    .from('tenant_subscriptions')
    .select(`
      tenant_id,
      trial_end,
      tenants!inner(name)
    `)
    .not('trial_end', 'is', null)
    .gte('trial_end', now.toISOString())
    .lte('trial_end', sevenDaysFromNow.toISOString())
    .eq('status', 'trialing');

  if (error) {
    console.error('[TrialNotification] Error fetching expiring trials:', error);
    return [];
  }

  return (subscriptions || []).map((sub: any) => {
    const trialEnd = new Date(sub.trial_end);
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return {
      tenant_id: sub.tenant_id,
      tenant_name: sub.tenants?.name || 'Unknown',
      trial_end: sub.trial_end,
      days_remaining: daysRemaining
    };
  }).filter((t: ExpiringTrial) => [1, 3, 7].includes(t.days_remaining));
}

function buildTrialExpirationMessage(tenantName: string, daysRemaining: number): any {
  const urgencyText = daysRemaining === 1 
    ? 'พรุ่งนี้จะหมดอายุ!' 
    : `อีก ${daysRemaining} วันจะหมดอายุ`;
  
  const urgencyColor = daysRemaining === 1 ? '#dc2626' : daysRemaining === 3 ? '#ea580c' : '#0284c7';

  return {
    type: 'flex',
    altText: `[Meetdup] ทดลองใช้งานจะหมดอายุ${daysRemaining === 1 ? 'พรุ่งนี้' : `ใน ${daysRemaining} วัน`}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: urgencyColor,
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: 'แจ้งเตือนการทดลองใช้',
            color: '#ffffff',
            weight: 'bold',
            size: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: tenantName,
            weight: 'bold',
            size: 'lg',
            wrap: true
          },
          {
            type: 'text',
            text: urgencyText,
            size: 'md',
            color: urgencyColor,
            weight: 'bold'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: 'เพื่อใช้งานต่อเนื่อง กรุณาอัปเกรดแพ็กเกจใน Billing Settings',
            size: 'sm',
            color: '#666666',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'อัปเกรดเลย',
              uri: 'https://meetdup.app/admin/billing'
            },
            style: 'primary',
            color: urgencyColor
          }
        ]
      }
    }
  };
}

export async function sendTrialExpirationNotifications(): Promise<NotificationResult[]> {
  console.log('[TrialNotification] Starting trial expiration check...');
  
  const expiringTrials = await getExpiringTrials();
  console.log(`[TrialNotification] Found ${expiringTrials.length} trials expiring soon`);

  const results: NotificationResult[] = [];

  for (const trial of expiringTrials) {
    const result: NotificationResult = {
      tenantId: trial.tenant_id,
      tenantName: trial.tenant_name,
      daysRemaining: trial.days_remaining,
      adminsNotified: 0,
      errors: []
    };

    try {
      const alreadySent = await checkNotificationSent(trial.tenant_id, trial.days_remaining);
      if (alreadySent) {
        console.log(`[TrialNotification] ${trial.tenant_name}: Already notified for ${trial.days_remaining} days`);
        continue;
      }

      const credentials = await getLineCredentials(trial.tenant_id);
      if (!credentials?.channelAccessToken) {
        result.errors.push('No LINE credentials');
        results.push(result);
        continue;
      }

      const adminLineIds = await getAdminLineUserIds(trial.tenant_id);
      if (adminLineIds.length === 0) {
        result.errors.push('No admin LINE IDs found');
        results.push(result);
        continue;
      }

      const lineClient = new LineClient(credentials.channelAccessToken);
      const message = buildTrialExpirationMessage(trial.tenant_name, trial.days_remaining);

      for (const adminId of adminLineIds) {
        try {
          await lineClient.pushMessage(adminId, message);
          result.adminsNotified++;
        } catch (err: any) {
          result.errors.push(`Failed to notify ${adminId}: ${err.message}`);
        }
      }

      await recordNotificationSent(trial.tenant_id, trial.days_remaining);
      console.log(`[TrialNotification] ${trial.tenant_name}: Notified ${result.adminsNotified} admins`);

    } catch (err: any) {
      result.errors.push(`Error: ${err.message}`);
    }

    results.push(result);
  }

  console.log('[TrialNotification] Completed trial expiration check');
  return results;
}

async function checkNotificationSent(tenantId: string, daysRemaining: number): Promise<boolean> {
  const notificationType = `trial_expiring_${daysRemaining}d`;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('notification_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('notification_type', notificationType)
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (error) {
    console.error('[TrialNotification] Error checking notification status:', error);
    return false;
  }

  return (data && data.length > 0);
}

async function recordNotificationSent(tenantId: string, daysRemaining: number): Promise<void> {
  const notificationType = `trial_expiring_${daysRemaining}d`;

  const { error } = await supabaseAdmin
    .from('notification_logs')
    .insert({
      tenant_id: tenantId,
      notification_type: notificationType,
      details: { days_remaining: daysRemaining }
    });

  if (error) {
    console.error('[TrialNotification] Error recording notification:', error);
  }
}

export async function checkAndDowngradeExpiredTrials(): Promise<{ tenantId: string; status: string }[]> {
  console.log('[TrialNotification] Checking for expired trials to downgrade...');
  
  const now = new Date();
  
  const { data: expiredTrials, error } = await supabaseAdmin
    .from('tenant_subscriptions')
    .select('tenant_id, tenants!inner(name)')
    .eq('status', 'trialing')
    .lt('trial_end', now.toISOString());

  if (error) {
    console.error('[TrialNotification] Error fetching expired trials:', error);
    return [];
  }

  const results: { tenantId: string; status: string }[] = [];

  for (const trial of expiredTrials || []) {
    try {
      const { error: updateError } = await supabaseAdmin
        .from('tenant_subscriptions')
        .update({
          status: 'canceled',
          plan_id: 'free',
          stripe_price_id: null,
          updated_at: now.toISOString()
        })
        .eq('tenant_id', trial.tenant_id);

      if (updateError) throw updateError;

      results.push({ tenantId: trial.tenant_id, status: 'downgraded_to_free' });
      console.log(`[TrialNotification] Downgraded ${(trial as any).tenants?.name || trial.tenant_id} to free plan`);

      await notifyTrialExpired(trial.tenant_id, (trial as any).tenants?.name || 'Your Chapter');

    } catch (err: any) {
      results.push({ tenantId: trial.tenant_id, status: `error: ${err.message}` });
    }
  }

  console.log(`[TrialNotification] Downgraded ${results.filter(r => r.status === 'downgraded_to_free').length} trials`);
  return results;
}

async function notifyTrialExpired(tenantId: string, tenantName: string): Promise<void> {
  try {
    const credentials = await getLineCredentials(tenantId);
    if (!credentials?.channelAccessToken) return;

    const adminLineIds = await getAdminLineUserIds(tenantId);
    if (adminLineIds.length === 0) return;

    const lineClient = new LineClient(credentials.channelAccessToken);
    const message = {
      type: 'flex' as const,
      altText: '[Meetdup] ช่วงทดลองใช้หมดอายุแล้ว',
      contents: {
        type: 'bubble',
        size: 'kilo',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#6b7280',
          paddingAll: 'md',
          contents: [
            {
              type: 'text',
              text: 'ช่วงทดลองใช้หมดอายุ',
              color: '#ffffff',
              weight: 'bold',
              size: 'sm'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: 'lg',
          contents: [
            {
              type: 'text',
              text: tenantName,
              weight: 'bold',
              size: 'lg',
              wrap: true
            },
            {
              type: 'text',
              text: 'บัญชีของคุณได้ถูกปรับเป็นแพ็กเกจ Free แล้ว',
              size: 'sm',
              color: '#666666',
              wrap: true
            },
            {
              type: 'text',
              text: 'คุณยังคงใช้งานได้ตามปกติ แต่มีข้อจำกัดบางอย่าง หากต้องการใช้งานเต็มรูปแบบ กรุณาอัปเกรดแพ็กเกจ',
              size: 'xs',
              color: '#999999',
              wrap: true
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: 'md',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: 'ดูแพ็กเกจทั้งหมด',
                uri: 'https://meetdup.app/admin/billing'
              },
              style: 'primary'
            }
          ]
        }
      }
    };

    for (const adminId of adminLineIds) {
      try {
        await lineClient.pushMessage(adminId, message);
      } catch (err) {
        console.error(`[TrialNotification] Failed to notify admin ${adminId} about expiration:`, err);
      }
    }
  } catch (err) {
    console.error('[TrialNotification] Error sending trial expired notification:', err);
  }
}
