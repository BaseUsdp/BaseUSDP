import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  type Webhook,
  type WebhookToggleField,
} from "@/services/webhooks";

const MAX_WEBHOOKS = 5;

const TOGGLE_ROWS: { key: WebhookToggleField; label: string; description: string }[] = [
  {
    key: "notify_incoming",
    label: "Incoming payments",
    description: "POST when someone sends you a payment.",
  },
  {
    key: "notify_outgoing",
    label: "Outgoing confirmations",
    description: "POST when one of your sends settles.",
  },
  {
    key: "notify_x402",
    label: "x402 settlements",
    description: "POST when a payment request / link of yours is paid.",
  },
  {
    key: "notify_deposit",
    label: "Veil deposits",
    description: "POST when a private deposit lands.",
  },
  {
    key: "notify_withdraw",
    label: "Veil withdrawals",
    description: "POST when a private withdrawal completes.",
  },
  {
    key: "notify_scheduled",
    label: "Scheduled / recurring fires",
    description: "POST when an auto-executed scheduled payment goes through.",
  },
];

const WebhooksSettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealedSecretId, setRevealedSecretId] = useState<string | null>(null);

  const load = async () => {
    if (!fullWalletAddress) {
      setWebhooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await listWebhooks(fullWalletAddress);
    if (result.success && result.webhooks) setWebhooks(result.webhooks);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWalletAddress]);

  const atCap = webhooks.length >= MAX_WEBHOOKS;

  const handleAdd = async () => {
    if (!fullWalletAddress) return;
    const trimmed = newUrl.trim();
    if (!trimmed) {
      toast({ title: "URL required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const result = await createWebhook(
      fullWalletAddress,
      trimmed,
      newLabel.trim() || undefined
    );
    setCreating(false);
    if (result.success && result.webhook) {
      setWebhooks((prev) => [result.webhook!, ...prev]);
      setNewUrl("");
      setNewLabel("");
      setExpandedId(result.webhook.id);
      setRevealedSecretId(result.webhook.id);
      toast({ title: "Webhook added", description: "Copy the signing secret below." });
    } else {
      toast({ title: "Couldn't add webhook", description: result.error, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, key: WebhookToggleField, value: boolean) => {
    if (!fullWalletAddress) return;
    const previous = webhooks;
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, [key]: value } : w)));
    setBusyId(id + ":" + key);
    const result = await updateWebhook(fullWalletAddress, id, { [key]: value });
    setBusyId(null);
    if (!result.success) {
      setWebhooks(previous);
      toast({ title: "Couldn't update", description: result.error, variant: "destructive" });
    } else if (key === "enabled" && value) {
      // Server clears consecutive_failures + last_error when re-enabling.
      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, consecutive_failures: 0, last_error: null } : w
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!fullWalletAddress) return;
    setBusyId(id + ":delete");
    const result = await deleteWebhook(fullWalletAddress, id);
    setBusyId(null);
    if (result.success) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Webhook removed" });
    } else {
      toast({ title: "Couldn't delete", description: result.error, variant: "destructive" });
    }
  };

  const handleTest = async (id: string) => {
    if (!fullWalletAddress) return;
    setBusyId(id + ":test");
    const result = await testWebhook(fullWalletAddress, id);
    setBusyId(null);
    if (result.success) {
      toast({
        title: "Test ping delivered",
        description: result.status ? `Endpoint responded ${result.status}.` : undefined,
      });
    } else {
      toast({
        title: "Test ping failed",
        description: result.error,
        variant: "destructive",
      });
    }
    await load();
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <Icon icon="ph:lightning-bold" className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold">Webhooks</h3>
          <p className="text-xs text-muted-foreground">
            POST a JSON payload to any URL on incoming, outgoing, deposit, withdraw,
            x402, or scheduled events. Signed with HMAC SHA-256.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4 mb-3">
              No webhooks registered yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {webhooks.map((wh) => (
                <WebhookRow
                  key={wh.id}
                  webhook={wh}
                  expanded={expandedId === wh.id}
                  secretRevealed={revealedSecretId === wh.id}
                  busy={busyId}
                  onExpand={() =>
                    setExpandedId((cur) => (cur === wh.id ? null : wh.id))
                  }
                  onToggleSecret={() =>
                    setRevealedSecretId((cur) => (cur === wh.id ? null : wh.id))
                  }
                  onToggle={(k, v) => handleToggle(wh.id, k, v)}
                  onTest={() => handleTest(wh.id)}
                  onDelete={() => handleDelete(wh.id)}
                  onCopy={(text, label) => copyText(text, label)}
                />
              ))}
            </ul>
          )}

          {atCap ? (
            <p className="mt-4 text-xs text-muted-foreground">
              You've reached the cap of {MAX_WEBHOOKS} webhooks. Delete one before
              adding another.
            </p>
          ) : (
            <div className="mt-4 space-y-2 pt-4 border-t border-border">
              <p className="text-xs font-medium">Add a webhook</p>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-endpoint.example.com/hook"
                className="bg-background"
              />
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (optional) — e.g. Zapier"
                maxLength={60}
                className="bg-background"
              />
              <Button
                onClick={handleAdd}
                disabled={creating || !newUrl.trim()}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                {creating ? (
                  <>
                    <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
                    Add webhook
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                HTTPS only. Loopback and private-IP hosts are rejected.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

interface WebhookRowProps {
  webhook: Webhook;
  expanded: boolean;
  secretRevealed: boolean;
  busy: string | null;
  onExpand: () => void;
  onToggleSecret: () => void;
  onToggle: (key: WebhookToggleField, value: boolean) => void;
  onTest: () => void;
  onDelete: () => void;
  onCopy: (text: string, label: string) => void;
}

const WebhookRow = ({
  webhook,
  expanded,
  secretRevealed,
  busy,
  onExpand,
  onToggleSecret,
  onToggle,
  onTest,
  onDelete,
  onCopy,
}: WebhookRowProps) => {
  const status = useMemo(() => {
    if (!webhook.enabled) {
      return { icon: "ph:pause-circle-bold", color: "text-muted-foreground", text: "Disabled" };
    }
    if (webhook.consecutive_failures >= 10) {
      return {
        icon: "ph:warning-circle-bold",
        color: "text-red-400",
        text: "Auto-disabled after 10 failures",
      };
    }
    if (webhook.last_error) {
      return { icon: "ph:warning-bold", color: "text-amber-400", text: webhook.last_error };
    }
    if (webhook.last_fired_at) {
      return { icon: "ph:check-circle-bold", color: "text-emerald-400", text: "Healthy" };
    }
    return { icon: "ph:circle-dashed-bold", color: "text-muted-foreground", text: "Never fired" };
  }, [webhook]);

  return (
    <li className="rounded-xl border border-border bg-background/40">
      <button
        type="button"
        onClick={onExpand}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        <Icon icon={status.icon} className={`w-4 h-4 shrink-0 ${status.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {webhook.label && (
              <span className="text-sm font-medium truncate">{webhook.label}</span>
            )}
            <span className="font-mono text-xs text-muted-foreground truncate">
              {webhook.url}
            </span>
          </div>
          <p className={`text-[11px] mt-0.5 ${status.color}`}>{status.text}</p>
        </div>
        <Icon
          icon="ph:caret-down-bold"
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-4 pt-1 space-y-4 border-t border-border">
          <div className="flex items-start justify-between gap-4 pt-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master switch for this URL.
              </p>
            </div>
            <Switch
              checked={webhook.enabled}
              onCheckedChange={(v) => onToggle("enabled", v)}
              disabled={busy === webhook.id + ":enabled"}
            />
          </div>

          {webhook.enabled && (
            <div className="ml-2 pl-4 border-l border-border space-y-3">
              {TOGGLE_ROWS.map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.description}
                    </p>
                  </div>
                  <Switch
                    checked={webhook[row.key]}
                    onCheckedChange={(v) => onToggle(row.key, v)}
                    disabled={busy === webhook.id + ":" + row.key}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium">Signing secret</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-background border border-border rounded px-2 py-1.5 truncate">
                {secretRevealed ? webhook.secret : "•".repeat(28)}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleSecret}
                className="shrink-0"
              >
                <Icon
                  icon={secretRevealed ? "ph:eye-slash-bold" : "ph:eye-bold"}
                  className="w-4 h-4"
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(webhook.secret, "Secret")}
                className="shrink-0"
              >
                <Icon icon="ph:copy-bold" className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Each delivery includes <code>X-BaseUSDP-Signature: sha256=&lt;hex&gt;</code>{" "}
              where hex = HMAC-SHA-256(secret, <code>timestamp.body</code>). Verify it
              before trusting the payload.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={busy === webhook.id + ":test"}
            >
              {busy === webhook.id + ":test" ? (
                <>
                  <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Icon icon="ph:lightning-bold" className="w-4 h-4 mr-2" />
                  Send test ping
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={onDelete}
              disabled={busy === webhook.id + ":delete"}
            >
              <Icon icon="ph:trash-bold" className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};

export default WebhooksSettings;
