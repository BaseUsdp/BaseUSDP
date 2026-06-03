import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Send, Loader2, Bot, User, Sparkles, Link2, Link2Off, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";
import SendPaymentModal from "../SendPaymentModal";
import DepositModal from "../DepositModal";
import X402PaymentModal from "../X402PaymentModal";

const BASE_MCP_ENABLED = import.meta.env.VITE_ENABLE_BASE_MCP === "true";
type BaseMcpStatus = "loading" | "connected" | "disconnected";

// Web Speech API — Chrome/Edge/Safari support it under either name.
// Firefox doesn't (we gracefully hide the mic button when unsupported).
const SpeechRecognitionImpl: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    : null;
const SUPPORTS_VOICE_INPUT = !!SpeechRecognitionImpl;
const SUPPORTS_VOICE_OUTPUT =
  typeof window !== "undefined" && "speechSynthesis" in window;

interface TerminalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: { type: string; params?: Record<string, string> };
  timestamp: Date;
}

interface AITerminalSectionProps {
  showBalance: boolean;
  setActiveTab: (tab: string) => void;
  onWithdraw?: (amount?: string, token?: string) => void;
}

const SUGGESTED_COMMANDS = [
  "What's my balance?",
  "Send a payment",
  "Show my transaction history",
  "Create a payment request",
  "What can you do?",
];

