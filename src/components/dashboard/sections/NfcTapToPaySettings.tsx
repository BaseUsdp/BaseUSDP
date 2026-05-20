import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/utils/apiConfig";
import { isWebNfcSupported, writeUrlToTag, scanForUrl } from "@/lib/nfc";

const BASE_URL =
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin.replace(/\/$/, "")
    : "https://baseusdp.com";

const MEMO_MAX_LEN = 120;

const NfcTapToPaySettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [supported] = useState(isWebNfcSupported());
  const [username, setUsername] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [memo, setMemo] = useState("");
  const [writing, setWriting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const writeAbortRef = useRef<AbortController | null>(null);
  const scanCancelRef = useRef<(() => void) | null>(null);

  // Look up the user's @handle so we can default the tag URL to /tip/@handle
  // when they have one, falling back to /pay?to=<wallet>.
  useEffect(() => {
    if (!fullWalletAddress) {
      setUsername(null);
      return;
    }
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile?.has_custom_username && d.profile?.username) {
          setUsername(d.profile.username);
        }
      })
      .catch(() => undefined);
  }, [fullWalletAddress]);

  const buildUrl = (): string => {
    if (!fullWalletAddress) return BASE_URL;
    const amt = amount.trim();
    const m = memo.trim().slice(0, MEMO_MAX_LEN);
    // If we have an amount / memo / non-USDC token, force the /pay form so
    // the prefill carries through. Otherwise use the tip URL when a handle
    // exists — it's prettier and works without the recipient revealing their
    // address publicly.
    const hasExtras = !!amt || !!m || token !== "USDC";
    if (username && !hasExtras) {
      return `${BASE_URL}/tip/@${encodeURIComponent(username)}`;
    }
    const params = new URLSearchParams({ to: fullWalletAddress });
    if (amt) params.set("amount", amt);
    if (token) params.set("token", token);
    if (m) params.set("memo", m);
    return `${BASE_URL}/pay?${params.toString()}`;
  };

  const handleWrite = async () => {
    if (!fullWalletAddress) return;
    if (writing) return;

    const url = buildUrl();
    if (url.length > 2048) {
      toast({ title: "URL too long", description: "Trim the memo.", variant: "destructive" });
      return;
    }

    setWriting(true);
    const controller = new AbortController();
    writeAbortRef.current = controller;
    const result = await writeUrlToTag(url, controller.signal);
    setWriting(false);
    writeAbortRef.current = null;

    if (result.ok) {
      toast({
        title: "Tag written",
        description: "Tap the tag with any NFC phone to test.",
      });
    } else {
      toast({
        title: "Write failed",
        description: result.reason,
        variant: result.reason === "Cancelled" ? "default" : "destructive",
      });
    }
  };

  const handleCancelWrite = () => {
    writeAbortRef.current?.abort();
  };

  const handleScan = () => {
    if (scanning) {
      scanCancelRef.current?.();
      scanCancelRef.current = null;
      setScanning(false);
      return;
    }
    setScanning(true);
    setScannedUrl(null);
    scanCancelRef.current = scanForUrl(
      (url) => {
        setScannedUrl(url);
        setScanning(false);
        scanCancelRef.current = null;
      },
      (msg) => {
        setScanning(false);
        scanCancelRef.current = null;
        toast({ title: "Scan failed", description: msg, variant: "destructive" });
      }
    );
  };

  // Clean up any in-flight write/scan on unmount.
  useEffect(() => {
    return () => {
      writeAbortRef.current?.abort();
      scanCancelRef.current?.();
    };
  }, []);

  const previewUrl = buildUrl();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
          <Icon icon="ph:nfc-bold" className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold">NFC tap-to-pay</h3>
          <p className="text-xs text-muted-foreground">
            Write a payment URL to a blank NFC tag. Anyone with an NFC phone taps
            the tag → pay screen opens automatically.
          </p>
        </div>
      </div>

      {!supported && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Web NFC isn't supported on this browser. Use Chrome on Android to write
          tags. The tags themselves work with any NFC-capable phone after writing.
        </div>
      )}

      {supported && (
        <>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount (optional)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Token</p>
                <div className="flex gap-1 rounded-md border border-border bg-background p-1">
                  {(["USDC", "USDT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setToken(t)}
                      className={`flex-1 text-xs py-1.5 rounded ${
                        token === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Memo (optional, max {MEMO_MAX_LEN} chars)
              </p>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX_LEN))}
                placeholder="e.g. Coffee, Invoice #42"
                className="bg-background"
              />
            </div>

            <div className="rounded-lg bg-background/40 border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">URL that will be written</p>
              <code className="font-mono text-xs break-all">{previewUrl}</code>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!writing ? (
              <Button
                onClick={handleWrite}
                disabled={!fullWalletAddress}
                className="bg-orange-500 hover:bg-orange-500/90 text-white"
              >
                <Icon icon="ph:nfc-bold" className="w-4 h-4 mr-2" />
                Write to NFC tag
              </Button>
            ) : (
              <>
                <Button disabled className="bg-orange-500/40 text-white">
                  <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                  Hold tag near phone…
                </Button>
                <Button variant="outline" onClick={handleCancelWrite}>
                  Cancel
                </Button>
              </>
            )}

            <Button variant="outline" onClick={handleScan}>
              <Icon
                icon={scanning ? "ph:stop-bold" : "ph:scan-bold"}
                className="w-4 h-4 mr-2"
              />
              {scanning ? "Stop scan" : "Scan a tag (test)"}
            </Button>
          </div>

          {scannedUrl && (
            <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="text-[11px] text-emerald-300 mb-1">Last scanned URL</p>
              <code className="font-mono text-xs break-all text-emerald-100">
                {scannedUrl}
              </code>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Tip: blank NTAG215 stickers cost {"<"}$1 each. After writing, the tag
            works on any NFC phone (iOS + Android) — no app needed by the tapper.
          </p>
        </>
      )}
    </motion.div>
  );
};

export default NfcTapToPaySettings;
