/**
 * Renders a transaction counterparty as either its internal @handle, its
 * resolved ENS / Basenames name, or "Unknown" when neither is available.
 *
 * Pass the full address (or @handle) — not a pre-truncated string. We
 * need the unmodified address to do reverse resolution.
 */

import { useEnsName } from "@/hooks/useEnsName";

interface Props {
  value: string | undefined | null;
  className?: string;
  unknownLabel?: string;
  loadingLabel?: string;
}

const UNKNOWN_DEFAULT = "Unknown";

const AddressDisplay = ({
  value,
  className,
  unknownLabel = UNKNOWN_DEFAULT,
  loadingLabel = "…",
}: Props) => {
  const isHandle = !!value && value.startsWith("@");
  const isFullAddress = !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
  const { name, isLoading } = useEnsName(isFullAddress ? value : null);

  if (isHandle) return <span className={className}>{value}</span>;

  if (isFullAddress) {
    if (isLoading) {
      return (
        <span className={className} style={{ opacity: 0.6 }}>
          {loadingLabel}
        </span>
      );
    }
    return <span className={className}>{name ?? unknownLabel}</span>;
  }

  return <span className={className}>{unknownLabel}</span>;
};

export default AddressDisplay;