const AITerminalSection = ({ showBalance, setActiveTab, onWithdraw }: AITerminalSectionProps) => {
  const { encryptedBalance, walletAddress, isConnected, activeChain } = useWallet();
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendInitialRecipient, setSendInitialRecipient] = useState<string | undefined>();
  const [sendInitialAmount, setSendInitialAmount] = useState<string | undefined>();
  const [sendInitialToken, setSendInitialToken] = useState<"USDC" | "USDT" | undefined>();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositInitialAmount, setDepositInitialAmount] = useState<string | undefined>();
  const [depositInitialToken, setDepositInitialToken] = useState<"USDC" | "USDT" | undefined>();
  const [x402ModalOpen, setX402ModalOpen] = useState(false);
  const [x402InitialAmount, setX402InitialAmount] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice mode state.
  const [isListening, setIsListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [baseMcpStatus, setBaseMcpStatus] = useState<BaseMcpStatus>(
    BASE_MCP_ENABLED ? "loading" : "disconnected",
  );
  const [baseMcpBusy, setBaseMcpBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshBaseMcpStatus = async () => {
    if (!BASE_MCP_ENABLED) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/base-mcp/status`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      setBaseMcpStatus(data.connected ? "connected" : "disconnected");
    } catch {
      setBaseMcpStatus("disconnected");
    }
  };

  useEffect(() => {
    refreshBaseMcpStatus();
  }, []);

  // Surface OAuth callback outcomes as toasts and clean up the URL so a
  // refresh doesn't re-show them.
  useEffect(() => {
    const outcome = searchParams.get("base_mcp");
    if (!outcome) return;
    if (outcome === "connected") {
      toast.success("Base Account connected — your AI can now swap, lend, and explore Base.");
      setBaseMcpStatus("connected");
    } else if (outcome === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(`Couldn't connect Base Account (${reason}).`);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("base_mcp");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const connectBaseMcp = () => {
    setBaseMcpBusy(true);
    const returnTo = encodeURIComponent("/dashboard?tab=ai");
    window.location.href = `${getApiUrl()}/api/auth/base-mcp/start?return_to=${returnTo}`;
  };

  const disconnectBaseMcp = async () => {
    setBaseMcpBusy(true);
    try {
      await fetch(`${getApiUrl()}/api/auth/base-mcp/disconnect`, {
        method: "POST",
        credentials: "same-origin",
      });
      setBaseMcpStatus("disconnected");
      toast.success("Base Account disconnected.");
    } catch {
      toast.error("Couldn't disconnect — try again.");
    } finally {
      setBaseMcpBusy(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeAction = (action: { type: string; params?: Record<string, string> }) => {
    switch (action.type) {
      case "send_payment":
        setSendInitialRecipient(action.params?.recipient);
        setSendInitialAmount(action.params?.amount);
        setSendInitialToken(action.params?.token as "USDC" | "USDT" | undefined);
        setSendModalOpen(true);
        break;
      case "deposit":
        setDepositInitialAmount(action.params?.amount);
        setDepositInitialToken(action.params?.token as "USDC" | "USDT" | undefined);
        setDepositModalOpen(true);
        break;
      case "create_payment":
        setX402InitialAmount(action.params?.amount);
        setX402ModalOpen(true);
        break;
      case "withdraw":
        onWithdraw?.(action.params?.amount, action.params?.token);
        break;
      case "show_history":
        setActiveTab("history");
        break;
      case "navigate":
        if (action.params?.tab) {
          setActiveTab(action.params.tab);
        }
        break;
      case "show_balance":
      case "help":
      case "none":
      default:
        break;
    }
  };

  const speakReply = (text: string) => {
    if (!voiceReply || !SUPPORTS_VOICE_OUTPUT) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      // best-effort — silent fail on quota / restricted contexts
    }
  };

  const startListening = () => {
    if (!SUPPORTS_VOICE_INPUT || isListening) return;
    try {
      const rec = new SpeechRecognitionImpl();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      let gotAnything = false;

      rec.onstart = () => {
        console.log("[voice] recognition started");
        toast.message("🎙️ Listening — speak now");
      };

      rec.onaudiostart = () => console.log("[voice] audio capture started");
      rec.onsoundstart = () => console.log("[voice] sound detected");
      rec.onspeechstart = () => {
        console.log("[voice] speech detected");
        gotAnything = true;
      };
      rec.onspeechend = () => console.log("[voice] speech ended");

      rec.onresult = (event: any) => {
        // Build the transcript from all results (interim + final).
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          if (r && r[0]) transcript += r[0].transcript;
        }
        console.log("[voice] result:", transcript);
        gotAnything = true;
        setInput(transcript);
      };

      rec.onerror = (event: any) => {
        console.warn("[voice] error:", event?.error, event);
        const code = event?.error || "unknown";
        const msgs: Record<string, string> = {
          "not-allowed": "Microphone blocked. Check browser site permissions.",
          "service-not-allowed": "Speech service blocked by the browser.",
          "no-speech": "No speech detected — try speaking again.",
          "audio-capture": "No microphone found. Check that one is connected.",
          network: "Speech recognition needs a network connection.",
          aborted: "", // user-initiated, suppress
        };
        const userMsg = msgs[code] ?? `Voice error: ${code}`;
        if (userMsg) toast.error(userMsg);
        setIsListening(false);
      };

      rec.onend = () => {
        console.log("[voice] recognition ended");
        if (!gotAnything) {
          toast.message("Didn't catch anything — try clicking the mic and speaking up.");
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err: any) {
      console.error("[voice] start failed:", err);
      setIsListening(false);
      toast.error(err?.message || "Couldn't start voice input.");
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped — ignore
    }
    setIsListening(false);
  };

  // Tidy up if the user navigates away mid-listen.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      if (SUPPORTS_VOICE_OUTPUT) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const handleSend = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isLoading) return;

    const userMsg: TerminalMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            walletAddress: walletAddress || null,
            balance: showBalance ? encryptedBalance : "hidden",
            chain: activeChain,
            isConnected,
          },
        }),
      });

      const data = await res.json();

      const assistantMsg: TerminalMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "Sorry, I couldn't process that.",
        action: data.action || undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakReply(assistantMsg.content);

      if (data.action) {
        executeAction(data.action);
      }
    } catch {
      const errorMsg: TerminalMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--dash-border)" }}
        >
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Terminal className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--dash-text)" }}>
              AI Terminal
            </h2>
            <p className="text-xs" style={{ color: "var(--dash-text-faint)" }}>
              Talk to AI in plain English
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {SUPPORTS_VOICE_OUTPUT && (
              <button
                onClick={() => {
                  setVoiceReply((v) => {
                    const next = !v;
                    if (!next) {
                      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
                    }
                    return next;
                  });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                  voiceReply
                    ? "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20"
                    : "bg-transparent border-border text-muted-foreground hover:bg-white/5"
                }`}
                title={voiceReply ? "Speaking replies — click to mute" : "Click to read replies aloud"}
              >
                {voiceReply ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                {voiceReply ? "Speak" : "Mute"}
              </button>
            )}
            {BASE_MCP_ENABLED && (
              <button
                onClick={baseMcpStatus === "connected" ? disconnectBaseMcp : connectBaseMcp}
                disabled={baseMcpBusy || baseMcpStatus === "loading"}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                  baseMcpStatus === "connected"
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20"
                    : "bg-transparent border-border text-muted-foreground hover:bg-white/5"
                }`}
                title={
                  baseMcpStatus === "connected"
                    ? "Base Account connected — click to disconnect"
                    : "Connect your Base Account to unlock swaps, lending, vault yields, and more"
                }
              >
                {baseMcpBusy || baseMcpStatus === "loading" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : baseMcpStatus === "connected" ? (
                  <Link2 className="w-3 h-3" />
                ) : (
                  <Link2Off className="w-3 h-3" />
                )}
                {baseMcpStatus === "connected" ? "Base connected" : "Connect Base"}
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-400">Online</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "var(--dash-text)" }}>
                Welcome to AI Terminal
              </h3>
              <p className="text-xs mb-6 max-w-xs" style={{ color: "var(--dash-text-faint)" }}>
                Your AI-powered assistant for managing payments, checking balances, and navigating USDP.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTED_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => handleSend(cmd)}
                    className="px-3 py-1.5 rounded-lg text-xs border transition-all hover:bg-white/10"
                    style={{
                      color: "var(--dash-text-muted)",
                      border: "1px solid var(--dash-border)",
                    }}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                        msg.role === "user"
                          ? "bg-sky-500/20 border border-sky-500/30"
                          : "bg-primary/20 border border-primary/30"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-sky-500/15 border border-sky-500/20 rounded-br-md"
                          : "border rounded-bl-md"
                      }`}
                      style={
                        msg.role === "assistant"
                          ? {
                              background: "var(--dash-surface)",
                              borderColor: "var(--dash-border)",
                            }
                          : undefined
                      }
                    >
                      <p
                        className="text-sm leading-relaxed break-words"
                        style={{ color: "var(--dash-text)" }}
                      >
                        {msg.content}
                      </p>
                      <p
                        className="text-[10px] mt-1.5"
                        style={{ color: "var(--dash-text-faint)" }}
                      >
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary/20 border border-primary/30">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-bl-md border"
                      style={{
                        background: "var(--dash-surface)",
                        borderColor: "var(--dash-border)",
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-5 py-4" style={{ borderTop: "1px solid var(--dash-border)" }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening…" : "Ask anything..."}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              style={{
                background: "var(--dash-overlay)",
                border: "1px solid var(--dash-border)",
              }}
              maxLength={500}
            />
            {SUPPORTS_VOICE_INPUT && (
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                className={`p-2.5 rounded-xl transition-all ${
                  isListening
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 animate-pulse"
                    : "bg-muted text-muted-foreground/70 border border-border hover:bg-white/5"
                }`}
                title={isListening ? "Stop listening" : "Speak to the AI Terminal"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-all ${
                input.trim() && !isLoading
                  ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                  : "bg-muted text-muted-foreground/30 border border-border cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modals triggered by AI actions */}
      <SendPaymentModal open={sendModalOpen} onOpenChange={setSendModalOpen} initialRecipient={sendInitialRecipient} initialAmount={sendInitialAmount} initialToken={sendInitialToken} />
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} initialAmount={depositInitialAmount} initialToken={depositInitialToken} />
      <X402PaymentModal open={x402ModalOpen} onOpenChange={setX402ModalOpen} initialAmount={x402InitialAmount} />
    </>
  );
};

export default AITerminalSection;
