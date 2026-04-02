# Relayer Architecture

## What is a Relayer?
The relayer is an off-chain service that submits transactions to the Base network on behalf of users. It is a critical privacy component because it prevents the sender's address from appearing in the transaction.

## Why Relayers Matter for Privacy
Without a relayer:
- The user's address would appear as the transaction sender
- This creates a link between the user and the privacy pool withdrawal
- An observer could correlate timing, gas patterns, and addresses

With a relayer:
- The relayer's address appears as the transaction sender
- The user's proof is submitted anonymously
- No on-chain link between the user and the withdrawal

## Relayer Flow
1. User generates a ZK proof in their browser
2. User sends the proof to the relayer via HTTPS
3. Relayer verifies the proof off-chain
4. Relayer submits the transaction to Base, paying gas
5. Relayer deducts a small fee from the transfer amount
6. Recipient receives funds from the privacy pool contract

## Relayer Security
- The relayer cannot steal funds (the proof specifies the recipient)
- The relayer cannot modify the transfer amount (it is part of the public inputs)
- The relayer cannot learn which deposit is being spent (the proof is zero-knowledge)
- If the relayer goes down, users can self-relay by submitting proofs directly (with reduced privacy)

## Decentralization
Currently, BaseUSDP operates a single relayer. Plans for relayer decentralization include:
- Multiple independent relayers
- Relayer rotation for each transaction
- Decentralized relayer network with staking

## Fees
The relayer charges a small fee (0.1%) to cover gas costs and operational expenses.
