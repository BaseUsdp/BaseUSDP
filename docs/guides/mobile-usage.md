# Mobile Usage Guide

## Overview
BaseUSDP is designed as a progressive web application (PWA) that works seamlessly on mobile devices. This guide covers optimal mobile usage patterns and tips.

## Supported Mobile Wallets
- **Coinbase Wallet** (iOS/Android) — Recommended for mobile use
- **MetaMask Mobile** (iOS/Android) — Full featured mobile wallet
- **Rainbow** (iOS/Android) — Clean interface with Base support

## Installing as a PWA

### iOS (Safari)
1. Open baseusdp.com in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Name the app and tap "Add"

### Android (Chrome)
1. Open baseusdp.com in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"
4. Confirm the installation

## Mobile-Specific Tips
- Use the in-app browser within your mobile wallet for the best experience
- Enable biometric authentication in your wallet for faster approvals
- Keep your wallet app updated for the latest security patches
- Proof generation on mobile takes 15-30 seconds longer than desktop

## QR Code Payments
On mobile, you can scan QR codes to quickly fill in payment details. This is especially useful for in-person payments at merchants that accept BaseUSDP.

## Data Usage
BaseUSDP downloads approximately 2-5 MB of WASM files on first load. After initial caching, subsequent visits use minimal data. Proof generation is CPU-intensive but does not require additional data transfer.

## Battery Considerations
ZK proof generation is computationally intensive and may drain battery faster. For best results, ensure your device has at least 20% battery before generating proofs.
