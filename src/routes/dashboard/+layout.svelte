<script lang="ts">
	import IconLayoutDashboard from '@tabler/icons-svelte/icons/layout-dashboard';
	import IconCalendarWeek from '@tabler/icons-svelte/icons/calendar-week';
	import IconBallFootball from '@tabler/icons-svelte/icons/ball-football';
	import IconTrophy from '@tabler/icons-svelte/icons/trophy';
	import IconUserCog from '@tabler/icons-svelte/icons/user-cog';
	import IconBuilding from '@tabler/icons-svelte/icons/building';
	import IconShoppingCart from '@tabler/icons-svelte/icons/shopping-cart';
	import IconCreditCard from '@tabler/icons-svelte/icons/credit-card';
	import IconFileText from '@tabler/icons-svelte/icons/file-text';
	import IconChartBar from '@tabler/icons-svelte/icons/chart-bar';
	import IconSettings from '@tabler/icons-svelte/icons/settings';
	import IconHelpCircle from '@tabler/icons-svelte/icons/help-circle';
	import IconHeadset from '@tabler/icons-svelte/icons/headset';
	import IconUser from '@tabler/icons-svelte/icons/user';
	import IconChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
	import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import IconArrowBackUp from '@tabler/icons-svelte/icons/arrow-back-up';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';

	let { children, data } = $props();

	let isSidebarOpen = $state(true);

	const menuItems = [
		{ id: 'Dashboard', label: 'Dashboard', icon: IconLayoutDashboard, href: '/dashboard' },
		{ id: 'Schedule', label: 'Schedule', icon: IconCalendarWeek, href: '/dashboard/schedule' },
		{
			id: 'Intramural Offerings',
			label: 'Intramural Offerings',
			icon: IconBallFootball,
			href: '/dashboard/offerings'
		},
		{ id: 'Club Sports', label: 'Club Sports', icon: IconTrophy, href: '#' },
		{ id: 'Member Management', label: 'Member Management', icon: IconUserCog, href: '#' },
		{
			id: 'Communication Center',
			label: 'Communication Center',
			icon: IconMessageCircle,
			href: '#'
		},
		{ id: 'Facilities', label: 'Facilities', icon: IconBuilding, href: '/dashboard/facilities' },
		{ id: 'Equipment Checkout', label: 'Equipment Checkout', icon: IconShoppingCart, href: '#' },
		{ id: 'Payments', label: 'Payments', icon: IconCreditCard, href: '#' },
		{ id: 'Forms', label: 'Forms', icon: IconFileText, href: '#' },
		{ id: 'Reports', label: 'Reports', icon: IconChartBar, href: '#' },
		{ id: 'Settings', label: 'Settings', icon: IconSettings, href: '#' }
	] as const;

	const menuWidth = $derived.by(() => (isSidebarOpen ? 'w-64 xl:w-66' : 'w-14 xl:w-16'));
	const navBottomPadding = $derived.by(() => (isSidebarOpen ? 'pb-40' : 'pb-36'));

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	const activePath = $derived.by(() => $page.url.pathname);
	const accountHref = '/dashboard/account';
	const isAccountRoute = $derived.by(
		() => activePath === accountHref || activePath.startsWith(`${accountHref}/`)
	);
	const viewerName = $derived.by(() => {
		const name = data?.viewer?.name?.trim() ?? '';
		if (name.length > 0) {
			return name;
		}

		const email = data?.viewer?.email?.trim() ?? '';
		if (email.includes('@')) {
			return email.split('@')[0];
		}

		return 'My Account';
	});
	const viewerEmail = $derived.by(() => data?.viewer?.email?.trim() ?? 'No email');
	const isViewingAsPlayer = $derived.by(() => data?.authMode?.isViewingAsPlayer === true);
	const shellInsetClass = $derived.by(() => (isViewingAsPlayer ? 'inset-4' : 'inset-0'));
	const sidebarHeightClass = $derived.by(() =>
		isViewingAsPlayer ? 'h-[calc(100dvh-2rem)]' : 'h-dvh'
	);
	const shellBorderOpacityClass = $derived.by(() =>
		isViewingAsPlayer ? 'opacity-100' : 'opacity-0'
	);
	const viewingModeLabel = $derived.by(() => {
		const effectiveRole = data?.authMode?.effectiveRole?.trim() ?? '';
		if (effectiveRole.length > 0) {
			return effectiveRole.toUpperCase();
		}
		return 'PLAYER';
	});
	const returnModeLabel = $derived.by(() => {
		const baseRole = data?.authMode?.baseRole?.trim().toLowerCase() ?? '';
		if (baseRole.length > 0) {
			return baseRole;
		}
		return 'player';
	});
	let revertingViewMode = $state(false);
	let viewModeBadgeError = $state('');

	const exitViewMode = async () => {
		if (!browser || !isViewingAsPlayer || revertingViewMode) {
			return;
		}

		revertingViewMode = true;
		viewModeBadgeError = '';
		try {
			const response = await fetch('/api/auth/view-as-player', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ enabled: false })
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				viewModeBadgeError = payload?.error ?? 'Unable to restore role view.';
				await invalidateAll();
				return;
			}

			await invalidateAll();
		} catch {
			viewModeBadgeError = 'Unable to restore role view.';
		} finally {
			revertingViewMode = false;
		}
	};

	$effect(() => {
		if (!browser) {
			return;
		}

		const html = document.documentElement;
		const body = document.body;
		const previousHtmlOverflow = html.style.overflow;
		const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
		const previousBodyOverflow = body.style.overflow;
		const previousBodyScrollbarGutter = body.style.scrollbarGutter;

		html.style.overflow = 'hidden';
		html.style.scrollbarGutter = 'auto';
		body.style.overflow = 'hidden';
		body.style.scrollbarGutter = 'auto';

		return () => {
			html.style.overflow = previousHtmlOverflow;
			html.style.scrollbarGutter = previousHtmlScrollbarGutter;
			body.style.overflow = previousBodyOverflow;
			body.style.scrollbarGutter = previousBodyScrollbarGutter;
		};
	});
