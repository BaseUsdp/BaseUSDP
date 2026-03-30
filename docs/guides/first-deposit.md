# First Deposit Guide

## Overview
Depositing USDC into the BaseUSDP privacy pool is the first step toward making private payments. This guide covers the complete deposit flow from start to finish.

## Prerequisites
- A connected wallet with USDC on Base
- A small amount of ETH for gas fees (typically < $0.01 on Base)
- Familiarity with the wallet setup process

## Understanding Deposits
When you deposit USDC into BaseUSDP, your funds enter a privacy pool. The deposit is recorded on-chain, but subsequent transfers within the pool are shielded using zero-knowledge proofs. This means your payment recipients and amounts remain confidential.

## Step-by-Step Deposit

### 1. Navigate to the Deposit Page
Click "Deposit" in the main navigation bar. You will see the deposit form with amount input and tier selection.

### 2. Select a Privacy Tier
BaseUSDP offers multiple privacy tiers based on deposit amount:
- **Tier 1 (1 USDC):** Basic privacy, suitable for testing
- **Tier 2 (10 USDC):** Standard privacy for everyday payments
- **Tier 3 (100 USDC):** Enhanced privacy with larger anonymity set
- **Tier 4 (1000 USDC):** Maximum privacy for high-value transactions

### 3. Approve USDC Spending
If this is your first deposit, you must approve the BaseUSDP contract to spend your USDC. Click "Approve" and confirm the transaction in your wallet.

### 4. Confirm Deposit
After approval, click "Deposit" and confirm the transaction. The deposit will be processed in 1-2 Base blocks (approximately 4 seconds).

### 5. Save Your Note
After a successful deposit, you will receive a deposit note. **Save this note securely** — it is required to withdraw or transfer your funds. Without it, your funds cannot be recovered.

## Gas Costs
Deposits on Base typically cost less than $0.01 in gas fees thanks to the L2 architecture.
