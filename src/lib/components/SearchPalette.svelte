<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { IconHistory } from '@tabler/icons-svelte';
	import { tick } from 'svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		getNextSearchPaletteHighlightedIndex,
		resolveSearchPaletteMovementIntent,
		type SearchPaletteMovementFocusMode
	} from '$lib/search/keyboard.js';
	import type { SearchResponse, SearchResult } from '$lib/search/types.js';
	import {
		clearSearchPaletteHighlightedIndex,
		closeSearchPalette,
		focusSearchPaletteInput,
		searchPaletteErrorMessage,
		searchPaletteGroups,
		searchPaletteHighlightedIndex,
		searchPaletteLoading,
		searchPaletteLoadingSeasonScope,
		searchPaletteOpen,
		searchPaletteQuery,
		searchPaletteScopedSeasonId,
		searchPaletteSeasons,
		searchPaletteTotalCount,
		openSearchPalette,
		registerSearchPaletteInput,
		setSearchPaletteErrorMessage,
		setSearchPaletteGroups,
		setSearchPaletteHighlightedIndex,
		setSearchPaletteLoading,
		setSearchPaletteLoadingSeasonScope,
		setSearchPaletteQuery,
		setSearchPaletteScopedSeasonId,
		setSearchPaletteSeasons,
		setSearchPaletteTotalCount
	} from '$lib/search/controller.js';
	import {
		buildSearchPaletteSeasonDropdownOptions,
		resolveSearchPaletteDefaultSeasonId,
		resolveSearchPaletteScopedSeasonSlug
	} from '$lib/search/season-scope.js';

	interface SearchPaletteSeasonResponse {
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
	let pendingHighlightFocusMode = $state<SearchPaletteMovementFocusMode | null>(null);

	const flatResults = $derived.by(() =>
		$searchPaletteGroups.flatMap((group) =>
			group.items.map((item) => ({
				group,
				item
			}))
		)
	);
	const indexedGroups = $derived.by(() => {
		let nextFlatIndex = 0;
		return $searchPaletteGroups.map((group) => ({
			...group,
			items: group.items.map((item) => ({
				item,
				flatIndex: nextFlatIndex++
			}))
		}));
	});
	const hasResults = $derived.by(() => flatResults.length > 0);
	const todayIsoDate = $derived.by(() => new Date().toISOString().slice(0, 10));
	const seasonDropdownOptions = $derived.by(() =>
		buildSearchPaletteSeasonDropdownOptions($searchPaletteSeasons, todayIsoDate)
	);
	const scopedSeasonSlug = $derived.by(() =>
		resolveSearchPaletteScopedSeasonSlug($searchPaletteSeasons, $searchPaletteScopedSeasonId)
	);

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		const tagName = target.tagName.toLowerCase();
		return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
	}

	function isResultTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			target.closest('[data-search-palette-result="true"]') !== null
		);
	}

	function closePalette(): void {
		debounceTimer && clearTimeout(debounceTimer);
		debounceTimer = null;
		abortController?.abort();
		abortController = null;
		requestSequence += 1;
		allowAutoHighlight = true;
		closeSearchPalette();
	}

	async function loadSeasonScope(): Promise<void> {
		if (!browser || !$searchPaletteOpen) return;
		setSearchPaletteLoadingSeasonScope(true);
		try {
			const response = await fetch('/api/intramural-sports/seasons');
			const payload = (await response.json()) as SearchPaletteSeasonResponse;
			if (!response.ok || !payload.success || !payload.data) {
				setSearchPaletteSeasons([]);
				setSearchPaletteScopedSeasonId('');
				return;
			}

			const nextSeasons = payload.data.seasons ?? [];
			setSearchPaletteSeasons(nextSeasons);
			setSearchPaletteScopedSeasonId(resolveSearchPaletteDefaultSeasonId(nextSeasons));
		} catch {
			setSearchPaletteSeasons([]);
			setSearchPaletteScopedSeasonId('');
		} finally {
			setSearchPaletteLoadingSeasonScope(false);
		}
	}

	async function loadResults(nextQuery: string): Promise<void> {
		if (!browser || !$searchPaletteOpen) return;
		abortController?.abort();
		abortController = new AbortController();
		const requestId = ++requestSequence;
		setSearchPaletteLoading(true);
		setSearchPaletteErrorMessage('');
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
			const payload = (await response.json()) as SearchResponse;
			if (requestId !== requestSequence) return;
			if (!response.ok || !payload.success) {
				setSearchPaletteErrorMessage(payload.error ?? 'Unable to load search results.');
				setSearchPaletteGroups([]);
				setSearchPaletteTotalCount(0);
				pendingHighlightFocusMode = null;
				setSearchPaletteHighlightedIndex(-1);
				return;
			}
			setSearchPaletteGroups(payload.groups ?? []);
			setSearchPaletteTotalCount(payload.totalCount ?? 0);
			pendingHighlightFocusMode = null;
			setSearchPaletteHighlightedIndex(
				allowAutoHighlight && (payload.totalCount ?? 0) > 0 ? 0 : -1
			);
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				if (requestId !== requestSequence) return;
				setSearchPaletteErrorMessage('Unable to load search results.');
				setSearchPaletteGroups([]);
				setSearchPaletteTotalCount(0);
				pendingHighlightFocusMode = null;
				setSearchPaletteHighlightedIndex(-1);
			}
		} finally {
			if (requestId === requestSequence) {
				setSearchPaletteLoading(false);
			}
		}
	}

	function moveHighlight(offset: -1 | 1, focusMode: SearchPaletteMovementFocusMode): void {
		if (!hasResults) return;
		pendingHighlightFocusMode = focusMode;
		const nextIndex = getNextSearchPaletteHighlightedIndex(
			$searchPaletteHighlightedIndex,
			flatResults.length,
			offset
		);
		setSearchPaletteHighlightedIndex(nextIndex);
	}

	async function rememberSelection(result: SearchResult): Promise<void> {
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

	async function selectResult(result: SearchResult): Promise<void> {
		await rememberSelection(result);
		closePalette();
		await goto(result.href);
	}

	async function selectHighlightedResult(): Promise<void> {
		if ($searchPaletteHighlightedIndex < 0 || $searchPaletteHighlightedIndex >= flatResults.length)
			return;
		await selectResult(flatResults[$searchPaletteHighlightedIndex]!.item);
	}

	function handleSeasonScopeChange(value: string): void {
		if (!value || value === $searchPaletteScopedSeasonId) return;
		setSearchPaletteScopedSeasonId(value);
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		const movementIntent = resolveSearchPaletteMovementIntent(event.key, {
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
		registerSearchPaletteInput(inputElement);
	});

	$effect(() => {
		if (!browser) return;
		const handleWindowKeydown = (event: KeyboardEvent) => {
			const isShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
			if (isShortcut && event.key.toLowerCase() === 'k') {
				if (!$searchPaletteOpen && isEditableTarget(event.target)) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				if (!$searchPaletteOpen) {
					openSearchPalette('keyboard', '');
					return;
				}
				focusSearchPaletteInput();
				return;
			}

			if (!$searchPaletteOpen) return;
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
		if (!browser || !$searchPaletteOpen) return;
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
		if (!browser || !$searchPaletteOpen) return;
		allowAutoHighlight = true;
		void loadSeasonScope();
	});

	$effect(() => {
		if (!browser || !$searchPaletteOpen) return;
		const highlightedIndex = $searchPaletteHighlightedIndex;
		const focusMode = pendingHighlightFocusMode;
		if (highlightedIndex < 0) {
			pendingHighlightFocusMode = null;
			return;
		}

		void tick().then(() => {
			if (!$searchPaletteOpen || highlightedIndex !== $searchPaletteHighlightedIndex) {
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
		if (!browser || !$searchPaletteOpen) return;
		scopedSeasonSlug;
		if (debounceTimer) clearTimeout(debounceTimer);
		const delay = $searchPaletteQuery.trim().length > 0 ? 150 : 0;
		debounceTimer = setTimeout(() => {
			void loadResults($searchPaletteQuery);
		}, delay);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function handleResultKeydown(event: KeyboardEvent): void {
		const movementIntent = resolveSearchPaletteMovementIntent(event.key, {
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

	function handleResultPointerMove(flatIndex: number): void {
		if (flatIndex === $searchPaletteHighlightedIndex) {
			return;
		}

		allowAutoHighlight = true;
		pendingHighlightFocusMode = null;
		setSearchPaletteHighlightedIndex(flatIndex);
	}
</script>

{#if $searchPaletteOpen}
	<div class="fixed inset-0 z-80 bg-secondary-950/36" role="presentation" onclick={closePalette}>
		<div
			class="pointer-events-none flex w-full justify-center px-4"
			style="padding-top: calc(var(--pwa-top-bar-offset, 0px) + 1rem);"
		>
			<div
				class="pointer-events-auto w-full max-w-3xl overflow-hidden border-2 border-neutral-950 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.18)]"
				role="dialog"
				tabindex="-1"
				aria-modal="true"
				aria-label="Search palette"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				onmouseleave={() => {
					allowAutoHighlight = false;
					clearSearchPaletteHighlightedIndex();
				}}
			>
				<div class="border-b border-neutral-500 bg-neutral-25 px-4 py-4">
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							<SearchInput
								id="search-palette-input"
								label="Search anything"
								value={$searchPaletteQuery}
								bind:inputElement
								placeholder="Search pages, members, offerings, teams, facilities, and more"
								inputClass="input-neutral min-h-12 pl-10 pr-10 text-base"
								iconClass="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-950"
								clearButtonClass="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-700 hover:text-neutral-950"
								clearIconClass="h-4 w-4"
								onInputKeydown={handleInputKeydown}
								on:input={(event) => {
									allowAutoHighlight = true;
									setSearchPaletteQuery(event.detail.value);
								}}
							/>
						</div>
						<ListboxDropdown
							options={seasonDropdownOptions}
							value={$searchPaletteScopedSeasonId}
							ariaLabel="Search season scope"
							emptyText={$searchPaletteLoadingSeasonScope
								? 'Loading seasons...'
								: 'No seasons configured.'}
							disabled={$searchPaletteLoadingSeasonScope || seasonDropdownOptions.length === 0}
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
							>{$searchPaletteLoading
								? 'Searching'
								: $searchPaletteTotalCount > 0
									? `${$searchPaletteTotalCount} Results`
									: 'Ready'}</span
						>
					</div>
				</div>

				<div
					class="max-h-[min(70vh,36rem)] overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-secondary-500 scrollbar-track-secondary-300 scrollbar-corner-secondary-300 hover:scrollbar-thumb-secondary-500 active:scrollbar-thumb-secondary-500 scrollbar-hover:scrollbar-thumb-secondary-400 scrollbar-active:scrollbar-thumb-secondary-600"
				>
					{#if $searchPaletteErrorMessage}
						<p class="px-4 py-6 text-sm text-primary-800">{$searchPaletteErrorMessage}</p>
					{:else if $searchPaletteLoading && !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">Loading results...</p>
					{:else if !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">No matches found.</p>
					{:else}
						{#each indexedGroups as group}
							<section class="border-t border-neutral-700 first:border-t-0">
								<div
									class="bg-primary-500/30 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-950"
								>
									{group.label}
								</div>
								<div class="divide-y divide-neutral-700">
									{#each group.items as entry}
										<button
											bind:this={highlightedResultButtons[entry.flatIndex]}
											type="button"
											data-search-palette-result="true"
											class={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left cursor-pointer ${
												entry.flatIndex === $searchPaletteHighlightedIndex
													? 'bg-primary-50'
													: 'bg-white hover:bg-neutral-25'
											}`}
											onmousemove={() => handleResultPointerMove(entry.flatIndex)}
											onkeydown={handleResultKeydown}
											onclick={() => {
												void selectResult(entry.item);
											}}
										>
											<div class="min-w-0">
												<p class="truncate text-sm font-semibold text-neutral-950">
													{entry.item.title}
												</p>
												{#if entry.item.subtitle}
													<p class="mt-0.5 truncate text-xs leading-5 text-neutral-700">
														{entry.item.subtitle}
													</p>
												{/if}
											</div>
											<div class="shrink-0 text-right">
												{#if entry.item.badge}
													<span
														class="inline-flex border border-neutral-500 bg-neutral-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950"
													>
														{entry.item.badge}
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
