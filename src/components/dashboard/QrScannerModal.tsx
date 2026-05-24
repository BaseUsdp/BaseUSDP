import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  startQrScanner,
  isBarcodeDetectorSupported,
  isCameraSupported,
  parseQrText,
  type QrPayload,
} from "@/lib/qr-scan";

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (payload: QrPayload, raw: string) => void;
}

const QrScannerModal = ({ open, onOpenChange, onResult }: QrScannerModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(isBarcodeDetectorSupported() && isCameraSupported());

  useEffect(() => {
    if (!open) {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      setError(null);
      return;
    }
    if (!supported) {
      setError(
        isBarcodeDetectorSupported()
          ? "No camera available on this device."
          : "This browser doesn't support QR scanning. Try Chrome or Safari 17+."
      );
      return;
    }

    let cancelled = false;
    (async () => {
      // Wait one tick so the <video> ref is attached after the dialog mounts.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled || !videoRef.current) return;
      const stop = await startQrScanner({
        videoEl: videoRef.current,
        onResult: (text) => {
          const parsed = parseQrText(text);
          onResult(parsed, text);
          onOpenChange(false);
        },
        onError: (err) => setError(err.message || "Scanner failed"),
      });
      stopRef.current = stop;
    })();

    return () => {
      cancelled = true;
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card">
        <DialogTitle className="sr-only">Scan a payment QR code</DialogTitle>
        <div className="relative">
          {supported && !error ? (
            <>
              <video
                ref={videoRef}
                className="w-full aspect-square object-cover bg-black"
                playsInline
                muted
              />
              {/* Scan target overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-3/5 aspect-square relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
                </div>
              </div>
              <AnimatePresence>
                {!error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white text-xs px-3 py-1.5 backdrop-blur-md flex items-center gap-2"
                  >
                    <Icon icon="ph:scan-bold" className="w-3.5 h-3.5 animate-pulse" />
                    Point at a payment QR
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center text-center gap-3">
              <Icon icon="ph:warning-bold" className="w-8 h-8 text-amber-400" />
              <p className="text-sm">{error || "QR scanning unavailable."}</p>
              <p className="text-xs text-muted-foreground">
                You can still paste the payment URL directly into the recipient field.
              </p>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Works with BASEUSDP <code>/pay</code> URLs, <code>ethereum:</code> URIs, or plain 0x addresses.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerModal;
