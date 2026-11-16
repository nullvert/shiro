<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import IconButton from "@components/atoms/action/IconButton.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { decryptProtectedContent } from "@utils/password-protection";
import {
	clearProtectedSession,
	protectedPayloadId,
	readProtectedSession,
	writeProtectedSession,
} from "@utils/protected-session";
import { onMount } from "svelte";
import type { ProtectedPayload } from "@/types/protectedContent";

let {
	payload,
	scope,
	hint = "",
	title = "",
	description = "",
	headingIcon = "",
	variant = "default",
	cacheSession = true,
	onunlocked,
}: {
	payload: ProtectedPayload;
	scope: string;
	hint?: string;
	title?: string;
	description?: string;
	headingIcon?: string;
	variant?: "default" | "compact";
	/** 是否缓存当前标签页的解锁内容。 */
	cacheSession?: boolean;
	onunlocked: (content: string) => void;
} = $props();

let password = $state("");
let error = $state("");
let loading = $state(false);
let passwordVisible = $state(false);

const contentKind = scope.startsWith("post:")
	? "post"
	: scope.startsWith("moment:")
		? "moment"
		: "album";
const copyKeys = {
	post: {
		title: I18nKey.postPasswordTitle,
		description: I18nKey.postPasswordDescription,
		label: I18nKey.postPasswordLabel,
		show: I18nKey.postPasswordShow,
		hide: I18nKey.postPasswordHide,
		required: I18nKey.postPasswordRequired,
		invalid: I18nKey.postPasswordInvalid,
		unlock: I18nKey.postPasswordUnlock,
		unlocking: I18nKey.postPasswordUnlocking,
	},
	album: {
		title: I18nKey.albumPasswordTitle,
		description: I18nKey.albumPasswordDescription,
		label: I18nKey.albumPasswordLabel,
		show: I18nKey.albumPasswordShow,
		hide: I18nKey.albumPasswordHide,
		required: I18nKey.albumPasswordRequired,
		invalid: I18nKey.albumPasswordInvalid,
		unlock: I18nKey.albumPasswordUnlock,
		unlocking: I18nKey.albumPasswordUnlocking,
	},
	moment: {
		title: I18nKey.momentPasswordTitle,
		description: I18nKey.momentPasswordDescription,
		label: I18nKey.momentPasswordLabel,
		show: I18nKey.momentPasswordShow,
		hide: I18nKey.momentPasswordHide,
		required: I18nKey.momentPasswordRequired,
		invalid: I18nKey.momentPasswordInvalid,
		unlock: I18nKey.momentPasswordUnlock,
		unlocking: I18nKey.momentPasswordUnlocking,
	},
} as const;
const copy = copyKeys[contentKind];
const resolvedTitle = title || i18n(copy.title);
const resolvedDescription = description || i18n(copy.description);
const resolvedHeadingIcon =
	headingIcon ||
	(contentKind === "post"
		? "material-symbols:article-outline-rounded"
		: contentKind === "moment"
			? "material-symbols:lock-outline-rounded"
			: "material-symbols:photo-library-outline-rounded");

