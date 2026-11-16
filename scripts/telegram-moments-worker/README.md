# Telegram Moments Cloudflare Worker

Скрипт Cloudflare Worker для автоматической публикации заметок в блог через Telegram-бота.

Сообщения (текст, хэштеги, фото или пересланные посты) сохраняются напрямую как Markdown-файлы в `src/content/moments/<дата>-<id>.md`, а прикрепленные изображения — в `public/images/moments/`.

---

## 1. Необходимые секреты (Cloudflare Dashboard)

В настройках вашего Worker (`Settings` -> `Variables and Secrets`) добавьте:

| Переменная | Описание | Пример |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) | `123456789:ABCdef...` |
| `ALLOWED_TELEGRAM_USER_ID` | Ваш цифровой Telegram ID от [@userinfobot](https://t.me/userinfobot) | `987654321` |
| `GITHUB_TOKEN` | GitHub Personal Access Token (Fine-grained с правами `Contents: Read and write`) | `github_pat_...` |
| `GITHUB_OWNER` | Ваш логин или организация на GitHub | `nullvert` |
| `GITHUB_REPO` | Название репозитория | `shiro` |
| `GITHUB_BRANCH` | Ветка (по умолчанию `main`) | `main` |

---

## 2. Развертывание в Cloudflare

### Через веб-интерфейс Cloudflare (самый простой способ):
1. Откройте [dash.cloudflare.com](https://dash.cloudflare.com/) -> **Compute (Workers) -> Workers & Pages**.
2. Нажмите **Create Application** -> **Create Worker**.
3. Укажите имя воркера (например `telegram-moments-worker`) и нажмите **Deploy**.
4. Нажмите **Edit code**, удалите базовый шаблон, скопируйте и вставьте всё содержимое файла [worker.ts](file:///c:/Users/User/Projects/shiro/scripts/telegram-moments-worker/worker.ts) и нажмите **Deploy**.
5. Перейдите во вкладку **Settings** -> **Variables and Secrets** и пропишите 6 переменных из таблицы выше.

---

## 3. Настройка вебхука Telegram

После деплоя воркера свяжите бота с URL воркера:

Откройте в браузере (заменив `<ВАШ_TELEGRAM_BOT_TOKEN>` и `<ВАШ_WORKER_URL>`):
```text
https://api.telegram.org/bot<ВАШ_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<ВАШ_WORKER_URL>.workers.dev
```

Вы должны получить JSON-ответ:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

---

## 4. Как это работает
1. Вы пересылаете пост из канала в личку боту или отправляете боту текст/фото напрямую.
2. Бот проверяет ваш `ALLOWED_TELEGRAM_USER_ID`.
3. Сохраняет фотографии (если есть) в `public/images/moments/`.
4. Создает файл `src/content/moments/YYYY-MM-DD-timestamp.md` с валидным Frontmatter (`published`, `tags`, `images`) и текстом.
5. Пушит коммит в репозиторий через GitHub REST API.
6. Отправляет вам подтверждение в Telegram: `✅ Опубликовано в Заметки!`.
7. GitHub Actions / Cloudflare Pages / Vercel автоматически запускает билд и обновляет сайт!
