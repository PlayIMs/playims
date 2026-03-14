<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import type { MegaSearchGroup, MegaSearchResponse, MegaSearchResult } from '$lib/search/types.js';

	let open = $state(false);
	let query = $state('');
	let groups = $state<MegaSearchGroup[]>([]);
	let totalCount = $state(0);
	let loading = $state(false);
	let errorMessage = $state('');
	let highlightedIndex = $state(-1);
	let inputElement = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;
	let lastFocusedElement = $state<HTMLElement | null>(null);
	let shortcutHint = $state('Ctrl + K');

	const flatResults = $derived.by(() =>
		groups.flatMap((group) =>
			group.items.map((item) => ({
				group,
				item
			}))
		)
	);
	const hasResults = $derived.by(() => flatResults.length > 0);

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		const tagName = target.tagName.toLowerCase();
		return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
	}

	function focusInput(): void {
		void tick().then(() => {
			inputElement?.focus();
			const valueLength = inputElement?.value.length ?? 0;
			inputElement?.setSelectionRange(valueLength, valueLength);
		});
	}

	function openPalette(): void {
		if (!browser || open) return;
		lastFocusedElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		open = true;
		query = '';
		errorMessage = '';
		groups = [];
		totalCount = 0;
		highlightedIndex = -1;
		focusInput();
	}

	function closePalette(): void {
		open = false;
		query = '';
		groups = [];
		totalCount = 0;
		errorMessage = '';
		highlightedIndex = -1;
		debounceTimer && clearTimeout(debounceTimer);
		debounceTimer = null;
		abortController?.abort();
		abortController = null;
		lastFocusedElement?.focus();
	}

	function resolveSeasonContext(): string | null {
		if (!browser) return null;
		const currentUrl = new URL(window.location.href);
		const pathSegments = currentUrl.pathname.split('/').filter(Boolean);

		if (pathSegments[0] === 'dashboard' && pathSegments[1] === 'offerings' && pathSegments[2]) {
			return decodeURIComponent(pathSegments[2]);
		}

		const seasonParam = currentUrl.searchParams.get('season');
		return seasonParam?.trim() ? seasonParam.trim() : null;
	}

	async function loadResults(nextQuery: string): Promise<void> {
		if (!browser || !open) return;
		abortController?.abort();
		abortController = new AbortController();
		loading = true;
		errorMessage = '';
		try {
			const url = new URL('/api/search', window.location.origin);
			const trimmedQuery = nextQuery.trim();
			if (trimmedQuery) {
				url.searchParams.set('q', trimmedQuery);
			}
			const seasonContext = resolveSeasonContext();
			if (seasonContext) {
				url.searchParams.set('season', seasonContext);
			}
			const response = await fetch(url, { signal: abortController.signal });
			const payload = (await response.json()) as MegaSearchResponse;
			if (!response.ok || !payload.success) {
				errorMessage = payload.error ?? 'Unable to load search results.';
				groups = [];
				totalCount = 0;
				highlightedIndex = -1;
				return;
			}
			groups = payload.groups ?? [];
			totalCount = payload.totalCount ?? 0;
			highlightedIndex = payload.totalCount > 0 ? 0 : -1;
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				errorMessage = 'Unable to load search results.';
				groups = [];
				totalCount = 0;
				highlightedIndex = -1;
			}
		} finally {
			loading = false;
		}
	}

	function moveHighlight(offset: -1 | 1): void {
		if (!hasResults) return;
		if (highlightedIndex < 0) {
			highlightedIndex = 0;
			return;
		}
		const nextIndex = highlightedIndex + offset;
		if (nextIndex < 0) {
			highlightedIndex = flatResults.length - 1;
			return;
		}
		if (nextIndex >= flatResults.length) {
			highlightedIndex = 0;
			return;
		}
		highlightedIndex = nextIndex;
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
		if (highlightedIndex < 0 || highlightedIndex >= flatResults.length) return;
		await selectResult(flatResults[highlightedIndex]!.item);
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveHighlight(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveHighlight(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			void selectHighlightedResult();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
		}
	}

	$effect(() => {
		if (!browser) return;
		const platformText = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
		shortcutHint = /(mac|iphone|ipad|ipod)/.test(platformText) ? 'Cmd + K' : 'Ctrl + K';

		const handleWindowKeydown = (event: KeyboardEvent) => {
			const isShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
			if (isShortcut && event.key.toLowerCase() === 'k') {
				if (!open && isEditableTarget(event.target)) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				if (!open) {
					openPalette();
					return;
				}
				focusInput();
				return;
			}

			if (!open) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				closePalette();
				return;
			}
			if (isEditableTarget(event.target)) return;
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				moveHighlight(1);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				moveHighlight(-1);
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				void selectHighlightedResult();
			}
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});

	$effect(() => {
		if (!browser || !open) return;
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
		if (!browser || !open) return;
		if (debounceTimer) clearTimeout(debounceTimer);
		const delay = query.trim().length > 0 ? 150 : 0;
		debounceTimer = setTimeout(() => {
			void loadResults(query);
		}, delay);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-[80] bg-secondary-950/30 backdrop-blur-[1px]"
		role="presentation"
		onclick={closePalette}
	>
		<div class="pointer-events-none flex w-full justify-center px-4 pt-4 sm:pt-6">
			<div
				class="pointer-events-auto w-full max-w-3xl overflow-hidden border-2 border-neutral-950 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.18)]"
				role="dialog"
				tabindex="-1"
				aria-modal="true"
				aria-label="Mega search"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<div class="border-b border-secondary-200 bg-neutral-25 px-4 py-4">
					<SearchInput
						id="mega-search-input"
						label="Search anything"
						value={query}
						bind:inputElement
						placeholder="Search pages, members, offerings, teams, facilities, and more"
						inputClass="input-secondary min-h-12 border-2 border-neutral-950 pl-10 pr-10 text-base"
						iconClass="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-950"
						clearButtonClass="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
						clearIconClass="h-4 w-4"
						onInputKeydown={handleInputKeydown}
						on:input={(event) => {
							query = event.detail.value;
						}}
					/>
					<div
						class="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700"
					>
						<span>{shortcutHint}</span>
						<span>{loading ? 'Searching' : totalCount > 0 ? `${totalCount} Results` : 'Ready'}</span
						>
					</div>
				</div>

				<div class="max-h-[min(70vh,36rem)] overflow-y-auto bg-white">
					{#if errorMessage}
						<p class="px-4 py-6 text-sm text-primary-800">{errorMessage}</p>
					{:else if loading && !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">Loading results...</p>
					{:else if !hasResults}
						<p class="px-4 py-6 text-sm text-neutral-950">No matches found.</p>
					{:else}
						{#each groups as group}
							<section class="border-t border-secondary-200 first:border-t-0">
								<div
									class="bg-neutral-25 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-700"
								>
									{group.label}
								</div>
								<div class="divide-y divide-secondary-200">
									{#each group.items as item}
										{@const flatIndex = flatResults.findIndex(
											(entry) => entry.item.resultKey === item.resultKey
										)}
										<button
											type="button"
											class={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left cursor-pointer ${
												flatIndex === highlightedIndex
													? 'bg-primary-50'
													: 'bg-white hover:bg-neutral-25'
											}`}
											onmouseenter={() => {
												highlightedIndex = flatIndex;
											}}
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
														class="inline-flex border border-secondary-300 bg-neutral-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950"
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
