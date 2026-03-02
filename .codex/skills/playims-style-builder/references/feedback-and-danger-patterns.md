# Feedback And Danger Patterns

## Contents

1. Success feedback
2. Warning/caution feedback
3. Error feedback
4. Inline field errors
5. Icon action color mapping
6. Destructive confirm conventions
7. Danger modal recipe

## Success Feedback

Use `references/toast-patterns.md` for transient success feedback.

Keep success content inline only when it is part of a persistent review/result section that must remain visible in the layout.

## Warning/Caution Feedback

Empty/filter warning recipe:

- Wrapper: `border border-warning-300 bg-warning-50 p-3`
- Text: `text-sm text-neutral-950 font-sans`

Use for non-destructive caution states (filters, no-match conditions, setup reminders).

## Error Feedback

Use `references/toast-patterns.md` for transient page and wizard failure feedback.

Keep inline error panels only when the message must remain attached to a destructive review surface or other persistent content block.

## Inline Field Errors

- Field errors should be directly below the field.
- Canonical text class: `text-xs text-error-700 mt-1`.
- For danger forms, keep input border emphasis:
  - `input-secondary border-error-400 focus:border-error-600`.

## Icon Action Color Mapping

- Edit/action-neutral: default neutral/secondary icon color.
- Duplicate/copy: neutral tone unless action is destructive.
- Remove/delete icon on compact action button:
  - icon class includes `text-error-700`.
- Destructive CTA buttons:
  - `button-error` (or error-outlined variant when secondary emphasis is needed).

## Destructive Confirm Conventions

For high-impact actions:

0. Use a proper custom confirmation modal; do not use browser-native `window.confirm`.
1. Include impact summary text that explains exact data loss scope.
2. Include irreversible warning text.
3. Require user typed confirmation (usually normalized slug).
4. Disable destructive submit until confirmation matches.
5. Keep cancel and destructive actions visually separated.

Typed token inline style:

- Use `<code>` inline chip with mono typography.
- Existing pattern allows a small rounded chip (`rounded`/`rounded-sm`) as an explicit exception to flat defaults.

## Danger Modal Recipe

Use error-themed `ModalShell` composition:

- Panel: `w-full max-w-2xl ... border-4 border-error-700 bg-error-25 overflow-hidden flex flex-col`
- Header: `p-4 border-b border-error-300 bg-error-50 ...`
- Body warning block: `border-2 border-error-300 bg-error-50 p-3 space-y-2`
- Footer: `p-4 border-t border-secondary-300 flex justify-end gap-2`

Buttons:

- Cancel: `button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`
- Destructive: `button-error cursor-pointer inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`

Keep copy precise and specific to the entity being destroyed/left/archived.

Hard requirement:

- Any delete/remove/leave/archive confirmation in future UI must follow this custom modal pattern.
