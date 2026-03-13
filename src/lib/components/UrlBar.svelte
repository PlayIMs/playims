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
	class="fixed inset-x-0 top-0 z-[70] bg-primary text-primary-25 shadow-[0_1px_0_rgba(255,255,255,0.18)]"
	style="padding-top: env(safe-area-inset-top, 0px); padding-right: env(titlebar-area-width, 0px); -webkit-app-region: drag;"
>
	<div
		class="flex h-11 items-center gap-1 px-2"
		style="-webkit-app-region: no-drag; padding-right: var(--dashboard-pwa-toolbar-width, 0px);"
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
				class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
				aria-label="Reload page"
				onclick={onReload}
			>
				<IconRefresh class="h-4.5 w-4.5" />
			</button>
		</HoverTooltip>
		<HoverTooltip text="Open dashboard">
			<button
				type="button"
				class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
				aria-label="Open dashboard"
				onclick={() => void onHome()}
			>
				<IconLayoutDashboard class="h-4.5 w-4.5" />
			</button>
		</HoverTooltip>
		<div class="flex min-w-0 flex-1 bg-primary-600/80 focus-within:bg-primary-600">
			<input
				bind:this={inputElement}
				type="text"
				bind:value={inputValue}
				class="url-bar-input px-3 h-8 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-primary-25 focus:text-primary-05 placeholder:text-primary-100 focus:outline-none focus:ring-0"
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
		color: var(--color-secondary-05);
	}

	.url-bar-input::-moz-selection {
		background: var(--color-secondary-500);
		color: var(--color-secondary-05);
	}
</style>
