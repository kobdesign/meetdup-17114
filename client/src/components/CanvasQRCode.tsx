import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

interface CanvasQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function CanvasQRCode({ value, size = 100, className = "" }: CanvasQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      });
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={size}
      height={size}
    />
  );
}
