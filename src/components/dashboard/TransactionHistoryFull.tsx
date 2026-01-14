import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import TransactionFilters, { TransactionFilter, SortOption } from "./TransactionFilters";
import { cn } from "@/lib/utils";

interface TransactionHistoryFullProps {
  showBalance: boolean;
}

type TransactionStatus = "success" | "pending" | "failed";
type TransactionType = "transfer" | "x402";

interface Transaction {
  id: string;
  type: TransactionType;
  direction: "sent" | "received";
  amount: number;
  amountDisplay: string;
  counterparty: string;
  timestamp: string;
  date: Date;
  status: TransactionStatus;
  txHash: string;
  privacyLevel: "public" | "partial" | "full";
  paymentId?: string;
}

const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const now = new Date();
  
  for (let i = 0; i < 50; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(i / 3));
    date.setHours(Math.floor(Math.random() * 24));
    
    const type: TransactionType = Math.random() > 0.6 ? "x402" : "transfer";
    const direction: "sent" | "received" = Math.random() > 0.5 ? "sent" : "received";
    const amount = Math.floor(Math.random() * 5000) + 10;
    const status: TransactionStatus = Math.random() > 0.9 ? "pending" : Math.random() > 0.95 ? "failed" : "success";
    
    transactions.push({
      id: `tx_${i}`,
      type,
      direction,
      amount,
      amountDisplay: `${direction === "sent" ? "-" : "+"}$${amount.toLocaleString()}.00`,
      counterparty: `0x${Math.random().toString(16).substr(2, 4)}...${Math.random().toString(16).substr(2, 4)}`,
      timestamp: date.toLocaleString(),
      date,
      status,
      txHash: `0x${Math.random().toString(16).substr(2, 12)}...${Math.random().toString(16).substr(2, 6)}`,
      privacyLevel: ["public", "partial", "full"][Math.floor(Math.random() * 3)] as "public" | "partial" | "full",
      paymentId: type === "x402" ? `x402_${Math.random().toString(36).substr(2, 6)}` : undefined,
    });
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const ITEMS_PER_PAGE = 10;

const TransactionHistoryFull = ({ showBalance }: TransactionHistoryFullProps) => {
  const [allTransactions] = useState(generateMockTransactions);
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [sort, setSort] = useState<SortOption>("date_desc");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...allTransactions];

    // Apply filter
    if (filter !== "all") {
      result = result.filter(tx => {
        if (filter === "sent") return tx.direction === "sent";
        if (filter === "received") return tx.direction === "received";
        if (filter === "x402") return tx.type === "x402";
        if (filter === "transfer") return tx.type === "transfer";
        return true;
      });
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(tx =>
        tx.counterparty.toLowerCase().includes(searchLower) ||
        tx.txHash.toLowerCase().includes(searchLower) ||
        (tx.paymentId && tx.paymentId.toLowerCase().includes(searchLower))
      );
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sort) {
        case "date_desc":
          return b.date.getTime() - a.date.getTime();
        case "date_asc":
          return a.date.getTime() - b.date.getTime();
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    return result;
  }, [allTransactions, filter, sort, search]);

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredAndSortedTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Direction", "Amount", "Counterparty", "Status", "Hash"];
    const rows = filteredAndSortedTransactions.map(tx => [
      tx.timestamp,
      tx.type,
      tx.direction,
      tx.privacyLevel === "public" || showBalance ? tx.amountDisplay : "Encrypted",
      tx.counterparty,
      tx.status,
      tx.txHash,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `void402_transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case "success":
        return <Icon icon="ph:check-circle-bold" className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Icon icon="ph:clock-bold" className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case "failed":
        return <Icon icon="ph:x-circle-bold" className="w-4 h-4 text-red-500" />;
    }
  };

  const getAmountDisplay = (tx: Transaction) => {
    if (!showBalance && tx.privacyLevel !== "public") {
      return "Encrypted";
    }
    return tx.amountDisplay;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TransactionFilters
        filter={filter}
        onFilterChange={(f) => { setFilter(f); setCurrentPage(1); }}
        sort={sort}
        onSortChange={setSort}
        search={search}
        onSearchChange={(s) => { setSearch(s); setCurrentPage(1); }}
        onExportCSV={handleExportCSV}
      />

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {paginatedTransactions.length} of {filteredAndSortedTransactions.length} transactions
      </p>

      {/* Transaction List */}
      <div className="space-y-3">
        {paginatedTransactions.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-secondary/30">
            <p className="text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          paginatedTransactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group"
            >
              {/* Direction Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                tx.direction === "sent" ? "bg-red-500/20" : "bg-green-500/20"
              )}>
                {tx.direction === "sent" ? (
                  <Icon icon="ph:arrow-up-right-bold" className="w-5 h-5 text-red-500" />
                ) : (
                  <Icon icon="ph:arrow-down-left-bold" className="w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Transaction Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {tx.direction === "sent" ? `Sent to ${tx.counterparty}` : `Received from ${tx.counterparty}`}
                  </p>
                  {tx.type === "x402" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      x402
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{tx.timestamp}</span>
                  {tx.paymentId && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{tx.paymentId}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Amount & Status */}
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-2">
                  <p className={cn(
                    "font-bold",
                    tx.direction === "sent" ? "text-red-500" : "text-green-500"
                  )}>
                    {getAmountDisplay(tx)}
                  </p>
                  {tx.privacyLevel !== "public" && !showBalance && (
                    <Icon icon="ph:lock-bold" className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {getStatusIcon(tx.status)}
                  <span className="text-xs text-muted-foreground capitalize">{tx.status}</span>
                </div>
              </div>

              {/* External Link */}
              <a
                href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-secondary rounded-lg"
              >
                <Icon icon="ph:arrow-square-out-bold" className="w-4 h-4 text-muted-foreground" />
              </a>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Icon icon="ph:caret-left-bold" className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-9"
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <Icon icon="ph:caret-right-bold" className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryFull;
