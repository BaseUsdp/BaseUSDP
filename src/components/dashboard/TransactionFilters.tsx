import { useState } from "react";
import { motion } from "framer-motion";
import { Filter, ArrowUpDown, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TransactionFilter = "all" | "sent" | "received" | "x402" | "transfer";
export type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

interface TransactionFiltersProps {
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onExportCSV: () => void;
}

const TransactionFilters = ({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  search,
  onSearchChange,
  onExportCSV,
}: TransactionFiltersProps) => {
  const filterOptions: { id: TransactionFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "sent", label: "Sent" },
    { id: "received", label: "Received" },
    { id: "transfer", label: "Transfers" },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by address, hash, or payment ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-secondary border-border h-11"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/10 rounded"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter Chips & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter Chips */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => onFilterChange(option.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  filter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort & Export */}
        <div className="flex items-center gap-3">
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="amount_desc">Amount (High)</SelectItem>
              <SelectItem value="amount_asc">Amount (Low)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={onExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilters;
