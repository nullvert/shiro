<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import ProgressIndicator from "@components/atoms/feedback/ProgressIndicator.svelte";
import Dialog from "@components/atoms/overlay/Dialog.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import {
	generateSharePoster,
	getSharePosterPalette,
	sanitizeFilename,
} from "@utils/share-poster";
import { showSnackbar } from "@utils/snackbar";
import { onDestroy, onMount } from "svelte";
import type { ArticleShareOptions } from "@/config/articleConfig";

let {
	options,
	title,
	description,
	author,
	published,
	siteTitle,
	postPath,
	coverSelector = "#post-cover img",
	avatarUrl = "",
	class: className = "",
}: {
	options: ArticleShareOptions;
	title: string;
	description: string;
	author: string;
	published: string;
	siteTitle: string;
	postPath: string;
	coverSelector?: string;
	avatarUrl?: string;
	class?: string;
} = $props();

let shareDialogOpen = $state(false);
let posterState = $state<"idle" | "generating" | "ready" | "error">("idle");
let posterBlobUrl = $state<string | null>(null);
let posterAbortController: AbortController | null = null;
let currentGenerationToken = 0;
let copied = $state(false);
let copyTimeout: number | null = null;

function formatString(
	template: string,
	replacements: Record<string, string>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(_, key) => replacements[key] ?? `{${key}}`,
	);
}

function revokeBlobUrl() {
	if (posterBlobUrl) {
		URL.revokeObjectURL(posterBlobUrl);
		posterBlobUrl = null;
	}
}

function invalidatePoster() {
	currentGenerationToken++;
	posterAbortController?.abort();
	posterAbortController = null;
	posterState = "idle";
	revokeBlobUrl();
}

onMount(() => {
	const root = document.documentElement;
	let dark = root.classList.contains("dark");
	const observer = new MutationObserver(() => {
		const nextDark = root.classList.contains("dark");
		if (nextDark === dark) return;
		dark = nextDark;

		if (shareDialogOpen) {
			void startGeneratePoster();
		} else {
			invalidatePoster();
		}
	});
	observer.observe(root, { attributes: true, attributeFilter: ["class"] });

	return () => observer.disconnect();
});

onDestroy(() => {
	if (posterAbortController) {
		posterAbortController.abort();
		posterAbortController = null;
	}
	if (copyTimeout) {
		clearTimeout(copyTimeout);
		copyTimeout = null;
	}
	revokeBlobUrl();
});

function getAbsolutePostUrl(): string {
	if (typeof window === "undefined") return postPath;
	const origin = window.location.origin;
	const cleanPath = postPath.startsWith("/") ? postPath : `/${postPath}`;
	return `${origin}${cleanPath}`.split("?")[0].split("#")[0];
}

async function copyPostLink() {
	const url = getAbsolutePostUrl();
	try {
		await navigator.clipboard.writeText(url);
		showSnackbar(i18n(I18nKey.copySuccess), {
			icon: "material-symbols:link-rounded",
		});
		copied = true;
		if (copyTimeout) clearTimeout(copyTimeout);
		copyTimeout = window.setTimeout(() => {
			copied = false;
		}, 2000);
	} catch {
		showSnackbar(i18n(I18nKey.copyFailed), {
			icon: "material-symbols:error-outline-rounded",
		});
	}
}

async function startGeneratePoster() {
	if (posterAbortController) {
		posterAbortController.abort();
	}
	posterAbortController = new AbortController();
	const generationToken = ++currentGenerationToken;

	posterState = "generating";
	revokeBlobUrl();

	try {
		let coverUrl: string | undefined;
		if (
			options.includeCover &&
			coverSelector &&
			typeof document !== "undefined"
		) {
			const imgEl = document.querySelector<HTMLImageElement>(coverSelector);
			if (imgEl) {
				coverUrl = imgEl.currentSrc || imgEl.src;
			}
		}

		const palette = getSharePosterPalette();
		const postUrl = getAbsolutePostUrl();

		const blob = await generateSharePoster({
			title,
			description,
			author,
			published,
			siteTitle,
			url: postUrl,
			coverUrl,
			avatarUrl,
			labels: {
				author: i18n(I18nKey.author),
				scanToRead: i18n(I18nKey.scanToRead),
			},
			palette,
			signal: posterAbortController.signal,
		});

		if (generationToken !== currentGenerationToken) {
			return;
		}

		posterBlobUrl = URL.createObjectURL(blob);
		posterState = "ready";
	} catch (err) {
		if (generationToken === currentGenerationToken) {
			posterState = "error";
		}
	}
}

