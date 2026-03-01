/**
 * Share Cast Button
 * Composes a privacy-safe Farcaster cast after a successful payment
 * Default text: "Sent a private payment via ORB402" (no amount, no recipient)
 * Uses dynamic import to avoid crashes outside Farcaster iframe
 */

import { Share2 } from "lucide-react";

interface ShareCastButtonProps {
  paymentId?: string;
  text?: string;
  className?: string;
}

export function ShareCastButton({
  paymentId,
  text = "Sent a private payment via ORB402",
  className = "",
}: ShareCastButtonProps) {
  const handleShare = async () => {
    try {
      const { default: sdk } = await import("@farcaster/miniapp-sdk");

      const embeds: string[] = [];

      if (paymentId) {
        embeds.push(`https://orb402.com/miniapp/pay/${paymentId}`);
      }

      await sdk.actions.composeCast({
        text,
        embeds: embeds as any,
      });
    } catch (error) {
      console.error("[ShareCast] Error composing cast:", error);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium transition-colors ${className}`}
    >
      <Share2 className="w-4 h-4" />
      Share on Farcaster
    </button>
  );
}
