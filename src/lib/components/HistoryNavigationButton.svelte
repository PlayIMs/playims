<script lang="ts" module>
	let historyNavigationButtonSequence = 0;

	function nextHistoryNavigationButtonId(prefix: string): string {
		historyNavigationButtonSequence += 1;
		return `${prefix}-${historyNavigationButtonSequence}`;
	}
</script>

<script lang="ts">
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		resolveAnchoredFloatingPosition,
		toFixedStyle
	} from '$lib/components/floating-position';
	import { truncatePwaHistoryRoute, type PwaHistoryEntry } from '$lib/utils/pwa-navigation';
	import { onDestroy } from 'svelte';

	type HistoryNavigationButtonProps = {
		ariaLabel: string;
		tooltip: string;
		disabled: boolean;
		entries: PwaHistoryEntry[];
		align?: 'left' | 'right';
		icon: any;
		onNavigate: () => void;
		onJumpToHistory: (targetIndex: number) => void;
	};

	let {
		ariaLabel,
		tooltip,
		disabled,
		entries,
		align = 'left',
		icon,
		onNavigate,
		onJumpToHistory
	}: HistoryNavigationButtonProps = $props();

	let rootElement = $state<HTMLDivElement | null>(null);
	let buttonElement = $state<HTMLButtonElement | null>(null);
	let panelElement = $state<HTMLDivElement | null>(null);
	let itemElements = $state<Array<HTMLButtonElement | null>>([]);
	let open = $state(false);
	let activeIndex = $state(0);
	let panelStyle = $state(
		'position: fixed; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;'
	);

	const buttonId = nextHistoryNavigationButtonId('history-navigation-button');
	const menuId = `${buttonId}-menu`;
	const hiddenPanelStyle =
		'position: fixed; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;';
	const canOpenMenu = $derived.by(() => !disabled && entries.length > 0);
	const tooltipText = $derived.by(() => (open ? '' : tooltip));

	onDestroy(() => {
		itemElements = [];
	});

	function runAfterRender(callback: () => void): void {
		if (typeof window === 'undefined') {
			return;
		}

		window.requestAnimationFrame(() => {
			callback();
		});
	}

	function positionPanel(): void {
		if (typeof window === 'undefined' || !buttonElement || !panelElement) {
			return;
		}

		const buttonRect = buttonElement.getBoundingClientRect();
		const measuredRect = panelElement.getBoundingClientRect();
		const targetWidth = Math.max(240, buttonRect.width, measuredRect.width);
		const position = resolveAnchoredFloatingPosition({
			anchorRect: buttonRect,
			panelWidth: targetWidth,
			panelHeight: measuredRect.height,
			gapPx: 4,
			align,
			preferVertical: 'bottom',
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			paddingPx: 8
		});

		panelStyle = toFixedStyle(
			position,
			`min-width: ${Math.max(buttonRect.width, 240)}px; pointer-events: auto; z-index: 90;`
		);
	}

	function openMenu(): void {
		if (!canOpenMenu) {
			return;
		}

		open = true;
		activeIndex = 0;
		runAfterRender(() => {
			positionPanel();
			itemElements[0]?.focus();
		});
	}

	function closeMenu(focusTrigger = false): void {
		if (!open) {
			return;
		}

		open = false;
		activeIndex = 0;
		panelStyle = hiddenPanelStyle;
		if (focusTrigger) {
			buttonElement?.focus();
		}
	}

	function focusItem(index: number): void {
		if (entries.length === 0) {
			return;
		}

		const clampedIndex = Math.min(Math.max(index, 0), entries.length - 1);
		activeIndex = clampedIndex;
		itemElements[clampedIndex]?.focus();
	}

	function handleButtonClick(): void {
		closeMenu();
		onNavigate();
	}

	function handleRootContextMenu(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}

		if (panelElement?.contains(target)) {
			event.preventDefault();
			return;
		}

		if (!rootElement?.contains(target)) {
			return;
		}

		if (disabled) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		if (buttonElement && !buttonElement.contains(target)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (open) {
			closeMenu(true);
			return;
		}

		openMenu();
	}

	function handleButtonKeydown(event: KeyboardEvent): void {
		if ((event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) && canOpenMenu) {
			event.preventDefault();
			if (open) {
				closeMenu(true);
				return;
			}
			void openMenu();
			return;
		}

		if (event.key === 'Escape' && open) {
			event.preventDefault();
			closeMenu(true);
		}
	}

	function handlePanelKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusItem(activeIndex + 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			focusItem(activeIndex - 1);
			return;
		}

		if (event.key === 'Home') {
			event.preventDefault();
			focusItem(0);
			return;
		}

		if (event.key === 'End') {
			event.preventDefault();
			focusItem(entries.length - 1);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu(true);
			return;
		}

		if (event.key === 'Tab') {
			closeMenu();
		}
	}

	function handlePanelFocusout(event: FocusEvent): void {
		const relatedTarget = event.relatedTarget;
		if (!(relatedTarget instanceof Node)) {
			closeMenu();
			return;
		}

		if (panelElement?.contains(relatedTarget)) {
			return;
		}

		if (buttonElement?.contains(relatedTarget)) {
			return;
		}

		closeMenu();
	}

	function jumpToEntry(targetIndex: number): void {
		closeMenu();
		onJumpToHistory(targetIndex);
	}

	$effect(() => {
		if (typeof window === 'undefined' || !open) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) {
				closeMenu();
				return;
			}

			if (rootElement?.contains(target)) {
				return;
			}

			closeMenu();
		};
		const handleViewportChange = () => {
			positionPanel();
		};

		window.addEventListener('pointerdown', handlePointerDown, true);
		window.addEventListener('resize', handleViewportChange);
		window.addEventListener('scroll', handleViewportChange, true);
		return () => {
			window.removeEventListener('pointerdown', handlePointerDown, true);
			window.removeEventListener('resize', handleViewportChange);
			window.removeEventListener('scroll', handleViewportChange, true);
		};
	});

	$effect(() => {
		if (!open) {
			return;
		}

		if (entries.length === 0) {
			closeMenu();
			return;
		}

		if (activeIndex > entries.length - 1) {
			activeIndex = entries.length - 1;
		}

		runAfterRender(() => {
			if (open) {
				positionPanel();
			}
		});
	});
