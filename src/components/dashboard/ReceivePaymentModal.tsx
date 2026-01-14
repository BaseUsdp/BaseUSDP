import { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Copy, CheckCircle, Share2, Download } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReceivePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ReceivePaymentModal = ({ open, onOpenChange }: ReceivePaymentModalProps) => {
  const { walletAddress, walletType } = useWallet();
  const [copied, setCopied] = useState(false);

  // Get full mock address based on wallet type
  const fullAddress = walletType === "phantom" 
    ? "PhntmDemo1234567890abcdefghijklmnopqrstuvwxyz"
    : walletType === "solflare"
    ? "SlfDemo1234567890abcdefghijklmnopqrstuvwxyz"
    : walletAddress || "Demo1234567890abcdefghijklmnopqrstuvwxyz";

  const handleCopy = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Void402 Address",
          text: `Send encrypted payments to: ${fullAddress}`,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-primary" />
            </div>
            Receive Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <div className="relative">
              {/* Mock QR Code - In production, use a real QR library */}
              <div className="w-48 h-48 bg-white rounded-2xl p-4 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-br from-foreground to-foreground/80 rounded-lg relative overflow-hidden">
                  {/* QR Pattern Simulation */}
                  <div className="absolute inset-2 grid grid-cols-8 gap-0.5">
                    {Array(64).fill(0).map((_, i) => (
                      <div
                        key={i}
                        className={`w-full aspect-square ${Math.random() > 0.5 ? 'bg-white' : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                  {/* Corner markers */}
                  <div className="absolute top-2 left-2 w-6 h-6 border-4 border-white rounded-sm" />
                  <div className="absolute top-2 right-2 w-6 h-6 border-4 border-white rounded-sm" />
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-4 border-white rounded-sm" />
                  {/* Center logo */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-xs">V402</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative ring */}
              <div className="absolute -inset-2 rounded-3xl border-2 border-primary/20" />
            </div>
          </motion.div>

          {/* Address Display */}
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Your Address</p>
            <p className="font-mono text-sm text-center break-all">
              {fullAddress}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="h-12"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
              className="h-12"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Info */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-sm text-muted-foreground text-center">
              Share this QR code or address to receive encrypted payments on Base Sepolia
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceivePaymentModal;
