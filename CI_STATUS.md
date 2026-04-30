# CI/CD Status

## GitHub Actions

`.github/workflows/ci.yml` runs on push / PR to `main`.

### Checks
1. **Type check** — `npm run type-check` (`tsc --noEmit`)
2. **Tests** — `npm test` (vitest --run)
3. **Build** — `npm run build` (tsup → `dist/cli.js`)

### Local pre-push
```bash
npm run type-check
npm test
npm run build
node dist/cli.js --version
```

If all four pass, CI will pass.

### Not in CI
- E2E HTTP tests (manual recipe in TESTING.md)
- TUI rendering tests (ink output is not stable to snapshot)
- Auto-deploy (this is a CLI; no deploy target)