const inputId = `password-gate-${scope.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
const headingId = `${inputId}-title`;
const payloadId = protectedPayloadId(payload);
const expectedContentType =
	contentKind === "post" ? "text/html" : "application/json";

onMount(() => {
	if (!cacheSession) {
		clearProtectedSession(scope);
		return;
	}
	if (payload.contentType !== expectedContentType) return;
	const session = readProtectedSession(scope, payloadId);
	if (session) onunlocked(session.content);
});

function clearError() {
	if (error) error = "";
}

async function unlock() {
	if (!password.trim()) {
		error = i18n(copy.required);
		return;
	}
	error = "";
	loading = true;
	try {
		if (payload.contentType !== expectedContentType) throw new Error();
		const content = await decryptProtectedContent(payload, password, scope);
		if (cacheSession) writeProtectedSession(scope, payloadId, content);
		onunlocked(content);
	} catch {
		error = i18n(copy.invalid);
	} finally {
		loading = false;
	}
}
</script>

<section
	class={`password-gate password-gate--${variant}${loading ? " password-gate--loading" : ""}`}
	aria-labelledby={headingId}
	aria-busy={loading}
>
	<div class="password-gate__content">
		<div class="password-gate__heading">
			<div class="password-gate__heading-icon" aria-hidden="true">
				<Icon icon={resolvedHeadingIcon} />
			</div>
			<div class="password-gate__heading-text">
				<h2 id={headingId}>{resolvedTitle}</h2>
				<p>{resolvedDescription}</p>
			</div>
		</div>

		{#if hint}
			<div class="password-gate__hint">
				<Icon icon="material-symbols:key-rounded" aria-hidden="true" />
				<span>{hint}</span>
			</div>
		{/if}

		<form
			class="password-gate__form"
			onsubmit={(event) => {
				event.preventDefault();
				void unlock();
			}}
		>
			<div class="password-gate__field">
				<TextField
					id={inputId}
					name="password"
					type={passwordVisible ? "text" : "password"}
					bind:value={password}
					label={i18n(copy.label)}
					placeholder={i18n(copy.label)}
					variant="outlined"
					autocomplete="current-password"
					disabled={loading}
					{error}
					oninput={clearError}
					class="password-gate__input"
				>
					<Icon slot="leading" icon="material-symbols:lock-rounded" aria-hidden="true" />
					<IconButton
						slot="trailing"
						icon={passwordVisible
							? "material-symbols:visibility-off-rounded"
							: "material-symbols:visibility-rounded"}
						size="small"
						label={i18n(
							passwordVisible ? copy.hide : copy.show,
						)}
						disabled={loading}
						onclick={() => (passwordVisible = !passwordVisible)}
					/>
				</TextField>
			</div>
			<Button
				type="submit"
				label={loading
				? i18n(copy.unlocking)
				: i18n(copy.unlock)}
				icon={loading
					? "material-symbols:progress-activity"
					: "material-symbols:lock-open-rounded"}
				size="medium"
				full
				disabled={loading}
				class="password-gate__submit"
			/>
		</form>
	</div>
</section>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.password-gate
	display: flex
	flex-direction: column
	align-items: center
	width: 100%
	max-width: 32rem
	margin: 0 auto
	border: 1px solid var(--outline-variant)
	border-radius: var(--shape-corner-xl)
	background: var(--surface-container-low)
	color: var(--on-surface)
	box-shadow: var(--m3e-elevation-1)
	box-sizing: border-box

	&__content
		display: flex
		flex-direction: column
		align-items: center
		width: 100%
		gap: var(--m3e-space-5)
		min-width: 0
		padding: var(--m3e-space-8)
		box-sizing: border-box

	&__heading
		display: flex
		flex-direction: column
		align-items: center
		text-align: center
		gap: var(--m3e-space-4)
		width: 100%

	&__heading-icon
		display: grid
		place-items: center
		width: 4rem
		height: 4rem
		border-radius: var(--shape-corner-full)
		background: var(--secondary-container)
		color: var(--on-secondary-container)
		box-shadow: var(--m3e-elevation-1)
		flex-shrink: 0
		> :global(svg)
			width: 2rem
			height: 2rem

	&__heading-text
		display: flex
		flex-direction: column
		gap: var(--m3e-space-1)
		align-items: center
		width: 100%

	h2
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-large)
		font-weight: 600

	&__heading p
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		max-width: 24rem

	&__hint
		display: flex
		align-items: center
		gap: var(--m3e-space-3)
		width: 100%
		max-width: 100%
		box-sizing: border-box
		padding: var(--m3e-space-3) var(--m3e-space-4)
		border-radius: var(--shape-corner-m)
		background: var(--surface-container-high)
		border: 1px solid var(--outline-variant)
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		> :global(svg)
			flex: none
			width: 1.25rem
			height: 1.25rem
			color: var(--primary)
		span
			min-width: 0
			overflow-wrap: anywhere

	&__form
		display: grid
		grid-template-columns: minmax(0, 1fr)
		gap: var(--m3e-space-4)
		width: 100%

	&__field
		min-width: 0
		min-height: 4.5rem
		width: 100%

	:global(.password-gate__input)
		width: 100%
		border-radius: var(--shape-corner-m)

	:global(.password-gate__input .m3-text-field__trailing)
		margin-right: calc(var(--m3e-space-2) * -1)

	&--loading :global(.password-gate__submit .m3-button__icon)
		animation: password-gate-spin var(--m3e-duration-long) linear infinite

@keyframes password-gate-spin
	to
		transform: rotate(1turn)

@media (max-width: bp-sm - 1px)
	.password-gate
		border-radius: var(--shape-corner-l)

		&__content
			gap: var(--m3e-space-4)
			padding: var(--m3e-space-5) var(--m3e-space-4)

		&__heading
			gap: var(--m3e-space-3)

		&__heading-icon
			width: 3.25rem
			height: 3.25rem
			> :global(svg)
				width: 1.75rem
				height: 1.75rem

		h2
			font: var(--m3e-type-title-medium)
			font-weight: 600

		&__heading p
			font: var(--m3e-type-body-small)

		&__hint
			padding: var(--m3e-space-2) var(--m3e-space-3)
			font: var(--m3e-type-body-small)

		&__field
			min-height: 4.25rem

.password-gate
	&--compact
		display: block
		max-width: none
		min-height: 0
		border: 0
		border-radius: 0
		background: transparent
		box-shadow: none

		.password-gate__content
			align-items: stretch
			gap: var(--m3e-space-3)
			padding: var(--m3e-space-3) 0 0

		.password-gate__heading
			display: grid
			grid-template-columns: auto minmax(0, 1fr)
			text-align: left
			align-items: start
			gap: var(--m3e-space-3)

		.password-gate__heading-text
			align-items: start

		.password-gate__heading-icon
			width: 2.5rem
			height: 2.5rem
			border-radius: var(--shape-corner-m)
			box-shadow: none
			> :global(svg)
				width: 1.35rem
				height: 1.35rem

		.password-gate__heading h2
			font: var(--m3e-type-title-medium)
			font-weight: 600

		.password-gate__heading p
			font: var(--m3e-type-body-small)
			max-width: none

		.password-gate__hint
			padding: var(--m3e-space-2) var(--m3e-space-3)
			font: var(--m3e-type-body-small)

		.password-gate__field
			min-height: 4rem

@media (prefers-reduced-motion: reduce)
	.password-gate--loading :global(.password-gate__submit .m3-button__icon)
		animation: none
</style>
