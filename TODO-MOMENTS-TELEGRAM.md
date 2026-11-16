# TODO: Автоматизация «Заметок» (Moments) через пересылку из Telegram

## Концепция (Вариант 3: Forward боту)
1. Вы ведете свой Telegram-канал как обычно.
2. Когда выходит пост/мысль/фото, которую хотите видеть на сайте в разделе «Заметки»:
   - Просто делаете **Forward (Переслать)** этого сообщения в личку своему личному боту.
   - Также бот принимает и обычные сообщения прямо в личке (если захочется написать что-то только для сайта в обход канала).
3. Cloudflare Worker ловит сообщение, извлекает текст/фото/оригинальную дату и пушит в репозиторий через GitHub API.
4. Сайт автоматически собирается и обновляет раздел «Заметки».

---

## Архитектура
```
Telegram-канал
      │ (Вы делаете Forward)
      ▼
Личка бота (только для вашего User ID)
      │ (Webhook)
Cloudflare Worker (бесплатный Serverless)
      │ (GitHub REST API: contents)
Репозиторий Shirone: `src/content/moments/moment-{timestamp}.md`
      │
      ▼ (CI/CD)
Автоматическая пересборка и деплой сайта
```

---

## Чеклист задач

- [ ] **1. Telegram Bot**
  - [ ] Создать бота через [@BotFather](https://t.me/BotFather), получить `TELEGRAM_BOT_TOKEN`.
  - [ ] Узнать свой цифровой ID через [@userinfobot](https://t.me/userinfobot) (`ALLOWED_TELEGRAM_USER_ID`), чтобы бот слушал только вас.

- [ ] **2. GitHub Access Token**
  - [ ] Создать Personal Access Token (Fine-grained) в настройках GitHub:
    - Репозиторий: `shiro` (или ваш форк).
    - Permissions: `Contents: Read and write`.

- [ ] **3. Cloudflare Worker**
  - [ ] Создать воркер (бесплатный план).
  - [ ] Прописать переменные окружения:
    - `GITHUB_TOKEN`
    - `GITHUB_OWNER`
    - `GITHUB_REPO`
    - `ALLOWED_TELEGRAM_USER_ID`
    - `TELEGRAM_BOT_TOKEN`
  - [ ] Задеплоить код обработки сообщений:
    - Проверка `from.id == ALLOWED_TELEGRAM_USER_ID`.
    - Поддержка как прямых сообщений, так и пересланных (`forward_origin` / `forward_date`).
    - Извлечение текста / подписи к фото (`caption`).
    - Сохранение фото (если есть) или привязка ссылки.
    - Формирование `src/content/moments/*.md` и пуш в ветку через GitHub API.
    - Ответ ботом: «✅ Опубликовано на сайте!».

- [ ] **4. Привязка вебхука**
  - [ ] Установить Webhook на URL воркера:
    ```
    https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<worker-name>.<subdomain>.workers.dev
    ```

- [ ] **5. Тестирование**
  - [ ] Переслать любой пост из канала боту.
  - [ ] Проверить, что бот ответил подтверждением, файл создался в `src/content/moments/`, и сайт пересобрался.
