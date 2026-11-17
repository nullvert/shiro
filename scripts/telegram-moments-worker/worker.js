/**
 * Cloudflare Worker for Telegram -> GitHub (Moments)
 *
 * Environment variables / Secrets in Cloudflare:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - ALLOWED_TELEGRAM_USER_ID: Your numerical Telegram User ID (from @userinfobot)
 * - GITHUB_TOKEN: GitHub Personal Access Token (PAT) with repo contents:write permissions
 * - GITHUB_OWNER: GitHub username or organization (e.g. "nullvert")
 * - GITHUB_REPO: Repository name (e.g. "shiro")
 * - GITHUB_BRANCH: Target branch (default: "main")
 */

export default {
	async fetch(request, env) {
		if (request.method !== "POST") {
			return new Response("Telegram Moments Worker is running. Send POST via Telegram Webhook.", { status: 200 });
		}

		try {
			const update = await request.json();
			const message = update.message || update.channel_post;
			if (!message) {
				return new Response("OK - No message", { status: 200 });
			}

			const chatId = message.chat?.id;
			const fromId = String(message.from?.id || "");
			const allowedId = String(env.ALLOWED_TELEGRAM_USER_ID || "").trim();

			// Безопасность: фильтруем сообщения только от вас
			if (allowedId && fromId !== allowedId) {
				console.warn(`Unauthorized message from user ${fromId}`);
				return new Response("Unauthorized", { status: 200 });
			}

			// Извлекаем текст (прямое сообщение или подпись к фото)
			const rawText = message.text || message.caption || "";
			const photos = message.photo;

			if (!rawText && (!photos || photos.length === 0)) {
				return new Response("Empty update", { status: 200 });
			}

			// Парсим дату (если forward - берём оригинальную дату)
			const origTimestamp = message.forward_origin?.date || message.forward_date || message.date;
			const dateObj = origTimestamp ? new Date(origTimestamp * 1000) : new Date();

			// ISO 8601 формат для Astro Content Collection
			const isoPublished = dateObj.toISOString();
			const pad = (n) => String(n).padStart(2, "0");
			const fileDatePrefix = `${dateObj.getUTCFullYear()}-${pad(dateObj.getUTCMonth() + 1)}-${pad(dateObj.getUTCDate())}`;
			const timeStampId = dateObj.getTime();

			// Извлекаем хэштеги (#tag)
			const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
			const matchedTags = [];
			let match;
			while ((match = hashtagRegex.exec(rawText)) !== null) {
				matchedTags.push(match[1]);
			}
			const tags = Array.from(new Set(matchedTags));

			// Обработка фотографий
			const uploadedImages = [];
			if (photos && photos.length > 0) {
				const bestPhoto = photos[photos.length - 1];
				const fileId = bestPhoto.file_id;

				const fileUrl = await getTelegramFileUrl(fileId, env.TELEGRAM_BOT_TOKEN);
				if (fileUrl) {
					const imgRes = await fetch(fileUrl);
					const imgArrayBuffer = await imgRes.arrayBuffer();
					const base64Content = arrayBufferToBase64(imgArrayBuffer);

					const extMatch = fileUrl.match(/\.([a-zA-Z0-9]+)$/);
					const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
					const imageFileName = `${fileDatePrefix}-${timeStampId}.${ext}`;
					const imagePath = `public/images/moments/${imageFileName}`;

					// Загружаем картинку в репозиторий через GitHub API
					await uploadFileToGitHub(
						env,
						imagePath,
						base64Content,
						`feat(moments): add photo ${imageFileName} via telegram bot`
					);

					// Безопасный alt без переносов строк для корректного YAML
					const safeAlt = rawText
						? rawText.replace(/[\r\n]+/g, " ").trim().slice(0, 40)
						: "Moment photo";

					uploadedImages.push({
						src: `/images/moments/${imageFileName}`,
						alt: safeAlt,
					});
				}
			}

			// Формируем Markdown-файл для src/content/moments/*.md
			let frontmatter = `---\npublished: ${isoPublished}\n`;
			if (tags.length > 0) {
				frontmatter += `tags:\n${tags.map((t) => `  - ${t}`).join("\n")}\n`;
			}
			if (uploadedImages.length > 0) {
				frontmatter += `images:\n`;
				for (const img of uploadedImages) {
					frontmatter += `  - src: ${img.src}\n`;
					if (img.alt) frontmatter += `    alt: "${img.alt.replace(/"/g, '\\"')}"\n`;
				}
			}
			frontmatter += `---\n\n`;

			const markdownContent = frontmatter + rawText.trim() + "\n";
			const markdownFileName = `${fileDatePrefix}-${timeStampId}.md`;
			const markdownFilePath = `src/content/moments/${markdownFileName}`;

			const base64Markdown = btoa(unescape(encodeURIComponent(markdownContent)));

			// Сохраняем .md в GitHub
			await uploadFileToGitHub(
				env,
				markdownFilePath,
				base64Markdown,
				`feat(moments): add moment ${markdownFileName} via telegram bot`
			);

			// Отправляем ответ пользователю в Telegram
			if (chatId && env.TELEGRAM_BOT_TOKEN) {
				const imagesText = uploadedImages.length > 0 ? `\n🖼️ Фото: ${uploadedImages.length}` : "";
				const tagsText = tags.length > 0 ? `\n🏷️ ${tags.map((t) => `#${t}`).join(" ")}` : "";
				await sendTelegramMessage(
					env.TELEGRAM_BOT_TOKEN,
					chatId,
					`✅ <b>Опубликовано в Заметки!</b>\n\n📄 <code>${markdownFileName}</code>\n📅 <i>${isoPublished}</i>${tagsText}${imagesText}`
				);
			}

			return new Response("OK", { status: 200 });
		} catch (err) {
			console.error("Worker error:", err);
			return new Response(`Error: ${err.message}`, { status: 500 });
		}
	},
};

/**
 * Получение прямой ссылки на файл из Telegram
 */
async function getTelegramFileUrl(fileId, botToken) {
	const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
	const data = await res.json();
	if (data.ok && data.result?.file_path) {
		return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
	}
	return null;
}

/**
 * Отправка сообщения в Telegram
 */
async function sendTelegramMessage(botToken, chatId, text) {
	await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text: text,
			parse_mode: "HTML",
		}),
	});
}

/**
 * Конвертация ArrayBuffer в Base64 для GitHub API
 */
function arrayBufferToBase64(buffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Загрузка/создание файла через GitHub REST API
 */
async function uploadFileToGitHub(env, filePath, base64Content, commitMessage) {
	const branch = env.GITHUB_BRANCH || "main";
	const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;

	const res = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Telegram-Moments-Worker",
		},
		body: JSON.stringify({
			message: commitMessage,
			content: base64Content,
			branch: branch,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`GitHub Upload Error (${filePath}): ${err}`);
	}
}
