# First Transfer Guide

## Overview
Private transfers are the core feature of BaseUSDP. Once you have deposited USDC into the privacy pool, you can send funds to any Base address without revealing the connection between sender and recipient.

## How Private Transfers Work
BaseUSDP uses zero-knowledge proofs to verify that you have sufficient funds in the privacy pool without revealing which specific deposit belongs to you. The recipient receives clean USDC from the pool with no traceable link to your deposit.

## Making Your First Transfer

### 1. Navigate to the Transfer Page
Click "Transfer" in the main navigation. You will see the transfer form.

### 2. Enter Recipient Details
You can send to:
- A Base wallet address (0x...)
- A BaseUSDP username (if the recipient has registered one)

### 3. Enter Amount
Enter the amount you wish to transfer. The amount must not exceed your deposited balance in the selected privacy tier.

### 4. Generate Proof
Click "Generate Proof". This process happens locally in your browser using WebAssembly and takes 5-15 seconds depending on your device. No private data leaves your browser.

### 5. Submit Transfer
Once the proof is generated, click "Submit Transfer". The transaction will be sent to the Base network and typically confirms within 4 seconds.

### 6. Share Confirmation
You can share the transaction hash with the recipient for verification. The recipient will see incoming USDC but cannot determine the sender.

## Transfer Fees
BaseUSDP charges a small protocol fee on transfers to sustain development. Current fee: 0.3% of the transfer amount. Gas fees on Base are typically under $0.01.

## Privacy Considerations
- Avoid transferring the exact same amount you deposited
- Wait some time between deposit and transfer for better privacy
- Use the recommended privacy tier for your transaction size
