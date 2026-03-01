/**
 * Farcaster Recipient Input
 * Input field with toggle: "ORB402 username" / "Farcaster user"
 * For Farcaster users: resolves via /api/farcaster/resolve-fid (privacy-safe)
 */

import { useState, useEffect, useRef } from "react";
import { Search, User, CheckCircle, XCircle, Loader2 } from "lucide-react";
import farcasterApi from "../services/farcasterApi";

interface FarcasterRecipientInputProps {
  onRecipientResolved: (recipient: {
    type: "orb402" | "farcaster";
    username: string;
    orb402Username?: string;
    hasDeposited?: boolean;
  } | null) => void;
}

type InputMode = "orb402" | "farcaster";

export function FarcasterRecipientInput({
  onRecipientResolved,
}: FarcasterRecipientInputProps) {
  const [mode, setMode] = useState<InputMode>("orb402");
  const [inputValue, setInputValue] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<{
    found: boolean;
    orb402Username?: string | null;
    hasDeposited?: boolean;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Clear previous result
    setResolveResult(null);
    onRecipientResolved(null);

    if (!inputValue.trim()) return;

    // For ORB402 mode, pass directly (no resolution needed)
    if (mode === "orb402") {
      onRecipientResolved({
        type: "orb402",
        username: inputValue.trim(),
      });
      return;
    }

    // For Farcaster mode, debounce and resolve
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const username = inputValue.trim().replace(/^@/, "");
      if (!username) return;

      setIsResolving(true);
      try {
        const result = await farcasterApi.resolveFarcasterUser(username);
        setResolveResult(result);

        if (result.found) {
          onRecipientResolved({
            type: "farcaster",
            username,
            orb402Username: result.orb402Username || undefined,
            hasDeposited: result.hasDeposited,
          });
        }
      } catch {
        setResolveResult({ found: false });
      } finally {
        setIsResolving(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, mode, onRecipientResolved]);

  return (
    <div className="space-y-2">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-0.5 bg-zinc-800 rounded-lg">
        <button
          onClick={() => {
            setMode("orb402");
            setInputValue("");
          }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "orb402"
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          ORB402 Username
        </button>
        <button
          onClick={() => {
            setMode("farcaster");
            setInputValue("");
          }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "farcaster"
              ? "bg-purple-600 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Farcaster User
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            mode === "orb402" ? "Enter ORB402 username" : "Enter Farcaster username"
          }
          className="w-full pl-9 pr-10 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
        />

        {/* Status indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isResolving ? (
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          ) : resolveResult?.found ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : resolveResult && !resolveResult.found ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : inputValue && mode === "orb402" ? (
            <User className="w-4 h-4 text-zinc-400" />
          ) : null}
        </div>
      </div>

      {/* Resolution result */}
      {mode === "farcaster" && resolveResult && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg ${
            resolveResult.found
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {resolveResult.found
            ? resolveResult.orb402Username
              ? `ORB402 user: ${resolveResult.orb402Username} (${resolveResult.hasDeposited ? "has funds" : "no deposits yet"})`
              : "Found on Farcaster (no ORB402 account yet)"
            : "Farcaster user not found"}
        </div>
      )}
    </div>
  );
}
