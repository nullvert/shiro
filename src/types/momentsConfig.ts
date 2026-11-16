import type { PageMeta } from "./pageMeta.ts";

export interface MomentsConfig extends PageMeta {
	/**
	 * Опциональная перегрузка автора для шапки заметок.
	 * Если не указано, используется profileConfig (глобальный профиль).
	 */
	author?: {
		name?: string;
		avatar?: string;
		url?: string;
	};
}
