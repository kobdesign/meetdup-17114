import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  name: string;
  meetingId?: string;
}

export default function QRCodeDialog({ open, onOpenChange, slug, name, meetingId }: QRCodeDialogProps) {
  const profileUrl = meetingId
    ? `${window.location.origin}/chapter/${slug}?meeting=${meetingId}`
    : `${window.location.origin}/chapter/${slug}`;

  const downloadQRCode = () => {
    const svg = document.getElementById(`qr-code-${slug}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${slug}-qr-code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      toast.success("ดาวน์โหลด QR Code สำเร็จ");
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>QR Code - {name}</DialogTitle>
          <DialogDescription>
            {meetingId 
              ? "QR code สำหรับลงทะเบียนเข้าร่วมการประชุมนี้โดยตรง"
              : "QR code สำหรับหน้า public profile ของ chapter"
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg border">
            <QRCode
              id={`qr-code-${slug}`}
              value={profileUrl}
              size={256}
              level="H"
            />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-mono text-muted-foreground break-all">
              {profileUrl}
            </p>
            <Button onClick={downloadQRCode} className="mt-2">
              <Download className="mr-2 h-4 w-4" />
              ดาวน์โหลด QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
