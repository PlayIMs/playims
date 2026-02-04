<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		IconHome,
		IconLayoutDashboard,
		IconTrophy,
		IconShieldX,
		IconArrowsShuffle
	} from '@tabler/icons-svelte';

	type Choice = 'rock' | 'paper' | 'scissors';

	let { statusText, titleText, messageText, detailText } = $props<{
		statusText: string;
		titleText: string;
		messageText: string;
		detailText?: string | null;
	}>();

	const choices = [
		{ id: 'rock', label: 'Rock', hint: 'Rock' },
		{ id: 'paper', label: 'Paper', hint: 'Paper' },
		{ id: 'scissors', label: 'Scissors', hint: 'Scissors' }
	] as const;

	let playerChoice = $state<Choice | null>(null);
	let aiChoice = $state<Choice | null>(null);
	let result = $state<'win' | 'lose' | 'tie' | null>(null);
	let wins = $state(0);
	let losses = $state(0);
	let ties = $state(0);
	let isRevealing = $state(false);
	let shakeOffset = $state(0);
	let isClient = $state(false);

	let shakeTimer: ReturnType<typeof setInterval> | null = null;
	const playerSkin = 'light';
	const scoreKey = 'playims-rps-score';

	const getLabel = (choice: Choice | null) => {
		const match = choices.find((item) => item.id === choice);
		return match ? match.label : 'None';
	};

	const getHandSrc = (choice: Choice | null, variant: 'player' | 'cpu') => {
		if (!choice) {
			return null;
		}
		return variant === 'player'
			? `/rps/${playerSkin}/${choice}.png`
			: `/rps/cpu/${choice}.png`;
	};

	let playerLabel = $derived(getLabel(playerChoice));
	let aiLabel = $derived(getLabel(aiChoice));
	let displayPlayerChoice = $derived(isRevealing ? 'rock' : playerChoice);
	let displayAiChoice = $derived(isRevealing ? 'rock' : aiChoice);
	let playerSrc = $derived(getHandSrc(displayPlayerChoice, 'player'));
	let aiSrc = $derived(getHandSrc(displayAiChoice, 'cpu'));

	onMount(() => {
		isClient = true;
		const stored = localStorage.getItem(scoreKey);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as { wins?: number; losses?: number; ties?: number };
				wins = typeof parsed.wins === 'number' ? parsed.wins : 0;
				losses = typeof parsed.losses === 'number' ? parsed.losses : 0;
				ties = typeof parsed.ties === 'number' ? parsed.ties : 0;
			} catch {
				wins = 0;
				losses = 0;
				ties = 0;
			}
		}
	});

	$effect(() => {
		if (!isClient) {
			return;
		}
		localStorage.setItem(scoreKey, JSON.stringify({ wins, losses, ties }));
	});

	const decideResult = (player: Choice, aiPick: Choice) => {
		if (player === aiPick) {
			return 'tie';
		}
		if (
			(player === 'rock' && aiPick === 'scissors') ||
			(player === 'paper' && aiPick === 'rock') ||
			(player === 'scissors' && aiPick === 'paper')
		) {
			return 'win';
		}
		return 'lose';
	};

	const clearShake = () => {
		if (shakeTimer) {
			clearInterval(shakeTimer);
			shakeTimer = null;
		}
		shakeOffset = 0;
	};

	const resolveRound = (choice: Choice, aiPick: Choice) => {
		const outcome = decideResult(choice, aiPick);
		aiChoice = aiPick;
		result = outcome;
		isRevealing = false;

		if (outcome === 'win') {
			wins += 1;
		} else if (outcome === 'lose') {
			losses += 1;
		} else {
			ties += 1;
		}
	};

	const playRound = (choice: Choice) => {
		if (isRevealing) {
			return;
		}

		const aiPick = choices[Math.floor(Math.random() * choices.length)].id;

		playerChoice = choice;
		aiChoice = null;
		result = null;
		isRevealing = true;
		clearShake();

		let step = 0;
		const totalSteps = 6;
		const shakeDistance = 8;

		shakeTimer = setInterval(() => {
			shakeOffset = step % 2 === 0 ? -shakeDistance : shakeDistance;
			step += 1;

			if (step >= totalSteps) {
				clearShake();
				resolveRound(choice, aiPick);
			}
		}, 180);
	};

	onDestroy(() => {
		clearShake();
	});
</script>

