import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { authenticateWithBiometric } from "@/services/webauthn";

interface BiometricLockScreenProps {
  open: boolean;
  onUnlocked: () => void;
}

const BiometricLockScreen = ({ open, onUnlocked }: BiometricLockScreenProps) => {
  const { fullWalletAddress, disconnect } = useWallet();
  const { toast } = useToast();
  const [unlocking, setUnlocking] = useState(false);

  if (!open) return null;

  const truncated = fullWalletAddress
    ? `${fullWalletAddress.slice(0, 6)}…${fullWalletAddress.slice(-4)}`
    : "your wallet";

  const handleUnlock = async () => {
    if (!fullWalletAddress) return;
    setUnlocking(true);
    const result = await authenticateWithBiometric(fullWalletAddress);
    setUnlocking(false);
    if (result.success) {
      onUnlocked();
    } else {
      toast({
        title: "Couldn't unlock",
        description: result.error || "Try again or reconnect your wallet.",
        variant: "destructive",
      });
    }
  };

  const handleReconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.warn("[BiometricLockScreen] disconnect error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md mx-6 rounded-2xl border border-border bg-card p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <Icon icon="ph:fingerprint-bold" className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Dashboard locked</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unlock with biometrics or reconnect your wallet to continue.
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-2">{truncated}</p>
          </div>

          <Button
            className="w-full bg-emerald-500 hover:bg-emerald-500/90 text-white"
            onClick={handleUnlock}
            disabled={unlocking}
          >
            {unlocking ? (
              <>
                <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                Unlocking…
              </>
            ) : (
              <>
                <Icon icon="ph:fingerprint-bold" className="w-4 h-4 mr-2" />
                Unlock with biometrics
              </>
            )}
          </Button>

          <Button variant="outline" className="w-full" onClick={handleReconnect} disabled={unlocking}>
            <Icon icon="ph:plug-bold" className="w-4 h-4 mr-2" />
            Reconnect wallet
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default BiometricLockScreen;
