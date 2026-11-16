import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "assets/images/demo-avatar.webp", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Javohir",
	bio: "The rain remembers what the sky forgot to say.",
	links: [
		{
			name: "Медиатека",
			icon: "material-symbols:photo-library-rounded",
			url: "https://media.nullvert.uz",
		},
		{
			name: "Закладки",
			icon: "material-symbols:bookmarks-rounded",
			url: "https://links.nullvert.uz",
		},
		{
			name: "Поддержать",
			icon: "material-symbols:savings-rounded",
			url: "https://support.nullvert.uz",
		},
	],
});
