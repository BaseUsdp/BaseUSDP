/**
 * Renders a transaction counterparty as either its internal @handle, its
 * resolved ENS / Basenames name, or "Unknown" when neither is available.
 *
 * Pass the full address (or @handle) — not a pre-truncated string. We
 * need the unmodified address to do reverse resolution.
 *
 * Set `showAvatar` to also render the recipient's Basenames avatar via
 * OnchainKit. When the displayed `value` is a @handle, pass the underlying
 * address as `avatarAddress` so the avatar can still resolve.
 */

import { Avatar } from "@coinbase/onchainkit/identity";
import { base } from "viem/chains";
import { useEnsName } from "@/hooks/useEnsName";

interface Props {
  value: string | undefined | null;
  className?: string;
  unknownLabel?: string;
  loadingLabel?: string;
  showAvatar?: boolean;
  avatarAddress?: string | null;
  avatarClassName?: string;
}

const UNKNOWN_DEFAULT = "Unknown";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const AddressDisplay = ({
  value,
  className,
  unknownLabel = UNKNOWN_DEFAULT,
  loadingLabel = "…",
  showAvatar = false,
  avatarAddress,
  avatarClassName = "w-5 h-5 rounded-full",
}: Props) => {
  const isHandle = !!value && value.startsWith("@");
  const isFullAddress = !!value && ADDRESS_RE.test(value);
  const { name, isLoading } = useEnsName(isFullAddress ? value : null);

  const avatarSource = isFullAddress
    ? value
    : avatarAddress && ADDRESS_RE.test(avatarAddress)
    ? avatarAddress
    : null;

  const avatar = showAvatar && avatarSource ? (
    <Avatar
      address={avatarSource as `0x${string}`}
      chain={base}
      className={avatarClassName}
    />
  ) : null;

  let label: React.ReactNode;
  if (isHandle) {
    label = value;
  } else if (isFullAddress) {
    if (isLoading) {
      label = (
        <span style={{ opacity: 0.6 }}>{loadingLabel}</span>
      );
    } else {
      label = name ?? unknownLabel;
    }
  } else {
    label = unknownLabel;
  }

  if (!avatar) return <span className={className}>{label}</span>;

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {avatar}
      <span>{label}</span>
    </span>
  );
};

export default AddressDisplay;
