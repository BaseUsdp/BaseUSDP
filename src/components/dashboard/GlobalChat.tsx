/**
 * GlobalChat — token-gated group chat for BASEUSDP users.
 * All users with a username can participate.
 * Future: will require $ORB token to send messages.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Users, Loader2, Lock, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { authService } from "@/services/authService";
import { getApiUrl } from "@/utils/apiConfig";

interface GlobalMessage {
  id: string;
  wallet_address: string;
  username: string;
  content: string;
  created_at: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/** Render message content with @mentions highlighted */
function MessageContent({ content, own }: { content: string; own?: boolean }) {
  const parts = content.split(/(@[a-zA-Z][a-zA-Z0-9_-]{1,19})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className={`font-semibold ${own ? "text-white underline" : "text-primary"}`}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

interface GlobalChatProps {
  hasUsername: boolean;
}

const GlobalChat = ({ hasUsername }: GlobalChatProps) => {
  const { fullWalletAddress } = useWallet();
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // @mention autocomplete
  const [showMentions, setShowMentions] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<string[]>([]);

  const apiUrl = getApiUrl();
  const myWallet = fullWalletAddress?.toLowerCase() || "";

  const isOwn = useCallback(
    (addr: string) => addr.toLowerCase() === myWallet,
    [myWallet]
  );

  // Build known usernames from messages
  const knownNames = useCallback(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.username && !isOwn(msg.wallet_address)) {
        names.add(msg.username);
      }
    }
    return [...names].sort();
  }, [messages, isOwn]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const resp = await fetch(`${apiUrl}/api/global/messages?limit=50`);
      if (resp.ok) {
        const json = await resp.json();
        const newMsgs: GlobalMessage[] = json.messages || [];
        setMessages((prev) => {
          if (
            prev.length === newMsgs.length &&
            prev[prev.length - 1]?.id === newMsgs[newMsgs.length - 1]?.id
          ) {
            return prev;
          }
          return newMsgs;
        });
      } else {
        console.error("[GlobalChat] fetch messages failed:", resp.status, await resp.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[GlobalChat] fetch messages error:", err);
    }
  }, [apiUrl]);

  // Initial load
  useEffect(() => {
    fetchMessages().finally(() => setLoading(false));
  }, [fetchMessages]);

  // Poll every 4 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle @mention autocomplete
  const handleInputChange = (value: string) => {
    setInput(value);
    setSendError("");

    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const names = knownNames();
      const filtered = query
        ? names.filter((n) => n.toLowerCase().startsWith(query))
        : names;
      setMentionOptions(filtered.slice(0, 5));
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    if (mentionMatch) {
      const start = cursorPos - mentionMatch[0].length;
      const newValue =
        input.slice(0, start) + `@${name} ` + input.slice(cursorPos);
      setInput(newValue);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending || !fullWalletAddress) return;
    const userText = input.trim();
    setInput("");
    setSending(true);
    setSendError("");
    setShowMentions(false);

    // Optimistic render
    const tempMsg: GlobalMessage = {
      id: `temp-${Date.now()}`,
      wallet_address: myWallet,
      username: "you",
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const token = authService.getSessionToken();
      const resp = await fetch(`${apiUrl}/api/global/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          wallet: fullWalletAddress,
          message: userText,
        }),
      });

      if (!resp.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        const data = await resp.json().catch(() => null);
        setSendError(data?.error || "Failed to send message");
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setSendError(err?.message || "Network error");
      console.error("[GlobalChat] send error:", err);
    } finally {
      setSending(false);
    }
  };

  // No username state
  if (!hasUsername) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <h3 className="text-lg font-semibold text-muted-foreground mb-1">
          Username Required
        </h3>
        <p className="text-sm text-muted-foreground/70 max-w-xs">
          Create a username in Settings to join the global chat.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] bg-card/50 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Global Chat</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Live
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No messages yet</p>
            <p className="text-xs text-muted-foreground/60">
              Be the first to start the conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const own = isOwn(msg.wallet_address);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] ${own ? "text-right" : "text-left"}`}>
                    {/* Sender */}
                    <div
                      className={`flex items-center gap-1.5 mb-0.5 ${
                        own ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className="text-[10px] text-muted-foreground font-medium">
                        @{msg.username}
                      </span>
                      {own && (
                        <span className="text-[8px] font-bold text-primary bg-primary/10 rounded px-1">
                          YOU
                        </span>
                      )}
                    </div>
                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm inline-block whitespace-pre-wrap ${
                        own
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}
                    >
                      <MessageContent content={msg.content} own={own} />
                    </div>
                    {/* Time */}
                    <p
                      className={`text-[9px] text-muted-foreground/50 mt-0.5 ${
                        own ? "text-right" : "text-left"
                      }`}
                    >
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* @mention autocomplete */}
      {showMentions && mentionOptions.length > 0 && (
        <div className="border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <AtSign size={10} className="text-muted-foreground" />
            {mentionOptions.map((name) => (
              <button
                key={name}
                onClick={() => insertMention(name)}
                className="text-[10px] text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-0.5 transition"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div className="px-4 py-1.5 border-t border-border">
          <p className="text-[10px] text-red-400">{sendError}</p>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-border bg-card/50">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !showMentions) handleSend();
            if (e.key === "Escape") setShowMentions(false);
          }}
          placeholder="Message everyone... (use @name to mention)"
          disabled={sending}
          maxLength={500}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          size="icon"
          className="bg-primary hover:bg-primary/90 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default GlobalChat;
