import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Inbox, Loader2, User, Reply, ShieldCheck, ShieldX, ShieldQuestion, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useXMTP, type XMTPConversation } from "@/contexts/XMTPContext";
import SendMessageModal from "../SendMessageModal";
import ChatModal from "../ChatModal";
import XMTPSetupBanner from "../XMTPSetupBanner";
import GlobalChat from "../GlobalChat";

const MessagesSection = () => {
  const { isXMTPReady, conversations } = useXMTP();
  const [activeTab, setActiveTab] = useState("global");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [chatWith, setChatWith] = useState<{ username: string; peerAddress: string } | null>(null);

  // Split conversations by consent state
  const allowedConversations = conversations.filter((c) => c.consentState === "allowed");
  const requestConversations = conversations.filter((c) => c.consentState === "unknown");

  const formatTime = (date: Date) => {
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

  const ConversationCard = ({ conv, isRequest }: { conv: XMTPConversation; isRequest?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() =>
        setChatWith({
          username: conv.peerUsername || conv.peerAddress.slice(0, 10) + "...",
          peerAddress: conv.peerAddress,
        })
      }
      className="p-4 rounded-xl bg-muted/50 border border-border hover:border-foreground/20 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            {conv.unread && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              @{conv.peerUsername || conv.peerAddress.slice(0, 10) + "..."}
            </p>
            {isRequest && (
              <span className="text-[10px] text-yellow-500/80 flex items-center gap-0.5">
                <ShieldQuestion className="w-3 h-3" />
                Message request
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {conv.lastMessageAt.getTime() > 0 ? formatTime(conv.lastMessageAt) : ""}
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed pl-10 truncate">
        {conv.lastMessage || "No messages yet"}
      </p>
    </motion.div>
  );

  const EmptyState = ({ type }: { type: "inbox" | "requests" }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {type === "inbox" ? (
          <Inbox className="w-8 h-8 text-muted-foreground/40" />
        ) : (
          <ShieldQuestion className="w-8 h-8 text-muted-foreground/40" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground mb-1">
        {type === "inbox" ? "No conversations yet" : "No message requests"}
      </h3>
      <p className="text-sm text-muted-foreground/70">
        {type === "inbox"
          ? "Start a conversation by sending a message"
          : "Messages from unknown contacts will appear here"}
      </p>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Messages<span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            End-to-end encrypted messaging
          </p>
        </div>
        {isXMTPReady && activeTab !== "global" && (
          <button
            onClick={() => {
              setReplyTo(undefined);
              setSendModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Send className="w-4 h-4" />
            Send Message
          </button>
        )}
      </div>

      {/* Tabs — Global is always available, Inbox/Requests require XMTP */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="w-4 h-4" />
            Inbox
            {allowedConversations.length > 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {allowedConversations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ShieldQuestion className="w-4 h-4" />
            Requests
            {requestConversations.length > 0 && (
              <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full">
                {requestConversations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-2">
            <Globe className="w-4 h-4" />
            Global
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox">
          {!isXMTPReady ? (
            <XMTPSetupBanner />
          ) : allowedConversations.length === 0 ? (
            <EmptyState type="inbox" />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {allowedConversations.map((conv) => (
                  <ConversationCard key={conv.peerAddress} conv={conv} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          {!isXMTPReady ? (
            <XMTPSetupBanner />
          ) : requestConversations.length === 0 ? (
            <EmptyState type="requests" />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {requestConversations.map((conv) => (
                  <ConversationCard key={conv.peerAddress} conv={conv} isRequest />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Global Chat Tab */}
        <TabsContent value="global">
          <GlobalChat hasUsername={true} />
        </TabsContent>
      </Tabs>

      {/* Send Message Modal */}
      <SendMessageModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        onMessageSent={() => {}}
        defaultRecipient={replyTo}
      />

      {/* Chat Modal */}
      <ChatModal
        open={!!chatWith}
        onClose={() => setChatWith(null)}
        username={chatWith?.username || ""}
        peerAddress={chatWith?.peerAddress}
        onMessageSent={() => {}}
      />
    </div>
  );
};

export default MessagesSection;
