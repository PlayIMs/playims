<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { IconDots } from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		getDataTableRowActionMode,
		getSingleDataTableRowActionOption,
		type DataTableRowActionOption
	} from '$lib/components/data-table.js';

	interface Props {
		options: DataTableRowActionOption[];
		ariaLabel: string;
		align?: 'left' | 'right';
		buttonClass?: string;
		listClass?: string;
	}

	const DEFAULT_BUTTON_CLASS =
		'inline-flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-secondary-700 cursor-pointer opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-neutral-100 hover:text-secondary-900 focus:outline-none focus-visible:bg-neutral-100 focus-visible:text-secondary-900 disabled:cursor-not-allowed disabled:text-secondary-400';
	const DEFAULT_LIST_CLASS = 'w-52';

	let {
		options,
		ariaLabel,
		align = 'right',
		buttonClass = DEFAULT_BUTTON_CLASS,
		listClass = DEFAULT_LIST_CLASS
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		action: { value: string };
	}>();

	const actionMode = $derived.by(() => getDataTableRowActionMode(options));
	const singleOption = $derived.by(() => getSingleDataTableRowActionOption(options));
	const singleOptionTooltip = $derived.by(() => {
		if (!singleOption) return '';
		return singleOption.disabled
			? singleOption.disabledTooltip ?? singleOption.tooltip ?? singleOption.label
			: singleOption.tooltip ?? singleOption.label;
	});

	function triggerSingleAction(): void {
		if (!singleOption || singleOption.disabled) return;
		dispatch('action', { value: singleOption.value });
	}
</script>

{#if actionMode !== 'none'}
	<div class="flex justify-end">
		{#if actionMode === 'single' && singleOption}
			<HoverTooltip text={singleOptionTooltip} wrapperClass="inline-flex">
				<span class="inline-flex">
					<button
						type="button"
						class={buttonClass}
						aria-label={ariaLabel}
						disabled={singleOption.disabled}
						onclick={triggerSingleAction}
					>
						<IconDots class="h-4 w-4" />
					</button>
				</span>
			</HoverTooltip>
		{:else}
			<ListboxDropdown
				options={options}
				value=""
				mode="action"
				{align}
				{ariaLabel}
				{buttonClass}
				{listClass}
				on:action={(event) => {
					dispatch('action', event.detail);
				}}
			>
				{#snippet trigger()}<IconDots class="h-4 w-4" />{/snippet}
			</ListboxDropdown>
		{/if}
	</div>
{/if}
