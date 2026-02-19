<script lang="ts" module>
	let dropdownIdSequence = 0;

	function nextDropdownId(prefix: string): string {
		dropdownIdSequence += 1;
		return `${prefix}-${dropdownIdSequence}`;
	}
</script>

<script lang="ts">
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import type { Snippet } from 'svelte';

	interface ListboxDropdownOption {
		value: string;
		label: string;
		statusLabel?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	type ListboxDropdownMode = 'select' | 'action';

	interface Props {
		options: ListboxDropdownOption[];
		value: string;
		ariaLabel: string;
		mode?: ListboxDropdownMode;
		placeholder?: string;
		emptyText?: string;
		noteText?: string;
		noteClass?: string;
		buttonClass?: string;
		listClass?: string;
		optionClass?: string;
		selectedOptionClass?: string;
		activeOptionClass?: string;
		disabledOptionClass?: string;
		footerActionLabel?: string;
		footerActionAriaLabel?: string;
		footerActionClass?: string;
		footerActionDisabled?: boolean;
		footerAction?: Snippet<[]>;
		footerSecondaryActionLabel?: string;
		footerSecondaryActionAriaLabel?: string;
		footerSecondaryActionClass?: string;
		footerSecondaryActionDisabled?: boolean;
		footerSecondaryAction?: Snippet<[]>;
		autoFocus?: boolean;
		align?: 'left' | 'right';
		disabled?: boolean;
		trigger?: Snippet<[boolean, ListboxDropdownOption | null]>;
	}

	let {
		options,
		value,
		ariaLabel,
		mode = 'select',
		placeholder = 'Select option',
		emptyText = 'No options available.',
		noteText,
		noteClass = 'px-3 pb-2 text-xs text-neutral-900 text-left',
		buttonClass = 'button-secondary-outlined px-3 py-1 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60',
		listClass = 'mt-1 w-64 border-2 border-secondary-300 bg-white z-20 max-h-72 overflow-y-auto',
		optionClass = 'w-full text-left px-3 py-2 text-sm cursor-pointer text-neutral-950 transition-colors duration-100 touch-manipulation',
		selectedOptionClass = 'bg-primary text-white font-semibold',
		activeOptionClass = 'bg-neutral-300 text-neutral-950',
		disabledOptionClass = 'opacity-50 cursor-not-allowed bg-white text-neutral-700',
		footerActionLabel,
		footerActionAriaLabel,
		footerActionClass = 'w-full button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center',
		footerActionDisabled = false,
		footerAction,
		footerSecondaryActionLabel,
		footerSecondaryActionAriaLabel,
		footerSecondaryActionClass = 'button-secondary-outlined px-2 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer justify-center',
		footerSecondaryActionDisabled = false,
		footerSecondaryAction,
		autoFocus = false,
		align = 'left',
		disabled = false,
		trigger
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { value: string };
		action: { value: string };
		footerAction: undefined;
		footerSecondaryAction: undefined;
	}>();

	let root = $state<HTMLDivElement | null>(null);
	let buttonElement = $state<HTMLButtonElement | null>(null);
	let panelElement = $state<HTMLDivElement | null>(null);
	let listElement = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let activeIndex = $state(-1);
	let listInlineStyle = $state('');
	let typeaheadBuffer = '';
	let typeaheadResetTimer: ReturnType<typeof setTimeout> | null = null;
	const dropdownId = nextDropdownId('dropdown');
	const buttonId = `${dropdownId}-button`;
	const listboxId = `${dropdownId}-listbox`;
	const footerActionId = `${dropdownId}-footer-action`;
	const footerSecondaryActionId = `${dropdownId}-footer-secondary-action`;

	const selectedIndex = $derived.by(() =>
		mode === 'action'
			? -1
			: options.findIndex((option) => option.value === value && !option.disabled)
	);
	const hasPrimaryFooterAction = $derived.by(() => Boolean(footerActionLabel || footerAction));
	const hasSecondaryFooterAction = $derived.by(() =>
		Boolean(footerSecondaryActionLabel || footerSecondaryAction)
	);
	const hasFooterAction = $derived.by(() => hasPrimaryFooterAction || hasSecondaryFooterAction);
	const selectedOption = $derived.by(() =>
		selectedIndex >= 0 ? (options[selectedIndex] ?? null) : null
	);
	const activeOptionId = $derived.by(() =>
		activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
	);
	const rootClass = $derived.by(() => {
		const isFullWidthTrigger = /\bw-full\b/.test(buttonClass) || /\bmin-w-full\b/.test(buttonClass);
		return `relative ${isFullWidthTrigger ? 'flex w-full' : 'inline-flex'} items-stretch`;
	});

	onDestroy(() => {
		clearTypeaheadBuffer();
	});

	function clearTypeaheadBuffer(): void {
		typeaheadBuffer = '';
		if (typeaheadResetTimer) {
			clearTimeout(typeaheadResetTimer);
			typeaheadResetTimer = null;
		}
	}

	function normalizeText(value: string): string {
		return value.toLowerCase().replace(/\s+/g, ' ').trim();
	}

	function isTypeaheadCharacter(key: string): boolean {
		return key.length === 1 && key !== '\r' && key !== '\n' && key !== '\t';
	}

	function optionLabelMatchesBuffer(label: string, normalizedBuffer: string): boolean {
		if (!normalizedBuffer) return false;
		const normalizedLabel = normalizeText(label);
		if (!normalizedLabel) return false;
		if (normalizedLabel.startsWith(normalizedBuffer)) return true;
		if (normalizedLabel.includes(` ${normalizedBuffer}`)) return true;
		return normalizedBuffer.length >= 3 && normalizedLabel.includes(normalizedBuffer);
	}

	function findNextEnabledIndex(startIndex: number, direction: 1 | -1): number {
		if (options.length === 0) return -1;
		let index = startIndex;
		for (let scanCount = 0; scanCount < options.length; scanCount += 1) {
			index = (index + direction + options.length) % options.length;
			const option = options[index];
			if (option && !option.disabled) return index;
		}
		return -1;
	}

	function findFirstEnabledIndex(): number {
		return findNextEnabledIndex(-1, 1);
	}

	function findLastEnabledIndex(): number {
		return findNextEnabledIndex(0, -1);
	}

	function setActiveIndexToSelectedOrFirst(): void {
		if (selectedIndex >= 0) {
			activeIndex = selectedIndex;
			return;
		}
		const firstEnabledIndex = findFirstEnabledIndex();
		if (firstEnabledIndex >= 0) {
			activeIndex = firstEnabledIndex;
			return;
		}
		activeIndex = -1;
	}

	function triggerFooterAction(): void {
		if (!hasPrimaryFooterAction || footerActionDisabled) return;
		dispatch('footerAction');
		closeMenu(true);
	}

	function triggerFooterSecondaryAction(): void {
		if (!hasSecondaryFooterAction || footerSecondaryActionDisabled) return;
		dispatch('footerSecondaryAction');
		closeMenu(true);
	}

	function clamp(value: number, min: number, max: number): number {
		if (max < min) return min;
		return Math.min(Math.max(value, min), max);
	}

	function positionList(): void {
		if (typeof window === 'undefined' || !buttonElement || !panelElement) return;

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const viewportPadding = 8;
		const gap = 4;
		const buttonRect = buttonElement.getBoundingClientRect();
		const measuredRect = panelElement.getBoundingClientRect();
		const listWidth = Math.max(1, measuredRect.width);
		const listHeight = Math.max(1, measuredRect.height);

		const preferredLeft = align === 'right' ? buttonRect.right - listWidth : buttonRect.left;
		const maxLeft = viewportWidth - listWidth - viewportPadding;
		const clampedLeft = clamp(preferredLeft, viewportPadding, maxLeft);
		const maxWidth = Math.max(0, viewportWidth - viewportPadding * 2);
		const minWidth = clamp(buttonRect.width, 0, maxWidth);

		const belowTop = buttonRect.bottom + gap;
		const aboveBottom = buttonRect.top - gap;
		const spaceBelow = Math.max(0, viewportHeight - belowTop - viewportPadding);
		const spaceAbove = Math.max(0, aboveBottom - viewportPadding);
		const shouldOpenAbove = spaceBelow < listHeight && spaceAbove > spaceBelow;
		const availableHeight = Math.max(0, shouldOpenAbove ? spaceAbove : spaceBelow);
		const listTop = shouldOpenAbove
			? Math.max(viewportPadding, buttonRect.top - gap - Math.min(listHeight, availableHeight))
			: belowTop;

		listInlineStyle = `position: fixed; top: ${listTop}px; left: ${clampedLeft}px; min-width: ${minWidth}px; max-width: ${maxWidth}px; max-height: ${availableHeight}px;`;
	}

	function handlePanelFocusout(event: FocusEvent): void {
		const target = event.relatedTarget;
		if (!(target instanceof Node)) {
			closeMenu();
			return;
		}
		if (panelElement?.contains(target)) return;
		if (buttonElement?.contains(target)) return;
		closeMenu();
	}

	async function openMenu(focusList = true): Promise<void> {
		if (disabled) return;
		if (!open) {
			open = true;
			setActiveIndexToSelectedOrFirst();
		}
		if (!focusList) return;
		await tick();
		positionList();
		listElement?.focus();
		scrollActiveOptionIntoView();
	}

	function closeMenu(focusTrigger = false): void {
		if (!open) return;
		open = false;
		activeIndex = -1;
		clearTypeaheadBuffer();
		if (focusTrigger) buttonElement?.focus();
	}

	function consumeEscapeEvent(event: KeyboardEvent): void {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	function scrollActiveOptionIntoView(): void {
		if (!listElement || activeIndex < 0) return;
		const activeOption = listElement.querySelector<HTMLElement>(
			`#${listboxId}-option-${activeIndex}`
		);
		activeOption?.scrollIntoView({ block: 'nearest' });
	}

	function selectOptionAtIndex(index: number): void {
		const option = options[index];
		if (!option || option.disabled) return;
		if (mode === 'action') {
			dispatch('action', { value: option.value });
			closeMenu(true);
			return;
		}
		if (option.value !== value) {
			dispatch('change', { value: option.value });
		}
		closeMenu(true);
	}

	function moveActive(direction: 1 | -1): void {
		const fromIndex = activeIndex >= 0 ? activeIndex : selectedIndex >= 0 ? selectedIndex : -1;
		const nextIndex = findNextEnabledIndex(fromIndex, direction);
		if (nextIndex < 0) return;
		activeIndex = nextIndex;
		scrollActiveOptionIntoView();
	}

	function applyTypeaheadSearch(character: string): void {
		if (options.length === 0 || !isTypeaheadCharacter(character)) return;
		typeaheadBuffer = `${typeaheadBuffer}${character.toLowerCase()}`;

		if (typeaheadResetTimer) clearTimeout(typeaheadResetTimer);
		typeaheadResetTimer = setTimeout(() => {
			typeaheadBuffer = '';
			typeaheadResetTimer = null;
		}, 700);

		const normalizedBuffer = normalizeText(typeaheadBuffer);
		if (!normalizedBuffer) return;

		const activeOption = activeIndex >= 0 ? options[activeIndex] : null;
		if (
			normalizedBuffer.length > 1 &&
			activeOption &&
			!activeOption.disabled &&
			optionLabelMatchesBuffer(activeOption.label, normalizedBuffer)
		) {
			scrollActiveOptionIntoView();
			return;
		}

		if (normalizedBuffer.length === 1) {
			const fromIndex = activeIndex >= 0 ? activeIndex : selectedIndex >= 0 ? selectedIndex : -1;
			for (let scanCount = 1; scanCount <= options.length; scanCount += 1) {
				const candidateIndex = (fromIndex + scanCount + options.length) % options.length;
				const option = options[candidateIndex];
				if (!option || option.disabled) continue;
				if (!optionLabelMatchesBuffer(option.label, normalizedBuffer)) continue;
				activeIndex = candidateIndex;
				scrollActiveOptionIntoView();
				return;
			}
			return;
		}

		for (let candidateIndex = 0; candidateIndex < options.length; candidateIndex += 1) {
			const option = options[candidateIndex];
			if (!option || option.disabled) continue;
			if (!optionLabelMatchesBuffer(option.label, normalizedBuffer)) continue;
			activeIndex = candidateIndex;
			scrollActiveOptionIntoView();
			return;
		}
	}

	function handleButtonClick(): void {
		if (open) {
			closeMenu();
			return;
		}
		void openMenu();
	}

	function handleButtonKeydown(event: KeyboardEvent): void {
		if (disabled) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!open) {
				void openMenu();
				return;
			}
			moveActive(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (!open) {
				void openMenu();
				activeIndex = findLastEnabledIndex();
				return;
			}
			moveActive(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (open) {
				if (activeIndex >= 0) selectOptionAtIndex(activeIndex);
				return;
			}
			void openMenu();
			return;
		}
		if (event.key === ' ') {
			event.preventDefault();
			if (!open) {
				void openMenu();
				return;
			}
			applyTypeaheadSearch(event.key);
			return;
		}
		if (event.key === 'Escape') {
			if (!open) return;
			consumeEscapeEvent(event);
			closeMenu();
			return;
		}
		if (event.key === 'Tab') {
			if (open) closeMenu();
			return;
		}
		if (!isTypeaheadCharacter(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
		event.preventDefault();
		if (!open) {
			void openMenu();
		}
		applyTypeaheadSearch(event.key);
	}

	function handleListKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActive(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActive(-1);
			return;
		}
		if (event.key === 'Home') {
			event.preventDefault();
			activeIndex = findFirstEnabledIndex();
			scrollActiveOptionIntoView();
			return;
		}
		if (event.key === 'End') {
			event.preventDefault();
			activeIndex = findLastEnabledIndex();
			scrollActiveOptionIntoView();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (activeIndex >= 0) selectOptionAtIndex(activeIndex);
			return;
		}
		if (event.key === 'Escape') {
			consumeEscapeEvent(event);
			closeMenu(true);
			return;
		}
		if (event.key === 'Tab') {
			if (hasFooterAction && !event.shiftKey) {
				return;
			}
			closeMenu();
			return;
		}
		if (!isTypeaheadCharacter(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
		event.preventDefault();
		applyTypeaheadSearch(event.key);
	}

	function optionClassFor(option: ListboxDropdownOption, index: number): string {
		const nextOption = options[index + 1];
		const hasBottomDivider = index < options.length - 1 && !nextOption?.separatorBefore;
		const optionBorderClass = `${hasBottomDivider ? 'border-b border-secondary-200' : 'border-b-0'} ${
			option.separatorBefore ? 'border-t border-secondary-200' : ''
		}`;
		const optionBaseClass = `${optionClass} ${optionBorderClass}`;
		const isSelected = mode === 'action' ? false : option.value === value;
		const isActive = index === activeIndex;

		if (option.disabled) {
			return `${optionBaseClass} ${disabledOptionClass}`;
		}

		if (isSelected && isActive) {
			return `${optionBaseClass} bg-primary-600 text-white font-semibold`;
		}

		if (isSelected) {
			return `${optionBaseClass} ${selectedOptionClass}`;
		}

		if (isActive) {
			return `${optionBaseClass} ${activeOptionClass}`;
		}

		return `${optionBaseClass} hover:bg-neutral-300 active:bg-neutral-300`;
	}

	function optionDisabledInfoClassFor(option: ListboxDropdownOption, index: number): string {
		const nextOption = options[index + 1];
		const hasBottomDivider = index < options.length - 1 && !nextOption?.separatorBefore;
		const optionBorderClass = `${hasBottomDivider ? 'border-b border-secondary-200' : 'border-b-0'} ${
			option.separatorBefore ? 'border-t border-secondary-200' : ''
		}`;
		const optionBaseClass = `${optionClass} ${optionBorderClass}`;
		const disabledNoOpacity = disabledOptionClass.replace(/\bopacity-\d+\b/g, '').trim();
		const normalizedDisabledClass = disabledNoOpacity.replace(/\s+/g, ' ').trim();
		return `${optionBaseClass} ${normalizedDisabledClass || 'cursor-not-allowed bg-white text-neutral-700'}`;
	}

	function optionTooltipFor(option: ListboxDropdownOption): string | undefined {
		const value = option.disabled ? option.disabledTooltip ?? option.tooltip : option.tooltip;
		if (!value) return undefined;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;

		const handleWindowPointerDown = (event: PointerEvent) => {
			if (!root) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (root.contains(target)) return;
			closeMenu();
		};

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			consumeEscapeEvent(event);
			closeMenu(true);
		};

		window.addEventListener('pointerdown', handleWindowPointerDown, true);
		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('pointerdown', handleWindowPointerDown, true);
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;
		positionList();

		const handleViewportChange = () => {
			positionList();
		};
		const resizeObserver =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(() => {
						positionList();
					});

		if (resizeObserver && buttonElement) resizeObserver.observe(buttonElement);
		if (resizeObserver && panelElement) resizeObserver.observe(panelElement);
		if (resizeObserver && listElement) resizeObserver.observe(listElement);
		window.addEventListener('resize', handleViewportChange);
		window.addEventListener('scroll', handleViewportChange, true);
		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener('resize', handleViewportChange);
			window.removeEventListener('scroll', handleViewportChange, true);
		};
	});

	$effect(() => {
		if (!open) return;
		if (activeIndex >= 0 && activeIndex < options.length && !options[activeIndex]?.disabled) return;
		setActiveIndexToSelectedOrFirst();
	});
</script>

<div class={rootClass} bind:this={root}>
	<button
		id={buttonId}
		type="button"
		class={buttonClass}
		aria-label={ariaLabel}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listboxId}
		{disabled}
		data-wizard-autofocus={autoFocus ? 'true' : undefined}
		bind:this={buttonElement}
		onclick={handleButtonClick}
		onkeydown={handleButtonKeydown}
	>
		{#if trigger}
			{@render trigger(open, selectedOption)}
		{:else}
			<span class="truncate">{selectedOption?.label ?? placeholder}</span>
			{#if open}
				<IconChevronUp class="w-4 h-4 shrink-0" />
			{:else}
				<IconChevronDown class="w-4 h-4 shrink-0" />
			{/if}
		{/if}
	</button>

	{#if open}
		<div
			class={`${listClass} fixed ${hasFooterAction ? 'flex flex-col overflow-hidden' : ''}`}
			style={listInlineStyle}
			bind:this={panelElement}
			onfocusout={handlePanelFocusout}
		>
			<div
				id={listboxId}
				role="listbox"
				aria-label={ariaLabel}
				aria-labelledby={buttonId}
				aria-activedescendant={activeOptionId}
				tabindex="0"
				class={`${hasFooterAction ? 'min-h-0 flex-1 overflow-y-auto' : ''} focus:outline-none focus-visible:outline-none`}
				bind:this={listElement}
				onkeydown={handleListKeydown}
			>
				{#if options.length === 0}
					<p class="px-3 py-2 text-xs text-neutral-900">{emptyText}</p>
				{:else}
					{#each options as option, index}
						{@const isSelectedOption = mode !== 'action' && option.value === value}
						{@const optionTooltip = optionTooltipFor(option)}
						{@const showOptionInfo = option.disabled && Boolean(optionTooltip)}
						{#if showOptionInfo}
							<div
								id={`${listboxId}-option-${index}`}
								role="option"
								aria-selected={mode === 'action' ? undefined : option.value === value}
								aria-disabled="true"
								class={`${optionDisabledInfoClassFor(option, index)} cursor-not-allowed`}
							>
								<span class="inline-flex items-center gap-2 min-w-0 text-neutral-700/50 cursor-not-allowed">
									<span class="truncate">{option.label}</span>
									{#if option.statusLabel}
										<span
											class="text-[10px] uppercase tracking-wide shrink-0 text-neutral-700/50"
										>
											({option.statusLabel})
										</span>
									{/if}
									<HoverTooltip
										text={optionTooltip ?? ''}
										placement="right"
										preferSide="right"
										align="center"
										minHorizontalGapPx={10}
										offsetPx={10}
										constrainToAncestorOverflow={false}
										maxWidthClass="max-w-72"
									>
										<button
											type="button"
											class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-700/50 cursor-help hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
											aria-label={`Why "${option.label}" is unavailable`}
											tabindex="-1"
										>
											<IconInfoCircle class="w-4 h-4" stroke={2} />
										</button>
									</HoverTooltip>
								</span>
							</div>
						{:else}
							<button
								id={`${listboxId}-option-${index}`}
								type="button"
								role="option"
								aria-selected={mode === 'action' ? undefined : option.value === value}
								aria-disabled={option.disabled ? 'true' : undefined}
								tabindex="-1"
								disabled={option.disabled}
								class={optionClassFor(option, index)}
								onclick={() => {
									selectOptionAtIndex(index);
								}}
								onmousemove={() => {
									if (!option.disabled) activeIndex = index;
								}}
							>
								<span class="inline-flex items-center gap-2 min-w-0">
									<span class="truncate">{option.label}</span>
									{#if option.statusLabel}
										<span
											class={`text-[10px] uppercase tracking-wide shrink-0 ${isSelectedOption ? 'text-white' : 'text-secondary-900'}`}
										>
											({option.statusLabel})
										</span>
									{/if}
								</span>
							</button>
						{/if}
					{/each}
				{/if}
			</div>

			{#if noteText}
				<p class={noteClass}>{noteText}</p>
			{/if}

			{#if hasFooterAction}
				<div class="border-t-2 border-secondary-300 bg-neutral-100 p-1.5">
					<div
						class={hasPrimaryFooterAction && hasSecondaryFooterAction
							? 'grid grid-cols-[minmax(0,1fr)_auto] gap-1.5'
							: ''}
					>
						{#if hasPrimaryFooterAction}
							<button
								id={footerActionId}
								type="button"
								class={footerActionClass}
								aria-label={footerActionAriaLabel ?? footerActionLabel}
								disabled={footerActionDisabled}
								onclick={triggerFooterAction}
							>
								{#if footerAction}
									{@render footerAction()}
								{:else}
									{footerActionLabel}
								{/if}
							</button>
						{/if}
						{#if hasSecondaryFooterAction}
							<button
								id={footerSecondaryActionId}
								type="button"
								class={footerSecondaryActionClass}
								aria-label={footerSecondaryActionAriaLabel ?? footerSecondaryActionLabel}
								disabled={footerSecondaryActionDisabled}
								onclick={triggerFooterSecondaryAction}
							>
								{#if footerSecondaryAction}
									{@render footerSecondaryAction()}
								{:else}
									{footerSecondaryActionLabel}
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
