/**
 * Twitter/X Payment Settings Card
 * Allows users to link their X account, enable tweet payments, and set daily limits.
 */

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getTweetPaymentSettings,
  updateTweetPaymentSettings,
  unlinkTweetPaymentAccount,
  startXOAuth,
} from "@/services/twitterApi";

const TwitterPaymentSettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState(false);
  const [xUsername, setXUsername] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(100);

  useEffect(() => {
    loadSettings();

    // Check for OAuth redirect result
    const params = new URLSearchParams(window.location.search);
    if (params.get("x_linked") === "true") {
      toast({ title: "X account verified", description: "Your X account has been linked successfully." });
      window.history.replaceState({}, "", window.location.pathname);
    }
    const xError = params.get("x_error");
    if (xError) {
      toast({ title: "Link failed", description: xError.replace(/\+/g, " "), variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await getTweetPaymentSettings();
      setLinked(data.linked);
      setXUsername(data.x_username || "");
      setEnabled(data.enabled);
      setDailyLimit(data.daily_limit);
    } catch (err: any) {
      console.error("[TwitterSettings] Load error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkAccount() {
    if (!fullWalletAddress) return;
    setSaving(true);
    try {
      const { authorize_url } = await startXOAuth();
      window.location.href = authorize_url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  }

  async function handleUnlink() {
    if (!fullWalletAddress) return;
    setSaving(true);
    try {
      await unlinkTweetPaymentAccount({ wallet: fullWalletAddress });
      toast({ title: "Account disconnected", description: "X account unlinked." });
      setLinked(false);
      setXUsername("");
      setEnabled(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!fullWalletAddress) return;
    setSaving(true);
    try {
      await updateTweetPaymentSettings({
        wallet: fullWalletAddress,
        enabled,
        daily_limit: dailyLimit,
      });
      toast({ title: "Settings saved", description: "Tweet payment settings updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/50 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-secondary/50 rounded animate-pulse" />
            <div className="h-3 w-56 bg-secondary/30 rounded animate-pulse" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
          <Icon icon="ri:twitter-x-fill" className="w-5 h-5 text-sky-500" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">X/Twitter Payments</h3>
          <p className="text-xs text-muted-foreground">
            Send payments via @BaseUSDPbot mentions on X
          </p>
        </div>
      </div>

      {/* Link Account */}
      {!linked ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link your X account to enable tweet-based payments. Mention{" "}
            <code className="text-primary">@BaseUSDPbot send 5 USDC to @username</code>{" "}
            in a tweet to send a private payment.
          </p>
          <Button
            onClick={handleLinkAccount}
            disabled={saving}
            className="w-full bg-sky-500 hover:bg-sky-600"
          >
            {saving ? (
              <>
                <Icon icon="ph:spinner" className="w-4 h-4 mr-2 animate-spin" />
                Redirecting to X...
              </>
            ) : (
              <>
                <Icon icon="ri:twitter-x-fill" className="w-4 h-4 mr-2" />
                Verify & Link X Account
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Linked account info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div className="flex items-center gap-2">
              <Icon icon="ri:twitter-x-fill" className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">@{xUsername}</span>
            </div>
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div>
              <p className="font-medium">Enable Tweet Payments</p>
              <p className="text-xs text-muted-foreground">
                Allow sending payments via @BaseUSDPbot mentions
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Daily limit */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div>
              <p className="font-medium">Daily Limit</p>
              <p className="text-xs text-muted-foreground">
                Maximum daily spend ($1 - $10,000)
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded-lg border border-border bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Save button */}
          <Button
            className="w-full bg-sky-500 hover:bg-sky-600"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Icon icon="ph:spinner" className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon icon="ph:floppy-disk-bold" className="w-4 h-4 mr-2" />
                Save Tweet Payment Settings
              </>
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default TwitterPaymentSettings;
