import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

const SmsOfflineBadge = ({ queuedCount }: { queuedCount: number }) => {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && queuedCount === 0) return null;

  const color = online ? "hsl(var(--beam-amber))" : "#ef4444";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        borderColor: color,
        color,
        background: online ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
      }}
    >
      <Icon
        icon={online ? "ph:queue-bold" : "ph:wifi-slash-bold"}
        className="h-3 w-3"
      />
      {online
        ? `${queuedCount} queued`
        : `Offline · ${queuedCount} queued`}
    </span>
  );
};

export default SmsOfflineBadge;
