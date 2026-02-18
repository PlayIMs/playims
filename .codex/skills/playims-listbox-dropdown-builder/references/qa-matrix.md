# ListboxDropdown QA Matrix

Use this matrix after adding or refactoring any `ListboxDropdown` usage.

## Selection + State
- Selecting an option emits `change` once with the expected `event.detail.value`.
- Parent state updates and reflected label/trigger state stays in sync.
- Existing side effects on selection (filtering, section reset, fetches) still run.
- If current `value` is missing from options, placeholder behavior is acceptable for the route.

## Keyboard
- `ArrowDown` on trigger opens dropdown and moves active option.
- `ArrowUp` on trigger opens dropdown and can start at last enabled option.
- `Enter` or `Space` selects active option.
- `Home` and `End` jump to first/last enabled option.
- `Escape` closes dropdown and returns focus to trigger.
- `Tab` closes dropdown without trapping focus.
- Typeahead matches option labels and ignores disabled options.

## Pointer + Focus
- Clicking trigger toggles open/closed state.
- Clicking outside closes dropdown.
- Hovering options updates active styling (without selecting until click/Enter/Space).
- Selecting an option closes dropdown and returns focus to trigger button.

## Accessibility + Semantics
- Trigger has domain-specific `ariaLabel`.
- Trigger exposes `aria-haspopup="listbox"` and valid `aria-expanded` transitions.
- List container uses `role="listbox"` and options use `role="option"`.
- `aria-selected` reflects current selection.
- Disabled options expose `aria-disabled` and cannot be selected.

## Visual + Layout
- Trigger style aligns with route conventions (`button-secondary-outlined` for compact icon triggers).
- List alignment (`left`/`right`) and width work at mobile and desktop breakpoints.
- Selected, active, and disabled option states are clearly distinct.
