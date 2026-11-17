<script lang="ts">
/**
 * 动态页主体（有机体）：动态流 + 加载更多。
 * 数据由页面层构建期渲染后以 props 传入（零运行时请求）。
 */
import Button from "@components/atoms/action/Button.svelte";
import Icon from "@components/atoms/display/Icon.svelte";
import MomentCard, {
	type MomentAuthor,
} from "@components/molecules/MomentCard.svelte";
import ProtectedMoment from "@components/organisms/ProtectedMoment.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { MomentItem } from "@utils/content-utils";
import { initFancybox } from "@utils/fancybox-handler";
import { initMarkdownRuntime } from "@utils/markdown-runtime";
import { onMount, tick } from "svelte";

let {
	moments = [] as MomentItem[],
	author = { name: "", avatar: "", url: "/about/" } as MomentAuthor,
}: {
	moments?: MomentItem[];
	author?: MomentAuthor;
	title?: string;
	subtitle?: string;
} = $props();

const MOMENTS_PAGE_SIZE = 10;
let shownCount = $state(MOMENTS_PAGE_SIZE);

const visibleMoments = $derived(moments.slice(0, shownCount));
const hasMore = $derived(moments.length > shownCount);

async function refreshRuntimes() {
	await tick();
	initFancybox();
	void initMarkdownRuntime();
}

onMount(() => {
	// 图片灯箱与 Markdown 运行时（代码高亮/复制、YouTube、折叠块、Mermaid 等）
	void refreshRuntimes();
});

async function handleLoadMore() {
	shownCount += MOMENTS_PAGE_SIZE;
	await refreshRuntimes();
}
</script>

<div class="moment-section">
	{#if visibleMoments.length > 0}
		<div class="moment-section__list">
			{#each visibleMoments as moment, i (moment.id)}
				{#if moment.encrypted}
					<ProtectedMoment {moment} {author} delay={Math.min(i, 7) * 45} />
				{:else}
					<MomentCard {moment} {author} delay={Math.min(i, 7) * 45} />
				{/if}
			{/each}
		</div>
		{#if hasMore}
			<div class="moment-section__more">
				<Button
					variant="outlined"
					icon="material-symbols:expand-more-rounded"
					label={i18n(I18nKey.loadMore)}
					onclick={handleLoadMore}
				/>
			</div>
		{/if}
	{:else}
		<div class="moment-section__empty">
			<Icon icon="material-symbols:search-off-outline-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.momentsNoResults)}</span>
		</div>
	{/if}
</div>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.moment-section
	display: block

	&__list
		display: grid
		grid-template-columns: minmax(0, 1fr)
		gap: 1rem

	&__more
		display: flex
		justify-content: center
		margin-top: 1.25rem

	&__empty
		display: flex
		flex-direction: column
		align-items: center
		justify-content: center
		gap: 0.75rem
		min-height: 11rem
		color: var(--on-surface-variant)
</style>
