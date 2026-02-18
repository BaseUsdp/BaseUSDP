import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const NetworkWarningBanner = () => {
  const { networkStatus, switchNetwork, isConnected } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isConnected || networkStatus !== "wrong_network") {
    return null;
  }

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      await switchNetwork();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-destructive/10 border-b border-destructive/30 px-4 py-3"
    >
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Wrong Network Detected</p>
            <p className="text-xs text-muted-foreground">
              Please switch to Base (Chain ID: 8453) to use USDP
            </p>
          </div>
        </div>
        <Button
          onClick={handleSwitch}
          disabled={isSwitching}
          size="sm"
          className="bg-destructive hover:bg-destructive/90 text-white"
        >
          {isSwitching ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Switching...
            </>
          ) : (
            "Switch Network"
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default NetworkWarningBanner;
