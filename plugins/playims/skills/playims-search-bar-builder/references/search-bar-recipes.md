# Search Bar Recipes

## Canonical Default

Use the offerings-page search bar as the base recipe:

- Component: `src/lib/components/SearchInput.svelte`
- Wrapper: `relative`
- Leading icon: `absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950`
- Input: `input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed`
- Clear button: `absolute right-2 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer`
- Clear icon: `w-4 h-4`

## Compact Modal/List Search

Use this for tight sidebars and chooser lists:

- Wrapper: `relative ml-2 flex-1 min-w-0`
- Leading icon: `absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-950`
- Input: `input-secondary h-6 min-h-0 w-full pl-7 pr-7 py-0 text-xs leading-5 disabled:cursor-not-allowed`
- Clear button: `absolute right-1 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer`
- Clear icon: `w-3.5 h-3.5`

## Full-Width Panel Search

Use when the surrounding section already handles spacing:

- Wrapper: `relative w-full`
- Input: `w-full input-secondary pl-10 pr-10 py-1 text-sm`

## Embedded Dropdown Search

When a searchable dropdown needs its own filter field:

- Reuse `SearchInput` inside the panel instead of raw input markup.
- Wrapper: `relative`
- Leading icon: `pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-700`
- Input: `input-secondary min-h-10 pl-8 pr-8`
- Clear button: `absolute right-2 top-1/2 -translate-y-1/2 text-secondary-700 hover:text-secondary-900 cursor-pointer`
- Clear icon: `h-4 w-4`

## Behavior Checklist

- Keep the clear control hidden when the value is empty.
- Preserve existing filtering logic and reset side effects.
- Preserve custom attributes passed to the input, including `data-lpignore`.
- Prefer meaningful placeholders:
  - `Search members`
  - `Search facilities and areas...`
  - `Search division, team, captain, or waitlist`
- Use the `clearButtonMode` and `clearButtonText` props only when the product explicitly needs text instead of the default icon affordance.
