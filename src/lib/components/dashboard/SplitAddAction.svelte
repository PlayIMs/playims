<script lang="ts">
	import { IconChevronDown } from '@tabler/icons-svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { createEventDispatcher } from 'svelte';

	interface SplitAddActionOption {
		value: string;
		label: string;
		leadingVisualClass?: string;
		leadingVisualAriaLabel?: string;
		description?: string;
		statusLabel?: string;
		rightLabel?: string;
		rightDescription?: string;
		searchText?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface Props {
		label?: string;
		options: SplitAddActionOption[];
		ariaLabel?: string;
		buttonClass?: string;
		menuButtonClass?: string;
		listClass?: string;
		optionClass?: string;
		activeOptionClass?: string;
		align?: 'left' | 'right';
		disabled?: boolean;
	}

	let {
		label = '+ ADD',
		options,
		ariaLabel = 'Open add menu',
		buttonClass = 'button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer',
		menuButtonClass = 'button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer',
		listClass = 'mt-1 w-44 border-2 border-neutral-950 bg-white z-20',
		optionClass = 'w-full text-left px-3 py-2 text-sm text-neutral-950 cursor-pointer',
		activeOptionClass = 'bg-neutral-100 text-neutral-950',
		align = 'right',
		disabled = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		click: undefined;
		action: { value: string };
	}>();
</script>

<div class="relative inline-flex items-stretch">
	<button
		type="button"
		class={buttonClass}
		{disabled}
		onclick={() => {
			dispatch('click');
		}}
	>
		{label}
	</button>
	<ListboxDropdown
		{options}
		value=""
		mode="action"
		{align}
		{disabled}
		{ariaLabel}
		buttonClass={menuButtonClass}
		{listClass}
		{optionClass}
		{activeOptionClass}
		on:action={(event) => {
			dispatch('action', event.detail);
		}}
	>
		{#snippet trigger(open)}
			<IconChevronDown
				class={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
			/>
		{/snippet}
	</ListboxDropdown>
</div>
