<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		IconChevronLeft,
		IconChevronRight,
		IconHome,
		IconRefresh
	} from '@tabler/icons-svelte';
	import {
		buildPwaAddressValue,
		resolvePwaAddressNavigationTarget,
		shouldSyncPwaAddressValue
	} from '$lib/utils/pwa-navigation';

	type UrlBarProps = {
		canGoBack: boolean;
		canGoForward: boolean;
		onBack: () => void;
		onForward: () => void;
		onReload: () => void;
		onHome: () => void | Promise<void>;
	};

	type UrlBarKeydownEvent = KeyboardEvent & {
		currentTarget: EventTarget & HTMLInputElement;
	};

	let { canGoBack, canGoForward, onBack, onForward, onReload, onHome }: UrlBarProps = $props();

	let inputElement = $state<HTMLInputElement | null>(null);
	let inputValue = $state('');
	let isEditing = $state(false);
	let navigationInFlight = $state(false);

	const displayUrl = $derived.by(() => buildPwaAddressValue($page.url));
	const canSubmitAddress = $derived.by(
		() => resolvePwaAddressNavigationTarget(inputValue, $page.url)?.route !== null
	);

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

	const beginAddressEditing = (event: FocusEvent) => {
		isEditing = true;
		const target = event.currentTarget;
		if (target instanceof HTMLInputElement) {
			target.select();
		}
	};

	const finishAddressEditing = () => {
		isEditing = false;
	};

	const navigateToInputValue = async (source: 'enter' | 'button') => {
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
				source,
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
					source,
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
				source,
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
		void navigateToInputValue('enter');
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
	<div class="flex h-11 items-center gap-1 px-2" style="-webkit-app-region: no-drag;">
		<button
			type="button"
			class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-45"
			aria-label="Go back"
			disabled={!canGoBack}
			onclick={onBack}
		>
			<IconChevronLeft class="h-5 w-5" />
		</button>
		<button
			type="button"
			class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-45"
			aria-label="Go forward"
			disabled={!canGoForward}
			onclick={onForward}
		>
			<IconChevronRight class="h-5 w-5" />
		</button>
		<button
			type="button"
			class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
			aria-label="Reload page"
			onclick={onReload}
		>
			<IconRefresh class="h-4.5 w-4.5" />
		</button>
		<button
			type="button"
			class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
			aria-label="Go home"
			onclick={() => void onHome()}
		>
			<IconHome class="h-4.5 w-4.5" />
		</button>
		<div class="min-w-0 flex-1 bg-primary-600/80 px-3">
			<input
				bind:this={inputElement}
				type="text"
				bind:value={inputValue}
				class="h-8 w-full border-0 bg-transparent p-0 text-sm text-primary-25 placeholder:text-primary-100 focus:outline-none focus:ring-0"
				aria-label="Page address"
				autocapitalize="none"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				placeholder="Enter an internal path"
				enterkeyhint="go"
				onfocus={beginAddressEditing}
				onblur={finishAddressEditing}
				onkeydown={handleAddressKeydown}
			/>
		</div>
		<button
			type="button"
			class="flex h-8 cursor-pointer items-center bg-primary-600 px-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-25 transition-colors duration-150 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={!canSubmitAddress}
			onclick={() => void navigateToInputValue('button')}
		>
			Go
		</button>
	</div>
</div>
