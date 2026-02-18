# ListboxDropdown QA Matrix

Use this matrix after adding or refactoring any `ListboxDropdown` usage.

## Selection + State
- Selecting an option emits `change` once with the expected `event.detail.value`.
- Parent state updates and reflected label/trigger state stays in sync.
- Existing side effects on selection (filtering, section reset, fetches) still run.
- If current `value` is missing from options, placeholder behavior is acceptable for the route.
- If footer action is configured, clicking it emits `footerAction` and runs the expected route action.
- In `mode="action"`, selecting an option emits `action` and does not persist a selected option state.

## Keyboard
- `ArrowDown` on trigger opens dropdown and moves active option.
- `ArrowUp` on trigger opens dropdown and can start at last enabled option.
- `Enter` or `Space` selects active option.
- `Home` and `End` jump to first/last enabled option.
- `Escape` closes dropdown and returns focus to trigger.
- `Tab` closes dropdown without trapping focus.
- Typeahead matches option labels and ignores disabled options.
- In `mode="action"`, keyboard activation triggers `action` handlers and closes the panel.

## Pointer + Focus
- Clicking trigger toggles open/closed state.
- Clicking outside closes dropdown.
- Hovering options updates active styling (without selecting until click/Enter/Space).
- Selecting an option closes dropdown and returns focus to trigger button.
- Footer action button (when present) is visually distinct and clickable without affecting option selection state.

## Accessibility + Semantics
- Trigger has domain-specific `ariaLabel`.
- Trigger exposes `aria-haspopup="listbox"` and valid `aria-expanded` transitions.
- List container uses `role="listbox"` and options use `role="option"`.
- `aria-selected` reflects current selection.
- Disabled options expose `aria-disabled` and cannot be selected.
- Footer action button has an accessible label (`footerActionAriaLabel` or clear visible text).

## Visual + Layout
- Trigger style aligns with route conventions (`button-secondary-outlined` for compact icon triggers).
- List alignment (`left`/`right`) and width work at mobile and desktop breakpoints.
- Selected, active, and disabled option states are clearly distinct.
