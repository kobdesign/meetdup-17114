import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, AlertCircle, ArrowRight, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface RequireLINELinkProps {
  participantName?: string;
  phone?: string;
  token: string;
  onLinked: () => void;
}

export function RequireLINELink({ participantName, phone, token, onLinked }: RequireLINELinkProps) {
  const [pollingStatus, setPollingStatus] = useState<"checking" | "linked">("checking");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isActive = true;

    const checkLINELink = async () => {
      if (!isActive) return;

      try {
        const response = await fetch(`/api/participants/check-line-link/${token}`);
        const data = await response.json();

        if (data.success && data.hasLinkedLine) {
          setPollingStatus("linked");
          if (intervalId) {
            clearInterval(intervalId);
          }
          // Wait a bit to show success message, then proceed
          setTimeout(() => {
            if (isActive) {
              onLinked();
            }
          }, 1500);
        } else {
          setPollCount((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Failed to check LINE link status:", error);
        // Keep polling even on error
      }
    };

    // Initial check
    checkLINELink();

    // Poll every 2 seconds INDEFINITELY until linked
    intervalId = setInterval(checkLINELink, 2000);

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [token, onLinked]);

  // Show success state
  if (pollingStatus === "linked") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 animate-in zoom-in duration-300" />
            <h3 className="text-xl font-semibold mb-2">เชื่อมโยง LINE สำเร็จ!</h3>
            <p className="text-sm text-muted-foreground">กำลังดำเนินการต่อ...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
            {pollingStatus === "checking" ? (
              <Loader2 className="h-8 w-8 text-green-600 dark:text-green-400 animate-spin" />
            ) : (
              <MessageCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            )}
          </div>
          <CardTitle className="text-2xl">จำเป็นต้องเชื่อมโยง LINE</CardTitle>
          <CardDescription>
            {pollingStatus === "checking"
              ? "กำลังตรวจสอบการเชื่อมโยง LINE..."
              : "กรุณาเชื่อมโยงบัญชี LINE ของคุณก่อนเปิดใช้งานบัญชี"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <strong>กำลังรอการเชื่อมโยง...</strong>
              <p className="mt-1 text-sm">
                ระบบกำลังตรวจสอบ... ({pollCount} ครั้ง)
                <br />
                หลังจากเชื่อมโยง LINE แล้ว หน้านี้จะดำเนินการต่อโดยอัตโนมัติ
              </p>
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ทำไมต้องเชื่อมโยง LINE?</strong>
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                <li>รับการแจ้งเตือนการลงทะเบียนสำเร็จ</li>
                <li>รับข้อมูลข่าวสารจาก Chapter</li>
                <li>ใช้ฟีเจอร์ LINE เพื่อค้นหานามบัตร</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                1
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">เปิด LINE Official Account</p>
                <p className="text-sm text-muted-foreground">
                  สแกน QR Code หรือค้นหา Chapter ของคุณใน LINE
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                2
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">ส่งข้อความ "ลงทะเบียน"</p>
                <p className="text-sm text-muted-foreground">
                  พิมพ์และส่งคำว่า <strong>"ลงทะเบียน"</strong> ใน LINE chat
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                3
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">กรอกเบอร์โทรศัพท์</p>
                <p className="text-sm text-muted-foreground">
                  {phone ? (
                    <>ใช้เบอร์: <strong className="font-mono">{phone}</strong></>
                  ) : (
                    'กรอกเบอร์โทรศัพท์ของคุณตามที่ระบบแนะนำ'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                4
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">กลับมาหน้านี้</p>
                <p className="text-sm text-muted-foreground">
                  หลังจากเชื่อมโยงแล้ว ส่งข้อความ <strong>"ขอลิงก์ลงทะเบียน"</strong> เพื่อรับลิงก์ใหม่
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              <Smartphone className="inline-block h-4 w-4 mr-1" />
              ต้องการความช่วยเหลือ? ติดต่อผู้ดูแล Chapter
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
