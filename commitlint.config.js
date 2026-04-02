/**
 * Commitlint configuration for BaseUSDP
 * Enforces conventional commit messages
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting, whitespace
        'refactor', // Code restructuring
        'perf',     // Performance improvement
        'test',     // Tests
        'build',    // Build system
        'ci',       // CI/CD
        'chore',    // Maintenance
        'revert',   // Revert changes
        'security', // Security fix
      ],
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200],
  },
};
