<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		IconChevronLeft,
		IconChevronRight,
		IconLayoutDashboard,
		IconRefresh
	} from '@tabler/icons-svelte';
	import HistoryNavigationButton from '$lib/components/HistoryNavigationButton.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		type PwaHistoryEntry,
		buildPwaAddressValue,
		resolvePwaAddressNavigationTarget,
		shouldSyncPwaAddressValue
	} from '$lib/utils/pwa-navigation';

	type UrlBarProps = {
		canGoBack: boolean;
		canGoForward: boolean;
		backHistoryEntries: PwaHistoryEntry[];
		forwardHistoryEntries: PwaHistoryEntry[];
		isReloading: boolean;
		onBack: () => void;
		onForward: () => void;
		onJumpToHistory: (targetIndex: number) => void;
		onReload: () => void;
		onHome: () => void | Promise<void>;
	};

	type UrlBarKeydownEvent = KeyboardEvent & {
		currentTarget: EventTarget & HTMLInputElement;
	};

	let {
		canGoBack,
		canGoForward,
		backHistoryEntries,
		forwardHistoryEntries,
		isReloading,
		onBack,
		onForward,
		onJumpToHistory,
		onReload,
		onHome
	}: UrlBarProps = $props();

	let inputElement = $state<HTMLInputElement | null>(null);
	let inputValue = $state('');
	let isEditing = $state(false);
	let navigationInFlight = $state(false);

	const displayUrl = $derived.by(() => buildPwaAddressValue($page.url));

	const buildCurrentRoute = () =>
		`${window.location.pathname}${window.location.search}${window.location.hash}`;

	$effect(() => {
		if (
			!shouldSyncPwaAddressValue({
				isEditing,
				navigationInFlight
			})
		) {
			return;
		}

		inputValue = displayUrl;
	});

	const beginAddressEditing = () => {
		isEditing = true;
	};

	const finishAddressEditing = () => {
		isEditing = false;
	};

	const navigateToInputValue = async () => {
		if (!browser) {
			return;
		}

		const rawValue = inputElement?.value ?? inputValue;
		inputValue = rawValue;

		const navigationTarget = resolvePwaAddressNavigationTarget(rawValue, $page.url);
		if (!navigationTarget) {
			inputValue = displayUrl;
			finishAddressEditing();
			return;
		}

		if (!navigationTarget.route) {
			console.warn('PWA URL bar blocked external navigation', {
				rawValue,
				href: navigationTarget.href
			});
			inputValue = displayUrl;
			finishAddressEditing();
			return;
		}

		navigationInFlight = true;
		finishAddressEditing();

		try {
			const currentRoute = buildCurrentRoute();
			if (navigationTarget.route === currentRoute) {
				inputElement?.blur();
				navigationInFlight = false;
				return;
			}

			await goto(navigationTarget.route);

			// some installed PWA shells appear to swallow goto without error; fall back to a same-origin navigation.
			if (buildCurrentRoute() !== navigationTarget.route) {
				console.warn('PWA URL bar falling back to document navigation', {
					rawValue,
					route: navigationTarget.route,
					href: navigationTarget.href
				});
				window.location.assign(navigationTarget.href);
				return;
			}

			inputElement?.blur();
		} catch (error) {
			navigationInFlight = false;
			console.error('PWA URL bar navigation failed', {
				rawValue,
				navigationTarget,
				error
			});
			window.location.assign(navigationTarget.href);
		}
	};

	const handleAddressKeydown = (event: UrlBarKeydownEvent) => {
		if (event.key !== 'Enter') {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		inputValue = event.currentTarget.value;
		void navigateToInputValue();
	};

	afterNavigate(() => {
		navigationInFlight = false;
		inputValue = displayUrl;
	});
</script>

<div
	class="pwa-chrome-surface fixed inset-x-0 top-0 z-[70] shadow-[0_1px_0_rgba(255,255,255,0.18)] pwa-window-drag-region"
	style="padding-top: env(safe-area-inset-top, 0px); padding-right: env(titlebar-area-width, 0px);"
>
	<div
		class="relative z-[72] flex h-11 items-center gap-1 px-2"
		style="padding-right: var(--dashboard-pwa-toolbar-width, 0px);"
	>
		<HistoryNavigationButton
			ariaLabel="Go back"
			tooltip="Go back"
			disabled={!canGoBack}
			entries={backHistoryEntries}
			align="left"
			icon={IconChevronLeft}
			onNavigate={onBack}
			{onJumpToHistory}
		/>
		<HistoryNavigationButton
			ariaLabel="Go forward"
			tooltip="Go forward"
			disabled={!canGoForward}
			entries={forwardHistoryEntries}
			align="left"
			icon={IconChevronRight}
			onNavigate={onForward}
			{onJumpToHistory}
		/>
		<HoverTooltip text="Reload page">
			<button
				type="button"
				class="pwa-chrome-action pwa-window-no-drag flex h-8 w-8 cursor-pointer items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45"
				aria-label="Reload page"
				disabled={isReloading}
				onclick={onReload}
			>
				<IconRefresh class="h-4.5 w-4.5" />
			</button>
		</HoverTooltip>
		<HoverTooltip text="Open dashboard">
			<button
				type="button"
				class="pwa-chrome-action pwa-window-no-drag flex h-8 w-8 cursor-pointer items-center justify-center transition-colors duration-150"
				aria-label="Open dashboard"
				onclick={() => void onHome()}
			>
				<IconLayoutDashboard class="h-4.5 w-4.5" />
			</button>
		</HoverTooltip>
		<div class="pwa-chrome-input-shell pwa-window-no-drag flex min-w-0 flex-1">
			<input
				bind:this={inputElement}
				type="text"
				bind:value={inputValue}
				class="url-bar-input pwa-chrome-input pwa-window-no-drag px-3 h-8 flex-1 appearance-none border-0 bg-black/5 transition-colors duration-300 focus:bg-black/10 p-0 text-sm focus:outline-none focus:ring-0"
				aria-label="Page address"
				autocapitalize="none"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				placeholder="Enter an internal path"
				enterkeyhint="search"
				onfocus={beginAddressEditing}
				onblur={finishAddressEditing}
				onkeydown={handleAddressKeydown}
			/>
		</div>
	</div>
</div>

<style>
	.url-bar-input::selection {
		background: var(--color-secondary-500);
		color: var(--color-secondary-foreground);
	}

	.url-bar-input::-moz-selection {
		background: var(--color-secondary-500);
		color: var(--color-secondary-foreground);
	}
</style>