function openShareDialog() {
	shareDialogOpen = true;
	if (posterState !== "ready") {
		startGeneratePoster();
	}
}

function downloadPoster() {
	if (!posterBlobUrl) return;
	const cleanTitle = sanitizeFilename(title, "article-share");
	const link = document.createElement("a");
	link.href = posterBlobUrl;
	link.download = `${cleanTitle}.png`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
</script>

<div
	class={`article-share-actions flex items-center ${className}`}
	data-article-share
>
	<Button
		variant="filled"
		size="small"
		label={i18n(I18nKey.shareArticle)}
		onclick={openShareDialog}
		class="article-share-btn"
	/>

	<!-- Share Dialog -->
	{#if shareDialogOpen}
		<Dialog bind:open={shareDialogOpen} title={i18n(I18nKey.shareArticle)} class="article-share-dialog">
			<div class="share-dialog-content">
				{#if posterState === "generating"}
					<div class="share-poster-status share-poster-status--loading">
						<ProgressIndicator variant="circular" label={i18n(I18nKey.generatingSharePoster)} />
						<p>{i18n(I18nKey.generatingSharePoster)}</p>
					</div>
				{:else if posterState === "ready" && posterBlobUrl}
					<div class="share-poster-preview">
						<img
							src={posterBlobUrl}
							alt={formatString(i18n(I18nKey.sharePosterPreviewAlt), { title })}
							class="share-poster-preview__img"
						/>
					</div>
				{:else if posterState === "error"}
					<div class="share-poster-status share-poster-status--error" role="alert">
						<span class="share-poster-status__icon" aria-hidden="true">
							<Icon icon="material-symbols:error-outline-rounded" />
						</span>
						<p>{i18n(I18nKey.sharePosterFailed)}</p>
					</div>
				{/if}
			</div>

			{#snippet actions()}
				<div class="share-dialog-actions grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
					<Button
						variant="tonal"
						size="medium"
						full
						icon={copied ? "material-symbols:check-rounded" : "material-symbols:link-rounded"}
						label={copied ? i18n(I18nKey.copySuccess) : i18n(I18nKey.copyLink)}
						onclick={copyPostLink}
					/>

					{#if posterState === "error"}
						<Button
							variant="filled"
							size="medium"
							full
							icon="material-symbols:refresh-rounded"
							label={i18n(I18nKey.retry)}
							onclick={startGeneratePoster}
						/>
					{:else}
						<Button
							variant="filled"
							size="medium"
							full
							icon="material-symbols:download-rounded"
							label={i18n(I18nKey.downloadSharePoster)}
							disabled={posterState !== "ready"}
							onclick={downloadPoster}
						/>
					{/if}
				</div>
			{/snippet}
		</Dialog>
	{/if}
</div>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.article-share-actions
	width: 100%

	@media (min-width: bp-md)
		width: auto

	:global(.article-share-btn)
		white-space: nowrap
		width: 100%

		@media (min-width: bp-md)
			width: auto

:global(.article-share-dialog)
	width: 100%
	/* !important boundary: Dialog owns the scoped default width; its public class API lets ArticleShare own this variant width. */
	max-width: unquote("min(48rem, calc(100vw - 2rem))") !important
	max-height: calc(100dvh - 2rem)
	display: flex
	flex-direction: column

:global(.article-share-dialog .m3-dialog__content)
	min-height: 0
	overflow: visible

.share-dialog-content
	display: flex
	flex-direction: column
	align-items: center
	justify-content: center
	width: 100%

.share-poster-preview
	display: flex
	align-items: center
	justify-content: center
	width: 100%
	box-sizing: border-box
	padding: 0
	background: transparent
	border-radius: var(--shape-corner-m)
	border: none

	&__img
		display: block
		max-height: calc(100dvh - 16rem)
		width: 100%
		height: auto
		border-radius: var(--shape-corner-m)
		object-fit: contain
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15)

.share-poster-status
	display: flex
	flex-direction: column
	align-items: center
	justify-content: center
	width: 100%
	height: 100%
	box-sizing: border-box
	gap: var(--m3e-space-3)
	padding: var(--m3e-space-8)
	text-align: center
	color: var(--on-surface-variant)
	font: var(--m3e-type-body-medium)

	&--error
		color: var(--error)

	&__icon
		font-size: 2.5rem
		line-height: 1
		color: var(--error)

		> :global(svg)
			width: 2.5rem
			height: 2.5rem

.share-dialog-actions
	width: 100%
</style>
