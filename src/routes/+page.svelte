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
	<title>Svelte Tailwind Template</title>
	<meta name="description" content="Svelte Tailwind Template" />
</svelte:head>

<section>
	<div class="min-h-screen flex items-center justify-center relative">
		<div class="text-center relative z-10 px-4">
			<h1
				class="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-fuchsia-400 to-violet-400 inline-block text-transparent bg-clip-text"
			>
				Hello World
			</h1>
		</div>
	</div>
</section>
