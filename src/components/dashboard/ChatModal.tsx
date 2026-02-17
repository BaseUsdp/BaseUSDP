import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, User } from "lucide-react";
import { getConversation, sendMessage, markMessagesRead, type Message } from "@/services/api";

interface ChatModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  onMessageSent?: () => void;
}

const ChatModal = ({ open, onClose, username, onMessageSent }: ChatModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUsername, setMyUsername] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getConversation(username);
      if (res.success) {
        setMessages(res.messages);
        setMyUsername(res.my_username);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && username) {
      fetchConversation();
      // Mark messages from this user as read
      markMessagesRead(username).catch(() => {});
    }
  }, [open, username]);

  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (open && !isLoading) {
      inputRef.current?.focus();
    }
  }, [open, isLoading]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const result = await sendMessage({
        recipient_username: username,
        message: newMessage.trim(),
      });
      if (result.success) {
        setNewMessage("");
        onMessageSent?.();
        // Refetch conversation to show the new message
        const res = await getConversation(username);
        if (res.success) {
          setMessages(res.messages);
        }
      } else {
        setError(result.error || "Failed to send");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 0) return time;
    if (diffDays === 1) return `Yesterday ${time}`;
    if (diffDays < 7) return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg mx-4 bg-[#0a0a0a]/95 border border-primary/20 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col"
            style={{ maxHeight: "80vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">@{username}</p>
                  <p className="text-xs text-white/40">Private conversation</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[300px] max-h-[50vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-white/40">No messages yet</p>
                  <p className="text-xs text-white/25 mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_username === myUsername;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                          isMine
                            ? "bg-primary/20 border border-primary/30 rounded-br-md"
                            : "bg-white/5 border border-white/10 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm text-white/90 leading-relaxed break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary/50" : "text-white/30"}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-5 py-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isSending}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-white/40 transition-all"
                  maxLength={1000}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className={`p-2.5 rounded-xl transition-all ${
                    newMessage.trim() && !isSending
                      ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                      : "bg-white/5 text-white/20 border border-white/10 cursor-not-allowed"
                  }`}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ChatModal;
