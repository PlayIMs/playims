# Testing Guide

## Why This Exists

PlayIMs uses a pragmatic TDD workflow so Codex knows when to slow down and protect behavior, and when to stay fast for trivial changes.

Technical Explanation:

- We use a server-first Vitest setup for route handlers, validation helpers, and backend business logic.
- We do **not** force full tests-first loops on every cosmetic UI tweak.
- The goal is reliable feedback loops, not ceremony for ceremony's sake.

## Commands

```bash
# Full Vitest suite
pnpm test

# Watch mode for local red -> green loops
pnpm test:watch

# Type-checking
pnpm check

# Final local verification gate
pnpm verify
```

Use the narrowest test command you can while working, then finish with `pnpm verify`.

## Choose A Testing Tier First

Every task should start by choosing one tier.

### 1. Full TDD

Use this for:

- `src/routes/api/**`
- `src/hooks.server.ts`
- `src/lib/server/**`
- `src/lib/database/operations/**`
- auth, validation, permissions, data mutations, business rules
- bug fixes that change behavior

Default loop:

1. Find existing tests.
2. If the area is older and untested, write characterization tests first.
3. Write the next failing test.
4. Run the narrowest relevant test command.
5. Implement the minimum code needed to go green.
6. Re-run tests until green.
7. Finish with `pnpm verify`.

### 2. Relaxed

Use this for:

- colors, spacing, typography, icons
- copy edits
- static markup reshaping
- trivial prop passthrough with no new logic

Default loop:

1. Implement directly.
2. Manually verify the changed screen or interaction.
3. Add 0-2 regression tests only if the behavior could realistically break later.
4. Run the lightest sensible validation command.

### 3. Escalate To Full TDD

If a "UI change" adds any of the following, it is no longer relaxed:

- conditional logic
- state transitions
- validation
- filtering or sorting
- permissions
- non-trivial data shaping

At that point, switch back to Full TDD.

## Codex Workflow For New Backend Work

Use this default sequence when Codex is changing server logic:

1. State that the task is using the **Full TDD** tier.
2. Check for relevant tests under `tests/`.
3. Add or update a failing regression test first.
4. Run the smallest relevant Vitest target.
5. Implement the fix or feature.
6. Re-run the focused test.
7. Run `pnpm verify` before finishing.

## Characterize First, Then Change

When you touch older backend code with weak coverage:

1. Read the current implementation.
2. Write characterization tests that document what it does today.
3. Make those tests pass on current code.
4. Add the new failing test for the intended change.
5. Implement the change.

This protects you from breaking existing behavior while the suite is still growing.

## Manual Checklist For Trivial UI Work

- Open the affected page or flow in `pnpm dev`.
- Confirm the layout, spacing, and copy are correct.
- Check mobile or narrow widths if the UI changed structurally.
- Confirm hover, focus, and disabled states if relevant.
- Add a regression test only if the change introduced meaningful behavior.

## Current Backfill Order

Server-first coverage expansion happens in batches:

1. Themes
2. Facilities
3. Intramural offerings, seasons, and leagues

Auth and members already act as the baseline examples for the current test style.

## Test Comment Standard

Every new or updated test in this repo should teach the next developer what is happening.

Required style:

- treat this comment standard as a mandatory completion step whenever creating or updating a test file
- each test file must begin with one block comment at the top of the file using this exact structure:
  - `Brief description:`
  - `Deeper explanation:`
  - `Summary of tests:`
- that full header block must use proper grammar and sentence case
- all other code comments in tests must be lowercase only
- helper functions, setup blocks, mocks, and non-obvious assertions should explain the reason behind
  the code, not only describe the action being taken
- if the test changes later, update the comments too so the explanation stays trustworthy
- a test file is not done until that header block and the lowercase teaching comments are present and accurate

Explain like you're brand new:

- the test file should read like a guided tour, not like a puzzle
- if a future developer asks "why is this here?", the comment should answer that directly