<div class="min-h-screen bg-secondary-500 flex items-center justify-center px-4 sm:px-6 lg:px-8">
	<div class="max-w-2xl w-full text-center">
		<div class="mb-8">
			<h1 class="text-8xl sm:text-9xl font-bold text-primary-500 tracking-tight">{statusText}</h1>
		</div>

		<div class="mb-8">
			<h2 class="text-2xl sm:text-3xl font-bold text-secondary-25 mb-4">{titleText}</h2>
			<p class="text-lg text-secondary-50 mb-2">{messageText}</p>
			{#if detailText}
				<p class="text-sm text-secondary-100 mt-2">{detailText}</p>
			{/if}
		</div>

		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a
				href="/"
				class="border-2 border-primary-500 bg-primary-500 text-white hover:bg-primary-600 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
			>
				<IconHome class="w-5 h-5" />
				Go Home
			</a>
			<a
				href="/dashboard"
				class="border-2 border-secondary-300 bg-secondary-400 text-secondary-25 hover:bg-secondary-300 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
			>
				<IconLayoutDashboard class="w-5 h-5" />
				Dashboard
			</a>
		</div>

		<div class="mt-10 border-2 border-secondary-300 bg-secondary-400/80 p-6 text-left">
			<div class="grid gap-4 sm:grid-cols-2">
				<div
					class={`border border-secondary-300 bg-secondary-500/70 p-4 outline outline-2 outline-offset-2 ${
						result === 'win' || result === 'tie' ? 'outline-accent-300' : 'outline-transparent'
					}`}
				>
					<div class="text-xs uppercase tracking-wide text-secondary-100">Your play</div>
					<div
						class="mt-3 flex h-24 items-center justify-center bg-secondary-500 text-secondary-25 font-semibold"
						data-hand="player"
					>
						{#if playerSrc}
							<img
								src={playerSrc}
								alt={`${playerLabel} hand`}
								class="h-24 w-24 object-contain"
								style={`image-rendering: pixelated; transform: translateY(${isRevealing ? shakeOffset : 0}px) rotate(45deg); transition: transform 180ms linear;`}
							/>
						{:else}
							<span class="text-xs text-secondary-100">Ready</span>
						{/if}
					</div>
				</div>
				<div
					class={`border border-secondary-300 bg-secondary-500/70 p-4 outline outline-2 outline-offset-2 ${
						result === 'lose' || result === 'tie' ? 'outline-accent-300' : 'outline-transparent'
					}`}
				>
					<div class="text-xs uppercase tracking-wide text-secondary-100">CPU play</div>
					<div
						class="mt-3 flex h-24 items-center justify-center bg-secondary-500 text-secondary-25 font-semibold"
						data-hand="ai"
					>
						{#if aiSrc}
							<img
								src={aiSrc}
								alt={`${aiLabel} hand`}
								class="h-24 w-24 object-contain"
								style={`image-rendering: pixelated; transform: translateY(${isRevealing ? shakeOffset : 0}px) rotate(-45deg); transition: transform 180ms linear;`}
							/>
						{:else}
							<span class="text-xs text-secondary-100">Ready</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="mt-4 grid gap-3 sm:grid-cols-3">
				{#each choices as choice}
					<button
						type="button"
						disabled={isRevealing}
						class={`cursor-pointer border border-secondary-300 px-4 py-3 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
							playerChoice === choice.id
								? 'bg-primary-500 text-white border-primary-500'
								: 'bg-secondary-500/70 text-secondary-25 hover:bg-secondary-300'
						}`}
						onclick={() => playRound(choice.id)}
					>
						<div class="flex flex-col items-center gap-2">
							<img
								src={`/rps/${playerSkin}/${choice.id}.png`}
								alt={choice.label}
								class="h-16 w-16 object-contain rotate-[45deg]"
								style="image-rendering: pixelated;"
							/>
							<span class="text-xs text-secondary-100">{choice.hint}</span>
						</div>
					</button>
				{/each}
			</div>

			<div class="mt-4 border-t border-secondary-300 pt-4">
				<div class="flex flex-wrap items-center justify-between gap-3 text-xs text-secondary-100">
					<div class="flex items-center gap-2 px-4">
						<IconTrophy class="w-4 h-4 text-accent-200" />
						<span>Wins: {wins}</span>
					</div>
					<div class="flex items-center gap-2 px-4">
						<IconShieldX class="w-4 h-4 text-primary-200" />
						<span>Losses: {losses}</span>
					</div>
					<div class="flex items-center gap-2 px-4">
						<IconArrowsShuffle class="w-4 h-4 text-secondary-100" />
						<span>Ties: {ties}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-12 pt-8 border-t-2 border-secondary-400">
			<p class="text-sm text-secondary-100">
				If you believe this is an error, please contact support.
			</p>
		</div>
	</div>
</div>
