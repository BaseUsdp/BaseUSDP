/**
 * Web NFC helpers. Chrome on Android only at time of writing — Safari /
 * iOS don't expose NDEFReader. We feature-detect and let callers gate UI
 * accordingly.
 *
 * Both write() and scan() require HTTPS (or localhost) and a user gesture.
 */

export type NfcResult =
  | { ok: true }
  | { ok: false; reason: string };

export function isWebNfcSupported(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error — NDEFReader isn't in the standard lib.dom types yet.
  return typeof window.NDEFReader === "function";
}

/**
 * Write a single URL record to an NFC tag. Resolves once the tag is
 * touched and the write completes; rejects on cancel / error / unsupported.
 */
export async function writeUrlToTag(url: string, signal?: AbortSignal): Promise<NfcResult> {
  if (!isWebNfcSupported()) {
    return { ok: false, reason: "Web NFC isn't supported here. Try Chrome on Android." };
  }
  try {
    // @ts-expect-error — NDEFReader isn't in lib.dom yet.
    const ndef = new window.NDEFReader();
    await ndef.write(
      { records: [{ recordType: "url", data: url }] },
      signal ? { signal } : undefined
    );
    return { ok: true };
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, reason: "Cancelled" };
    if (err?.name === "NotAllowedError") {
      return { ok: false, reason: "NFC permission denied" };
    }
    if (err?.name === "NotSupportedError") {
      return { ok: false, reason: "This device doesn't support NFC writes" };
    }
    return { ok: false, reason: err?.message || "NFC write failed" };
  }
}

/**
 * Listen for an NFC tag tap and invoke the callback once with the first
 * URL record found. Returns an unsubscribe function.
 */
export function scanForUrl(
  onUrl: (url: string) => void,
  onError?: (msg: string) => void
): () => void {
  if (!isWebNfcSupported()) {
    onError?.("Web NFC isn't supported here. Try Chrome on Android.");
    return () => undefined;
  }

  const controller = new AbortController();
  let cancelled = false;

  (async () => {
    try {
      // @ts-expect-error — NDEFReader isn't in lib.dom yet.
      const ndef = new window.NDEFReader();
      await ndef.scan({ signal: controller.signal });
      ndef.onreading = (event: any) => {
        if (cancelled) return;
        for (const rec of event.message?.records ?? []) {
          if (rec.recordType === "url" && rec.data) {
            try {
              const decoder = new TextDecoder();
              const url = decoder.decode(rec.data);
              cancelled = true;
              onUrl(url);
              controller.abort();
              return;
            } catch {
              /* swallow */
            }
          }
        }
      };
      ndef.onreadingerror = () => {
        if (!cancelled) onError?.("Couldn't read that tag");
      };
    } catch (err: any) {
      if (cancelled || err?.name === "AbortError") return;
      onError?.(err?.message || "Scan failed");
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
  };
}
