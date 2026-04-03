# Release Process

## Versioning
Follows semver: Major.Minor.Patch

## Checklist
1. All tests passing
2. Changelog updated
3. Version bumped in package.json
4. Security review complete
5. Documentation updated

## Creating a Release
```bash
npm version minor
git push origin main --tags
```
GitHub Actions automatically creates a release with notes.
