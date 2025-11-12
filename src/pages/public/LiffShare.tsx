import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Share2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LiffShare() {
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant');
  const participantId = searchParams.get('pid');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [participantData, setParticipantData] = useState<any>(null);

  useEffect(() => {
    initializeLiff();
  }, []);

  async function initializeLiff() {
    try {
      if (!tenantSlug || !participantId) {
        setError('Missing tenant or participant ID');
        setLoading(false);
        return;
      }

      // Fetch participant data
      const { data, error: fetchError } = await supabase.functions.invoke('get-participant-card', {
        body: {
          tenant_slug: tenantSlug,
          participant_id: participantId,
          user_id: 'liff-user'
        }
      });

      if (fetchError) throw fetchError;
      if (!data) throw new Error('No data returned');

      setParticipantData(data);

      // Initialize LIFF
      const liffId = data.public_secrets?.liff_id_share;
      if (!liffId) {
        setError('LIFF ID not configured for this tenant');
        setLoading(false);
        return;
      }

      await liff.init({ liffId });

      if (!liff.isInClient()) {
        setError('Please open this page in LINE app');
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err) {
      console.error('LIFF initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setLoading(false);
    }
  }

  function buildFlexMessage(): any {
    if (!participantData) return null;

    const { participant, tenant, visitor_info, public_secrets } = participantData;
    const isVisitor = participant.status === 'visitor' || participant.status === 'prospect';
    
    const avatarUrl = `https://cdn.lovableproject.com/avatars/${participant.participant_id}.jpg`;
    const host = window.location.origin;

    // Build body contents
    const bodyContents: any[] = [
      {
        type: 'text',
        text: participant.full_name,
        weight: 'bold',
        size: 'xl',
        margin: 'md'
      }
    ];

    if (participant.nickname) {
      bodyContents.push({
        type: 'text',
        text: `(${participant.nickname})`,
        size: 'sm',
        color: '#999999',
        margin: 'sm'
      });
    }

    if (participant.company) {
      bodyContents.push({
        type: 'text',
        text: participant.company,
        size: 'md',
        color: '#555555',
        margin: 'md'
      });
    }

    if (participant.business_type) {
      bodyContents.push({
        type: 'text',
        text: `🏢 ${participant.business_type}`,
        size: 'sm',
        color: '#999999',
        margin: 'sm'
      });
    }

    // Add visitor section
    if (isVisitor && visitor_info) {
      bodyContents.push({
        type: 'separator',
        margin: 'xl'
      });

      if (participant.goal) {
        bodyContents.push({
          type: 'box',
          layout: 'baseline',
          margin: 'md',
          contents: [
            { type: 'text', text: 'เป้าหมาย:', size: 'sm', color: '#999999', flex: 0 },
            { type: 'text', text: participant.goal, size: 'sm', color: '#555555', wrap: true, flex: 1, margin: 'sm' }
          ]
        });
      }

      bodyContents.push({
        type: 'box',
        layout: 'baseline',
        margin: 'sm',
        contents: [
          { type: 'text', text: 'ผู้แนะนำ:', size: 'sm', color: '#999999', flex: 0 },
          { type: 'text', text: visitor_info.inviter_name, size: 'sm', color: '#555555', flex: 1, margin: 'sm' }
        ]
      });

      bodyContents.push({
        type: 'box',
        layout: 'baseline',
        margin: 'sm',
        contents: [
          { type: 'text', text: 'สถานะ:', size: 'sm', color: '#999999', flex: 0 },
          { 
            type: 'text', 
            text: visitor_info.payment_status, 
            size: 'sm', 
            color: visitor_info.payment_status.includes('✅') ? '#06c755' : '#ff334b',
            flex: 1,
            margin: 'sm'
          }
        ]
      });
    }

    // Build footer
    const footerContents: any[] = [];

    if (participant.phone) {
      footerContents.push({
        type: 'button',
        style: 'primary',
        color: '#06c755',
        action: { type: 'uri', label: '📞 โทร', uri: `tel:${participant.phone}` }
      });
    }

    if (public_secrets?.line_channel_id) {
      const oaId = public_secrets.line_channel_id.replace('@', '');
      const nickname = participant.nickname || participant.full_name;
      footerContents.push({
        type: 'button',
        style: 'primary',
        action: {
          type: 'uri',
          label: '💬 ส่งข้อความ',
          uri: `line://oaMessage/${oaId}/?text=Hi%20${encodeURIComponent(nickname)}%21`
        }
      });
    }

    const shareUrl = public_secrets?.liff_id_share
      ? `line://app/${public_secrets.liff_id_share}?pid=${participant.participant_id}`
      : `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(`${host}/profile/${tenant.slug}/${participant.participant_id}`)}`;
    
    footerContents.push({
      type: 'button',
      style: 'link',
      action: { type: 'uri', label: '🔗 แชร์นามบัตร', uri: shareUrl }
    });

    footerContents.push({
      type: 'button',
      style: 'link',
      action: {
        type: 'uri',
        label: '✅ Check-in',
        uri: `${host}/checkin?tenant=${tenant.slug}&pid=${participant.participant_id}`
      }
    });

    return {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: avatarUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: { type: 'uri', uri: avatarUrl }
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: footerContents
      }
    };
  }

  async function handleShare() {
    try {
      setLoading(true);
      const flexMessage = buildFlexMessage();

      if (!flexMessage) {
        throw new Error('Failed to build flex message');
      }

      const result = await liff.shareTargetPicker([
        {
          type: 'flex',
          altText: `นามบัตร: ${participantData.participant.full_name}`,
          contents: flexMessage as any
        }
      ]);

      if (result) {
        setShared(true);
      }
    } catch (err) {
      console.error('Share error:', err);
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (liff.isInClient()) {
      liff.closeWindow();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>เกิดข้อผิดพลาด</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleClose} className="w-full">
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (shared) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <CardTitle>แชร์สำเร็จ!</CardTitle>
            </div>
            <CardDescription>นามบัตรถูกแชร์เรียบร้อยแล้ว</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleClose} className="w-full">
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>แชร์นามบัตร</CardTitle>
          <CardDescription>
            {participantData?.participant.full_name}
            {participantData?.participant.nickname && ` (${participantData.participant.nickname})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {participantData?.participant.company && (
            <div>
              <p className="text-sm text-muted-foreground">บริษัท</p>
              <p className="font-medium">{participantData.participant.company}</p>
            </div>
          )}
          {participantData?.participant.business_type && (
            <div>
              <p className="text-sm text-muted-foreground">ประเภทธุรกิจ</p>
              <p className="font-medium">{participantData.participant.business_type}</p>
            </div>
          )}
          <Button onClick={handleShare} className="w-full" size="lg">
            <Share2 className="mr-2 h-4 w-4" />
            แชร์นามบัตร
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
