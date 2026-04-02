# API Error Codes

## Overview
BaseUSDP API uses standard HTTP status codes with detailed error bodies for all error responses.

## Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

## Error Codes Reference

### Authentication Errors (401)
| Code | Description |
|------|-------------|
| `AUTH_MISSING` | No authorization header provided |
| `AUTH_INVALID_TOKEN` | JWT token is invalid or malformed |
| `AUTH_EXPIRED` | JWT token has expired |
| `AUTH_INVALID_SIGNATURE` | Wallet signature verification failed |
| `AUTH_NONCE_EXPIRED` | Authentication nonce has expired |
| `AUTH_NONCE_USED` | Nonce has already been used |

### Validation Errors (400)
| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Wallet address format is invalid |
| `INVALID_AMOUNT` | Amount is not a valid number or out of range |
| `INVALID_TIER` | Requested privacy tier does not exist |
| `INVALID_PROOF` | Zero-knowledge proof verification failed |
| `INVALID_USERNAME` | Username does not meet requirements |
| `AMOUNT_MISMATCH` | Amount does not match selected tier |

### Resource Errors (404/409)
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Requested resource does not exist |
| `USERNAME_TAKEN` | Username is already registered |
| `NULLIFIER_SPENT` | Deposit note has already been spent |
| `PAYMENT_EXPIRED` | Payment request has expired |

### Server Errors (500)
| Code | Description |
|------|-------------|
| `INTERNAL_ERROR` | Unexpected server error |
| `RELAYER_UNAVAILABLE` | Relayer service is temporarily unavailable |
| `CHAIN_ERROR` | Base network interaction failed |
| `MERKLE_ROOT_STALE` | Merkle root has changed since proof generation |
