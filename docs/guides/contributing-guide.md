# Contributing Guide (Extended)

## Finding Issues to Work On
- Check issues labeled `good first issue` for beginner-friendly tasks
- Issues labeled `help wanted` are looking for community contributions
- Issues labeled `bounty` have associated rewards

## Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following our coding standards
4. Write tests for new functionality
5. Run the full test suite: `npm test`
6. Commit using conventional commits: `feat: add new feature`
7. Push to your fork and open a PR

## Coding Standards
- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier for formatting (runs on pre-commit)
- Maximum line length: 100 characters
- Use descriptive variable and function names
- Add JSDoc comments for exported functions

## Testing Guidelines
- Unit tests for utility functions and hooks
- Integration tests for API routes
- Component tests with React Testing Library
- Aim for 80%+ code coverage

## PR Review Process
1. Automated checks must pass
2. At least one maintainer review required
3. Security-sensitive changes need security team review
4. Documentation updates for user-facing changes
5. Changelog entry for notable changes
