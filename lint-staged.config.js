/**
 * lint-staged configuration for BaseUSDP
 * Runs linting and formatting on staged files before commit
 */
module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  '*.{css,scss}': [
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
  ],
};
