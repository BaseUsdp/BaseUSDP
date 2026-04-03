# Code Style Guide

## TypeScript
- Strict mode enabled; prefer `const` over `let`
- Explicit return types on exported functions
- Interfaces over type aliases for objects
- Avoid `any`

## React
- Functional components with hooks
- Named exports (not default)
- Components under 200 lines

## Naming
- Files: kebab-case
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE

## Import Order
1. External packages
2. Internal (`@/...`)
3. Relative
4. Type-only imports
