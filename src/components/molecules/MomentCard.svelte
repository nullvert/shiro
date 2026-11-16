<script lang="ts">
/**
 * 动态卡片（分子）：Telegram-style 简约信息卡片。
 * 去除冗余的头像/作者名，以内容为中心。
 * 支持置顶/加密徽章、Markdown 正文、内联图片画廊，
 * 右下角紧凑时间戳与状态信息。
 */
import Icon from "@components/atoms/display/Icon.svelte";
import MomentGallery from "@components/molecules/MomentGallery.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { MomentItem } from "@utils/content-utils";
import { formatLocalizedDateTime } from "@utils/date-utils";
import { reveal } from "@utils/motion";
import type { Snippet } from "svelte";

export type MomentAuthor = {
	name: string;
	avatar: string;
	avatarSrcset?: string;
	avatarWidth?: number;
	avatarHeight?: number;
	url: string;
};

let {
	moment,
	author,
	/** stagger 入场延迟 ms（由列表传入：第 i 项 i × step） */
	delay = 0,
	class: className = "",
	children,
}: {
	moment: MomentItem;
	author?: MomentAuthor;
	delay?: number;
	class?: string;
	children?: Snippet;
} = $props();

const publishedAt = $derived(new Date(moment.published));
const timeText = $derived(formatLocalizedDateTime(publishedAt));
</script>

<article class="moment-card {className}" id="moment-{moment.id}" use:reveal={{ delay }}>
	{#if moment.pinned}
		<div class="moment-card__pinned-pin" title={i18n(I18nKey.pinned)}>
			<Icon icon="material-symbols:keep-rounded" aria-hidden="true" />
		</div>
	{/if}

	{#if children}
		{@render children()}
	{:else}
		{#if moment.images.length > 0}
			<div class="moment-card__media">
				<MomentGallery images={moment.images} />
			</div>
		{/if}

		{#if moment.html.trim()}
			<div class="moment-card__content custom-md">
				<!-- 正文为构建期渲染产物（站点 markdown 插件链） -->
				{@html moment.html}
			</div>
		{/if}

		<footer class="moment-card__meta">
			<div class="moment-card__tags-and-loc">
				{#if moment.location}
					<span class="moment-card__location">
						<Icon icon="material-symbols:location-on-outline-rounded" aria-hidden="true" />
						{moment.location}
					</span>
				{/if}
				{#if moment.tags.length > 0}
					<div class="moment-card__tags">
						{#each moment.tags as tag (tag)}
							<span class="moment-card__tag">#{tag}</span>
						{/each}
					</div>
				{/if}
			</div>

			<time class="moment-card__time" datetime={moment.published}>{timeText}</time>
		</footer>
	{/if}
</article>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.moment-card
	display: flex
	flex-direction: column
	box-sizing: border-box
	width: 100%
	min-width: 0
	padding: var(--m3e-space-4) var(--m3e-space-5)
	border-radius: var(--shape-corner-l)
	background: var(--card-bg)
	border: 1px solid var(--outline-variant)
	color: var(--on-surface)
	position: relative

	&__pinned-pin
		position: absolute
		top: 0.875rem
		right: 0.875rem
		display: flex
		align-items: center
		justify-content: center
		width: 1.5rem
		height: 1.5rem
		color: var(--primary)
		opacity: 0.85
		> :global(svg)
			width: 1.125rem
			height: 1.125rem
			transform: rotate(30deg)

	&__media
		margin-bottom: var(--m3e-space-3)
		width: 100%

	&__content
		color: var(--on-surface)
		font-size: 1rem
		line-height: 1.7
		overflow-wrap: anywhere
		:global(p)
			font-size: 1rem
			line-height: 1.7
		:global(p:first-child)
			margin-top: 0
		:global(p:last-child)
			margin-bottom: 0

		:global(pre.astro-code)
			margin: 0.75rem 0
			padding: 0.875rem 1.125rem
			border-radius: var(--shape-corner-m)
			background-color: #1e1e2e !important
			color: #cdd6f4 !important
			border: 1px solid var(--outline-variant)
			overflow-x: auto
			font-size: 0.875rem
			line-height: 1.6

		:global(pre.astro-code code)
			background: transparent !important
			padding: 0 !important
			border-radius: 0 !important
			color: inherit !important
			font-family: var(--font-code, monospace)

		:global(pre.astro-code code span.line)
			display: block
			background: transparent !important

		:global(:not(pre) > code)
			padding: 0.15rem 0.4rem
			border-radius: var(--shape-corner-xs)
			background: var(--surface-container-high)
			color: var(--primary)
			font-size: 0.875em
			font-family: var(--font-code, monospace)

	&__meta
		display: flex
		align-items: center
		justify-content: space-between
		gap: var(--m3e-space-3)
		margin-top: var(--m3e-space-4)
		padding-top: var(--m3e-space-2)
		border-top: 1px solid var(--outline-variant)

	&__tags-and-loc
		display: flex
		align-items: center
		gap: var(--m3e-space-3)
		flex-wrap: wrap

	&__location
		display: inline-flex
		align-items: center
		gap: 0.25rem
		color: var(--on-surface-variant)
		font-size: 0.875rem
		> :global(svg)
			width: 0.875rem
			height: 0.875rem

	&__tags
		display: flex
		flex-wrap: wrap
		gap: 0.375rem

	&__tag
		display: inline-flex
		align-items: center
		padding: 0.15rem 0.55rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-high)
		color: var(--primary)
		font-size: 0.875rem
		font-weight: 500
		letter-spacing: 0.01em

	&__time
		margin-left: auto
		flex-shrink: 0
		display: inline-flex
		align-items: center
		gap: 0.25rem
		padding: 0.15rem 0.55rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container)
		color: var(--on-surface-variant)
		font-size: 0.875rem
		font-variant-numeric: tabular-nums
		letter-spacing: 0.01em

	@media (max-width: bp-sm - 1px)
		padding: 0.875rem 1rem
</style>
