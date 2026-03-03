<script lang="ts">
	import {
		IconLayoutDashboard,
		IconCalendarWeek,
		IconBallAmericanFootball,
		IconTrophy,
		IconUserCog,
		IconBuilding,
		IconShoppingCart,
		IconCreditCard,
		IconFileText,
		IconChartBar,
		IconSettings,
		IconHelpCircle,
		IconHeadset,
		IconUser,
		IconChevronLeft,
		IconChevronRight,
		IconMessageCircle,
		IconArrowBackUp,
		IconCode
	} from '@tabler/icons-svelte';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { flip } from 'svelte/animate';
	import { cubicInOut } from 'svelte/easing';
	import {
		DASHBOARD_NAV_KEY_SET,
		mergeDashboardNavigationConfig,
		mergeDashboardNavigationLabels,
		mergeDashboardNavigationOrder,
		orderDashboardNavigationItems,
		type DashboardNavKey,
		type DashboardNavigationOrder,
		type DashboardNavigationLabels
	} from '$lib/dashboard/navigation';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ViewRoleWizard from './_wizards/ViewRoleWizard.svelte';

	type AuthRole = 'participant' | 'manager' | 'admin' | 'dev';

	let { children, data } = $props();

	let isSidebarOpen = $state(true);

	const isDashboardNavKey = (value: string): value is DashboardNavKey =>
		DASHBOARD_NAV_KEY_SET.has(value as DashboardNavKey);

	const menuItemIcons = {
		dashboard: IconLayoutDashboard,
		schedule: IconCalendarWeek,
		offerings: IconBallAmericanFootball,
		clubSports: IconTrophy,
		memberManagement: IconUserCog,
		communicationCenter: IconMessageCircle,
		facilities: IconBuilding,
		equipmentCheckout: IconShoppingCart,
		payments: IconCreditCard,
		forms: IconFileText,
		reports: IconChartBar,
		settings: IconSettings
	} as const;

	const NAVIGATION_LABELS_UPDATED_EVENT = 'playims:navigation-labels-updated';
	let navigationLabels = $state<DashboardNavigationLabels>(mergeDashboardNavigationLabels());
	let navigationOrder = $state<DashboardNavigationOrder>(mergeDashboardNavigationOrder());
	const menuItems = $derived.by(() =>
		orderDashboardNavigationItems(navigationOrder).map((item) => ({
			...item,
			label: navigationLabels[item.key],
			icon: menuItemIcons[item.key]
		}))
	);
	const navigationEntries = $derived.by(() => {
		if (!isDeveloperRole) {
			return menuItems;
		}

		const developerItem = {
			key: 'developer',
			label: 'Developer',
			href: '/dashboard/dev',
			icon: IconCode
		};
		const settingsIndex = menuItems.findIndex((item) => item.key === 'settings');
		if (settingsIndex === -1) {
			return [...menuItems, developerItem];
		}

		return [
			...menuItems.slice(0, settingsIndex + 1),
			developerItem,
			...menuItems.slice(settingsIndex + 1)
		];
	});

	const menuWidth = $derived.by(() => (isSidebarOpen ? 'w-64 xl:w-66' : 'w-14 xl:w-16'));
	const navBottomPadding = $derived.by(() => (isSidebarOpen ? 'pb-40' : 'pb-36'));

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	const activePath = $derived.by(() => $page.url.pathname);
	const isMenuItemActive = (href: string): boolean => {
		if (href === '#') {
			return false;
		}
		if (href === '/dashboard') {
			return activePath === href;
		}
		return activePath === href || activePath.startsWith(`${href}/`);
	};
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
	const normalizeRole = (value: unknown): AuthRole => {
		if (typeof value !== 'string') {
			return 'participant';
		}
		const normalized = value.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	};
	const resolveViewTargets = (baseRole: AuthRole): AuthRole[] => {
		if (baseRole === 'dev') return ['admin', 'manager', 'participant'];
		if (baseRole === 'admin') return ['manager', 'participant'];
		if (baseRole === 'manager') return ['participant'];
		return [];
	};
	const baseRole = $derived.by(() => normalizeRole(data?.authMode?.baseRole));
	const effectiveRole = $derived.by(() => normalizeRole(data?.authMode?.effectiveRole));
	const isDeveloperRole = $derived.by(() => effectiveRole === 'dev');
	const canViewAsRole = $derived.by(() => data?.authMode?.canViewAsRole === true);
	const isViewingAsRole = $derived.by(() => data?.authMode?.isViewingAsRole === true);
	const availableViewTargets = $derived.by(() => resolveViewTargets(baseRole));
	const shellInsetClass = $derived.by(() => (isViewingAsRole ? 'inset-4' : 'inset-0'));
	const sidebarHeightClass = $derived.by(() =>
		isViewingAsRole ? 'h-[calc(100dvh-2rem)]' : 'h-dvh'
	);
	const shellBorderOpacityClass = $derived.by(() =>
		isViewingAsRole ? 'opacity-100' : 'opacity-0'
	);
	const viewingModeLabel = $derived.by(() => {
		return effectiveRole.toUpperCase();
	});
	const returnModeLabel = $derived.by(() => {
		return baseRole;
	});
	const ORGANIZATION_SWITCHING_SESSION_KEY = 'playims:organization-switching';
	let roleWizardOpen = $state(false);
	let roleWizardSubmitting = $state(false);
	let revertingViewMode = $state(false);
	let viewModeBadgeError = $state('');
	let organizationSwitching = $state(false);

	$effect(() => {
		const merged = mergeDashboardNavigationConfig({
			labels: data?.navigationLabels,
			order: data?.navigationOrder
		});
		navigationLabels = merged.labels;
		navigationOrder = merged.order;
	});

	const syncOrganizationSwitchingState = () => {
		if (!browser) {
			organizationSwitching = false;
			return;
		}

		try {
			organizationSwitching =
				window.sessionStorage.getItem(ORGANIZATION_SWITCHING_SESSION_KEY) === '1';
		} catch {
			organizationSwitching = false;
		}
	};

	const openRoleWizard = () => {
		if (!canViewAsRole || isViewingAsRole || roleWizardSubmitting || organizationSwitching) {
			return;
		}
		roleWizardOpen = true;
		viewModeBadgeError = '';
	};

	const closeRoleWizard = () => {
		if (roleWizardSubmitting) {
			return;
		}
		roleWizardOpen = false;
	};

	const applyViewRole = async (targetRole: AuthRole | null) => {
		if (!browser || !canViewAsRole || roleWizardSubmitting || organizationSwitching) {
			return;
		}

		roleWizardSubmitting = true;
		viewModeBadgeError = '';
		try {
			const response = await fetch('/api/auth/view-as-role', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ targetRole })
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				viewModeBadgeError = payload?.error ?? 'Unable to update role view.';
				await invalidateAll();
				return;
			}

			roleWizardOpen = false;
			await invalidateAll();
		} catch {
			viewModeBadgeError = 'Unable to update role view.';
		} finally {
			roleWizardSubmitting = false;
		}
	};

	const exitViewMode = async () => {
		if (!browser || !isViewingAsRole || revertingViewMode || organizationSwitching) {
			return;
		}

		revertingViewMode = true;
		viewModeBadgeError = '';
		try {
			const response = await fetch('/api/auth/view-as-role', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ targetRole: null })
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

		const handleNavigationLabelsUpdated = (event: Event) => {
			const customEvent = event as CustomEvent<{
				labels?: Partial<Record<DashboardNavKey, string>>;
				order?: DashboardNavigationOrder;
			}>;
			const incomingLabels = customEvent.detail?.labels;
			const incomingOrder = customEvent.detail?.order;
			if (
				(!incomingLabels || typeof incomingLabels !== 'object') &&
				!Array.isArray(incomingOrder)
			) {
				return;
			}

			const sanitized: Partial<Record<DashboardNavKey, string>> = {};
			if (incomingLabels && typeof incomingLabels === 'object') {
				for (const [rawKey, rawLabel] of Object.entries(incomingLabels)) {
					if (!isDashboardNavKey(rawKey) || typeof rawLabel !== 'string') {
						continue;
					}
					sanitized[rawKey] = rawLabel;
				}
			}

			const merged = mergeDashboardNavigationConfig({
				labels: {
					...navigationLabels,
					...sanitized
				},
				order: Array.isArray(incomingOrder) ? incomingOrder : navigationOrder
			});
			navigationLabels = merged.labels;
			navigationOrder = merged.order;
		};

		syncOrganizationSwitchingState();

		const handleOrganizationSwitchingEvent = (event: Event) => {
			const customEvent = event as CustomEvent<{ active?: boolean }>;
			if (typeof customEvent.detail?.active === 'boolean') {
				organizationSwitching = customEvent.detail.active;
				return;
			}

			syncOrganizationSwitchingState();
		};

		const handleStorageEvent = (event: StorageEvent) => {
			if (event.key && event.key !== ORGANIZATION_SWITCHING_SESSION_KEY) {
				return;
			}

			syncOrganizationSwitchingState();
		};

		window.addEventListener(
			'playims:organization-switching',
			handleOrganizationSwitchingEvent as EventListener
		);
		window.addEventListener(
			NAVIGATION_LABELS_UPDATED_EVENT,
			handleNavigationLabelsUpdated as EventListener
		);
		window.addEventListener('storage', handleStorageEvent);
		window.addEventListener('focus', syncOrganizationSwitchingState);
		return () => {
			window.removeEventListener(
				'playims:organization-switching',
				handleOrganizationSwitchingEvent as EventListener
			);
			window.removeEventListener(
				NAVIGATION_LABELS_UPDATED_EVENT,
				handleNavigationLabelsUpdated as EventListener
			);
			window.removeEventListener('storage', handleStorageEvent);
			window.removeEventListener('focus', syncOrganizationSwitchingState);
		};
	});

	$effect(() => {
		if (!organizationSwitching) {
			return;
		}

		roleWizardOpen = false;
	});

	$effect(() => {
		if (!browser || !canViewAsRole) {
			return;
		}

		const handleViewModeShortcut = (event: KeyboardEvent) => {
			if (!(event.ctrlKey && event.shiftKey && event.code === 'KeyR')) {
				return;
			}
			if (organizationSwitching) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			if (isViewingAsRole) {
				void exitViewMode();
				return;
			}

			openRoleWizard();
		};

		window.addEventListener('keydown', handleViewModeShortcut, true);
		return () => {
			window.removeEventListener('keydown', handleViewModeShortcut, true);
		};
	});

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
		class="pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_0_1rem_var(--color-secondary-500)] transition-opacity duration-220 {shellBorderOpacityClass}"
		aria-hidden="true"
	></div>
	{#if isViewingAsRole}
		<div class="fixed right-4 top-4 z-60 inline-flex h-7 items-stretch bg-secondary-300 text-white">
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
					class="inline-flex h-full w-7 cursor-pointer items-center justify-center bg-secondary-400 text-white transition-colors duration-150 hover:bg-secondary-600 focus-visible:bg-secondary-800 disabled:cursor-wait disabled:opacity-70"
					aria-label="Return to organization role view"
					disabled={revertingViewMode || organizationSwitching}
					onclick={exitViewMode}
				>
					<IconArrowBackUp class="w-4 h-4" />
				</button>
			</HoverTooltip>
		</div>
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
						{#each navigationEntries as item (item.key)}
							<li animate:flip={{ duration: 280, easing: cubicInOut }}>
								<HoverTooltip text={isSidebarOpen ? '' : item.label} wrapperClass="block w-full">
									<a
										href={item.href}
										class="w-full whitespace-nowrap {isSidebarOpen
											? 'px-4 py-3 md:px-3 md:py-2.5 md:gap-2.5 xl:px-4 xl:py-3 xl:gap-3 flex items-center text-base md:text-sm xl:text-base'
											: 'px-2 py-3 md:px-1.5 md:py-2.5 xl:px-2 xl:py-3 flex items-center justify-center'} transition-colors duration-150 cursor-pointer {isMenuItemActive(
											item.href
										)
											? 'bg-primary-600 border-l-4 border-neutral-500 text-white'
											: 'text-primary-100 hover:bg-primary-600 hover:text-white border-l-4 border-transparent'} {item.href ===
										'#'
											? 'opacity-70 pointer-events-none'
											: ''}"
										aria-current={isMenuItemActive(item.href) ? 'page' : undefined}
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
	<ViewRoleWizard
		open={roleWizardOpen}
		formError={viewModeBadgeError}
		submitting={roleWizardSubmitting || organizationSwitching}
		{effectiveRole}
		allowedRoles={availableViewTargets}
		onRequestClose={closeRoleWizard}
		onSelectRole={(role) => void applyViewRole(role)}
	/>
</div>
