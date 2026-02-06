import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, AlertCircle, ChevronRight } from "lucide-react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PrivacyLevelSelectorProps {
  compact?: boolean;
  onChange?: (level: PrivacyLevel) => void;
  onNavigateToSettings?: () => void;
}

const PrivacyLevelSelector = ({ compact = false, onChange, onNavigateToSettings }: PrivacyLevelSelectorProps) => {
  const { privacyLevel, setPrivacyLevel } = useWallet();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<PrivacyLevel | null>(null);

  const levels: { id: PrivacyLevel; label: string; description: string; icon: typeof Eye }[] = [
    {
      id: "public",
      label: "Public",
      description: "Fully visible transactions - amounts and parties are public",
      icon: Eye,
    },
    {
      id: "partial",
      label: "Partial",
      description: "Amount hidden, parties visible - balanced privacy",
      icon: EyeOff,
    },
    {
      id: "full",
      label: "Full",
      description: "Amount + parties hidden - maximum privacy with ZK proofs",
      icon: Lock,
    },
  ];

  const handleSelectLevel = (level: PrivacyLevel) => {
    if (level === privacyLevel) return;
    setPendingLevel(level);
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (pendingLevel) {
      setPrivacyLevel(pendingLevel);
      onChange?.(pendingLevel);
    }
    setShowConfirmation(false);
    setPendingLevel(null);
  };

  const currentLevel = levels.find(l => l.id === privacyLevel);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              privacyLevel === "public" ? "bg-yellow-500/20 text-yellow-500" :
              privacyLevel === "partial" ? "bg-blue-500/20 text-blue-500" :
              "bg-green-500/20 text-green-500"
            )}>
              {currentLevel && <currentLevel.icon className="w-4 h-4" />}
            </div>
            <span className="text-xs font-medium uppercase tracking-wider">
              {currentLevel?.label}
            </span>
          </div>
          {onNavigateToSettings && (
            <button 
              onClick={onNavigateToSettings}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Go to Settings"
            >
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-neutral-500 leading-tight">
          {currentLevel?.description}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider block">
          Privacy Level
        </label>
        <div className="grid grid-cols-3 gap-2">
          {levels.map((level) => (
            <button
              key={level.id}
              onClick={() => handleSelectLevel(level.id)}
              className={cn(
                "p-3 rounded-xl border text-center transition-all",
                privacyLevel === level.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center",
                privacyLevel === level.id ? "bg-primary/20" : "bg-secondary"
              )}>
                <level.icon className={cn(
                  "w-4 h-4",
                  privacyLevel === level.id ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <p className={cn(
                "text-sm font-medium",
                privacyLevel === level.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {level.label}
              </p>
            </button>
          ))}
        </div>
        {currentLevel && (
          <p className="text-xs text-muted-foreground mt-2">
            {currentLevel.description}
          </p>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Change Privacy Level
            </DialogTitle>
            <DialogDescription>
              {pendingLevel && (
                <>
                  You are about to change your privacy level to{" "}
                  <span className="font-semibold text-foreground">
                    {levels.find(l => l.id === pendingLevel)?.label}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
              <h4 className="font-medium mb-2">What this means:</h4>
              <p className="text-sm text-muted-foreground">
                {pendingLevel && levels.find(l => l.id === pendingLevel)?.description}
              </p>
            </div>
            
            <div className="mt-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4">
              <p className="text-sm text-yellow-500">
                This change will require an on-chain transaction and will apply to all future transactions.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="bg-primary hover:bg-primary/90">
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PrivacyLevelSelector;
