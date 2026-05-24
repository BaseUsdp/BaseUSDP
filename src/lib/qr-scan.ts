/**
 * Native QR scanning helpers built on the BarcodeDetector API.
 *
 * Supported on:
 *   - Chrome / Edge (desktop + Android)
 *   - Safari on iOS 17+ and macOS 14+
 *   - Brave, Opera, most Chromium derivatives
 *
 * NOT supported (yet) on:
 *   - Firefox
 *   - Old iOS / Safari
 *
 * For unsupported browsers we surface a clear "use Chrome" / "paste URL"
 * message instead of pulling in a 30 KB shim.
 */

export type QrPayload =
  | { kind: "baseusdp-pay"; to: string; amount?: string; token?: "USDC" | "USDT"; memo?: string }
  | { kind: "ethereum-uri"; to: string; amount?: string }
  | { kind: "address"; to: string }
  | { kind: "raw"; value: string };

export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error — BarcodeDetector isn't in lib.dom yet
  return typeof window.BarcodeDetector === "function";
}

export function isCameraSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

/** Parse a scanned string into a structured payload. */
export function parseQrText(raw: string): QrPayload {
  const trimmed = raw.trim();

  // Plain 0x address.
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return { kind: "address", to: trimmed };
  }

  // BASEUSDP-style URL (any subdomain, any path that ends in /pay).
  // Examples:
  //   https://baseusdp.com/pay?to=0x...&amount=10
  //   https://www.baseusdp.com/pay?to=0x...
  //   http://localhost:5173/pay?to=0x...
  try {
    const url = new URL(trimmed);
    if (/\/pay\/?$/.test(url.pathname)) {
      const to = url.searchParams.get("to") || "";
      const amount = url.searchParams.get("amount") || undefined;
      const tokenRaw = (url.searchParams.get("token") || "").toUpperCase();
      const token = tokenRaw === "USDT" ? "USDT" : tokenRaw === "USDC" ? "USDC" : undefined;
      const memo = url.searchParams.get("memo") || undefined;
      if (/^0x[0-9a-fA-F]{40}$/.test(to)) {
        return { kind: "baseusdp-pay", to, amount, token, memo };
      }
    }
  } catch {
    /* not a URL */
  }

  // EIP-681 ethereum: URI (basic — address + optional amount param).
  // ethereum:0xRecipient
  // ethereum:0xRecipient@8453?value=1e18
  // ethereum:0xToken@8453/transfer?address=0xRecipient&uint256=1000000
  const ethMatch = trimmed.match(/^ethereum:(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/(\w+))?(?:\?(.+))?$/);
  if (ethMatch) {
    const targetAddr = ethMatch[1];
    const fnName = ethMatch[3];
    const query = ethMatch[4];
    const params = new URLSearchParams(query || "");
    // If the URI is a token transfer call, the real recipient is the
    // `address` query param; the path address is the token contract.
    if (fnName === "transfer") {
      const recipient = params.get("address");
      const amountUnits = params.get("uint256");
      if (recipient && /^0x[0-9a-fA-F]{40}$/.test(recipient)) {
        return {
          kind: "ethereum-uri",
          to: recipient,
          amount: amountUnits ?? undefined,
        };
      }
    }
    // Plain transfer (native asset).
    return {
      kind: "ethereum-uri",
      to: targetAddr,
      amount: params.get("value") ?? undefined,
    };
  }

  return { kind: "raw", value: trimmed };
}

interface ScanOptions {
  videoEl: HTMLVideoElement;
  onResult: (text: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Start the camera + barcode detection loop. Returns a stop() function
 * that cleans up the stream and the animation frame.
 */
export async function startQrScanner(opts: ScanOptions): Promise<() => void> {
  if (!isBarcodeDetectorSupported()) {
    opts.onError?.(new Error("This browser doesn't support QR scanning. Try Chrome or Safari 17+."));
    return () => undefined;
  }
  if (!isCameraSupported()) {
    opts.onError?.(new Error("No camera available."));
    return () => undefined;
  }

  let stream: MediaStream | null = null;
  let raf = 0;
  let cancelled = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    opts.videoEl.srcObject = stream;
    opts.videoEl.setAttribute("playsinline", "true");
    opts.videoEl.muted = true;
    await opts.videoEl.play();
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      opts.onError?.(new Error("Camera permission denied."));
    } else if (err?.name === "NotFoundError") {
      opts.onError?.(new Error("No camera found."));
    } else {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
    return () => undefined;
  }

  // @ts-expect-error — BarcodeDetector isn't in lib.dom yet
  const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

  const tick = async () => {
    if (cancelled) return;
    try {
      const results = await detector.detect(opts.videoEl);
      if (results && results.length > 0) {
        const text = results[0].rawValue as string;
        if (text) {
          opts.onResult(text);
          cancelled = true;
          return;
        }
      }
    } catch (e) {
      /* ignore per-frame errors; keep scanning */
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    opts.videoEl.srcObject = null;
  };
}
