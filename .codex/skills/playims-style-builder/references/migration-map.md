# Migration Map (Legacy `.cursor` Style Skill -> New Codex Skill)

This map preserves meaningful content from:

- `.cursor/skills/style/SKILL.md`

## Mapping Table

| Legacy Section | New Location(s) | Preservation Status | Notes |
| --- | --- | --- | --- |
| `When to Use` | `SKILL.md` -> `Trigger Conditions` | Preserved | Trigger scope now explicitly tied to `src/routes/dashboard/**` and wizard surfaces. |
| `CSS Framework` | `SKILL.md` -> `Guardrails`, `references/style-foundation.md`, `references/forms-and-controls.md` | Preserved + tightened | Tailwind-first policy preserved; shared component mandates now explicit. |
| `Design Aesthetic` | `SKILL.md` -> `Hybrid Visual Policy`, `references/style-foundation.md` | Preserved with codebase exception policy | Flat/square default preserved; explicit exception list added from deployed code. |
| `Color System` | `references/style-foundation.md`, `references/class-recipes.md` | Preserved | Semantic role guidance and token discipline retained; recipes now grounded in app usage. |
| `Typography` | `references/style-foundation.md`, `references/dashboard-layout-recipes.md` | Preserved + clarified | Inter/Bitter usage and heading/body split documented with concrete class recipes. |
| `Icons` | `references/style-foundation.md`, `references/feedback-and-danger-patterns.md` | Preserved + clarified | Tabler-only standard retained; action color semantics and icon button recipes added. |
| `Dashboard Design` | `references/dashboard-layout-recipes.md`, `references/forms-and-controls.md`, `references/wizard-recipes.md` | Preserved + expanded | High-level intent converted into copyable layout/action recipes from offerings and wizards. |
| `Responsive Priority (Mobile + iPad)` | `references/dashboard-layout-recipes.md`, `references/style-foundation.md`, `references/qa-gates.md` | Preserved | Mobile/iPad checklist now enforced by QA gates. |
| `Svelte Runes (Svelte 5)` | `references/forms-and-controls.md` | Preserved | Runes and event-handling rules retained as implementation guardrails. |
| `HTML Structure Rules` | `references/forms-and-controls.md`, `references/qa-gates.md` | Preserved | No nested forms and accessible backdrops retained and gated. |
| `Best Practices` | `SKILL.md` workflow + `references/qa-gates.md` | Preserved + operationalized | Converted from broad guidance to required workflow and acceptance checks. |

## Conflict Resolution Decisions

Legacy rule with conflict:

- Legacy: avoid rounded edges globally.
- Current codebase: intentionally rounded in narrow, scoped cases.

Resolved policy:

- Keep flat/square as default for new page/chrome structures.
- Allow only these explicit exceptions:
  - Circular radio controls and radio dots.
  - Small keycap/code chips already used in destructive confirmation and role quick-key affordances.
  - Existing deployed component affordances that are scoped and already live.

## Content Loss Prevention Notes

- No meaningful legacy section is dropped; each maps to `SKILL.md` and/or `references/*`.
- Rules that were previously generic are now tied to concrete source patterns from offerings and shared wizard components.
- Legacy file remains untouched by this migration flow.
