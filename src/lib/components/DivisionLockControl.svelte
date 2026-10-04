<script lang="ts">
	import { tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { IconLock, IconLockOpen, IconRestore, IconX } from '@tabler/icons-svelte';
	import HoverTooltip from './HoverTooltip.svelte';
	import { resolveAnchoredFloatingPosition, toFixedStyle } from './floating-position.js';
	import { saveDivisionLock, type LockableDivision } from './division-lock-control.js';
	import { toast } from '$lib/toasts';

	let {
		division,
		canManage,
		apiPath,
		leagueId,
		leagueName,
		iconClass = 'h-4 w-4'
	}: {
		division: LockableDivision;
		canManage: boolean;
		apiPath: string;
		leagueId: string;
		leagueName: string;
		iconClass?: string;
	} = $props();
	let open = $state(false);
	let submitting = $state(false);
	let anchor = $state<HTMLButtonElement>();
	let panel = $state<HTMLDivElement>();
	let cancel = $state<HTMLButtonElement>();
	let panelStyle = $state('position: fixed; visibility: hidden;');
	const tooltip = $derived(
		canManage
			? division.isLocked
				? 'Click to unlock this division'
				: 'Click to lock this division'
			: division.isLocked
				? 'This division cannot be joined'
				: 'This division can be joined'
	);

	function close() {
		if (submitting) return;
		open = false;
		anchor?.focus();
	}

	function position() {
		if (!anchor || !panel) return;
		const rect = panel.getBoundingClientRect();
		const placement = resolveAnchoredFloatingPosition({
			anchorRect: anchor.getBoundingClientRect(),
			panelWidth: rect.width,
			panelHeight: rect.height,
			align: 'left',
			gapPx: 4,
			paddingPx: 8,
			preferVertical: 'bottom',
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight
		});
		panelStyle = toFixedStyle(placement, `max-width: ${placement.maxWidth}px;`);
	}

	async function save(action: 'toggle' | 'revert') {
		if (submitting || !canManage) return;
		const successMessage =
			action === 'revert'
				? 'Division lock reset to default.'
				: division.isLocked
					? 'Division unlocked.'
					: 'Division locked.';
		submitting = true;
		try {
			await saveDivisionLock(apiPath, leagueId, division, action);
			await invalidateAll();
			open = false;
			anchor?.focus();
			toast.success(successMessage, { title: leagueName });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Unable to update division lock right now.',
				{ title: leagueName }
			);
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			position();
			cancel?.focus();
		});
		const outside = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				!anchor?.contains(event.target) &&
				!panel?.contains(event.target)
			)
				close();
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || submitting) return;
			close();
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener('pointerdown', outside);
		window.addEventListener('keydown', escape, true);
		window.addEventListener('resize', position);
		window.addEventListener('scroll', position, true);
		return () => {
			window.removeEventListener('pointerdown', outside);
			window.removeEventListener('keydown', escape, true);
			window.removeEventListener('resize', position);
			window.removeEventListener('scroll', position, true);
		};
	});
</script>

<HoverTooltip text={tooltip} cursorOffsetYPx={open ? -30 : 18} wrapperClass="inline-flex shrink-0">
	{#if canManage}
		<button
			type="button"
			bind:this={anchor}
			class="inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-neutral-950 hover:text-secondary-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
			aria-label={`${division.isLocked ? 'Unlock' : 'Lock'} ${division.name}`}
			aria-haspopup="dialog"
			aria-expanded={open}
			disabled={submitting}
			onclick={() => {
				if (open) close();
				else open = true;
			}}
		>
			{#if division.isLocked}<IconLock class={iconClass} />
			{:else}<IconLockOpen class={`${iconClass} opacity-50`} />{/if}
		</button>
	{:else}
		<span
			class="inline-flex text-neutral-950"
			aria-label={division.isLocked ? 'Locked' : 'Unlocked'}
		>
			{#if division.isLocked}<IconLock class={iconClass} />
			{:else}<IconLockOpen class={`${iconClass} opacity-50`} />{/if}
		</span>
	{/if}
</HoverTooltip>

{#if open && canManage}
	<div
		bind:this={panel}
		class="z-[280] border-2 border-neutral-950 bg-white p-1 shadow-md"
		style={panelStyle}
		role="dialog"
		aria-modal="false"
		aria-label={division.isLocked ? 'Unlock division' : 'Lock division'}
	>
		<div class="flex items-center gap-1">
			<button
				type="button"
				bind:this={cancel}
				disabled={submitting}
				onclick={close}
				class="button-secondary-outlined inline-flex h-7 items-center justify-center gap-1 px-2.5 text-[11px] leading-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
			>
				<IconX class="h-3.5 w-3.5" /><span>Cancel</span>
			</button>
			<HoverTooltip
				text={division.isLocked ? 'Unlock division' : 'Lock division'}
				wrapperClass="inline-flex shrink-0"
			>
				<button
					type="button"
					disabled={submitting}
					onclick={() => void save('toggle')}
					class="inline-flex h-7 items-center justify-center gap-1 border border-primary-600 bg-primary-500 px-2.5 text-[11px] font-semibold leading-none cursor-pointer hover:bg-primary-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50 text-primary-foreground"
				>
					{#if division.isLocked}<IconLockOpen class="h-3.5 w-3.5 opacity-90" /><span>Unlock</span>
					{:else}<IconLock class="h-3.5 w-3.5" /><span>Lock</span>{/if}
				</button>
			</HoverTooltip>
			{#if division.doAutoLock === false}
				<HoverTooltip text="Use default locking" wrapperClass="ml-auto inline-flex shrink-0">
					<button
						type="button"
						disabled={submitting}
						onclick={() => void save('revert')}
						class="button-primary-outlined inline-flex h-7 items-center justify-center gap-1 px-2.5 text-[11px] leading-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
					>
						<IconRestore class="h-3.5 w-3.5" /><span>Auto</span>
					</button>
				</HoverTooltip>
			{/if}
		</div>
	</div>
{/if}
