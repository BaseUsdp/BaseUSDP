/**
 * XMTP React Context
 * Provides decentralized E2E-encrypted messaging throughout the app.
 * Auto-initializes when an EVM wallet is connected + authenticated.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useWallet } from "@/contexts/WalletContext";
import * as xmtp from "@/services/xmtpService";
import { useAddressResolver } from "@/hooks/useAddressResolver";
import { ConsentState, type DecodedMessage } from "@xmtp/browser-sdk";

export interface XMTPConversation {
  peerAddress: string;
  peerUsername: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unread: boolean;
  consentState: "allowed" | "denied" | "unknown";
}

interface XMTPContextType {
  isXMTPReady: boolean;
  isInitializing: boolean;
  initError: string | null;
  conversations: XMTPConversation[];
  unreadCount: number;
  initializeXMTP: () => Promise<void>;
  sendMessage: (peerAddress: string, text: string) => Promise<void>;
  getConversation: (peerAddress: string) => Promise<DecodedMessage[]>;
  resolveUsername: (username: string) => Promise<string | null>;
  allowAddress: (address: string) => Promise<void>;
  denyAddress: (address: string) => Promise<void>;
  canMessage: (address: string) => Promise<boolean>;
}

const XMTPContext = createContext<XMTPContextType | undefined>(undefined);

export const XMTPProvider = ({ children }: { children: ReactNode }) => {
  const { isConnected, isAuthenticated, fullWalletAddress, activeChain, walletType } = useWallet();
  const { resolveUsername, resolveAddress } = useAddressResolver();

  const [isXMTPReady, setIsXMTPReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<XMTPConversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track which conversations user has "seen" (opened)
  const seenConversationsRef = useRef<Set<string>>(new Set());
  const isStreamingRef = useRef(false);

  // Get EVM provider sign function
  const getSignFn = useCallback(() => {
    if (activeChain !== "base") return null;

    return async (message: string, address: string): Promise<string> => {
      let provider: any;
      if (walletType === "metamask") {
        provider = (window as any).ethereum;
        if (!provider?.isMetaMask || provider?.isPhantom) return "";
      } else {
        provider = (window as any).phantom?.ethereum;
        if (!provider?.isPhantom) return "";
      }
      return provider.request({
        method: "personal_sign",
        params: [message, address],
      });
    };
  }, [activeChain, walletType]);

  /**
   * Initialize XMTP client manually (triggered by user action).
   */
  const initializeXMTP = useCallback(async () => {
    if (isXMTPReady || isInitializing) return;
    if (!fullWalletAddress || activeChain !== "base") {
      setInitError("EVM wallet required for messaging");
      return;
    }

    const signFn = getSignFn();
    if (!signFn) {
      setInitError("Could not access wallet signer");
      return;
    }

    setIsInitializing(true);
    setInitError(null);

    try {
      const signer = xmtp.buildSigner(fullWalletAddress, signFn);
      await xmtp.initialize(signer);
      setIsXMTPReady(true);

      // Load initial conversations
      await refreshConversations();
    } catch (err: any) {
      console.error("[XMTP] Init error:", err);
      setInitError(err.message || "Failed to initialize messaging");
    } finally {
      setIsInitializing(false);
    }
  }, [isXMTPReady, isInitializing, fullWalletAddress, activeChain, getSignFn]);

  /**
   * Refresh the conversations list from XMTP.
   */
  const refreshConversations = useCallback(async () => {
    try {
      const convos = await xmtp.listConversations();
      const mapped: XMTPConversation[] = [];

      for (const conv of convos) {
        const messages = await conv.messages({ limit: 1n });
        const lastMsg = messages[0];

        // Extract peer address from conversation members
        const members = await conv.members();
        const peerMember = members.find(
          (m) => m.accountIdentifiers[0]?.identifier?.toLowerCase() !== fullWalletAddress.toLowerCase()
        );
        const peerAddr = peerMember?.accountIdentifiers[0]?.identifier || "";

        // Resolve peer username
        const peerUser = peerAddr ? await resolveAddress(peerAddr) : null;

        // Determine consent state
        let consentState: "allowed" | "denied" | "unknown" = "unknown";
        try {
          const state = conv.consentState();
          if (state === ConsentState.Allowed) consentState = "allowed";
          else if (state === ConsentState.Denied) consentState = "denied";
        } catch {
          // Default to unknown
        }

        mapped.push({
          peerAddress: peerAddr,
          peerUsername: peerUser,
          lastMessage: lastMsg ? String(lastMsg.content) : "",
          lastMessageAt: lastMsg ? new Date(Number(lastMsg.sentAtNs / 1_000_000n)) : new Date(0),
          unread: !seenConversationsRef.current.has(peerAddr.toLowerCase()),
          consentState,
        });
      }

      // Sort by most recent message
      mapped.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
      setConversations(mapped);

      // Update unread count
      const unread = mapped.filter((c) => c.unread && c.consentState !== "denied").length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("[XMTP] Failed to refresh conversations:", err);
    }
  }, [fullWalletAddress, resolveAddress]);

  /**
   * Start streaming all incoming messages.
   */
  useEffect(() => {
    if (!isXMTPReady || isStreamingRef.current) return;
    isStreamingRef.current = true;

    xmtp.streamAllMessages((message: DecodedMessage) => {
      // When a new message arrives, refresh conversations
      refreshConversations();
    });

    return () => {
      xmtp.stopStream();
      isStreamingRef.current = false;
    };
  }, [isXMTPReady, refreshConversations]);

  /**
   * Clean up on wallet disconnect.
   */
  useEffect(() => {
    if (!isConnected || !isAuthenticated) {
      if (isXMTPReady) {
        xmtp.disconnect();
        setIsXMTPReady(false);
        setConversations([]);
        setUnreadCount(0);
        seenConversationsRef.current.clear();
        isStreamingRef.current = false;
      }
    }
  }, [isConnected, isAuthenticated, isXMTPReady]);

  /**
   * Send a message to a peer address.
   */
  const handleSendMessage = useCallback(async (peerAddress: string, text: string) => {
    await xmtp.sendMessage(peerAddress, text);
    // Mark as seen since we're actively chatting
    seenConversationsRef.current.add(peerAddress.toLowerCase());
    await refreshConversations();
  }, [refreshConversations]);

  /**
   * Get conversation messages for a peer.
   */
  const handleGetConversation = useCallback(async (peerAddress: string): Promise<DecodedMessage[]> => {
    // Mark as seen when opening a conversation
    seenConversationsRef.current.add(peerAddress.toLowerCase());
    const messages = await xmtp.getConversationMessages(peerAddress);
    // Update unread state
    setConversations((prev) =>
      prev.map((c) =>
        c.peerAddress.toLowerCase() === peerAddress.toLowerCase()
          ? { ...c, unread: false }
          : c
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    return messages;
  }, []);

  /**
   * Check if a single address can receive XMTP messages.
   */
  const handleCanMessage = useCallback(async (address: string): Promise<boolean> => {
    const results = await xmtp.canMessage([address]);
    return results.get(address) ?? false;
  }, []);

  /**
   * Allow a contact.
   */
  const handleAllowAddress = useCallback(async (address: string) => {
    await xmtp.allowAddress(address);
    await refreshConversations();
  }, [refreshConversations]);

  /**
   * Deny a contact.
   */
  const handleDenyAddress = useCallback(async (address: string) => {
    await xmtp.denyAddress(address);
    await refreshConversations();
  }, [refreshConversations]);

  return (
    <XMTPContext.Provider
      value={{
        isXMTPReady,
        isInitializing,
        initError,
        conversations,
        unreadCount,
        initializeXMTP,
        sendMessage: handleSendMessage,
        getConversation: handleGetConversation,
        resolveUsername,
        allowAddress: handleAllowAddress,
        denyAddress: handleDenyAddress,
        canMessage: handleCanMessage,
      }}
    >
      {children}
    </XMTPContext.Provider>
  );
};

export const useXMTP = () => {
  const context = useContext(XMTPContext);
  if (context === undefined) {
    throw new Error("useXMTP must be used within an XMTPProvider");
  }
  return context;
};
