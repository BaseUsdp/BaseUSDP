import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface GovernanceSectionProps {
  showBalance: boolean;
}

const GovernanceSection = ({ showBalance }: GovernanceSectionProps) => {
  const [selectedProposal, setSelectedProposal] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState<Record<number, string>>({});

  const proposals = [
    {
      id: 1,
      title: "VIP-001: Increase Yield Vault APY Cap",
      description: "Proposal to increase the maximum APY cap for yield vaults from 50% to 75% to remain competitive with other DeFi protocols.",
      status: "active",
      endTime: "2 days left",
      votesFor: 65,
      votesAgainst: 35,
      quorum: 45,
      requiredQuorum: 40,
      author: "3nFv...8kLz",
      category: "Protocol Parameters"
    },
    {
      id: 2,
      title: "VIP-002: Add Support for New Token",
      description: "Integrate a new token into the USDP ecosystem, enabling encrypted transfers and yield generation.",
      status: "active",
      endTime: "4 days left",
      votesFor: 78,
      votesAgainst: 22,
      quorum: 52,
      requiredQuorum: 40,
      author: "7xKq...9mPw",
      category: "Token Addition"
    },
    {
      id: 3,
      title: "VIP-003: Treasury Allocation for Marketing",
      description: "Allocate 5% of treasury funds for Q1 2026 marketing initiatives and partnership development.",
      status: "passed",
      endTime: "Ended Jan 5",
      votesFor: 82,
      votesAgainst: 18,
      quorum: 61,
      requiredQuorum: 40,
      author: "9hGt...2rYs",
      category: "Treasury"
    },
  ];

  const handleVote = (proposalId: number, vote: string) => {
    setHasVoted(prev => ({ ...prev, [proposalId]: vote }));
  };

  const userStats = {
    votingPower: "12,500",
    proposalsVoted: 8,
    delegatedTo: null,
    stakedTokens: "12,500"
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Governance<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Participate in protocol decisions with encrypted voting
        </p>
      </div>

      {/* User Voting Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:trophy-bold" className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Voting Power</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {showBalance ? userStats.votingPower : "••••••"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">VOID tokens</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:hand-fist-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Proposals Voted</span>
          </div>
          <p className="text-2xl font-display font-bold">{userStats.proposalsVoted}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:coins-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Staked Tokens</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {showBalance ? userStats.stakedTokens : "••••••"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">VOID</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:users-three-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Delegated To</span>
          </div>
          <p className="text-2xl font-display font-bold">Self</p>
          <Button variant="link" size="sm" className="p-0 h-auto text-xs text-primary">
            Delegate
          </Button>
        </motion.div>
      </div>

      {/* Active Proposals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Icon icon="ph:hand-fist-bold" className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Active Proposals</h3>
              <p className="text-xs text-muted-foreground">Vote on protocol changes</p>
            </div>
          </div>
          <Button variant="outline">
            <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
            Create Proposal
          </Button>
        </div>

        <div className="space-y-4">
          {proposals.filter(p => p.status === "active").map((proposal) => (
            <div
              key={proposal.id}
              className={cn(
                "rounded-xl border p-5 transition-all cursor-pointer",
                selectedProposal === proposal.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => setSelectedProposal(selectedProposal === proposal.id ? null : proposal.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500 font-medium">
                      Active
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                      {proposal.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-lg">{proposal.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{proposal.description}</p>
                </div>
                <Icon icon="ph:caret-right-bold" className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  selectedProposal === proposal.id && "rotate-90"
                )} />
              </div>

              {/* Voting Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-500 font-medium">For: {proposal.votesFor}%</span>
                  <span className="text-red-500 font-medium">Against: {proposal.votesAgainst}%</span>
                </div>
                <div className="h-3 rounded-full bg-red-500/20 overflow-hidden flex">
                  <div 
                    className="h-full bg-green-500 rounded-l-full"
                    style={{ width: `${proposal.votesFor}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Quorum: {proposal.quorum}% / {proposal.requiredQuorum}%</span>
                  <span className="flex items-center gap-1">
                    <Icon icon="ph:clock-bold" className="w-3 h-3" />
                    {proposal.endTime}
                  </span>
                </div>
              </div>

              {/* Expanded Actions */}
              {selectedProposal === proposal.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-4 border-t border-border"
                >
                  {hasVoted[proposal.id] ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <Icon icon="ph:check-circle-bold" className="w-5 h-5" />
                      <span className="font-medium">
                        You voted {hasVoted[proposal.id] === "for" ? "For" : "Against"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(proposal.id, "for");
                        }}
                        className="flex-1 bg-green-500 hover:bg-green-600"
                      >
                        <Icon icon="ph:check-circle-bold" className="w-4 h-4 mr-2" />
                        Vote For
                      </Button>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(proposal.id, "against");
                        }}
                        variant="outline"
                        className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                      >
                        <Icon icon="ph:x-circle-bold" className="w-4 h-4 mr-2" />
                        Vote Against
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <div className="flex items-start gap-2">
                      <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Your vote is protected using ZK proofs. Vote counts are verifiable but individual choices remain private.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Past Proposals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <h3 className="font-display text-lg font-bold mb-6">Past Proposals</h3>

        <div className="space-y-3">
          {proposals.filter(p => p.status !== "active").map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30"
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                proposal.status === "passed" ? "bg-green-500/20" : "bg-red-500/20"
              )}>
                {proposal.status === "passed" ? (
                  <Icon icon="ph:check-circle-bold" className="w-5 h-5 text-green-500" />
                ) : (
                  <Icon icon="ph:x-circle-bold" className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{proposal.title}</p>
                <p className="text-xs text-muted-foreground">{proposal.endTime}</p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-sm font-bold",
                  proposal.status === "passed" ? "text-green-500" : "text-red-500"
                )}>
                  {proposal.status === "passed" ? "Passed" : "Failed"}
                </span>
                <p className="text-xs text-muted-foreground">
                  {proposal.votesFor}% For
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GovernanceSection;