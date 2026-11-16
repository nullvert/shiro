/**
 * 分享海报生成工具。
 *
 * 海报宽度固定，高度由封面、标题和摘要的实际排版决定。这样短内容不会在正文与
 * 页脚之间留下空洞，长内容也不会挤压作者和二维码区域。
 */

export const SHARE_POSTER_WIDTH = 1280;
export const SHARE_POSTER_HEIGHT = 720;

const PADDING_X = 72;
const PADDING_BOTTOM = 52;
const PADDING_TOP = 64;
const CONTENT_MAX_WIDTH = 1100;
const FONT_FAMILY = 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO_FAMILY =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export interface SharePosterPalette {
	surfaceContainerLowest: string;
	surfaceContainerLow: string;
	surfaceContainerHigh?: string;
	onSurface: string;
	onSurfaceVariant: string;
	primary: string;
	primaryContainer: string;
	onPrimaryContainer: string;
	outlineVariant: string;
}

export interface SharePosterLabels {
	author: string;
	scanToRead: string;
}

export interface SharePosterInput {
	title: string;
	description: string;
	author: string;
	published: string;
	siteTitle: string;
	url: string;
	coverUrl?: string;
	avatarUrl?: string;
	labels: SharePosterLabels;
	palette: SharePosterPalette;
	signal?: AbortSignal;
}

interface DrawableImage {
	source: CanvasImageSource;
	close?: () => void;
}

/** 格式化日期为 DD/MM/YYYY */
export function formatDateToDDMMYYYY(dateStr: string): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) {
		const parts = dateStr.split(/[-/]/);
		if (parts.length === 3 && parts[0].length === 4) {
			return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
		}
		return dateStr;
	}
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

/** 净化文件名，移除 Windows / POSIX 非法字符与控制字符。 */
export function sanitizeFilename(
	name: string,
	fallback = "article-share",
): string {
	const cleaned = Array.from(name)
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code >= 32 && code !== 127 && !'<>:"/\\|?*'.includes(char);
		})
		.join("")
		.trim()
		.replace(/\s+/g, "-");
	return cleaned || fallback;
}

/** 从页面读取当前生效的主题计算颜色。 */
export function getSharePosterPalette(
	element: HTMLElement = document.documentElement,
): SharePosterPalette {
	const style = getComputedStyle(element);
	const getVar = (name: string, fallback: string) => {
		const value = style.getPropertyValue(name).trim();
		return value || fallback;
	};

	return {
		surfaceContainerLowest: getVar("--surface-container-lowest", "#ffffff"),
		surfaceContainerLow: getVar("--surface-container-low", "#f7f2fa"),
		surfaceContainerHigh: getVar("--surface-container-high", "#ece6f0"),
		onSurface: getVar("--on-surface", "#1d1b20"),
		onSurfaceVariant: getVar("--on-surface-variant", "#49454f"),
		primary: getVar("--primary", "#6750a4"),
		primaryContainer: getVar("--primary-container", "#eaddff"),
		onPrimaryContainer: getVar("--on-primary-container", "#21005d"),
		outlineVariant: getVar("--outline-variant", "#cac4d0"),
	};
}

/** 带超时与 CORS 保护的可选图片加载器。失败时返回 null 供排版降级。 */
async function loadDrawableImage(
	url?: string,
	signal?: AbortSignal,
	timeoutMs = 6000,
): Promise<DrawableImage | null> {
	if (!url || signal?.aborted) return null;

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		const onAbort = () => controller.abort();
		signal?.addEventListener("abort", onAbort, { once: true });

		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) return null;

			const contentType = response.headers.get("content-type") || "";
			if (contentType && !contentType.startsWith("image/")) return null;

			const blob = await response.blob();
			if (blob.size > 15 * 1024 * 1024) return null;

			if (typeof createImageBitmap === "function") {
				const bitmap = await createImageBitmap(blob);
				return { source: bitmap, close: () => bitmap.close() };
			}

			return await new Promise<DrawableImage | null>((resolve) => {
				const image = new Image();
				const blobUrl = URL.createObjectURL(blob);
				image.onload = () => {
					resolve({
						source: image,
						close: () => URL.revokeObjectURL(blobUrl),
					});
				};
				image.onerror = () => {
					URL.revokeObjectURL(blobUrl);
					resolve(null);
				};
				image.src = blobUrl;
			});
		} finally {
			clearTimeout(timeoutId);
			signal?.removeEventListener("abort", onAbort);
		}
	} catch {
		return null;
	}
}

