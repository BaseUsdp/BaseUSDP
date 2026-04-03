# Performance Guide

## Targets
- Lighthouse: 95+
- FCP: < 1.5s
- TTI: < 3.0s
- CLS: < 0.1

## Strategies
- Code splitting via Next.js
- Lazy-load WASM and heavy components
- Aggressive caching for static assets
- Web Worker for proof generation
- Monitor with size-limit and Lighthouse CI
