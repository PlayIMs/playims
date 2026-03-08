# Class Recipes

Use this as a quick copy/paste matrix. Prefer these recipes before inventing new class combinations.

## Page And Section Shells

| Use Case | Canonical Classes |
| --- | --- |
| Page wrapper | `p-6 lg:p-8 space-y-6` |
| Page hero/header | `border-2 border-neutral-950 bg-neutral p-5 space-y-4` |
| Main board shell | `min-w-0 border-2 border-neutral-950 bg-neutral` |
| Section strip/header | `p-4 border-b border-neutral-950 bg-neutral-600/66` |
| Standard white card | `border border-neutral-950 bg-white p-4 space-y-3` |
| Nested neutral subsection | `border border-secondary-200 bg-neutral p-2 space-y-2` |
| Warning panel | `border border-warning-300 bg-warning-50 p-3` |
| Success panel | `bg-primary-100 border-2 border-primary-500 text-neutral-950 p-4` |
| Error panel (wizard) | `border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3` |

## Headings And Copy

| Use Case | Canonical Classes |
| --- | --- |
| Page title | `text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950` |
| Section title | `text-xl font-bold font-serif text-neutral-950` |
| Subsection title | `text-lg font-bold font-serif text-neutral-950` |
| Micro label | `text-[11px] uppercase tracking-wide font-bold` |
| Body | `text-sm font-sans text-neutral-950` |
| Helper/meta | `text-xs text-neutral-900` |
| Field error | `text-xs text-error-700 mt-1` |

## Buttons And Actions

| Use Case | Canonical Classes |
| --- | --- |
| Primary outlined CTA | `button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer` |
| Secondary outlined CTA | `button-secondary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer` |
| Compact icon button | `button-secondary-outlined p-1.5 cursor-pointer` |
| Compact square icon button | `button-secondary-outlined w-9 h-9 p-0 cursor-pointer inline-flex items-center justify-center` |
| Wizard back button | `button-secondary-outlined cursor-pointer` |
| Wizard next/submit | `button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed` |
| Destructive action | `button-error cursor-pointer inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60` |
| Danger secondary confirm | `button-secondary-outlined border-error-700 text-error-700 hover:bg-error-50 cursor-pointer` |

## Inputs And Form Controls

| Use Case | Canonical Classes |
| --- | --- |
| Standard input | `input-secondary` |
| Input with right icon/action | `input-secondary pr-10` |
| Date input with custom trigger | `input-secondary pr-9 no-native-date-picker` |
| Search-style input | `input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed` |
| Textarea | `textarea-secondary min-h-28` |
| Toggle | `toggle-secondary` |
| Radio | `radio-secondary mt-0.5` |
| Inline danger input | `input-secondary border-error-400 focus:border-error-600` |

## Labels And Helpers

| Use Case | Canonical Classes |
| --- | --- |
| Standard label | `block text-sm font-sans text-neutral-950 mb-1` |
| Label + inline info row | `mb-1 flex min-h-6 items-center gap-1.5` |
| Compact legacy label row (existing) | `mb-1 flex h-5 items-center gap-1.5 leading-none` |
| Label text for inline row | `text-sm leading-6 font-sans text-neutral-950` |
| Revert icon button in input | `-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none` |

## Dropdown Recipes (`ListboxDropdown`)

| Use Case | Canonical Classes |
| --- | --- |
| Default trigger (component default) | `button-secondary-outlined px-3 py-1 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center gap-2 ...` |
| Compact icon trigger | `button-secondary-outlined p-1.5 cursor-pointer` |
| Split add-menu trigger | `button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer` |
| Compact action list panel | `mt-1 w-44 border-2 border-neutral-950 bg-white z-20` |
| Compact option row | `w-full text-left px-3 py-2 text-sm text-neutral-950 cursor-pointer` |
| Active compact option | `bg-neutral-100 text-neutral-950` |
| Footer primary action | `w-full button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center` |
| Footer secondary action | `button-secondary-outlined px-2 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center` |

## Wizard Structures

| Use Case | Canonical Classes |
| --- | --- |
| Wizard modal panel | `wizard-modal-panel ... border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col` |
| Wizard header | `p-4 border-b border-secondary space-y-3` |
| Wizard form default | `p-4 space-y-5 flex-1 min-h-0 overflow-y-auto` |
| Wizard footer container | `pt-2 border-t border-neutral-950 flex justify-end` |
| Draft collection container | `border border-neutral-950 bg-white p-3 space-y-3` |
| Draft item card | `border border-neutral-950 bg-neutral p-3 space-y-2` |
| Draft list scroll region | `space-y-2 max-h-[61vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 ...` |

## Dangerous Modal Recipes

| Use Case | Canonical Classes |
| --- | --- |
| Danger panel shell | `w-full max-w-2xl max-h-[calc(100vh-3rem)] border-4 border-error-700 bg-error-25 overflow-hidden flex flex-col` |
| Danger header | `p-4 border-b border-error-300 bg-error-50 flex items-start justify-between gap-3` |
| Impact warning block | `border-2 border-error-300 bg-error-50 p-3 space-y-2` |
| Inline typed token chip | `font-mono text-xs bg-error-100 text-error-900 px-1 py-0.5 rounded` |

## Exception Recipes (Allowed Rounded Affordances)

| Use Case | Canonical Classes |
| --- | --- |
| Role quick-key chip | `... rounded-sm border border-secondary-500 bg-neutral-200 ...` |
| Typed token chip | `... px-1 py-0.5 rounded` |

These are explicit exceptions. Do not apply rounded classes to new page/chrome containers by default.
