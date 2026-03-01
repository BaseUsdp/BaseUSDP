/**
 * Mini App Settings Page
 * Toggle cast payments on/off + configure daily limit
 */

import { useState, useEffect } from "react";
import { useFarcaster } from "../contexts/FarcasterContext";
import farcasterApi from "../services/farcasterApi";

export default function MiniAppSettings() {
  const { walletAddress, farcasterUsername } = useFarcaster();
  const [enabled, setEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("100");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await farcasterApi.getCastPaymentSettings();
        setEnabled(data.enabled);
        setDailyLimit(String(data.daily_limit));
      } catch {
        // Settings not found — defaults are fine
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!walletAddress || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const limit = parseFloat(dailyLimit);
      await farcasterApi.updateCastPaymentSettings({
        wallet: walletAddress,
        enabled,
        daily_limit: isNaN(limit) || limit <= 0 ? 100 : Math.min(limit, 10000),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("[Settings] Save error:", err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-white">Settings</h2>

      {/* Cast Payments Section */}
      <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Cast Payments
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Send payments by mentioning @orb402 in a cast
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              enabled ? "bg-indigo-500" : "bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            <div className="border-t border-zinc-700/30 pt-3">
              <label className="text-xs text-zinc-400 block mb-1.5">
                Daily Limit (USD)
              </label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                min="1"
                max="10000"
                step="1"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Max $10,000 per day
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-300/90">
                When enabled, anyone can trigger a payment from your account by
                casting <span className="font-mono">@orb402 send [amount] USDC to @{farcasterUsername || "you"}</span>.
                Payments are private and processed via ZK proofs.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          saved
            ? "bg-green-600 text-white"
            : saving
              ? "bg-zinc-700 text-zinc-400"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
        }`}
      >
        {saved ? "Saved" : saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
