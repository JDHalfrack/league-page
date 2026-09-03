<script>
	import { tabs } from '$lib/utils/tabs';
	import Tab, { Icon, Label } from '@smui/tab';
	import List, { Item, Graphic, Text, Separator } from '@smui/list';
	import TabBar from '@smui/tab-bar';
	import { page } from '$app/state';
	import { goto, preloadData } from '$app/navigation';
	import { enableBlog } from '$lib/utils/leagueInfo';

	let active = $state(
		tabs.find(
			tab =>
				tab.dest == page.url.pathname ||
				(tab.nest && tab.children.find(subTab => subTab.dest == page.url.pathname))
		)
	);

	let display = $state(false);
	let activeNestedTab = $state(null);
	let parentEl = $state();
	let width = $state(0);
	let height = $state(0);
	let left = $state(0);
	let innerWidth = $state();

	const openNestedMenu = (tab, event) => {
		const wasSameTab = activeNestedTab?.key === tab.key;
		const shouldClose = display && wasSameTab;

		if (shouldClose) {
			display = false;
			activeNestedTab = null;
			return;
		}

		activeNestedTab = tab;

		const tabRect = event?.currentTarget?.getBoundingClientRect?.();
		const parentRect = parentEl?.getBoundingClientRect?.();

		if (tabRect && parentRect) {
			width = tabRect.width;
			height = tabRect.bottom - parentRect.top + 1;
			left = tabRect.left - parentRect.left;
		}

		display = true;
	};

	const closeMenu = () => {
		display = false;
		activeNestedTab = null;
	};

	const subGoto = dest => {
		closeMenu();
		goto(dest);
	};

	$effect(() => {
		// Recalculate/close on viewport changes so an old menu cannot remain
		// positioned under the wrong tab after a resize.
		if (innerWidth && display) {
			display = false;
			activeNestedTab = null;
		}
	});
</script>

<svelte:window bind:innerWidth={innerWidth} />

<style>
	:global(.navBar) {
		display: inline-flex;
		position: relative;
		justify-content: center;
	}

	:global(.navBar .material-icons) {
		font-size: 1.8em;
		height: 25px;
		width: 22px;
	}

	.parent {
		position: relative;
	}

	.subMenu {
		overflow-y: hidden;
		display: block;
		position: absolute;
		z-index: 5;
		background-color: var(--fff);
		transition: all 0.4s;
	}

	.overlay {
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		z-index: 4;
	}

	:global(.mdc-deprecated-list) {
		padding: 0;
	}

	:global(.subText) {
		font-size: 0.8em;
	}

	:global(.dontDisplay) {
		display: none;
	}
</style>

<div
	tabindex="0"
	role="button"
	class="overlay"
	style="display: {display ? 'block' : 'none'};"
	onclick={closeMenu}
></div>

<div class="parent" bind:this={parentEl}>
	<TabBar class="navBar" {tabs} key={(tab) => tab.key} bind:active>
		{#snippet tab(tab)}
			{#if tab.nest}
				<Tab
					{tab}
					minWidth
					onclick={(event) => openNestedMenu(tab, event)}
				>
					<Icon class="material-icons">{tab.icon}</Icon>
					<Label>{tab.label}</Label>
				</Tab>
			{:else}
				<Tab
					class="{tab.label == 'Blog' && !enableBlog ? 'dontDisplay' : ''}"
					{tab}
					onTouchstart={() => preloadData(tab.dest)}
					onMouseover={() => preloadData(tab.dest)}
					href={tab.dest}
					minWidth
				>
					<Icon class="material-icons">{tab.icon}</Icon>
					<Label>{tab.label}</Label>
				</Tab>
			{/if}
		{/snippet}
	</TabBar>

	<div
		class="subMenu"
		style="max-height: {display && activeNestedTab
			? 49 * activeNestedTab.children.length - 1
			: 0}px;
			width: {width}px;
			top: {height}px;
			left: {left}px;
			box-shadow: 0 0 {display ? '3px' : '0'} 0 #00316b;
			border: {display ? '1px' : '0'} solid #00316b;
			border-top: none;"
	>
		<List>
			{#if activeNestedTab}
				{#each activeNestedTab.children as subTab, ix}
					<Item
						onSMUIAction={() => subGoto(subTab.dest)}
						ontouchstart={() => {
							if (subTab.label != 'Go to Sleeper') preloadData(subTab.dest);
						}}
						onmouseover={() => {
							if (subTab.label != 'Go to Sleeper') preloadData(subTab.dest);
						}}
					>
						<Graphic class="material-icons">{subTab.icon}</Graphic>
						<Text class="subText">{subTab.label}</Text>
					</Item>

					{#if ix != activeNestedTab.children.length - 1}
						<Separator />
					{/if}
				{/each}
			{/if}
		</List>
	</div>
</div>
