<script lang="ts">
import LoadingIndicator from "@components/atoms/feedback/LoadingIndicator.svelte";
import AlbumCard from "@components/molecules/AlbumCard.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import type { AlbumIndexItem } from "@/types/album";

let {
	albums = [] as AlbumIndexItem[],
}: {
	albums?: AlbumIndexItem[];
	title?: string;
	subtitle?: string;
} = $props();
</script>

<div class="album-section">
	{#if albums.length > 0}
		<div class="album-section__grid">
			{#each albums as album, index (album.id)}
				<div class="album-section__item" style={`--album-delay: ${Math.min(index, 7) * 45}ms`}>
					<AlbumCard {album} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="album-section__empty">
			<Icon icon="material-symbols:search-off-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.albumsNoResults)}</span>
		</div>
	{/if}
</div>

<style lang="stylus">
.album-section
	display: block
	&__grid
		display: grid
		grid-template-columns: repeat(1, minmax(0, 1fr))
		gap: 1rem
		@media (min-width: 40rem)
			grid-template-columns: repeat(2, minmax(0, 1fr))
		@media (min-width: 75rem)
			grid-template-columns: repeat(3, minmax(0, 1fr))
	&__item
		min-width: 0
		animation: album-card-in var(--m3e-duration-long) var(--m3e-easing-emphasized-decelerate) both
		animation-delay: var(--album-delay)
	&__loading
		display: grid
		place-items: center
		min-height: 12rem
		opacity: 1
		transition: opacity var(--m3e-duration-short) var(--m3e-easing-standard)
		&--out
			opacity: 0
	&__empty
		display: grid
		place-items: center
		gap: 0.75rem
		min-height: 12rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		> :global(svg)
			width: 2rem
			height: 2rem

@keyframes album-card-in
	from
		opacity: 0
		transform: translateY(0.5rem)
	to
		opacity: 1
		transform: translateY(0)

:global(html.motion-reduced) .album-section__item
	animation: none

:global(html.motion-reduced) .album-section__loading
	transition: none

@media (prefers-reduced-motion: reduce)
	.album-section__item
		animation: none
	.album-section__loading
		transition: none
</style>
