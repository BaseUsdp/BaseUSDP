import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SendConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  token: string;
  recipientDisplay: string;
  threshold: number;
  onConfirm: (skipFurtherInSession: boolean) => void;
  countdownSeconds?: number;
}

const SendConfirmDialog = ({
  open,
  onOpenChange,
  amount,
  token,
  recipientDisplay,
  threshold,
  onConfirm,
  countdownSeconds = 3,
}: SendConfirmDialogProps) => {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [skipFurther, setSkipFurther] = useState(false);

  useEffect(() => {
    if (!open) {
      setRemaining(countdownSeconds);
      setSkipFurther(false);
      return;
    }
    setRemaining(countdownSeconds);
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [open, countdownSeconds]);

  const canConfirm = remaining === 0;
  const parsedAmount = parseFloat(amount);
  const formattedAmount = Number.isFinite(parsedAmount)
    ? parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ph:warning-circle-bold" className="w-5 h-5 text-amber-500" />
            Confirm large send
          </DialogTitle>
          <DialogDescription>
            This is above your safeguard threshold of ${threshold.toFixed(2)}. Double-check the recipient and amount before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2 my-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">${formattedAmount} {token}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-4">
            <span className="text-muted-foreground shrink-0">To</span>
            <span
              className="font-mono text-xs truncate text-right"
              title={recipientDisplay}
            >
              {recipientDisplay}
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={skipFurther}
            onChange={(e) => setSkipFurther(e.target.checked)}
            className="rounded border-border"
          />
          Don't ask again for this session
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => onConfirm(skipFurther)}
            className="bg-primary hover:bg-primary/90"
          >
            {canConfirm ? "Confirm send" : `Wait ${remaining}s…`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendConfirmDialog;
