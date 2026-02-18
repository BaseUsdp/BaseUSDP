import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AtSign, Send, Loader2, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useXMTP } from "@/contexts/XMTPContext";
import { getApiUrl } from "@/utils/apiConfig";

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSent?: () => void;
  defaultRecipient?: string;
}

const SendMessageModal = ({ open, onOpenChange, onMessageSent, defaultRecipient }: SendMessageModalProps) => {
  const { sendMessage, canMessage } = useXMTP();
  const [recipient, setRecipient] = useState(defaultRecipient || "");
  const [message, setMessage] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [recipientValid, setRecipientValid] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const apiUrl = getApiUrl();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setRecipient(defaultRecipient || "");
    } else {
      setRecipient("");
      setMessage("");
      setRecipientError(null);
      setRecipientWarning(null);
      setRecipientValid(false);
      setResolvedAddress(null);
      setSendError(null);
      setSendSuccess(false);
    }
  }, [open, defaultRecipient]);

  // Debounced username validation + XMTP canMessage check
  useEffect(() => {
    if (recipient.length === 0) {
      setRecipientError(null);
      setRecipientWarning(null);
      setRecipientValid(false);
      setResolvedAddress(null);
      setIsValidating(false);
      return;
    }
    if (recipient.length < 3) {
      setRecipientError("Username must be at least 3 characters");
      setRecipientWarning(null);
      setRecipientValid(false);
      setResolvedAddress(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const timeoutId = setTimeout(async () => {
      try {
        // Step 1: Check if username exists (also returns wallet_address)
        const response = await fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(recipient)}`);
        const data = await response.json();
        if (!data.exists) {
          setRecipientError("Username not found");
          setRecipientWarning(null);
          setRecipientValid(false);
          setResolvedAddress(null);
          setIsValidating(false);
          return;
        }

        // Use wallet_address from check-username response directly
        const addr = data.wallet_address;
        if (!addr) {
          setRecipientError("Could not resolve wallet address");
          setRecipientWarning(null);
          setRecipientValid(false);
          setResolvedAddress(null);
          setIsValidating(false);
          return;
        }

        // XMTP requires an EVM (0x) address — reject Solana addresses
        if (!addr.startsWith("0x")) {
          setRecipientError("This user registered with a Solana wallet. Encrypted messaging requires an EVM wallet.");
          setRecipientWarning(null);
          setRecipientValid(false);
          setResolvedAddress(null);
          setIsValidating(false);
          return;
        }

        // Username valid + address resolved — mark as valid
        setRecipientError(null);
        setRecipientValid(true);
        setResolvedAddress(addr);

        // Soft check: warn if recipient hasn't enabled XMTP yet
        try {
          const canMsg = await canMessage(addr);
          if (!canMsg) {
            setRecipientWarning("User hasn't enabled encrypted messaging yet. Message will be delivered when they do.");
          } else {
            setRecipientWarning(null);
          }
        } catch {
          setRecipientWarning(null);
        }
      } catch {
        setRecipientError("Could not verify username");
        setRecipientWarning(null);
        setRecipientValid(false);
        setResolvedAddress(null);
      }
      setIsValidating(false);
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      setIsValidating(false);
    };
  }, [recipient, apiUrl, canMessage]);

  const canSend = recipientValid && resolvedAddress && message.trim().length > 0 && message.trim().length <= 1000 && !isSending;

  const handleSend = async () => {
    if (!canSend || !resolvedAddress) return;

    setIsSending(true);
    setSendError(null);

    try {
      await sendMessage(resolvedAddress, message.trim());
      setSendSuccess(true);
      onMessageSent?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } catch (err: any) {
      setSendError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Send Message</DialogTitle>
          <DialogDescription className="text-white/50">
            Send an encrypted message to another USDP user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient Field */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Send to</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <AtSign className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value.replace(/@/g, ""));
                  setRecipientError(null);
                  setRecipientWarning(null);
                  setRecipientValid(false);
                  setResolvedAddress(null);
                  setSendError(null);
                }}
                placeholder="username"
                disabled={isSending || sendSuccess}
                className={`w-full pl-10 pr-10 py-3 rounded-xl bg-white/10 border text-sm transition-all ${
                  recipientError
                    ? "border-red-500/50 focus:border-red-400"
                    : isValidating
                    ? "border-yellow-500/50 focus:border-yellow-400"
                    : recipientValid
                    ? "border-green-500/50 focus:border-green-400"
                    : "border-white/20 focus:border-white/40"
                } text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20`}
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />}
                {!isValidating && recipientError && <AlertCircle className="w-4 h-4 text-red-500" />}
                {!isValidating && recipientValid && <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
            </div>
            {recipientError && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {recipientError}
              </motion.p>
            )}
            {!recipientError && recipientWarning && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 text-xs text-yellow-500/80 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                {recipientWarning}
              </motion.p>
            )}
          </div>

          {/* Message Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-white/70">Message</label>
              <span className={`text-xs ${message.length > 1000 ? "text-red-400" : "text-white/30"}`}>
                {message.length}/1000
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSendError(null);
              }}
              placeholder="Type your message..."
              disabled={isSending || sendSuccess}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-white/40 transition-all resize-none"
              maxLength={1000}
            />
          </div>

          {/* Error */}
          {sendError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {sendError}
              </p>
            </motion.div>
          )}

          {/* Success */}
          {sendSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Message sent successfully!
              </p>
            </motion.div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              canSend
                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg hover:shadow-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Message
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendMessageModal;
