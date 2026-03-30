# Troubleshooting Guide

## Common Issues and Solutions

### Wallet Connection Issues

**Problem:** Wallet does not connect when clicking "Connect Wallet"
- Ensure your wallet extension is installed and unlocked
- Check that you are on the Base network (Chain ID: 8453)
- Try refreshing the page or clearing browser cache
- Disable other wallet extensions that may conflict

**Problem:** Wrong network detected
- Switch to Base network in your wallet settings
- If Base is not listed, add it manually (see wallet-setup.md)

### Deposit Issues

**Problem:** Deposit transaction fails
- Ensure you have approved USDC spending first
- Check that you have sufficient USDC balance
- Verify you have enough ETH for gas fees
- Try increasing gas limit slightly if transaction reverts

**Problem:** Deposit succeeds but note is not shown
- Check your browser console for errors
- Ensure your browser supports WebAssembly
- Try using a different browser (Chrome or Firefox recommended)
- Contact support with your transaction hash

### Transfer Issues

**Problem:** Proof generation takes too long
- Close other browser tabs to free memory
- Ensure you are using a modern browser with WASM support
- On mobile, proof generation may take 30-60 seconds
- If it exceeds 2 minutes, refresh and try again

**Problem:** Transfer fails after proof generation
- The proof may have expired — generate a new one
- Check that the recipient address is valid
- Ensure you have not already spent this deposit note

### General Issues

**Problem:** Page loads but shows blank content
- Clear browser cache and cookies
- Disable ad blockers or privacy extensions temporarily
- Check browser console for JavaScript errors
- Try incognito/private browsing mode

## Getting Help
- GitHub Issues: github.com/BaseUsdp/BaseUSDP/issues
- Support Email: support@baseusdp.com
- Community Chat: Join our community channels
