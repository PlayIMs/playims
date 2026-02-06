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
	import IconChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
	import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import { page } from '$app/stores';

	let { children } = $props();

	let isSidebarOpen = $state(true);

	const menuItems = [
		{ id: 'Dashboard', label: 'Dashboard', icon: IconLayoutDashboard, href: '/dashboard' },
		{ id: 'Schedule', label: 'Schedule', icon: IconCalendarWeek, href: '/dashboard/schedule' },
		{ id: 'Intramural Sports', label: 'Intramural Sports', icon: IconBallFootball, href: '#' },
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
		{ id: 'Settings', label: 'Settings', icon: IconSettings, href: '#' },
		{ id: 'Help', label: 'Help', icon: IconHelpCircle, href: '#' }
	] as const;

	const menuWidth = $derived.by(() => (isSidebarOpen ? 'w-66' : 'w-16'));

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	const activePath = $derived.by(() => $page.url.pathname);
</script>

<div class="flex min-h-screen">
	<!-- Sidebar Navigation -->
	<aside
		class="bg-primary text-white flex flex-col relative transition-[width] duration-200 {menuWidth}"
		style="background-color: var(--color-primary-500);"
	>
		<!-- Logo Area -->
		<div
			class="p-4 border-b border-primary-600 flex items-center {isSidebarOpen
				? 'justify-between'
				: 'justify-center'}"
		>
			{#if isSidebarOpen}
				<h1 class="text-xl font-bold font-serif">Navigation</h1>
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
		<nav class="flex-1 p-2 overflow-y-auto" aria-label="Dashboard navigation">
			<ul class="space-y-2">
				{#each menuItems as item}
					<li>
						<a
							href={item.href}
							class="w-full whitespace-nowrap {isSidebarOpen
								? 'px-4 py-3 flex items-center gap-3'
								: 'px-2 py-3 flex items-center justify-center'} transition-colors duration-150 cursor-pointer {activePath ===
							item.href
								? 'bg-primary-600 border-l-4 border-neutral-500 text-white'
								: 'text-primary-100 hover:bg-primary-600 hover:text-white border-l-4 border-transparent'} {item.href ===
							'#'
								? 'opacity-70 pointer-events-none'
								: ''}"
							title={isSidebarOpen ? '' : item.label}
							aria-current={activePath === item.href ? 'page' : undefined}
						>
							<item.icon class="w-5 h-5 shrink-0" />
							{#if isSidebarOpen}
								<span>{item.label}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<!-- Main Content Area -->
	<main class="flex-1 bg-neutral min-h-screen">
		{@render children()}
	</main>
</div>

<style>
	/* Retro flat design: no rounded corners */
	* {
		border-radius: 0 !important;
	}
</style>
