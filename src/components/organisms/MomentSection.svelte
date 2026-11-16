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
import { onMount } from "svelte";

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

onMount(() => {
	// 图片灯箱：client:only 岛挂载晚于全局 init，此处确保 [data-fancybox] 已绑定
	initFancybox();
});
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
					onclick={() => (shownCount += MOMENTS_PAGE_SIZE)}
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
