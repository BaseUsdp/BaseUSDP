import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Share2, 
  Trash2,
  ExternalLink,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RequestStatus = "pending" | "paid" | "expired" | "cancelled";

interface PaymentRequest {
  id: string;
  serviceName: string;
  amount: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
  expiresAt?: string;
  paidBy?: string;
  txHash?: string;
}

const mockRequests: PaymentRequest[] = [
  {
    id: "x402_abc123",
    serviceName: "Premium API Access",
    amount: "50.00",
    description: "Monthly subscription",
    status: "pending",
    createdAt: "2026-01-12T10:00:00Z",
    expiresAt: "2026-01-19T10:00:00Z",
  },
  {
    id: "x402_def456",
    serviceName: "Data Export",
    amount: "25.00",
    description: "One-time export fee",
    status: "paid",
    createdAt: "2026-01-10T14:30:00Z",
    paidBy: "7xKq...9mPw",
    txHash: "5xYz...AbCd",
  },
  {
    id: "x402_ghi789",
    serviceName: "Enterprise License",
    amount: "500.00",
    description: "Annual license",
    status: "expired",
    createdAt: "2026-01-01T09:00:00Z",
    expiresAt: "2026-01-08T09:00:00Z",
  },
  {
    id: "x402_jkl012",
    serviceName: "Consulting Session",
    amount: "150.00",
    description: "1-hour consultation",
    status: "cancelled",
    createdAt: "2026-01-05T16:00:00Z",
  },
];

interface X402RequestsManagementProps {
  onCreateNew: () => void;
}

const X402RequestsManagement = ({ onCreateNew }: X402RequestsManagementProps) => {
  const [requests, setRequests] = useState(mockRequests);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filteredRequests = statusFilter === "all" 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const getStatusConfig = (status: RequestStatus) => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "bg-yellow-500/20 text-yellow-500", label: "Pending" };
      case "paid":
        return { icon: CheckCircle2, color: "bg-green-500/20 text-green-500", label: "Paid" };
      case "expired":
        return { icon: AlertCircle, color: "bg-gray-500/20 text-gray-500", label: "Expired" };
      case "cancelled":
        return { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Cancelled" };
    }
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(`https://void402.app/pay/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCancel = (id: string) => {
    setRequests(prev => 
      prev.map(r => r.id === id ? { ...r, status: "cancelled" as RequestStatus } : r)
    );
    setCancelDialog(null);
  };

  const statusFilters: { id: RequestStatus | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "paid", label: "Paid" },
    { id: "expired", label: "Expired" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Download className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Payment Requests</h3>
            <p className="text-xs text-muted-foreground">Manage your x402 payment requests</p>
          </div>
        </div>
        <Button onClick={onCreateNew} className="bg-accent hover:bg-accent/90">
          <Download className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              statusFilter === filter.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {filter.label}
            {filter.id !== "all" && (
              <span className="ml-2 text-xs opacity-70">
                ({requests.filter(r => r.status === filter.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 rounded-2xl bg-secondary/30"
            >
              <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payment requests found</p>
              <Button onClick={onCreateNew} variant="outline" className="mt-4">
                Create your first request
              </Button>
            </motion.div>
          ) : (
            filteredRequests.map((request, i) => {
              const statusConfig = getStatusConfig(request.status);
              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold truncate">{request.serviceName}</h4>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          statusConfig.color
                        )}>
                          <statusConfig.icon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                        {request.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono">{request.id}</span>
                        <span>•</span>
                        <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                        {request.status === "paid" && request.paidBy && (
                          <>
                            <span>•</span>
                            <span>Paid by {request.paidBy}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-2xl font-display font-bold">${request.amount}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(request.id)}
                      className="flex-1"
                    >
                      {copied === request.id ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    
                    <Button variant="outline" size="sm">
                      <QrCode className="w-4 h-4" />
                    </Button>
                    
                    <Button variant="outline" size="sm">
                      <Share2 className="w-4 h-4" />
                    </Button>

                    {request.status === "paid" && request.txHash && (
                      <a
                        href={`https://sepolia.basescan.org/tx/${request.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}

                    {request.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelDialog(request.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Cancel Payment Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this payment request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>
              Keep Request
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => cancelDialog && handleCancel(cancelDialog)}
            >
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default X402RequestsManagement;
