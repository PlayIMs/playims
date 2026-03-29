<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { IconHistory } from '@tabler/icons-svelte';
	import { tick } from 'svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		getNextMegaSearchHighlightedIndex,
		resolveMegaSearchMovementIntent,
		type MegaSearchMovementFocusMode
	} from '$lib/search/keyboard.js';
	import type { MegaSearchResponse, MegaSearchResult } from '$lib/search/types.js';
	import {
		clearMegaSearchHighlightedIndex,
		closeMegaSearchPalette,
		focusMegaSearchPaletteInput,
		megaSearchErrorMessage,
		megaSearchGroups,
		megaSearchHighlightedIndex,
		megaSearchLoading,
		megaSearchLoadingSeasonScope,
		megaSearchOpen,
		megaSearchQuery,
		megaSearchScopedSeasonId,
		megaSearchSeasons,
		megaSearchTotalCount,
		openMegaSearchPalette,
		registerMegaSearchInput,
		setMegaSearchErrorMessage,
		setMegaSearchGroups,
		setMegaSearchHighlightedIndex,
		setMegaSearchLoading,
		setMegaSearchLoadingSeasonScope,
		setMegaSearchQuery,
		setMegaSearchScopedSeasonId,
		setMegaSearchSeasons,
		setMegaSearchTotalCount
	} from '$lib/search/controller.js';
	import {
		buildMegaSearchSeasonDropdownOptions,
		resolveMegaSearchDefaultSeasonId,
		resolveMegaSearchScopedSeasonSlug
	} from '$lib/search/season-scope.js';

	interface MegaSearchSeasonResponse {
		success: boolean;
		data?: {
			currentSeasonId: string | null;
			seasons: Array<{
				id: string;
				name: string;
				slug: string;
				startDate: string;
				endDate: string | null;
				isCurrent: boolean;
				isActive: boolean;
			}>;
		};
		error?: string;
	}

	let inputElement = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;
	let requestSequence = 0;
	let allowAutoHighlight = $state(true);
	let highlightedResultButtons = $state<Array<HTMLButtonElement | null>>([]);
	let pendingHighlightFocusMode = $state<MegaSearchMovementFocusMode | null>(null);

	const flatResults = $derived.by(() =>
		$megaSearchGroups.flatMap((group) =>
			group.items.map((item) => ({
				group,
				item
			}))
		)
	);
	const hasResults = $derived.by(() => flatResults.length > 0);
	const todayIsoDate = $derived.by(() => new Date().toISOString().slice(0, 10));
	const seasonDropdownOptions = $derived.by(() =>
		buildMegaSearchSeasonDropdownOptions($megaSearchSeasons, todayIsoDate)
	);
	const scopedSeasonSlug = $derived.by(() =>
		resolveMegaSearchScopedSeasonSlug($megaSearchSeasons, $megaSearchScopedSeasonId)
	);

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		const tagName = target.tagName.toLowerCase();
		return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
	}

	function isResultTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement && target.closest('[data-mega-search-result="true"]') !== null
		);
	}

	function closePalette(): void {
		debounceTimer && clearTimeout(debounceTimer);
		debounceTimer = null;
		abortController?.abort();
		abortController = null;
		requestSequence += 1;
		allowAutoHighlight = true;
		closeMegaSearchPalette();
	}

	async function loadSeasonScope(): Promise<void> {
		if (!browser || !$megaSearchOpen) return;
		setMegaSearchLoadingSeasonScope(true);
		try {
			const response = await fetch('/api/intramural-sports/seasons');
			const payload = (await response.json()) as MegaSearchSeasonResponse;
			if (!response.ok || !payload.success || !payload.data) {
				setMegaSearchSeasons([]);
				setMegaSearchScopedSeasonId('');
				return;
			}

			const nextSeasons = payload.data.seasons ?? [];
			setMegaSearchSeasons(nextSeasons);
			setMegaSearchScopedSeasonId(resolveMegaSearchDefaultSeasonId(nextSeasons));
		} catch {
			setMegaSearchSeasons([]);
			setMegaSearchScopedSeasonId('');
		} finally {
			setMegaSearchLoadingSeasonScope(false);
		}
	}

	async function loadResults(nextQuery: string): Promise<void> {
		if (!browser || !$megaSearchOpen) return;
		abortController?.abort();
		abortController = new AbortController();
		const requestId = ++requestSequence;
		setMegaSearchLoading(true);
		setMegaSearchErrorMessage('');
		try {
			const url = new URL('/api/search', window.location.origin);
			const trimmedQuery = nextQuery.trim();
			if (trimmedQuery) {
				url.searchParams.set('q', trimmedQuery);
			}
			if (scopedSeasonSlug) {
				url.searchParams.set('season', scopedSeasonSlug);
			}
			const response = await fetch(url, { signal: abortController.signal });
			const payload = (await response.json()) as MegaSearchResponse;
			if (requestId !== requestSequence) return;
			if (!response.ok || !payload.success) {
				setMegaSearchErrorMessage(payload.error ?? 'Unable to load search results.');
				setMegaSearchGroups([]);
				setMegaSearchTotalCount(0);
				pendingHighlightFocusMode = null;
				setMegaSearchHighlightedIndex(-1);
				return;
			}
			setMegaSearchGroups(payload.groups ?? []);
			setMegaSearchTotalCount(payload.totalCount ?? 0);
			pendingHighlightFocusMode = null;
			setMegaSearchHighlightedIndex(allowAutoHighlight && (payload.totalCount ?? 0) > 0 ? 0 : -1);
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				if (requestId !== requestSequence) return;
				setMegaSearchErrorMessage('Unable to load search results.');
				setMegaSearchGroups([]);
				setMegaSearchTotalCount(0);
				pendingHighlightFocusMode = null;
				setMegaSearchHighlightedIndex(-1);
			}
		} finally {
			if (requestId === requestSequence) {
				setMegaSearchLoading(false);
			}
		}
	}

	function moveHighlight(offset: -1 | 1, focusMode: MegaSearchMovementFocusMode): void {
		if (!hasResults) return;
		pendingHighlightFocusMode = focusMode;
		const nextIndex = getNextMegaSearchHighlightedIndex(
			$megaSearchHighlightedIndex,
			flatResults.length,
			offset
		);
		setMegaSearchHighlightedIndex(nextIndex);
	}

	async function rememberSelection(result: MegaSearchResult): Promise<void> {
		try {
			await fetch('/api/search/recent', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					resultKey: result.resultKey,
					category: result.category,
					title: result.title,
					subtitle: result.subtitle ?? null,
					href: result.href,
					badge: result.badge ?? null,
					meta: result.meta ?? null
				})
			});
		} catch {
			// ignore recent-write failures because navigation is the primary action.
		}
	}

	async function selectResult(result: MegaSearchResult): Promise<void> {
		await rememberSelection(result);
		closePalette();
		await goto(result.href);
	}

	async function selectHighlightedResult(): Promise<void> {
		if ($megaSearchHighlightedIndex < 0 || $megaSearchHighlightedIndex >= flatResults.length)
			return;
		await selectResult(flatResults[$megaSearchHighlightedIndex]!.item);
	}

	function handleSeasonScopeChange(value: string): void {
		if (!value || value === $megaSearchScopedSeasonId) return;
		setMegaSearchScopedSeasonId(value);
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		const movementIntent = resolveMegaSearchMovementIntent(event.key, {
			shiftKey: event.shiftKey,
			targetIsInput: true
		});
		if (movementIntent) {
			event.preventDefault();
			allowAutoHighlight = true;
			moveHighlight(movementIntent.offset, movementIntent.focusMode);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			allowAutoHighlight = true;
			void selectHighlightedResult();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
		}
	}

	$effect(() => {
		registerMegaSearchInput(inputElement);
	});

	$effect(() => {
		if (!browser) return;
		const handleWindowKeydown = (event: KeyboardEvent) => {
			const isShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
			if (isShortcut && event.key.toLowerCase() === 'k') {
				if (!$megaSearchOpen && isEditableTarget(event.target)) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				if (!$megaSearchOpen) {
					openMegaSearchPalette('keyboard', '');
					return;
				}
				focusMegaSearchPaletteInput();
				return;
			}

			if (!$megaSearchOpen) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				closePalette();
				return;
			}
			if (event.key === 'Enter' && isResultTarget(event.target)) {
				event.preventDefault();
				allowAutoHighlight = true;
				void selectHighlightedResult();
			}
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});

	$effect(() => {
		if (!browser || !$megaSearchOpen) return;
		const html = document.documentElement;
		const body = document.body;
		const previousHtmlOverflow = html.style.overflow;
		const previousBodyOverflow = body.style.overflow;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		return () => {
			html.style.overflow = previousHtmlOverflow;
			body.style.overflow = previousBodyOverflow;
		};
	});

	$effect(() => {
		if (!browser || !$megaSearchOpen) return;
		allowAutoHighlight = true;
		void loadSeasonScope();
	});

	$effect(() => {
		if (!browser || !$megaSearchOpen) return;
		const highlightedIndex = $megaSearchHighlightedIndex;
		const focusMode = pendingHighlightFocusMode;
		if (highlightedIndex < 0) {
			pendingHighlightFocusMode = null;
			return;
		}

		void tick().then(() => {
			if (!$megaSearchOpen || highlightedIndex !== $megaSearchHighlightedIndex) {
				return;
			}

			const highlightedButton = highlightedResultButtons[highlightedIndex];
			if (!highlightedButton) {
				pendingHighlightFocusMode = null;
				return;
			}

			highlightedButton.scrollIntoView({
				block: 'nearest'
			});

			if (focusMode === 'focus-result') {
				highlightedButton.focus();
			} else if (focusMode === 'preserve-input' && document.activeElement !== inputElement) {
				inputElement?.focus();
			}

			if (focusMode === pendingHighlightFocusMode) {
				pendingHighlightFocusMode = null;
			}
		});
	});

	$effect(() => {
		if (!browser || !$megaSearchOpen) return;
		scopedSeasonSlug;
		if (debounceTimer) clearTimeout(debounceTimer);
		const delay = $megaSearchQuery.trim().length > 0 ? 150 : 0;
		debounceTimer = setTimeout(() => {
			void loadResults($megaSearchQuery);
		}, delay);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function handleResultKeydown(event: KeyboardEvent): void {
		const movementIntent = resolveMegaSearchMovementIntent(event.key, {
			shiftKey: event.shiftKey,
			targetIsResult: true
		});
		if (movementIntent) {
			event.preventDefault();
			allowAutoHighlight = true;
			moveHighlight(movementIntent.offset, movementIntent.focusMode);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			allowAutoHighlight = true;
			void selectHighlightedResult();
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
		}
	}
</script>

{#if $megaSearchOpen}
	<div
		class="fixed inset-0 z-80 bg-secondary-950/30 backdrop-blur-[1px]"
		role="presentation"
		onclick={closePalette}
	>
		<div
			class="pointer-events-none flex w-full justify-center px-4"
			style="padding-top: calc(var(--pwa-top-bar-offset, 0px) + 1rem);"
		>
			<div
				class="pointer-events-auto w-full max-w-3xl overflow-hidden border-2 border-neutral-950 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.18)]"
				role="dialog"
				tabindex="-1"
				aria-modal="true"
				aria-label="Mega search"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				onmouseleave={() => {
					allowAutoHighlight = false;
					clearMegaSearchHighlightedIndex();
				}}
			>
				<div class="border-b border-neutral-500 bg-neutral-25 px-4 py-4">
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							<SearchInput
								id="mega-search-input"
								label="Search anything"
								value={$megaSearchQuery}
								bind:inputElement
								placeholder="Search pages, members, offerings, teams, facilities, and more"
								inputClass="input-neutral min-h-12 pl-10 pr-10 text-base"
								iconClass="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-950"
								clearButtonClass="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-700 hover:text-neutral-950"
								clearIconClass="h-4 w-4"
								onInputKeydown={handleInputKeydown}
								on:input={(event) => {
									allowAutoHighlight = true;
									setMegaSearchQuery(event.detail.value);
								}}
							/>
						</div>
						<ListboxDropdown
							options={seasonDropdownOptions}
							value={$megaSearchScopedSeasonId}
							ariaLabel="Search season scope"
							emptyText={$megaSearchLoadingSeasonScope
								? 'Loading seasons...'
								: 'No seasons configured.'}
							disabled={$megaSearchLoadingSeasonScope || seasonDropdownOptions.length === 0}
							searchEnabled={seasonDropdownOptions.length > 8}
							searchPlaceholder="Search seasons"
							searchAriaLabel="Search seasons"
							buttonClass="button-neutral-outlined inline-flex h-12 w-12 shrink-0 items-center justify-center p-0 cursor-pointer"
							listClass="max-h-80 shadow-[0_12px_24px_rgba(20,33,61,0.22)]"
							on:change={(event) => {
								handleSeasonScopeChange(event.detail.value);
							}}
						>
							{#snippet trigger()}
								<IconHistory class="listbox-dropdown-icon h-4 w-4" />
							{/snippet}
						</ListboxDropdown>
					</div>
					<div
						class="mt-2 flex justify-end text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700"
					>
						<span
							>{$megaSearchLoading
								? 'Searching'
								: $megaSearchTotalCount > 0
									? `${$megaSearchTotalCount} Results`
									: 'Ready'}</span
						>
					</div>
				</div>

				<div class="max-h-[min(70vh,36rem)] overflow-y-auto bg-white">
					{#if $megaSearchErrorMessage}
						<p class="px-4 py-6 text-sm text-primary-800">{$megaSearchErrorMessage}</p>
					{:else if $megaSearchLoading && !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">Loading results...</p>
					{:else if !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">No matches found.</p>
					{:else}
						{#each $megaSearchGroups as group}
							<section class="border-t border-neutral-700 first:border-t-0">
								<div
									class="bg-primary-500/30 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-950"
								>
									{group.label}
								</div>
								<div class="divide-y divide-neutral-700">
									{#each group.items as item}
										{@const flatIndex = flatResults.findIndex(
											(entry) => entry.item.resultKey === item.resultKey
										)}
										<button
											bind:this={highlightedResultButtons[flatIndex]}
											type="button"
											data-mega-search-result="true"
											class={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left cursor-pointer ${
												flatIndex === $megaSearchHighlightedIndex
													? 'bg-primary-50'
													: 'bg-white hover:bg-neutral-25'
											}`}
											onmouseenter={() => {
												allowAutoHighlight = true;
												pendingHighlightFocusMode = null;
												setMegaSearchHighlightedIndex(flatIndex);
											}}
											onkeydown={handleResultKeydown}
											onclick={() => {
												void selectResult(item);
											}}
										>
											<div class="min-w-0">
												<p class="truncate text-sm font-semibold text-neutral-950">{item.title}</p>
												{#if item.subtitle}
													<p class="mt-0.5 truncate text-xs leading-5 text-neutral-700">
														{item.subtitle}
													</p>
												{/if}
											</div>
											<div class="shrink-0 text-right">
												{#if item.badge}
													<span
														class="inline-flex border border-neutral-500 bg-neutral-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950"
													>
														{item.badge}
													</span>
												{/if}
											</div>
										</button>
									{/each}
								</div>
							</section>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
