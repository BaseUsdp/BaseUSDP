# ENS & Base Name Resolution

BASEUSDP supports human-readable names in the send flow. Users can type an ENS name (`alice.eth`) or a Base Name (`alice.base`) instead of a raw `0x` address.

## Supported Formats

| Format | Example | Resolution |
|--------|---------|------------|
| ENS | `alice.eth` | ENS registry on Ethereum mainnet |
| Base Name | `alice.base` | Base Name resolver on Base L2 |
| Raw address | `0x1234...abcd` | Returned as-is |

## How It Works

1. User types a name in the recipient field
2. `detectNameType()` classifies the input
3. `useResolveName()` hook debounces input (500ms default)
4. If it's a name, the hook calls `resolveName()` which:
   - Computes the EIP-137 namehash
   - Calls the appropriate on-chain registry's `addr()` function
   - Returns the resolved address or null
5. Resolved addresses are cached in memory for the session

## Architecture

```
User Input
    │
    ▼
detectNameType() ──► "ens" / "basename" / "address" / "unknown"
    │
    ▼
useResolveName() hook (debounced)
    │
    ├── cache hit? → return cached address
    │
    ├── .eth → resolveENS() → ENS Registry (0x00...0C2E)
    │
    └── .base → resolveBaseName() → Base Resolver (0xC6d5...83BCD)
         │
         ▼
    Resolved 0x address (cached for session)
```

## Usage

```tsx
import { useResolveName } from "@/hooks/useResolveName";

function SendForm() {
  const [recipient, setRecipient] = useState("");
  const { address, nameType, isResolving, error } = useResolveName(
    recipient,
    provider
  );

  return (
    <div>
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="alice.eth, alice.base, or 0x..."
      />
      {isResolving && <span>Resolving...</span>}
      {error && <span>{error}</span>}
      {address && <span>→ {address}</span>}
    </div>
  );
}
```

## Caching

Resolved names are cached in a session-scoped `Map`. The cache:
- Persists for the browser session lifetime
- Stores both successful and failed resolutions (to avoid re-querying unresolvable names)
- Is not shared across tabs
- Has no TTL — names are assumed stable within a session

## Limitations

- Subdomains (e.g., `pay.alice.eth`) are not currently supported
- Reverse resolution (address → name) is not implemented
- Cross-chain resolution (e.g., resolving an ENS name on a non-mainnet chain) is not supported
