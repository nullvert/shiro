<script lang="ts">
/**
 * M3E 博客原子 — ArchiveList 归档时间轴（分组可折叠，组标题数据驱动）。
 * 数据驱动：groups 为 { id, title, items: { title, href, date, tags? } }[]；
 * 组头可折叠（chevron 旋转，m3-state-layer），时间轴节点行，
 * hover 标题变 primary 右移、节点放大；分类以 primary 小徽标前置。
 * Svelte 实现：ArchivePanel（Svelte）与 Astro 演示页均可复用。
 */
import Icon from "@iconify/svelte";
import { collapse } from "@utils/motion";

export interface ArchiveItem {
	title: string;
	href: string;
	/** 展示日期（如 "08-13"） */
	date: string;
	category?: string;
	tags?: string[];
}
export interface ArchiveGroup {
	/** 折叠状态键（组内唯一）：年份 / 分类名 / 标签名 */
	id: string;
	/** 头部主文本：年份数字 / 分类名 / #标签名 */
	title: string;
	items: ArchiveItem[];
}

let {
	groups = [],
	/** 单复数文案回调，如 (n) => `${n} 篇` */
	countLabel = (count: number) => `${count} 篇`,
	/** none 全部展开 / firstExpanded 多于一排时仅首年展开 */
	collapsedByDefault = "firstExpanded" as "none" | "firstExpanded",
	/** 由上层持久化后恢复的折叠状态 */
	restoredCollapsed = undefined as Record<string, boolean> | undefined,
	onCollapsedChange = undefined as
		| ((collapsed: Record<string, boolean>) => void)
		| undefined,
	class: className = "",
}: {
	groups?: ArchiveGroup[];
	countLabel?: (count: number) => string;
	collapsedByDefault?: "none" | "firstExpanded";
	restoredCollapsed?: Record<string, boolean>;
	onCollapsedChange?: (collapsed: Record<string, boolean>) => void;
	class?: string;
} = $props();

function createCollapsedState(nextGroups: ArchiveGroup[]) {
	const collapseAllButFirst =
		collapsedByDefault === "firstExpanded" && nextGroups.length > 1;
	const next: Record<string, boolean> = {};
	nextGroups.forEach((group, index) => {
		next[group.id] =
			restoredCollapsed?.[group.id] ?? (collapseAllButFirst && index > 0);
	});
	return next;
}

let collapsed = $state<Record<string, boolean>>(createCollapsedState(groups));
let previousGroups = groups;
let previousRestoredCollapsed = restoredCollapsed;
let animatedGroupId = $state<string | null>(null);

// 数据重组或持久状态恢复时直接落到终态；只有用户点击的组播放动画。
$effect(() => {
	if (
		groups === previousGroups &&
		restoredCollapsed === previousRestoredCollapsed
	) {
		return;
	}
	previousGroups = groups;
	previousRestoredCollapsed = restoredCollapsed;
	animatedGroupId = null;
	collapsed = createCollapsedState(groups);
});

function toggleGroup(id: string) {
	animatedGroupId = id;
	collapsed[id] = !collapsed[id];
	onCollapsedChange?.({ ...collapsed });
}
</script>

