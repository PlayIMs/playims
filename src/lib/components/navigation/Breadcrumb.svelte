<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		appendSeasonQueryToBreadcrumbHref,
		shouldShowBreadcrumbSeasonContext
	} from '$lib/components/navigation/breadcrumb-utils.js';
	import type {
		BreadcrumbOption,
		BreadcrumbSegment
	} from '$lib/components/navigation/breadcrumb.js';
	import { IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';

	interface Props {
		segments: BreadcrumbSegment[];
		class?: string;
		seasonLabel?: string | null;
		seasonSlug?: string | null;
		includeSeasonContext?: boolean;
	}

	let {
		segments,
		class: className = '',
		seasonLabel = null,
		seasonSlug = null,
		includeSeasonContext = false
	}: Props = $props();

	function hrefWithSeasonContext(href: string): string {
		return appendSeasonQueryToBreadcrumbHref(href, {
			seasonSlug,
			includeSeasonQuery: includeSeasonContext
		});
	}

	function resolvedHref(href: string): string {
		return (resolve as unknown as (route: string) => string)(hrefWithSeasonContext(href));
	}

	function menuOptionsFor(segment: BreadcrumbSegment): BreadcrumbOption[] {
		const currentValue = resolvedHref(segment.currentValue);
		const seasonContextLabel =
			shouldShowBreadcrumbSeasonContext(segment.key, includeSeasonContext) && seasonLabel
				? seasonLabel
				: undefined;

		return segment.options.map((option) =>
			resolvedHref(option.value) === currentValue
				? {
						...option,
						value: resolvedHref(option.value),
						statusLabel: seasonContextLabel,
						disabled: true
					}
				: {
						...option,
						value: resolvedHref(option.value),
						statusLabel: seasonContextLabel
					}
		);
	}

	function dropdownDisabled(segment: BreadcrumbSegment): boolean {
		return segment.showMenu === false || segment.options.length <= 1;
	}

	function showDropdown(segment: BreadcrumbSegment): boolean {
		return segment.showMenu !== false && segment.options.length > 1;
	}

	async function handleAction(value: string, currentValue: string): Promise<void> {
		if (!value || value === currentValue) return;
		await goto(value);
	}
</script>

{#if segments.length > 0}
	<nav
		aria-label="Breadcrumb navigation"
		class={`inline-flex min-w-0 max-w-full ml-0.5 items-center gap-1 overflow-visible whitespace-nowrap ${className}`}
	>
		{#each segments as segment, index (segment.key)}
			<div class="inline-flex min-w-0 shrink-0 items-center gap-0.5">
				<a
					href={resolvedHref(segment.href)}
					data-sveltekit-preload-data="hover"
					aria-current={resolvedHref(segment.href) === resolvedHref(segment.currentValue)
						? 'page'
						: undefined}
					class="inline-flex min-w-0 cursor-pointer items-center text-[13px] leading-4 font-normal text-neutral-900 transition-colors duration-150 focus:outline-none"
				>
					<span class="truncate">{segment.label}</span>
				</a>
				{#if showDropdown(segment)}
					<ListboxDropdown
						options={menuOptionsFor(segment)}
						value=""
						mode="action"
						ariaLabel={segment.menuAriaLabel}
						align="left"
						disabled={dropdownDisabled(segment)}
						positionAnchorMode="parent"
						searchEnabled={segment.searchEnabled ?? segment.options.length > 8}
						searchPlaceholder={segment.searchPlaceholder ?? `Search ${segment.label}`}
						searchAriaLabel={segment.menuAriaLabel}
						emptyText={segment.emptyText ?? 'No options available.'}
						buttonClass="inline-flex h-4 w-4 shrink-0 items-center justify-center bg-transparent p-0 text-secondary-900 cursor-pointer hover:text-neutral-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						listClass="mt-1 bg-white z-20 max-h-80 overflow-y-auto shadow-[0_12px_24px_rgba(20,33,61,0.22)]"
						optionClass="block w-full px-3 py-1.5 text-left text-sm font-normal whitespace-nowrap text-neutral-950 cursor-pointer"
						activeOptionClass="bg-neutral-100 text-neutral-950"
						separatorClass="border-secondary-200"
						preserveDisabledSeparatorOpacity
						on:action={(event) => {
							void handleAction(event.detail.value, segment.currentValue);
						}}
					>
						{#snippet trigger(open)}
							<IconChevronDown
								class={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
							/>
						{/snippet}
					</ListboxDropdown>
				{/if}
			</div>
			{#if index < segments.length - 1}
				<span class="inline-flex shrink-0 items-center text-secondary-700/80" aria-hidden="true">
					<IconChevronRight class="h-3 w-3" />
				</span>
			{/if}
		{/each}
	</nav>
{/if}
