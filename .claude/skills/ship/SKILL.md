---
name: ship
description: Ship the current work — create a branch, verify, commit, push, open a PR, merge, version bump, and tag. Use when the user says "/ship" or asks to ship their changes.
---

# Ship

Package up the current working-tree or staged changes on `main` and run the full ship workflow (branch → verify → commit → PR → merge → bump → tag).

## Prerequisites

Before starting, confirm:

1. You are on the `main` branch.
2. There are staged or unstaged changes to ship (`git status`). If there are no changes, tell the user and stop.
3. The working tree is otherwise clean (no unrelated uncommitted work). If there is unrelated work mixed in, ask the user to clarify what should be shipped.

## Step 1 — Branch

Analyze the diff (`git diff` and `git diff --cached`) to understand the changes. Determine the conventional commit type (`feat`, `fix`, `docs`, `refactor`, `chore`, etc.) and generate a branch name in the format `type/short-description`.

Create the branch:

```bash
git checkout -b type/short-description
```

Stage all relevant changes if not already staged.

## Step 2 — Verify

Run the full verification suite:

```bash
pnpm check && pnpm build && pnpm test
```

All three must pass. If any fail, fix the issues before continuing. Do not skip verification.

## Step 3 — Commit

Draft a conventional commit message from the diff:

- Format: `type(scope): description`
- Subject: imperative, lowercase, no period, max 72 chars
- Body: omit if the diff is self-explanatory. When included, explain *why* not *what*

Show the proposed commit message to the user and wait for approval. The user may edit it.

Commit with the approved message.

## Step 4 — Push + PR

Push the branch:

```bash
git push -u origin type/short-description
```

Draft a PR title and body. The title should match or closely follow the commit subject. The body should include:

```
## Summary
<1-3 bullet points explaining the change>

## Test plan
- [ ] <verification step as a task list checkbox>
- [ ] <another verification step>

Closes #N (if applicable)
```

Use `- [ ]` task list checkboxes for the test plan — GitHub renders these as interactive checkboxes in the PR UI, and the PR list view shows completion progress (e.g. "2/5 tasks"). Each checkbox should be a concrete verification step (e.g. `- [ ] pnpm check && pnpm build && pnpm test pass`, `- [ ] Manual smoke test of feature X`).

Include GitHub closing references (`Closes #N`, `Fixes #N`) when the change resolves an open issue. Check `gh issue list` or the conversation context for relevant issues. If none apply, omit the line.

Show the proposed PR to the user and wait for approval. Then create it:

```bash
gh pr create --title "..." --body "..."
```

## Step 5 — Merge

Ask the user: **"Ready to merge?"**

Do not auto-merge. Wait for the user to confirm. They may want to wait for CI, review the PR, or make adjustments first.

When the user confirms, merge:

```bash
gh pr merge --squash --delete-branch
```

This auto-switches to `main` and pulls.

## Step 6 — Version bump

Determine the version bump from the commit type:

- `feat` → **minor**
- `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build` → **patch**
- Breaking change (indicated by `!` after the type or `BREAKING CHANGE` in the body) → **major**

Read the current version from `packages/types/package.json`. Compute the new version.

Show the user: **"Bumping version: X.Y.Z → A.B.C (reason). Proceed?"**

Wait for approval. Then update `version` in all three package.jsons:

- `packages/types/package.json`
- `packages/server/package.json`
- `packages/react/package.json`

Commit:

```bash
git add packages/types/package.json packages/server/package.json packages/react/package.json
git commit -m "chore: release vA.B.C"
```

## Step 7 — Tag + push

```bash
git tag vA.B.C
git push origin main vA.B.C
```

The tag must point at the version bump commit, not the feature commit.

## Done

Print a summary:

- Branch: `type/short-description`
- Commit: `type(scope): description`
- PR: (link)
- Version: `vA.B.C`

## Rules

- Never skip verification (step 2).
- Always get user approval for: commit message, PR title/body, merge timing, and version bump.
- If anything fails, stop and address it — do not barrel through.
- One ship per invocation.
