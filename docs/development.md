# Development

## Setup

```bash
git clone https://github.com/quantumleeps/neeter.git
cd neeter
pnpm install        # installs deps + activates lefthook git hooks
```

For secret scanning, install [gitleaks](https://github.com/gitleaks/gitleaks):

```bash
brew install gitleaks
```

If gitleaks isn't installed, the hook skips gracefully — all other hooks still run.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm check` | Biome lint + format |
| `pnpm build` | TypeScript compilation |
| `pnpm test` | Vitest unit tests |

## Pre-commit hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs these checks on every commit (configured in `lefthook.yml`):

| Hook | What it does |
|------|-------------|
| **biome** | Lint + format staged `.ts`, `.tsx`, `.js`, `.json`, `.css` files |
| **gitleaks** | Scan for secrets, API keys, and tokens (requires `gitleaks` binary) |
| **large-files** | Block files over 500KB (excludes `pnpm-lock.yaml`) |
| **private-key** | Block `.pem`, `.key`, `.p12`, `.pfx` files |
| **merge-conflict** | Catch leftover conflict markers |
| **pii-check** | Scan for SSNs, phone numbers, and email addresses |

## CI

Pull requests to `main` run lint, build, and test via GitHub Actions. See `.github/workflows/ci.yml`.

[Dependabot](https://docs.github.com/en/code-security/dependabot) opens weekly PRs for npm and GitHub Actions dependency updates.
