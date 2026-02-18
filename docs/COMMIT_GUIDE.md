# Commit Message Guide

Use this standard for all commits in this repository.

## Format

Use:

```text
<type>: <brief description>
```

Rules:
- Keep `<type>` lowercase.
- Keep description brief and specific.
- Use present tense, action-oriented wording.
- Do not end the subject line with a period.

## Types

- `feat:` add a new feature or user-visible capability
- `fix:` fix a bug or unintended behavior
- `docs:` add or update documentation only
- `refactor:` improve structure without changing behavior
- `style:` formatting/styling changes with no logic changes
- `test:` add or update tests
- `chore:` maintenance tasks, tooling, config, dependency chores
- `perf:` performance improvements
- `build:` build system or dependency/build pipeline changes
- `ci:` CI pipeline/workflow changes

## Examples

- `feat: add footer action to ListboxDropdown for contextual CTA buttons`
- `fix: prevent listbox panel from overflowing the viewport on mobile`
- `docs: add commit message prefix guide`
- `refactor: extract season option mapping into derived helper`
- `test: add coverage for listbox keyboard navigation`

## Optional Scope

Use optional scope when helpful:

```text
<type>(<scope>): <brief description>
```

Examples:
- `feat(dropdown): add add-new-season footer action`
- `fix(wizard): preserve unsaved confirm on close`