</script>

<div
	class="relative inline-flex"
	role="presentation"
	bind:this={rootElement}
	oncontextmenu={handleRootContextMenu}
>
	<HoverTooltip text={tooltipText}>
		<button
			id={buttonId}
			type="button"
			class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 outline-none transition-colors duration-150 hover:bg-primary-600 focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-45"
			aria-label={ariaLabel}
			aria-haspopup={canOpenMenu ? 'menu' : undefined}
			aria-expanded={canOpenMenu ? open : undefined}
			aria-controls={canOpenMenu && open ? menuId : undefined}
			{disabled}
			bind:this={buttonElement}
			onclick={handleButtonClick}
			onkeydown={handleButtonKeydown}
		>
			{#if icon}
				{@const Icon = icon}
				<Icon class="h-5 w-5" />
			{/if}
		</button>
	</HoverTooltip>

	{#if open}
		<div
			id={menuId}
			role="menu"
			tabindex="-1"
			aria-label={`${ariaLabel} history`}
			class="fixed border-2 border-secondary-300 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
			style={panelStyle}
			bind:this={panelElement}
			onkeydown={handlePanelKeydown}
			onfocusout={handlePanelFocusout}
			oncontextmenu={(event) => {
				event.preventDefault();
			}}
		>
			<div class="flex flex-col">
				{#each entries as entry, index (entry.index)}
					<button
						type="button"
						role="menuitem"
						class={`w-full border-b border-secondary-200 px-2.5 py-1.5 text-left text-xs text-neutral-950 transition-colors duration-100 ${
							index === activeIndex
								? 'bg-neutral-300 text-neutral-950'
								: 'bg-white hover:bg-neutral-100'
						} ${index === entries.length - 1 ? 'border-b-0' : ''}`}
						bind:this={itemElements[index]}
						onfocus={() => {
							activeIndex = index;
						}}
						onmousemove={() => {
							activeIndex = index;
						}}
						onclick={() => {
							jumpToEntry(entry.index);
						}}
					>
						<span class="block truncate font-semibold leading-tight">{entry.title}</span>
						<span class="mt-0.5 block truncate text-[10px] leading-tight text-neutral-700/70">
							{truncatePwaHistoryRoute(entry.route)}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