function segmentText(text: string, granularity: "word" | "grapheme"): string[] {
	if (!text) return [];
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		try {
			const segmenter = new Intl.Segmenter(undefined, { granularity });
			return Array.from(segmenter.segment(text), (segment) => segment.segment);
		} catch {
			// Fall through to the code-point-safe fallback.
		}
	}
	return Array.from(text);
}

/** 按可用宽度换行，达到上限后在最后一行追加省略号。 */
function wrapTextLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const tokens = segmentText(normalized, "word").flatMap((token) =>
		ctx.measureText(token).width > maxWidth
			? segmentText(token, "grapheme")
			: [token],
	);
	const lines: string[] = [];
	let currentLine = "";
	let truncated = false;

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		const candidate = currentLine + token;
		if (ctx.measureText(candidate).width <= maxWidth) {
			currentLine = candidate;
			continue;
		}

		if (currentLine) {
			lines.push(currentLine.trimEnd());
			if (lines.length === maxLines) {
				truncated = true;
				break;
			}
		}
		currentLine = token.trimStart();
	}

	if (!truncated && currentLine && lines.length < maxLines) {
		lines.push(currentLine.trimEnd());
	}

	if (truncated && lines.length > 0) {
		const ellipsis = "\u2026";
		let lastLine = lines[lines.length - 1];
		while (
			lastLine &&
			ctx.measureText(`${lastLine}${ellipsis}`).width > maxWidth
		) {
			lastLine = segmentText(lastLine, "grapheme").slice(0, -1).join("");
		}
		lines[lines.length - 1] = `${lastLine.trimEnd()}${ellipsis}`;
	}

	return lines;
}

function drawCoverImage(
	ctx: CanvasRenderingContext2D,
	image: CanvasImageSource,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const dimensions = image as { width?: number; height?: number };
	const imageWidth = Number(dimensions.width) || width;
	const imageHeight = Number(dimensions.height) || height;
	const imageAspect = imageWidth / imageHeight;
	const targetAspect = width / height;

	let sourceX = 0;
	let sourceY = 0;
	let sourceWidth = imageWidth;
	let sourceHeight = imageHeight;
	if (imageAspect > targetAspect) {
		sourceWidth = imageHeight * targetAspect;
		sourceX = (imageWidth - sourceWidth) / 2;
	} else {
		sourceHeight = imageWidth / targetAspect;
		sourceY = (imageHeight - sourceHeight) / 2;
	}

	ctx.drawImage(
		image,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		x,
		y,
		width,
		height,
	);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Canvas toBlob returned null"));
		}, "image/png");
	});
}

/**
 * 绘制 16:9 横版分享海报：
 * - 全尺寸背景封面或主色渐变
 * - 暗色蒙版保证文字对比度
 * - 顶部/左上：日期 (DD/MM/YYYY)
 * - 中部：大标题 + 描述摘要
 * - 底部：左侧作者，右侧站点域名
 */