</script>

<div class="h-screen box-border">
	<div
		class="pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_0_1rem_var(--color-accent-500)] transition-opacity duration-220 {shellBorderOpacityClass}"
		aria-hidden="true"
	></div>
	{#if isViewingAsPlayer}
		<div class="fixed right-4 top-4 z-60 inline-flex h-7 items-stretch bg-accent-300 text-white">
			<span
				class="inline-flex items-center px-2 text-[0.6rem] font-bold leading-none tracking-[0.08em] cursor-default"
			>
				VIEWING AS {viewingModeLabel}
			</span>
			<HoverTooltip
				text={`Return to ${returnModeLabel} view`}
				wrapperClass="inline-flex self-stretch"
			>
				<button
					type="button"
					class="inline-flex h-full w-7 cursor-pointer items-center justify-center bg-accent-400 text-white transition-colors duration-150 hover:bg-accent-600 focus-visible:bg-accent-800 disabled:cursor-wait disabled:opacity-70"
					aria-label="Return to organization role view"
					disabled={revertingViewMode}
					onclick={exitViewMode}
				>
					<IconArrowBackUp class="w-4 h-4" />
				</button>
			</HoverTooltip>
		</div>
		{#if viewModeBadgeError}
			<p
				class="fixed right-2 top-[2.15rem] z-60 border border-accent-900 bg-accent-800 px-2 py-0.5 text-[0.65rem] leading-none text-primary-100"
			>
				{viewModeBadgeError}
			</p>
		{/if}
	{/if}
	<div class="fixed overflow-auto bg-neutral-500 transition-[inset] duration-220 {shellInsetClass}">
		<div class="flex min-h-full items-start">
			<!-- Sidebar Navigation -->
			<aside
				class="bg-primary text-white relative sticky top-0 self-start flex flex-col transition-[width] duration-220 {menuWidth} {sidebarHeightClass}"
			>
				<!-- Logo Area -->
				<div
					class="p-4 border-b border-primary-600 flex items-center {isSidebarOpen
						? 'justify-between'
						: 'justify-center'}"
				>
					{#if isSidebarOpen}
						<h1 class="text-xl font-bold font-serif tracking-wider">Navigation</h1>
					{/if}
					<button
						onclick={toggleSidebar}
						class="p-2 hover:bg-primary-600 transition-colors duration-150 cursor-pointer"
						aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
						type="button"
					>
						{#if isSidebarOpen}
							<IconChevronLeft class="w-5 h-5" />
						{:else}
							<IconChevronRight class="w-5 h-5" />
						{/if}
					</button>
				</div>

				<!-- Menu -->
				<nav
					class="flex-1 p-2 {navBottomPadding} overflow-y-auto scrollbar-thin scrollbar-thumb-primary-700 scrollbar-track-primary-400 scrollbar-corner-primary-500 hover:scrollbar-thumb-primary-700 active:scrollbar-thumb-primary-700 scrollbar-hover:scrollbar-thumb-primary-800 scrollbar-active:scrollbar-thumb-primary-700"
					aria-label="Dashboard navigation"
				>
					<ul class="space-y-1">
						{#each menuItems as item}
							<li>
								<HoverTooltip text={isSidebarOpen ? '' : item.label} wrapperClass="block w-full">
									<a
										href={item.href}
										class="w-full whitespace-nowrap {isSidebarOpen
											? 'px-4 py-3 md:px-3 md:py-2.5 md:gap-2.5 xl:px-4 xl:py-3 xl:gap-3 flex items-center text-base md:text-sm xl:text-base'
											: 'px-2 py-3 md:px-1.5 md:py-2.5 xl:px-2 xl:py-3 flex items-center justify-center'} transition-colors duration-150 cursor-pointer {activePath ===
										item.href
											? 'bg-primary-600 border-l-4 border-neutral-500 text-white'
											: 'text-primary-100 hover:bg-primary-600 hover:text-white border-l-4 border-transparent'} {item.href ===
										'#'
											? 'opacity-70 pointer-events-none'
											: ''}"
										aria-current={activePath === item.href ? 'page' : undefined}
									>
										<item.icon class="w-5 h-5 md:w-4 md:h-4 xl:w-5 xl:h-5 shrink-0" />
										{#if isSidebarOpen}
											<span>{item.label}</span>
										{/if}
									</a>
								</HoverTooltip>
							</li>
						{/each}
					</ul>
				</nav>

				<div
					class="absolute bottom-0 left-0 right-0 border-t border-primary-600 bg-primary-500 p-2"
				>
					{#if isSidebarOpen}
						<div class="flex items-stretch gap-2">
							<a
								href={accountHref}
								class="flex-1 min-w-0 px-3 py-2 flex items-center gap-3 border-l-4 transition-colors duration-150 cursor-pointer {isAccountRoute
									? 'bg-primary-600 border-neutral-500 text-white'
									: 'border-transparent text-primary-100 hover:bg-primary-600 hover:text-white'}"
								aria-current={isAccountRoute ? 'page' : undefined}
							>
								<IconUser class="w-5 h-5 shrink-0" />
								<div class="min-w-0">
									<p class="text-sm font-semibold truncate">{viewerName}</p>
									<p class="text-[11px] text-primary-100 truncate">{viewerEmail}</p>
								</div>
							</a>

							<div class="flex flex-col gap-2">
								<HoverTooltip text="Tech support">
									<button
										type="button"
										class="w-10 h-10 flex items-center justify-center border border-primary-300 text-primary-50 opacity-70 cursor-not-allowed"
										aria-label="Tech support"
										disabled
									>
										<IconHeadset class="w-5 h-5" />
									</button>
								</HoverTooltip>
								<HoverTooltip text="Help">
									<button
										type="button"
										class="w-10 h-10 flex items-center justify-center border border-primary-300 text-primary-50 opacity-70 cursor-not-allowed"
										aria-label="Help"
										disabled
									>
										<IconHelpCircle class="w-5 h-5" />
									</button>
								</HoverTooltip>
							</div>
						</div>
					{:else}
						<div class="flex flex-col items-center gap-2">
							<HoverTooltip text={viewerName}>
								<a
									href={accountHref}
									class="w-10 h-10 flex items-center justify-center border transition-colors duration-150 cursor-pointer {isAccountRoute
										? 'border-primary-100 bg-primary-600 text-white'
										: 'border-primary-300 text-primary-50 hover:bg-primary-600 hover:text-white'}"
									aria-current={isAccountRoute ? 'page' : undefined}
								>
									<IconUser class="w-5 h-5" />
								</a>
							</HoverTooltip>
							<HoverTooltip text="Tech support">
								<button
									type="button"
									class="w-10 h-10 flex items-center justify-center border border-primary-300 text-primary-50 opacity-70 cursor-not-allowed"
									aria-label="Tech support"
									disabled
								>
									<IconHeadset class="w-5 h-5" />
								</button>
							</HoverTooltip>
							<HoverTooltip text="Help">
								<button
									type="button"
									class="w-10 h-10 flex items-center justify-center border border-primary-300 text-primary-50 opacity-70 cursor-not-allowed"
									aria-label="Help"
									disabled
								>
									<IconHelpCircle class="w-5 h-5" />
								</button>
							</HoverTooltip>
						</div>
					{/if}
				</div>
			</aside>

			<!-- Main Content Area -->
			<main class="min-h-full flex-1 bg-neutral">
				{@render children()}
			</main>
		</div>
	</div>
</div>
