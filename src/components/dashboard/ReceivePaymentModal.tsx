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
import { QRCodeSVG } from "qrcode.react";

interface ReceivePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ReceivePaymentModal = ({ open, onOpenChange }: ReceivePaymentModalProps) => {
  const { fullWalletAddress, walletAddress, isConnected } = useWallet();
  const [copied, setCopied] = useState(false);

  // Use real wallet address
  const fullAddress = fullWalletAddress || walletAddress || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My USDP Address",
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
          {!isConnected || !fullAddress ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Please connect your wallet to receive payments</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="w-48 h-48 bg-white rounded-2xl p-4 flex items-center justify-center">
                  <QRCodeSVG
                    value={fullAddress}
                    size={192}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                {/* Decorative ring */}
                <div className="absolute -inset-2 rounded-3xl border-2 border-primary/20" />
              </div>
            </motion.div>
          )}

          {/* Address Display */}
          {!isConnected || !fullAddress ? (
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground text-center">Connect your wallet to see your address</p>
            </div>
          ) : (
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground text-center mb-2">Your Address</p>
              <p className="font-mono text-sm text-center">
                {fullAddress.length > 20 
                  ? `${fullAddress.slice(0, 6)}...${fullAddress.slice(-6)}`
                  : fullAddress}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {isConnected && fullAddress && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="h-12"
                disabled={!fullAddress}
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
                disabled={!fullAddress}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              <strong className="text-foreground">Privacy Note:</strong> This is your main wallet address.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              For maximum privacy, use <strong className="text-foreground">x402 Request</strong> instead. 
              Direct transfers to this address will bypass the privacy system.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              If someone sends to this address via USDP "Send", funds will go to your intermediate wallet (private).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceivePaymentModal;
