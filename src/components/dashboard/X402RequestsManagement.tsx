import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
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
  QrCode,
  Loader2,
  RefreshCw,
  X
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
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";
import QRCode from "qrcode";

type RequestStatus = "pending" | "settled" | "failed" | "expired" | "cancelled";

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
  paymentHash?: string;
}

interface X402RequestsManagementProps {
  onCreateNew: () => void;
}

const X402RequestsManagement = ({ onCreateNew }: X402RequestsManagementProps) => {
  const { fullWalletAddress, activeChain } = useWallet();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ id: string; qrCode: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get the payment URL for a request
  const getPaymentUrl = (id: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pay/${id}`;
  };

  // Load payment requests from backend API
  const loadRequests = useCallback(async () => {
    if (!fullWalletAddress) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/payments/list?wallet=${fullWalletAddress}`);
      const data = await response.json();

      if (data.success && data.payments) {
        setRequests(data.payments);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error("Error loading payment requests:", err);
      setError("Failed to load payment requests");
    } finally {
      setIsLoading(false);
    }
  }, [fullWalletAddress]);

  // Refresh payment requests from backend
  const refreshStatuses = useCallback(async () => {
    if (!fullWalletAddress) return;
    
    setIsRefreshing(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/payments/list?wallet=${fullWalletAddress}`);
      const data = await response.json();

      if (data.success && data.payments) {
        setRequests(data.payments);
      }
    } catch (err) {
      console.error("Error refreshing statuses:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [fullWalletAddress]);

  useEffect(() => {
    loadRequests();
    
    // Refresh every 30 seconds
    const interval = setInterval(refreshStatuses, 30000);
    return () => clearInterval(interval);
  }, [loadRequests, refreshStatuses]);

  // Listen for new payment requests created
  useEffect(() => {
    const handleNewRequest = () => {
      // Reload from backend after a short delay (give DB time to propagate)
      setTimeout(() => loadRequests(), 500);
    };
    
    window.addEventListener("paymentRequestCreated", handleNewRequest);
    
    return () => {
      window.removeEventListener("paymentRequestCreated", handleNewRequest);
    };
  }, [loadRequests]);

  const filteredRequests = statusFilter === "all" 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const getStatusConfig = (status: RequestStatus) => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "bg-yellow-500/20 text-yellow-500", label: "Pending" };
      case "settled":
        return { icon: CheckCircle2, color: "bg-green-500/20 text-green-500", label: "Settled" };
      case "failed":
        return { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Failed" };
      case "expired":
        return { icon: AlertCircle, color: "bg-gray-500/20 text-gray-500", label: "Expired" };
      case "cancelled":
        return { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Cancelled" };
    }
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(getPaymentUrl(id));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCancel = async (id: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/payments/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: id, wallet: fullWalletAddress }),
      });
      const data = await response.json();

      if (data.success) {
        // Update UI locally
        setRequests(prev => prev.map(r => 
          r.id === id ? { ...r, status: "cancelled" as RequestStatus } : r
        ));
      } else {
        console.error("Cancel API returned error:", data.error);
        // Still update UI locally for better UX, then reload from DB
        setRequests(prev => prev.map(r => 
          r.id === id ? { ...r, status: "cancelled" as RequestStatus } : r
        ));
        // Reload from backend after a short delay to sync
        setTimeout(() => loadRequests(), 1000);
      }
    } catch (err) {
      console.error("Error cancelling payment:", err);
      // Update UI locally even if network fails
      setRequests(prev => prev.map(r => 
        r.id === id ? { ...r, status: "cancelled" as RequestStatus } : r
      ));
    }
    setCancelDialog(null);
  };

  const handleShowQR = async (id: string) => {
    try {
      const url = getPaymentUrl(id);
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrModal({ id, qrCode: qrCodeDataUrl });
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  const handleShare = async (request: PaymentRequest) => {
    const url = getPaymentUrl(request.id);
    const shareData = {
      title: `Payment Request: ${request.serviceName}`,
      text: `Pay $${request.amount} for ${request.description}`,
      url: url,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(url);
        setCopied(request.id);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch (err) {
      // User cancelled or share failed, fallback to copy
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(url);
        setCopied(request.id);
        setTimeout(() => setCopied(null), 2000);
      }
    }
  };

  const statusFilters: { id: RequestStatus | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "settled", label: "Settled" },
    { id: "failed", label: "Failed" },
    { id: "expired", label: "Expired" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Icon icon="ph:download-bold" className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Payment Requests</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Manage your payment requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatuses}
            disabled={isRefreshing}
            className="h-9"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button onClick={onCreateNew} className="bg-accent hover:bg-accent/90 h-9">
            <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>
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
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
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
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 rounded-2xl border border-border bg-card"
            >
              <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading payment requests...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 rounded-2xl border border-border bg-card"
            >
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-2">{error}</p>
              <Button onClick={loadRequests} variant="outline" size="sm">
                Retry
              </Button>
            </motion.div>
          ) : filteredRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 rounded-2xl border border-border bg-card"
            >
              <Icon icon="ph:download-bold" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No payment requests found</p>
              <p className="text-xs text-muted-foreground mb-4">
                {statusFilter !== "all" ? "Try a different filter" : "Create your first payment request"}
              </p>
              <Button onClick={onCreateNew} variant="outline" size="sm">
                <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
                Create Request
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
                        {request.status === "settled" && request.paidBy && (
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
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleShowQR(request.id)}
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleShare(request)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>

                    {request.status === "settled" && request.txHash && (
                      <a
                        href={activeChain === "base" ? `https://basescan.org/tx/${request.txHash}` : `https://solscan.io/tx/${request.txHash}`}
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

      {/* QR Code Modal */}
      <Dialog open={!!qrModal} onOpenChange={() => setQrModal(null)}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Payment QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this QR code to pay this request
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrModal && (
              <>
                <img 
                  src={qrModal.qrCode} 
                  alt="Payment QR Code" 
                  className="w-64 h-64 rounded-lg border border-border"
                />
                <p className="mt-4 text-xs text-muted-foreground font-mono">
                  {qrModal.id}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => qrModal && handleCopy(qrModal.id)}
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button onClick={() => setQrModal(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default X402RequestsManagement;