export async function generateSharePoster(
	input: SharePosterInput,
): Promise<Blob> {
	if (input.signal?.aborted) {
		throw new DOMException("Poster generation aborted", "AbortError");
	}

	if (typeof document !== "undefined" && document.fonts) {
		try {
			await document.fonts.ready;
		} catch {
			// 系统字体回退仍可完成绘制。
		}
	}

	const coverImage = await loadDrawableImage(input.coverUrl, input.signal);

	try {
		if (input.signal?.aborted) {
			throw new DOMException("Poster generation aborted", "AbortError");
		}

		const canvas = document.createElement("canvas");
		canvas.width = SHARE_POSTER_WIDTH;
		canvas.height = SHARE_POSTER_HEIGHT;

		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Unable to create 2d canvas context");

		// 1. 绘制背景
		if (coverImage) {
			drawCoverImage(
				ctx,
				coverImage.source,
				0,
				0,
				SHARE_POSTER_WIDTH,
				SHARE_POSTER_HEIGHT,
			);
		} else {
			// 无封面时使用主题渐变
			const gradient = ctx.createLinearGradient(
				0,
				0,
				SHARE_POSTER_WIDTH,
				SHARE_POSTER_HEIGHT,
			);
			gradient.addColorStop(0, input.palette.primary);
			gradient.addColorStop(1, input.palette.onPrimaryContainer);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT);
		}

		// 2. 绘制暗色渐变遮罩 (阴影蒙版)，确保白色文字清晰可辨
		const overlayGradient = ctx.createLinearGradient(
			0,
			0,
			0,
			SHARE_POSTER_HEIGHT,
		);
		overlayGradient.addColorStop(0, "rgba(10, 15, 25, 0.45)");
		overlayGradient.addColorStop(0.4, "rgba(10, 15, 25, 0.65)");
		overlayGradient.addColorStop(1, "rgba(10, 15, 25, 0.92)");
		ctx.fillStyle = overlayGradient;
		ctx.fillRect(0, 0, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT);

		// 3. 计算排版
		// 日期 (DD/MM/YYYY)
		const formattedDate = formatDateToDDMMYYYY(input.published);

		// 测量标题与描述
		const titleFontSize = 54;
		const titleLineHeight = 68;
		ctx.font = `800 ${titleFontSize}px ${FONT_FAMILY}`;
		const titleLines = wrapTextLines(
			ctx,
			input.title || input.siteTitle,
			CONTENT_MAX_WIDTH,
			2,
		);

		const descFontSize = 24;
		const descLineHeight = 36;
		const description =
			input.description.trim() !== input.title.trim()
				? input.description.trim()
				: "";
		ctx.font = `400 ${descFontSize}px ${FONT_FAMILY}`;
		const descLines = description
			? wrapTextLines(ctx, description, CONTENT_MAX_WIDTH, 2)
			: [];

		// 排版高度计算
		const dateHeight = formattedDate ? 28 : 0;
		const dateGap = formattedDate ? 14 : 0;
		const titleHeight = titleLines.length * titleLineHeight;
		const descGap = descLines.length > 0 ? 18 : 0;
		const descHeight = descLines.length * descLineHeight;

		const totalBlockHeight =
			dateHeight + dateGap + titleHeight + descGap + descHeight;

		// Привязка контента к нижней трети (как на референсе: персонаж по центру виден сверху,
		// а текст начинается на уровне бедер/пояса)
		const footerAreaHeight = 64;
		const availableBottom =
			SHARE_POSTER_HEIGHT - PADDING_BOTTOM - footerAreaHeight;
		const contentStartY = Math.max(
			PADDING_TOP + 60,
			availableBottom - totalBlockHeight - 16,
		);

		let currentY = contentStartY;

		// 4. 绘制日期 (Mono, Medium 500)
		if (formattedDate) {
			ctx.font = `500 21px ${FONT_MONO_FAMILY}`;
			ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
			ctx.textBaseline = "top";
			ctx.fillText(formattedDate, PADDING_X, currentY);
			currentY += dateHeight + dateGap;
		}

		// 5. 绘制标题
		ctx.font = `800 ${titleFontSize}px ${FONT_FAMILY}`;
		ctx.fillStyle = "#ffffff";
		ctx.textBaseline = "top";
		// 细微阴影提升边缘清晰度
		ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
		ctx.shadowBlur = 14;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 2;

		titleLines.forEach((line, index) => {
			ctx.fillText(line, PADDING_X, currentY + index * titleLineHeight);
		});
		currentY += titleHeight + descGap;

		// 6. 绘制描述
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
		if (descLines.length > 0) {
			ctx.font = `400 ${descFontSize}px ${FONT_FAMILY}`;
			ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
			descLines.forEach((line, index) => {
				ctx.fillText(line, PADDING_X, currentY + index * descLineHeight);
			});
		}

		// 7. 绘制底部行 (Footer)
		const footerY = SHARE_POSTER_HEIGHT - PADDING_BOTTOM;
		ctx.textBaseline = "bottom";

		// 左下角：Javohir · nullvert.uz
		const leftText = "Javohir";
		const dotText = " · ";
		const rightText = "nullvert.uz";

		ctx.font = `500 24px ${FONT_MONO_FAMILY}`;
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.textAlign = "left";

		ctx.fillText(leftText, PADDING_X, footerY);
		const leftWidth = ctx.measureText(leftText).width;

		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.fillText(dotText, PADDING_X + leftWidth, footerY);
		const dotWidth = ctx.measureText(dotText).width;

		ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
		ctx.fillText(rightText, PADDING_X + leftWidth + dotWidth, footerY);

		return await canvasToBlob(canvas);
	} finally {
		coverImage?.close?.();
	}
}
