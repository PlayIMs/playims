<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import NavigationOptionMetadata from './NavigationOptionMetadata.svelte';
	import { breadcrumbDivisionOptions } from './breadcrumb.js';
	import {
		appendSeasonQueryToBreadcrumbHref,
		shouldShowBreadcrumbSeasonContext,
		shouldOpenBreadcrumbMenuFromLabel
	} from '$lib/components/navigation/breadcrumb-utils.js';
	import type {
		BreadcrumbMetadata,
		BreadcrumbOption,
		BreadcrumbSegment
	} from '$lib/components/navigation/breadcrumb.js';
	import { IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';

	interface Props {
		metadata?: Record<string, BreadcrumbMetadata>;
		segments: BreadcrumbSegment[];
		class?: string;
		seasonLabel?: string | null;
		seasonSlug?: string | null;
		includeSeasonContext?: boolean;
	}

	let {
		metadata = {},
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

	function metadataFor(value: string): BreadcrumbMetadata | undefined {
		// compare resolved paths so base paths and historical-season queries preserve the summary.
		return Object.entries(metadata).find(([href]) => resolvedHref(href) === value)?.[1];
	}

	function menuOptionsFor(segment: BreadcrumbSegment): BreadcrumbOption[] {
		const seasonContextLabel =
			shouldShowBreadcrumbSeasonContext(segment.key, includeSeasonContext) && seasonLabel
				? seasonLabel
				: undefined;

		const options = segment.options.map((option) => ({
			...option,
			value: resolvedHref(option.value),
			statusLabel: seasonContextLabel
		}));
		return segment.key === 'division' ? breadcrumbDivisionOptions(options, metadataFor) : options;
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
			{@const labelOpensMenu = shouldOpenBreadcrumbMenuFromLabel(
				index,
				segments.length,
				showDropdown(segment)
			)}
			<div class="inline-flex min-w-0 shrink-0 items-center gap-0.5">
				{#if !labelOpensMenu}
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
				{/if}
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
						buttonClass={labelOpensMenu
							? 'inline-flex h-4 min-w-0 items-center gap-0.5 bg-transparent p-0 text-[13px] leading-4 font-normal text-neutral-900 cursor-pointer focus:outline-none'
							: 'inline-flex h-4 w-4 shrink-0 items-center justify-center bg-transparent p-0 text-secondary-900 cursor-pointer hover:text-neutral-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'}
						listClass="max-h-80 shadow-[0_12px_24px_rgba(20,33,61,0.22)]"
						preserveDisabledSeparatorOpacity
						on:action={(event) => {
							void handleAction(event.detail.value, segment.currentValue);
						}}
					>
						{#snippet optionMetadata(option)}
							<NavigationOptionMetadata summary={metadataFor(option.value)} />
						{/snippet}
						{#snippet trigger(open)}
							{#if labelOpensMenu}
								<span class="truncate">{segment.label}</span>
							{/if}
							<IconChevronDown
								class={`h-4 w-4 shrink-0 text-secondary-900 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
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
