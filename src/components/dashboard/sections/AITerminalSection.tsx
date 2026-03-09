import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";
import SendPaymentModal from "../SendPaymentModal";
import DepositModal from "../DepositModal";
import X402PaymentModal from "../X402PaymentModal";

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
              Talk to ORB in plain English
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400">Online</span>
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
                Welcome to ORB Terminal
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
              placeholder="Ask ORB anything..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              style={{
                background: "var(--dash-overlay)",
                border: "1px solid var(--dash-border)",
              }}
              maxLength={500}
            />
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
