/**
 * Username Creation Component (1:1 with Nolvipay)
 * Shows when user first accesses dashboard without a custom username
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AtSign, ArrowRight, Check, AlertCircle, Loader } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getApiUrl } from "@/utils/apiConfig";

interface UsernameCreationProps {
  onComplete: () => void;
  onBack: () => void;
}

// Username validation
function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username || username.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long" };
  }
  if (username.length > 20) {
    return { isValid: false, error: "Username must be 20 characters or less" };
  }
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return { isValid: false, error: "Username must start with a letter or number" };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, underscores, and hyphens" };
  }
  return { isValid: true };
}

export const UsernameCreation: React.FC<UsernameCreationProps> = ({ onComplete, onBack }) => {
  const { publicKey } = useWallet();
  const [username, setUsernameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const apiUrl = getApiUrl();

  // Validate username in real-time (debounced)
  useEffect(() => {
    if (username.length === 0) {
      setError(null);
      setIsValidating(false);
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters long");
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const timeoutId = setTimeout(async () => {
      const validation = validateUsername(username);

      if (!validation.isValid) {
        setError(validation.error || "Invalid username");
        setIsValidating(false);
        return;
      }

      // Check if username is already taken
      try {
        const response = await fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        if (data.exists && data.wallet_address !== publicKey?.toBase58()) {
          setError("This username is already taken");
          setIsValidating(false);
          return;
        }
      } catch {
        // Continue validation even if check fails
      }

      setError(null);
      setIsValidating(false);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      setIsValidating(false);
    };
  }, [username, publicKey, apiUrl]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove @ if user tries to type it
    const cleanValue = value.replace(/@/g, "");
    setUsernameInput(cleanValue);
    setError(null);
  };

  const handleContinue = async () => {
    if (username.trim().length === 0) {
      setError("Username is required");
      return;
    }

    const validation = validateUsername(username.trim());

    if (!validation.isValid) {
      setError(validation.error || "Invalid username");
      return;
    }

    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsSaving(true);

    try {
      // Check if username is taken first
      const checkResponse = await fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(username)}`);
      const checkData = await checkResponse.json();
      if (checkData.exists && checkData.wallet_address !== publicKey.toBase58()) {
        setError("This username is already taken");
        setIsSaving(false);
        return;
      }

      // Save username
      const saveResponse = await fetch(`${apiUrl}/api/user/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          username: username.trim(),
        }),
      });

      const saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.success) {
        throw new Error(saveData.error || "Failed to save username");
      }

      setIsSaving(false);
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to save username. Please try again.");
      setIsSaving(false);
    }
  };

  const isFormValid = username.trim().length >= 3 && !error && !isValidating;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Glassmorphic Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 md:p-12 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500/20 mb-4"
            >
              <AtSign className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Create Your Username</h1>
            <p className="text-white/60 text-sm sm:text-base">Choose a unique username for your Void402 identity</p>
          </div>

          {/* Wallet Address Display */}
          {publicKey && (
            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-white/40 mb-1 font-mono">Wallet Address</p>
              <p className="text-sm text-white/70 font-mono break-all">{publicKey.toBase58()}</p>
            </div>
          )}

          {/* Username Input */}
          <div className="mb-6">
            <label htmlFor="username" className="block text-sm font-semibold text-white mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <AtSign className="w-5 h-5" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="alice"
                className={`w-full pl-12 pr-12 py-4 rounded-xl bg-white/10 backdrop-blur-sm border-2 transition-all ${
                  error
                    ? "border-red-500/50 focus:border-red-400"
                    : isValidating
                    ? "border-yellow-500/50 focus:border-yellow-400"
                    : isFormValid
                    ? "border-purple-500/50 focus:border-purple-400"
                    : "border-white/20 focus:border-white/40"
                } text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                style={{ fontSize: "1rem" }}
                disabled={isSaving}
                maxLength={20}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isValidating && <Loader className="w-5 h-5 text-yellow-500 animate-spin" />}
                {!isValidating && error && <AlertCircle className="w-5 h-5 text-red-500" />}
                {!isValidating && !error && isFormValid && <Check className="w-5 h-5 text-purple-400" />}
              </div>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {error}
              </motion.p>
            )}
            {!error && username.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-white/50"
              >
                Your username will be: <span className="font-mono font-semibold text-white">@{username}</span>
              </motion.p>
            )}
            <div className="mt-3 text-xs text-white/40 space-y-1">
              <p>• 3-20 characters</p>
              <p>• Letters, numbers, underscores, and hyphens only</p>
              <p>• Must start with a letter or number</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-white/50 leading-relaxed">
              Your username will be used to identify you in transactions. It's unique to your wallet and can be used by
              others to send you payments.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button
              onClick={handleContinue}
              disabled={!isFormValid || isSaving}
              whileHover={isFormValid && !isSaving ? { scale: 1.02 } : {}}
              whileTap={isFormValid && !isSaving ? { scale: 0.98 } : {}}
              className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                isFormValid && !isSaving
                  ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg hover:shadow-xl cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="mt-6 text-sm text-white/50 hover:text-white transition-colors text-center w-full"
        >
          ← Back to home
        </button>
      </motion.div>
    </div>
  );
};

export default UsernameCreation;
