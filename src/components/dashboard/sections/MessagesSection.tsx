import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Inbox, Loader2, RefreshCw, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSentMessages, getReceivedMessages, type Message } from "@/services/api";
import SendMessageModal from "../SendMessageModal";

const MessagesSection = () => {
  const [activeTab, setActiveTab] = useState("received");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [receivedRes, sentRes] = await Promise.all([
        getReceivedMessages(),
        getSentMessages(),
      ]);
      if (receivedRes.success) setReceivedMessages(receivedRes.messages);
      if (sentRes.success) setSentMessages(sentRes.messages);
    } catch (err: any) {
      setError(err.message || "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const MessageCard = ({ msg, type }: { msg: Message; type: "received" | "sent" }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {type === "received" ? (
                <>
                  <span className="text-white/50">From </span>
                  @{msg.sender_username}
                </>
              ) : (
                <>
                  <span className="text-white/50">To </span>
                  @{msg.recipient_username}
                </>
              )}
            </p>
          </div>
        </div>
        <span className="text-xs text-white/40 whitespace-nowrap">{formatTime(msg.created_at)}</span>
      </div>
      <p className="text-sm text-white/70 leading-relaxed pl-10">{msg.message}</p>
    </motion.div>
  );

  const EmptyState = ({ type }: { type: "received" | "sent" }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        {type === "received" ? (
          <Inbox className="w-8 h-8 text-white/20" />
        ) : (
          <Send className="w-8 h-8 text-white/20" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-white/50 mb-1">
        {type === "received" ? "No messages received" : "No messages sent"}
      </h3>
      <p className="text-sm text-white/30">
        {type === "received"
          ? "Messages from other users will appear here"
          : "Messages you send will appear here"}
      </p>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Messages<span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Send and receive private messages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMessages}
            disabled={isLoading}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-white/70"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setSendModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Send className="w-4 h-4" />
            Send Message
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="received" className="gap-2">
            <Inbox className="w-4 h-4" />
            Received
            {receivedMessages.length > 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {receivedMessages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="w-4 h-4" />
            Sent
            {sentMessages.length > 0 && (
              <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">
                {sentMessages.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Received Tab */}
        <TabsContent value="received">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : receivedMessages.length === 0 ? (
            <EmptyState type="received" />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {receivedMessages.map((msg) => (
                  <MessageCard key={msg.id} msg={msg} type="received" />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Sent Tab */}
        <TabsContent value="sent">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : sentMessages.length === 0 ? (
            <EmptyState type="sent" />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {sentMessages.map((msg) => (
                  <MessageCard key={msg.id} msg={msg} type="sent" />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Send Message Modal */}
      <SendMessageModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        onMessageSent={fetchMessages}
      />
    </div>
  );
};

export default MessagesSection;
