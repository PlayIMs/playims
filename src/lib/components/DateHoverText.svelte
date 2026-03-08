<script lang="ts">
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { buildDateTooltipText, type DateTooltipValue } from '$lib/utils/date-tooltip.js';

	interface Props {
		display: string;
		value: DateTooltipValue;
		endValue?: DateTooltipValue;
		includeTime?: boolean;
		wrapperClass?: string;
		textClass?: string;
		panelClass?: string;
		maxWidthClass?: string;
	}

	let {
		display,
		value,
		endValue,
		includeTime,
		wrapperClass = 'inline-flex max-w-full',
		textClass = '',
		panelClass,
		maxWidthClass
	}: Props = $props();

	const tooltipText = $derived.by(() => buildDateTooltipText({ value, endValue, includeTime }));
	const hasTooltip = $derived.by(() => tooltipText.trim().length > 0);
</script>

{#if hasTooltip}
	<HoverTooltip
		text={tooltipText}
		wrapperClass={wrapperClass}
		wrapperElement="span"
		{panelClass}
		{maxWidthClass}
	>
		<span class={textClass}>{display}</span>
	</HoverTooltip>
{:else}
	<span class={textClass}>{display}</span>
{/if}