<div class="m3-blog-archive {className}">
	{#each groups as g (g.id)}
		<section class="m3-blog-archive__group">
			<button
				type="button"
				class="m3-blog-archive__header m3-state-layer"
				aria-expanded={!collapsed[g.id]}
				onclick={() => toggleGroup(g.id)}
			>
				<span class="m3-blog-archive__group-title">{g.title}</span>
				<div class="m3-blog-archive__group-meta">
					<span class="m3-blog-archive__count">{countLabel(g.items.length)}</span>
					<span
						class="m3-blog-archive__chevron"
						class:m3-blog-archive__chevron--open={!collapsed[g.id]}
						aria-hidden="true"
					>
						<Icon icon="material-symbols:keyboard-arrow-down-rounded" />
					</span>
				</div>
			</button>

			<div
				class="m3-blog-archive__body"
				use:collapse={{
					open: !collapsed[g.id],
					animate: animatedGroupId === g.id,
					resetKey: groups,
				}}
			>
				<ul class="m3-blog-archive__list">
					{#each g.items as it (it.href)}
						<li class="m3-blog-archive__row">
							<a class="m3-blog-archive__item" href={it.href}>
								<time class="m3-blog-archive__date">{it.date}</time>
								<span class="m3-blog-archive__title-text">{it.title}</span>
								{#if it.category}
									<span class="m3-blog-archive__cat">{it.category}</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}
</div>

<style lang="stylus">
@import "../../../styles/breakpoints.styl"

.m3-blog-archive
	&__group + &__group
		margin-top: 1.5rem

	&__header
		display: flex
		align-items: center
		justify-content: space-between
		width: 100%
		padding: 0.75rem 0.75rem
		border: none
		border-radius: var(--shape-corner-m)
		background: transparent
		box-shadow: none
		text-align: left
		cursor: pointer
		color: inherit
		--m3e-state-color: var(--on-surface)
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			color var(--m3e-duration-short) var(--m3e-easing-standard)

		&:hover
			background: unquote("color-mix(in oklab, var(--on-surface) 5%, transparent)")

		&:active
			background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px

	&__group-title
		font-family: inherit
		font-size: 1.375rem
		font-weight: 700
		letter-spacing: -0.02em
		color: var(--on-surface)
		line-height: 1.2

	&__group-meta
		display: flex
		align-items: center
		gap: 0.625rem

	&__count
		display: inline-flex
		align-items: center
		padding: 0.125rem 0.5rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-high)
		font-size: 0.75rem
		font-weight: 500
		color: var(--on-surface-variant)
		line-height: 1.3

	&__chevron
		display: inline-flex
		align-items: center
		justify-content: center
		width: 1.75rem
		height: 1.75rem
		border-radius: var(--shape-corner-full)
		color: var(--on-surface-variant)
		transition:
			color var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

		> :global(svg)
			width: 1.25rem
			height: 1.25rem

		.m3-blog-archive__header:hover &
			color: var(--on-surface)

		&--open
			transform: rotate(180deg)

	&__list
		display: flex
		flex-direction: column
		list-style: none
		margin: 0
		padding: 0

	&__row
		border-bottom: 1px solid unquote("color-mix(in oklab, var(--outline-variant) 25%, transparent)")
		&:last-child
			border-bottom: none

	&__item
		display: grid
		grid-template-columns: 5.5rem 1fr auto
		align-items: center
		gap: 1.5rem
		width: 100%
		padding: 0.875rem 0.75rem
		border-radius: var(--shape-corner-s)
		text-decoration: none
		color: inherit
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-short) var(--m3e-easing-standard)

		&:hover
			background: unquote("color-mix(in oklab, var(--on-surface) 6%, transparent)")

			.m3-blog-archive__title-text
				color: var(--primary)

			.m3-blog-archive__date
				color: var(--on-surface)

			.m3-blog-archive__cat
				background: unquote("color-mix(in oklab, var(--primary) 15%, var(--surface-container-high))")
				color: var(--primary)

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: -2px

	&__date
		font-family: var(--font-mono, monospace)
		font-size: 0.8125rem
		font-weight: 500
		letter-spacing: 0.02em
		color: var(--on-surface-variant)
		white-space: nowrap
		transition: color var(--m3e-duration-short) var(--m3e-easing-standard)

	&__title-text
		font-size: 0.9375rem
		font-weight: 500
		line-height: 1.4
		color: var(--on-surface)
		transition: color var(--m3e-duration-short) var(--m3e-easing-standard)
		overflow-wrap: anywhere

	&__cat
		font-size: 0.75rem
		font-weight: 500
		color: var(--on-surface-variant)
		white-space: nowrap
		padding: 0.125rem 0.625rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container)
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			color var(--m3e-duration-short) var(--m3e-easing-standard)

	@media (max-width: bp-sm - 1px)
		&__group + &__group
			margin-top: 1.25rem

		&__header
			padding: 0.5rem 0.25rem

		&__group-title
			font-size: 1.125rem

		&__count
			font-size: 0.6875rem
			padding: 0.0625rem 0.375rem

		&__chevron
			width: 1.5rem
			height: 1.5rem

		&__item
			grid-template-columns: 3.5rem 1fr
			gap: 0.625rem
			padding: 0.625rem 0.25rem

		&__date
			font-size: 0.75rem

		&__title-text
			font-size: 0.8125rem
			line-height: 1.35

		&__cat
			display: none
</style>
