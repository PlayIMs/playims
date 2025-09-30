<script lang="ts">
	import { onMount } from 'svelte';
	import type { Client, User } from '$lib/database';

	export let data: {
		clients: Client[];
		users: User[];
		isDevelopment: boolean;
		environment: string;
		error?: string;
	};

	let scrollY = 0;

	onMount(() => {
		console.log('=== D1 Database Query Results ===');
		console.log('Environment:', data.environment);
		console.log('Development mode:', data.isDevelopment);

		if (data.error) {
			console.error('Database error:', data.error);
		} else {
			console.log('Clients:', data.clients);
			console.log('Users:', data.users);
			console.log('Total clients:', data.clients.length);
			console.log('Total users:', data.users.length);
		}

		console.log('===================================');
	});
</script>

<svelte:head>
	<title>PlayIMs - Intramural Sports League Manager</title>
	<meta
		name="description"
		content="Manage your intramural sports leagues with PlayIMs. Easy team management, scheduling, and league administration."
	/>
</svelte:head>

<svelte:window bind:scrollY />

<div class="page-container">
	<!-- Hero Section with Parallax Background -->
	<section class="hero-section">
		<div class="parallax-bg" style="transform: translateY({scrollY * 0.8}px)"></div>

		<div class="content-container">
			<div class="hero-content" style="transform: translateY({scrollY * -0.4}px)">
				<h1 class="hero-title">
					Play<span class="title-accent">IMs</span>
				</h1>

				<p class="hero-subtitle">The ultimate platform for managing intramural sports leagues</p>

				<p class="hero-description">
					Streamline your league management with easy team registration, automated scheduling,
					real-time standings, and comprehensive statistics tracking.
				</p>

				<div class="hero-buttons">
					<button class="btn-primary" disabled>Get Started</button>
					<button class="btn-secondary" disabled>Learn More</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="features-section">
		<div class="content-container">
			<div class="section-header">
				<h2 class="section-title">Everything you need to run successful leagues</h2>
				<p class="section-subtitle">Powerful features for administrators, teams, and players</p>
			</div>

			<div class="features-grid">
				<!-- Feature 1 -->
				<div class="feature-card">
					<div class="feature-icon navy">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							></path>
						</svg>
					</div>
					<h3 class="feature-title">Team Management</h3>
					<p class="feature-description">
						Easy team registration, player rosters, and captain management tools all in one place.
					</p>
				</div>

				<!-- Feature 2 -->
				<div class="feature-card">
					<div class="feature-icon crimson">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							></path>
						</svg>
					</div>
					<h3 class="feature-title">Smart Scheduling</h3>
					<p class="feature-description">
						Automated game scheduling with conflict resolution and intelligent venue management.
					</p>
				</div>

				<!-- Feature 3 -->
				<div class="feature-card">
					<div class="feature-icon navy">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							></path>
						</svg>
					</div>
					<h3 class="feature-title">Live Standings</h3>
					<p class="feature-description">
						Real-time standings, statistics, and comprehensive league performance tracking.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Community Stats Section -->
	<section class="stats-section">
		<div
			class="parallax-accent-left"
			style="transform: translateX({(scrollY - 800) * -0.3}px)"
		></div>
		<div
			class="parallax-accent-right"
			style="transform: translateX({(scrollY - 800) * 0.3}px)"
		></div>

		<div class="content-container">
			<div class="section-header">
				<h2 class="section-title white">Our Growing Community</h2>
				<p class="section-subtitle white">Join thousands already using PlayIMs</p>
			</div>

			<!-- Stats Overview -->
			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-icon crimson">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							></path>
						</svg>
					</div>
					<div class="stat-content">
						<h3 class="stat-label">Total Users</h3>
						<p class="stat-number crimson">{data.users.length}</p>
						<p class="stat-description">Active platform users</p>
					</div>
				</div>

				<div class="stat-card">
					<div class="stat-icon navy-light">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
							></path>
						</svg>
					</div>
					<div class="stat-content">
						<h3 class="stat-label">Total Clients</h3>
						<p class="stat-number navy-light">{data.clients.length}</p>
						<p class="stat-description">Organizations using PlayIMs</p>
					</div>
				</div>
			</div>

			<!-- Data Lists -->
			{#if data.error}
				<div class="error-card">
					<p>{data.error}</p>
				</div>
			{:else}
				<div class="data-grid">
					<!-- Users List -->
					<div class="data-card">
						<div class="data-header crimson-header">
							<svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
								></path>
							</svg>
							<h3>Recent Users</h3>
						</div>
						<div class="data-list">
							{#if data.users.length > 0}
								{#each data.users.slice(0, 10) as user}
									<div class="data-item">
										<div class="avatar crimson-avatar">
											{(user.username || 'U').charAt(0).toUpperCase()}
										</div>
										<div class="data-info">
											<h4 class="data-name">{user.username || 'Unknown'}</h4>
											<p class="data-email">{user.email || 'No email'}</p>
										</div>
									</div>
								{/each}
							{:else}
								<div class="empty-state">No users found</div>
							{/if}
						</div>
					</div>

					<!-- Clients List -->
					<div class="data-card">
						<div class="data-header navy-header">
							<svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
								></path>
							</svg>
							<h3>Recent Clients</h3>
						</div>
						<div class="data-list">
							{#if data.clients.length > 0}
								{#each data.clients.slice(0, 10) as client}
									<div class="data-item">
										<div class="avatar navy-avatar">
											{(client.name || 'C').charAt(0).toUpperCase()}
										</div>
										<div class="data-info">
											<h4 class="data-name">{client.name || 'Unknown'}</h4>
											<p class="data-email">{client.email || 'No email'}</p>
										</div>
									</div>
								{/each}
							{:else}
								<div class="empty-state">No clients found</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta-section">
		<div class="content-container">
			<div class="cta-content">
				<h2 class="cta-title">Ready to Transform Your League?</h2>
				<p class="cta-description">
					Join the future of intramural sports management. We're launching in the coming years with
					features that will revolutionize how you run your leagues.
				</p>
				<div class="cta-buttons">
					<button class="btn-cta-primary" disabled>Get Early Access</button>
					<button class="btn-cta-secondary" disabled>Contact Sales</button>
				</div>
				<p class="cta-note">Building the future of league management</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="content-container">
			<p class="footer-text">&copy; {new Date().getFullYear()} PlayIMs. All rights reserved.</p>
			<p class="footer-env">Environment: {data.environment}</p>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.page-container {
		width: 100%;
		overflow-x: hidden;
	}

	.content-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	/* Hero Section */
	.hero-section {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.parallax-bg {
		position: absolute;
		inset: -10%;
		background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #7f1d1d 100%);
	}

	.hero-content {
		position: relative;
		z-index: 10;
		text-align: center;
		padding: 4rem 0;
	}

	.hero-title {
		font-size: clamp(3rem, 10vw, 6rem);
		font-weight: 800;
		color: white;
		margin: 0 0 1.5rem 0;
		letter-spacing: -0.02em;
	}

	.title-accent {
		color: #ef4444;
	}

	.hero-subtitle {
		font-size: clamp(1.25rem, 3vw, 2rem);
		color: #e2e8f0;
		margin: 0 0 1.5rem 0;
		font-weight: 300;
	}

	.hero-description {
		font-size: clamp(1rem, 2vw, 1.25rem);
		color: #cbd5e1;
		max-width: 700px;
		margin: 0 auto 3rem auto;
		line-height: 1.7;
	}

	.hero-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-primary {
		background: #dc2626;
		color: white;
		padding: 1rem 2.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: #b91c1c;
		transform: translateY(-2px);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: transparent;
		color: white;
		padding: 1rem 2.5rem;
		border: 2px solid white;
		border-radius: 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn-secondary:hover:not(:disabled) {
		background: white;
		color: #0f172a;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Features Section */
	.features-section {
		background: #f8fafc;
		padding: 6rem 0;
	}

	.section-header {
		text-align: center;
		margin-bottom: 4rem;
	}

	.section-title {
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		color: #0f172a;
		margin: 0 0 1rem 0;
	}

	.section-title.white {
		color: white;
	}

	.section-subtitle {
		font-size: clamp(1rem, 2vw, 1.25rem);
		color: #64748b;
		margin: 0;
	}

	.section-subtitle.white {
		color: #cbd5e1;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.feature-card {
		background: white;
		padding: 2.5rem 2rem;
		border-radius: 1rem;
		border-left: 4px solid #e2e8f0;
		transition: all 0.3s ease;
	}

	.feature-card:hover {
		border-left-color: #dc2626;
		transform: translateY(-4px);
	}

	.feature-icon {
		width: 4rem;
		height: 4rem;
		border-radius: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.feature-icon.navy {
		background: #1e293b;
		color: white;
	}

	.feature-icon.crimson {
		background: #dc2626;
		color: white;
	}

	.feature-icon svg {
		width: 2rem;
		height: 2rem;
	}

	.feature-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #0f172a;
		margin: 0 0 1rem 0;
	}

	.feature-description {
		font-size: 1rem;
		color: #64748b;
		line-height: 1.6;
		margin: 0;
	}

	/* Stats Section */
	.stats-section {
		position: relative;
		background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
		padding: 6rem 0;
		overflow: hidden;
	}

	.parallax-accent-left,
	.parallax-accent-right {
		position: absolute;
		width: 400px;
		height: 400px;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0.15;
	}

	.parallax-accent-left {
		top: 20%;
		left: -200px;
		background: #dc2626;
	}

	.parallax-accent-right {
		bottom: 20%;
		right: -200px;
		background: #475569;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 2rem;
		margin-bottom: 4rem;
	}

	.stat-card {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 2rem;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		transition: all 0.3s ease;
	}

	.stat-card:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.stat-icon {
		width: 4rem;
		height: 4rem;
		border-radius: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-icon.crimson {
		background: rgba(220, 38, 38, 0.2);
		color: #ef4444;
	}

	.stat-icon.navy-light {
		background: rgba(100, 116, 139, 0.2);
		color: #94a3b8;
	}

	.stat-icon svg {
		width: 2rem;
		height: 2rem;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		margin: 0 0 0.5rem 0;
	}

	.stat-number {
		font-size: 3rem;
		font-weight: 800;
		margin: 0 0 0.25rem 0;
	}

	.stat-number.crimson {
		color: #ef4444;
	}

	.stat-number.navy-light {
		color: #94a3b8;
	}

	.stat-description {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
	}

	/* Data Grid */
	.data-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 2rem;
	}

	.data-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		overflow: hidden;
	}

	.data-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.data-header.crimson-header {
		background: rgba(220, 38, 38, 0.15);
	}

	.data-header.navy-header {
		background: rgba(71, 85, 105, 0.15);
	}

	.data-header h3 {
		font-size: 1.25rem;
		font-weight: 700;
		color: white;
		margin: 0;
	}

	.header-icon {
		width: 1.5rem;
		height: 1.5rem;
		color: white;
	}

	.data-list {
		max-height: 24rem;
		overflow-y: auto;
	}

	.data-list::-webkit-scrollbar {
		width: 6px;
	}

	.data-list::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
	}

	.data-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.data-item {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: background 0.2s ease;
	}

	.data-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.25rem;
		color: white;
		flex-shrink: 0;
	}

	.avatar.crimson-avatar {
		background: linear-gradient(135deg, #ef4444, #dc2626);
	}

	.avatar.navy-avatar {
		background: linear-gradient(135deg, #64748b, #475569);
	}

	.data-info {
		flex: 1;
		min-width: 0;
	}

	.data-name {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		margin: 0 0 0.25rem 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.data-email {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: #64748b;
	}

	.error-card {
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.3);
		border-radius: 1rem;
		padding: 2rem;
		text-align: center;
		color: #fca5a5;
	}

	/* CTA Section */
	.cta-section {
		background: linear-gradient(135deg, #b91c1c 0%, #991b1b 50%, #7f1d1d 100%);
		padding: 6rem 0;
	}

	.cta-content {
		text-align: center;
		max-width: 800px;
		margin: 0 auto;
	}

	.cta-title {
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: 800;
		color: white;
		margin: 0 0 1.5rem 0;
	}

	.cta-description {
		font-size: clamp(1rem, 2vw, 1.5rem);
		color: #fecaca;
		margin: 0 0 2.5rem 0;
		line-height: 1.7;
	}

	.cta-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: 2rem;
	}

	.btn-cta-primary {
		background: white;
		color: #991b1b;
		padding: 1.25rem 3rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 1.125rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn-cta-primary:hover:not(:disabled) {
		transform: translateY(-3px);
	}

	.btn-cta-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cta-secondary {
		background: transparent;
		color: white;
		padding: 1.25rem 3rem;
		border: 2px solid white;
		border-radius: 0.5rem;
		font-size: 1.125rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn-cta-secondary:hover:not(:disabled) {
		background: white;
		color: #991b1b;
	}

	.btn-cta-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cta-note {
		font-size: 1rem;
		color: #fecaca;
		margin: 0;
	}

	/* Footer */
	.footer {
		background: #020617;
		padding: 3rem 0;
		text-align: center;
	}

	.footer-text {
		color: #94a3b8;
		margin: 0 0 0.5rem 0;
	}

	.footer-env {
		color: #64748b;
		font-size: 0.875rem;
		margin: 0;
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 0 1rem;
		}

		.features-grid,
		.data-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
