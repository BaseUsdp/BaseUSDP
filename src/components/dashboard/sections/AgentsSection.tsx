import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listAgents,
  registerAgent,
  updateAgent,
  deleteAgent,
  generateAgentKey,
  updateAgentPolicy,
  getAgentLogs,
  provisionAgentKitWallet,
  getAgentPassport,
  type AgentProfile,
  type AgentSpendingLogEntry,
  type AgentPassportResponse,
} from "@/services/api";

type AgentView = "list" | "detail" | "register" | "docs";

const AgentsSection = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();

  const [view, setView] = useState<AgentView>("list");
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);

  // Register form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [registering, setRegistering] = useState(false);

  // API Key state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  // Policy editing
  const [policyForm, setPolicyForm] = useState({
    max_per_tx: 1000,
    daily_limit: 5000,
  });

  // Logs
  const [logs, setLogs] = useState<AgentSpendingLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Detail tab
  const [detailTab, setDetailTab] = useState<"overview" | "keys" | "policy" | "logs">("overview");

  // AgentKit state
  const [provisioningWallet, setProvisioningWallet] = useState(false);

  // Passport state
  const [passportData, setPassportData] = useState<AgentPassportResponse["passport"] | null>(null);
  const [passportLoading, setPassportLoading] = useState(false);

  const fetchAgents = async () => {
    if (!fullWalletAddress) return;
    try {
      setLoading(true);
      const result = await listAgents(fullWalletAddress);
      if (result.success) setAgents(result.agents);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [fullWalletAddress]);

  // Keep selectedAgent in sync when agents list refreshes
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find(a => a.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
        setPolicyForm(parsePolicyFromAgent(updated));
      }
    }
  }, [agents]);

  const handleRegister = async () => {
    if (!fullWalletAddress || !newName.trim()) return;
    setRegistering(true);
    try {
      const result = await registerAgent(fullWalletAddress, newName.trim(), newDescription.trim() || undefined);
      if (result.success) {
        toast({ title: "Agent registered", description: `${newName} is ready to configure.` });
        setNewName("");
        setNewDescription("");
        setView("list");
        fetchAgents();
      } else {
        toast({ title: "Registration failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const handleToggleStatus = async (agent: AgentProfile) => {
    if (!fullWalletAddress) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const result = await updateAgent(fullWalletAddress, agent.id, { status: newStatus });
      if (result.success) {
        toast({ title: `Agent ${newStatus}` });
        fetchAgents();
        if (selectedAgent?.id === agent.id && result.agent) {
          setSelectedAgent(result.agent);
        }
      }
    } catch {}
  };

  const handleGenerateKey = async () => {
    if (!fullWalletAddress || !selectedAgent) return;
    setGeneratingKey(true);
    try {
      const result = await generateAgentKey(fullWalletAddress, selectedAgent.id);
      if (result.success && result.key) {
        setGeneratedKey(result.key);
        toast({ title: "API key generated", description: "Copy it now — it won't be shown again." });
      } else {
        toast({ title: "Failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!fullWalletAddress || !selectedAgent) return;
    try {
      const result = await updateAgentPolicy(fullWalletAddress, selectedAgent.id, policyForm);
      if (result.success) {
        toast({ title: "Policy updated" });
        fetchAgents();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleFetchLogs = async () => {
    if (!fullWalletAddress || !selectedAgent) return;
    setLogsLoading(true);
    try {
      const result = await getAgentLogs(fullWalletAddress, selectedAgent.id);
      if (result.success) setLogs(result.logs);
    } catch {} finally {
      setLogsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!fullWalletAddress || !selectedAgent) return;
    setDeleting(true);
    try {
      const result = await deleteAgent(fullWalletAddress, selectedAgent.id);
      if (result.success) {
        toast({ title: "Agent deleted", description: `${selectedAgent.name} has been permanently removed.` });
        setSelectedAgent(null);
        setConfirmDelete(false);
        setView("list");
        fetchAgents();
      } else {
        toast({ title: "Delete failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const parsePolicyFromAgent = (agent: AgentProfile) => {
    const raw = agent.agent_spending_policies;
    const policy = Array.isArray(raw) ? raw[0] : raw;
    return {
      max_per_tx: policy ? (parseFloat(String(policy.max_per_tx)) || 1000) : 1000,
      daily_limit: policy ? (parseFloat(String(policy.daily_limit)) || 5000) : 5000,
    };
  };

  const openDetail = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setDetailTab("overview");
    setGeneratedKey(null);
    setConfirmDelete(false);
    setPolicyForm(parsePolicyFromAgent(agent));
    setPassportData(null);
    setView("detail");
    // Fetch passport data
    if (agent.passport_token_id != null) {
      setPassportLoading(true);
      getAgentPassport(agent.id)
        .then(result => setPassportData(result.passport))
        .catch(() => {})
        .finally(() => setPassportLoading(false));
    }
  };

  // ==================== RENDER ====================

  // Register View
  if (view === "register") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        <div className="mb-2">
          <button onClick={() => setView("list")} className="text-sm text-muted-foreground hover:text-primary mb-2 flex items-center gap-1">
            <Icon icon="ph:arrow-left-bold" className="w-4 h-4" /> Back to Agents
          </button>
          <h1 className="font-display text-3xl font-bold">Register Agent<span className="text-primary">.</span></h1>
          <p className="text-muted-foreground mt-1">Create a new AI agent that can transact on your behalf</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Agent Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Treasury Bot"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
            />
          </div>
          <Button
            onClick={handleRegister}
            disabled={!newName.trim() || registering}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {registering ? (
              <><Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" /> Registering...</>
            ) : (
              <><Icon icon="ph:robot-bold" className="w-4 h-4 mr-2" /> Register Agent</>
            )}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Detail View
  if (view === "detail" && selectedAgent) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        <div className="mb-2">
          <button onClick={() => { setView("list"); setGeneratedKey(null); }} className="text-sm text-muted-foreground hover:text-primary mb-2 flex items-center gap-1">
            <Icon icon="ph:arrow-left-bold" className="w-4 h-4" /> Back to Agents
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Icon icon="ph:robot-bold" className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{selectedAgent.name}</h1>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                selectedAgent.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                selectedAgent.status === "paused" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {selectedAgent.status}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleToggleStatus(selectedAgent)}>
                {selectedAgent.status === "active" ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Icon icon="ph:trash-bold" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation */}
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-4"
          >
            <Icon icon="ph:warning-bold" className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Delete this agent?</p>
              <p className="text-xs text-muted-foreground">This will permanently remove the agent, all API keys, policies, and spending logs.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Icon icon="ph:spinner-bold" className="w-4 h-4 mr-1 animate-spin" /> Deleting...</>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-1">
          {(["overview", "keys", "policy", "logs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setDetailTab(tab);
                if (tab === "logs") handleFetchLogs();
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-t-lg transition-colors capitalize",
                detailTab === tab ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {detailTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Agent ID</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-secondary/50 px-2 py-1 rounded break-all">{selectedAgent.id}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedAgent.id); toast({ title: "Copied!" }); }}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Icon icon="ph:copy-bold" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Owner</p>
                <p className="text-sm font-mono">{selectedAgent.owner_wallet.slice(0, 6)}...{selectedAgent.owner_wallet.slice(-4)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(selectedAgent.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium capitalize">{selectedAgent.status}</p>
              </div>
            </div>
            {selectedAgent.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{selectedAgent.description}</p>
              </div>
            )}

            {/* ERC-8004 Passport */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="ph:identification-badge-bold" className="w-4 h-4 text-violet-400" />
                <p className="text-xs font-medium">On-Chain Identity Passport (ERC-8004)</p>
                {selectedAgent.passport_token_id != null ? (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    selectedAgent.is_revoked ? "bg-red-500/20 text-red-400" :
                    selectedAgent.is_verified ? "bg-sky-500/20 text-sky-400" :
                    "bg-violet-500/20 text-violet-400"
                  )}>
                    {selectedAgent.is_revoked ? "Revoked" : selectedAgent.is_verified ? "Verified" : "Registered"}
                  </span>
                ) : (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">No Passport</span>
                )}
              </div>

              {selectedAgent.passport_token_id != null ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Token ID</p>
                      <p className="text-sm font-mono">#{selectedAgent.passport_token_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trust Score</p>
                      <p className={cn(
                        "text-sm font-bold",
                        (passportData?.trustScore ?? selectedAgent.trust_score ?? 50) >= 70 ? "text-emerald-400" :
                        (passportData?.trustScore ?? selectedAgent.trust_score ?? 50) >= 40 ? "text-yellow-400" :
                        "text-red-400"
                      )}>
                        {passportData?.trustScore ?? selectedAgent.trust_score ?? 50} / 100
                      </p>
                    </div>
                  </div>

                  {/* Registration TX */}
                  {selectedAgent.passport_tx_hash && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Registration TX</p>
                      <a
                        href={`https://basescan.org/tx/${selectedAgent.passport_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-sky-400 hover:underline flex items-center gap-1"
                      >
                        {selectedAgent.passport_tx_hash.slice(0, 10)}...{selectedAgent.passport_tx_hash.slice(-8)}
                        <Icon icon="ph:arrow-square-out-bold" className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Reputation Details */}
                  {passportLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" /> Loading reputation...
                    </div>
                  ) : passportData?.reputation ? (
                    <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                      <p className="text-xs font-medium">Reputation Details</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Positive Signals</p>
                          <p className="text-sm text-emerald-400 font-medium">{passportData.reputation.positiveSignals}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Negative Signals</p>
                          <p className="text-sm text-red-400 font-medium">{passportData.reputation.negativeSignals}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Transactions</p>
                          <p className="text-sm font-medium">{passportData.reputation.txCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Volume</p>
                          <p className="text-sm font-medium">${passportData.reputation.totalVolume}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Passport will be minted automatically on next registration with a wallet.
                </p>
              )}
            </div>

            {/* AgentKit Wallet */}
            <div className="border-t border-border pt-4 opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="ph:wallet-bold" className="w-4 h-4 text-sky-400" />
                <p className="text-xs font-medium">Coinbase AgentKit Wallet</p>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">Soon</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Provision a Coinbase smart wallet for gasless transactions on Base.
              </p>
              <Button
                size="sm"
                disabled
                className="bg-sky-600/50 text-white/50 cursor-not-allowed"
              >
                <Icon icon="ph:wallet-bold" className="w-4 h-4 mr-2" /> Enable AgentKit Wallet
              </Button>
            </div>
          </motion.div>
        )}

        {/* Keys Tab */}
        {detailTab === "keys" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon icon="ph:key-bold" className="w-5 h-5 text-yellow-400" />
                <h3 className="font-display text-lg font-bold">API Keys</h3>
              </div>

              {generatedKey && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-4">
                  <p className="text-xs text-emerald-400 font-medium mb-1">New API Key — copy now, shown once only:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-background px-2 py-1 rounded flex-1 overflow-x-auto">{generatedKey}</code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      toast({ title: "Copied!" });
                    }}>
                      <Icon icon="ph:copy-bold" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={handleGenerateKey} disabled={generatingKey} className="bg-primary hover:bg-primary/90">
                {generatingKey ? (
                  <><Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" /> Generate New Key</>
                )}
              </Button>

              <div className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Use the key in requests via <code className="bg-background px-1 rounded">X-Agent-Key</code> header
                  or <code className="bg-background px-1 rounded">Authorization: AgentKey &lt;key&gt;</code>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Policy Tab */}
        {detailTab === "policy" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Icon icon="ph:shield-check-bold" className="w-5 h-5 text-sky-400" />
              <h3 className="font-display text-lg font-bold">Spending Policy</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Max Per Transaction ($)</label>
                <input
                  type="number"
                  value={policyForm.max_per_tx}
                  onChange={(e) => setPolicyForm(p => ({ ...p, max_per_tx: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Daily Limit ($)</label>
                <input
                  type="number"
                  value={policyForm.daily_limit}
                  onChange={(e) => setPolicyForm(p => ({ ...p, daily_limit: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <Button onClick={handleSavePolicy} className="bg-primary hover:bg-primary/90">
              <Icon icon="ph:floppy-disk-bold" className="w-4 h-4 mr-2" /> Save Policy
            </Button>
          </motion.div>
        )}

        {/* Logs Tab */}
        {detailTab === "logs" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="ph:list-bold" className="w-5 h-5 text-purple-400" />
              <h3 className="font-display text-lg font-bold">Spending Log</h3>
            </div>

            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Icon icon="ph:spinner-bold" className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                    <div className={cn("w-2 h-2 rounded-full",
                      log.status === "completed" ? "bg-emerald-500" :
                      log.status === "blocked" ? "bg-red-500" :
                      log.status === "failed" ? "bg-orange-500" : "bg-yellow-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {log.action} — ${parseFloat(String(log.amount)).toFixed(2)} {log.token}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {log.status}{log.reason ? ` — ${log.reason}` : ""}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Docs View
  if (view === "docs") {
    const baseUrl = "https://www.baseusdp.com";
    const steps = [
      {
        num: 1,
        icon: "ph:key-bold",
        color: "text-yellow-400",
        title: "Generate an API Key",
        description: "Go to your agent's Keys tab → click \"Generate New Key\" → copy the key. Save it somewhere — it's shown once only.",
      },
      {
        num: 2,
        icon: "ph:wallet-bold",
        color: "text-emerald-400",
        title: "Make sure you have pool balance",
        description: "You need funds deposited in your dashboard. If your balance is 0, deposit some USDC first via the Deposit flow.",
      },
      {
        num: 3,
        icon: "ph:magnifying-glass-bold",
        color: "text-emerald-400",
        title: "Test: Check Balance",
        description: "The API key identifies your agent — no agent ID needed in the URL. You should get back your pool balance.",
        code: `curl ${baseUrl}/api/agents/balance \\
  -H "X-Agent-Key: your_api_key_here"`,
      },
      {
        num: 4,
        icon: "ph:paper-plane-tilt-bold",
        color: "text-sky-400",
        title: "Test: Send a Transfer",
        description: "Start with a small amount (e.g., $1). \"to\" accepts a username or 0x address. If successful, you'll get a tx hash back.",
        code: `curl -X POST ${baseUrl}/api/agents/transfer \\
  -H "X-Agent-Key: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "username_or_0xAddress",
    "amount": 1,
    "token": "USDC"
  }'`,
      },
      {
        num: 5,
        icon: "ph:shield-check-bold",
        color: "text-red-400",
        title: "Test: Policy Enforcement",
        description: "Set your policy to something low (e.g., max per tx = $5, daily limit = $10), then try sending more than allowed. This should get blocked by the spending policy.",
        code: `curl -X POST ${baseUrl}/api/agents/transfer \\
  -H "X-Agent-Key: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "0xSomeAddress",
    "amount": 100,
    "token": "USDC"
  }'`,
      },
      {
        num: 6,
        icon: "ph:list-bold",
        color: "text-purple-400",
        title: "Test: Check Spending Logs",
        description: "You should see both the successful and blocked attempts logged.",
        code: `curl ${baseUrl}/api/agents/logs \\
  -H "X-Agent-Key: your_api_key_here"`,
      },
    ];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        <div className="mb-2">
          <button onClick={() => setView("list")} className="text-sm text-muted-foreground hover:text-primary mb-2 flex items-center gap-1">
            <Icon icon="ph:arrow-left-bold" className="w-4 h-4" /> Back to Agents
          </button>
          <h1 className="font-display text-3xl font-bold">API Docs<span className="text-primary">.</span></h1>
          <p className="text-muted-foreground mt-1">Step-by-step guide to test your agent</p>
        </div>

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-border bg-card p-6 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {step.num}
              </div>
              <Icon icon={step.icon} className={cn("w-5 h-5 shrink-0", step.color)} />
              <h3 className="font-display text-lg font-bold">{step.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{step.description}</p>
            {step.code && (
              <div className="rounded-xl bg-secondary/50 p-4 font-mono text-xs overflow-x-auto whitespace-pre">{step.code}</div>
            )}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.04 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-2"
        >
          <div className="flex items-center gap-3 mb-1">
            <Icon icon="ph:lightbulb-bold" className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Quick Tip</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            You can run all of these from your terminal (Git Bash, PowerShell, or any CLI).
            Replace <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-xs">YOUR_AGENT_ID</code> and <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-xs">your_api_key_here</code> with your actual values.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  // List View (default)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Agents<span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage AI agents with programmatic access to your private wallet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setView("docs")}>
            <Icon icon="ph:book-open-bold" className="w-4 h-4 mr-2" /> API Docs
          </Button>
          <Button onClick={() => setView("register")} className="bg-primary hover:bg-primary/90">
            <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" /> New Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Icon icon="ph:spinner-bold" className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-12 text-center"
        >
          <Icon icon="ph:robot-bold" className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold mb-2">No Agents Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first AI agent to enable programmatic transfers with spending controls.
          </p>
          <Button onClick={() => setView("register")} className="bg-primary hover:bg-primary/90">
            <Icon icon="ph:robot-bold" className="w-4 h-4 mr-2" /> Register Your First Agent
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => openDetail(agent)}
              className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                  <Icon icon="ph:robot-bold" className="w-5 h-5 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{agent.name}</h3>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      agent.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                      agent.status === "paused" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    )}>
                      {agent.status}
                    </span>
                    {/* Passport Badge */}
                    {agent.passport_token_id != null ? (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        agent.is_revoked ? "bg-red-500/20 text-red-400" :
                        agent.is_verified ? "bg-sky-500/20 text-sky-400" :
                        "bg-violet-500/20 text-violet-400"
                      )}>
                        {agent.is_revoked ? "Revoked" : agent.is_verified ? "Verified" : "Registered"}
                      </span>
                    ) : null}
                    {/* Trust Score */}
                    {agent.trust_score != null && agent.passport_token_id != null && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        agent.trust_score >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        agent.trust_score >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        Trust: {agent.trust_score}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{agent.description || "No description"}</p>
                </div>
                <Icon icon="ph:caret-right-bold" className="w-4 h-4 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AgentsSection;
