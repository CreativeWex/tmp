# План доработок BeautyTrack

Документ описывает пошаговый план внесения 6 доработок (нумерация задач сохранена из исходного запроса: 1, 2, 3, 4, 6, 7).

Стек: FastAPI + SQLAlchemy + Alembic (SQLite) — бэкенд; React 19 + Vite + Tailwind v4 + React Query — фронтенд.

Общие правила:
- Все изменения схемы БД оформляются миграцией в `backend/alembic/versions/`.
- Существующие seed-данные не ломаем — поля делаем nullable там, где возможно.
- UI расширяем поверх существующих компонентов `frontend/src/components/ui.tsx`, дизайн (цвета brand-*, скруглённые карточки, шапка) сохраняем.

---

## Задача 1. Уникальность номера телефона клиента

Цель: при попытке указать телефон, уже принадлежащий другому клиенту, выводить понятную ошибку. Уникальность проверяется при создании клиента (`POST /clients`), регистрации (`POST /auth/register`), создании пользователя админом (`POST /admin/users`) и при обновлении (`PATCH /clients/{id}`).

### Бэкенд

1. `backend/app/models.py` — у модели `Client.phone` добавить `unique=True, index=True`. Оставить `nullable=True` (несколько NULL допускаются SQLite — это нужно, чтобы существующие клиенты без телефона не сломали ограничение).
2. `backend/app/models.py` — у `User.phone` добавить `unique=True, index=True` (для согласованности, т.к. при `auth/register` phone пишется и в `User`, и в `Client`).
3. Создать миграцию `backend/alembic/versions/002_unique_phone.py`:
   - предварительно нормализовать существующие телефоны (удалить пробелы/дефисы) и обнулить дубликаты (`UPDATE clients SET phone = NULL WHERE id NOT IN (SELECT MIN(id) FROM clients GROUP BY phone)`),
   - `op.create_index('ix_clients_phone_unique', 'clients', ['phone'], unique=True)` и аналогично для `users`.
4. `backend/app/routers/clients.py` — добавить хелпер `_normalize_phone(s)` (trim + удалить `()-` и пробелы, оставить `+` и цифры). Применять в `create_client` и `update_client`.
5. В `create_client` и `update_client` перед `db.commit()` выполнять запрос:
   ```
   exists = db.query(Client).filter(Client.phone == phone, Client.id != current_id).first()
   if exists: raise HTTPException(409, detail="Клиент с таким телефоном уже существует")
   ```
   Дополнительно ловить `IntegrityError` после `commit()` и переводить в 409 с тем же сообщением.
6. `backend/app/routers/auth.py::register` — перед созданием `User` и `Client` проверить уникальность `phone` среди `User.phone` и `Client.phone`. При коллизии — `HTTPException(409, "Телефон уже используется")`.
7. `backend/app/routers/admin.py::create_user` — то же самое.

### Фронтенд

8. `frontend/src/pages/ClientDetailPage.tsx` (`ProfileCard.save`) — при ошибке мутации показывать текст из `error.message` (он уже отображается, нужно убедиться что для 409 backend кладёт текст в `detail`, и `apiJson` пробрасывает его — проверить `frontend/src/lib/api.ts`).
9. `frontend/src/pages/ClientsPage.tsx` — в форме «Новый клиент» добавить поле «Телефон» (Input) и отправлять его в body. При 409 рисовать красное сообщение под формой.
10. `frontend/src/pages/PublicBookingPage.tsx` и `frontend/src/pages/AdminPage.tsx` (форма создания пользователя, если будет) — аналогично выводить ошибку 409.
11. Сделать клиентскую нормализацию телефона перед отправкой (тот же трим/удаление маски), чтобы пользователь не получал ложные «уникальные» дубли из-за форматирования.

### Приёмка

- Создание клиента с уже занятым телефоном → красная плашка «Клиент с таким телефоном уже существует», запрос возвращает 409.
- Регистрация второго `User` с тем же телефоном — 409.
- Сохранение профиля с чужим телефоном — 409, без падения формы.
- Клиент без телефона остаётся валидным (`NULL` допускается).

---

## Задача 2. Привязка плана ухода к визиту

Решение: добавить optional `visit_id` в `CarePlan` (выбранный вариант). План, созданный во вкладке «Уход» из карточки визита, привязывается к визиту; в карточке визита появляется блок «Назначенный уход».

### Бэкенд

1. `backend/app/models.py` — `CarePlan` получает поле `visit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("visits.id"), nullable=True, index=True)` и `visit = relationship("Visit", back_populates="care_plans")`. У `Visit` добавить обратную связь `care_plans: Mapped[List["CarePlan"]] = relationship(back_populates="visit")`.
2. Миграция `003_careplan_visit.py`:
   - `op.add_column('care_plans', sa.Column('visit_id', sa.Integer(), nullable=True))`,
   - `op.create_foreign_key('fk_careplan_visit', 'care_plans', 'visits', ['visit_id'], ['id'])`,
   - `op.create_index('ix_careplans_visit_id', 'care_plans', ['visit_id'])`.
3. `backend/app/schemas.py`:
   - `CarePlanCreate` — добавить `visit_id: Optional[int] = None`,
   - `CarePlanOut` — добавить `visit_id: Optional[int]`.
4. `backend/app/routers/care_plans.py::create_care_plan` — пробрасывать `visit_id` в модель, валидировать что визит принадлежит клиенту (`Visit.client_id == body.client_id`) и доступен текущему врачу (по правилам `_can_access_client`).
5. Новый эндпоинт `GET /clients/{client_id}/visits/{visit_id}/care-plans` (либо расширение `list_client_care_plans` параметром `visit_id`) — возвращает планы конкретного визита. Используется во фронте для блока «Назначенный уход».
6. `_serialize_plan` — добавить поле `visit_id` в ответ.

### Фронтенд

7. `frontend/src/lib/types.ts` — `CarePlan.visit_id: number | null`.
8. `frontend/src/pages/ClientDetailPage.tsx`:
   - В компоненте `VisitCard` добавить кнопку «Назначить уход» (рядом с «Загрузить фото»). При нажатии — раскрывается inline-форма подбора (тип кожи + concerns), кнопка «Подобрать топ-3» и «Сохранить как план», вызывающая `POST /care-plans` с `visit_id=visit.id`.
   - В этом же `VisitCard` отдельным блоком (через `useQuery` к `/clients/{id}/visits/{visit.id}/care-plans` либо фильтрацией общего списка по `visit_id`) рисовать «Назначенный уход» с разбивкой «Утро / Вечер» (использовать существующий `RoutineList`).
   - В блоке «Уход» (верхний `tab === 'care'`) показывать историю по визитам: для каждого визита, у которого есть план, рендерить «Визит DD.MM.YYYY → план #N» с возможностью раскрыть. Сортировка — по `visit_date` desc.
9. Для роли `client` (компонент `ClientCareView`) — в каждом плане выводить пометку «Назначен в визите DD.MM.YYYY», если `plan.visit_id` задан.
10. После создания плана из визита — `qc.invalidateQueries({ queryKey: ['care-plans', clientId] })` и `['visit-care-plans', visit.id]`.

### Приёмка

- Из карточки визита можно создать план — он привязывается к этому визиту.
- В карточке визита виден блок «Назначенный уход» со списком средств по утро/вечер.
- Во вкладке «Уход» виден хронологический список планов с привязкой к визитам — это и есть «динамика».
- Старые планы (без `visit_id`) продолжают отображаться как и раньше.

---

## Задача 3. Исправить «нет доступа к карточке через „Моя карточка“» (роль client)

Симптом: клиент кликает «Моя карточка», но получает экран «Нет доступа к этой карточке».

### Диагностика причин (по коду)

A. В `frontend/src/pages/ClientsPage.tsx` нарушены rules-of-hooks: `useMutation(...)` вызывается после `early return` для роли `client`. На втором рендере (когда данные подгрузились) порядок хуков отличается — это может ронять компонент/портить состояние навигации. См. `ClientsPage.tsx:22-46`.

B. Если `Client.user_id` не выставлен (например, для клиентов, заведённых вручную через `POST /clients`, поле `user_id` всегда `None`), то проверка `_can_access_client` (`backend/app/routers/clients.py:20-22`) возвращает `False` → `403`. У клиентов, заведённых через `auth/register` или `admin/users` (CLIENT), связка ставится — но смешение сценариев приводит к 403.

C. В `ClientDetailPage.tsx:140-151` дополнительный фронтовый чек `c.user_id !== user?.id` показывает «Нет доступа» даже когда backend бы пропустил.

### Шаги исправления

#### Бэкенд

1. `backend/app/routers/auth.py::register` — при `email == existing User.email` отказать 400 (уже есть), но дополнительно: если у клиента в БД уже есть `Client` с тем же email/phone, привязать `user_id` к существующему `Client` вместо создания нового. Это устраняет случай, когда админ заранее завёл клиента, а тот потом регистрируется сам.
2. Новый эндпоинт `GET /clients/me` — возвращает `Client` текущего пользователя (по `user_id == current_user.id`), 404 если не привязан. Используется фронтом вместо `GET /clients` + `[0]`.
3. Уточнить логирование в `_get_client`: при 403 писать в логи `user.id`, `client.id`, `client.user_id` (чтобы было видно, что именно не совпало).

#### Фронтенд

4. `frontend/src/pages/ClientsPage.tsx` — перенести **все** `useQuery`/`useMutation` в начало компонента, ДО любых `return` (исправить нарушение rules-of-hooks). Ветка для `client` использует `useEffect` для редиректа вместо ранней навигации в теле компонента.
5. Заменить запрос «найти своего клиента» с `apiJson<Client[]>('/clients')[0]` на `apiJson<Client>('/clients/me')`. Это надёжнее: backend сам ищет нужную запись по `user_id`.
6. `frontend/src/pages/ClientDetailPage.tsx:140-151` — убрать дублирующую проверку доступа на стороне фронта (полагаемся на backend). Если backend вернул 200 — значит, доступ есть.
7. `frontend/src/pages/Layout.tsx:36-40` — ссылка «Моя карточка» для роли `client` указывает на `/app/clients`. Сделать её вычисляемой: после загрузки `me` показывать `/app/clients/{me.id}`. Если `me` ещё не подгружен — disabled-стиль.

#### Миграционная подчистка данных

8. Скрипт/однократный SQL (в той же миграции `004_link_orphan_clients.py` или вручную в seed-разделе для dev-БД): для каждого `User` с ролью `client`, у которого `Client.user_id IS NULL`, найти `Client` по совпадению `email`/`phone` и проставить `user_id`. Это лечит «осиротевшие» карточки в текущей dev-БД.

### Приёмка

- Под `client@example.com` (seed) клик «Моя карточка» открывает `/app/clients/{id}` без 403.
- Зарегистрированный «с нуля» клиент попадает в свою карточку сразу после первого входа.
- Если карточка клиента не привязана (`Client.user_id IS NULL`) — показывается дружелюбное «Профиль не привязан, обратитесь к администратору» (вместо «Нет доступа»).

---

## Задача 4. Удаление клиента врачом и администратором

### Бэкенд

1. Новый эндпоинт `DELETE /clients/{client_id}` в `backend/app/routers/clients.py`:
   ```
   @router.delete("/{client_id}", status_code=204,
                  dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
   def delete_client(client_id, db, user): ...
   ```
2. Для роли DOCTOR — разрешать удаление только своих клиентов (`client.doctor_user_id == user.id`).
3. Каскадное удаление зависимых сущностей (в SQLite каскад через FK не работает без `cascade="all, delete-orphan"`):
   - визиты клиента → их фото (файлы на диске тоже удалить, переиспользовать логику из `delete_visit` в `routers/clients.py:152-166`);
   - `CarePlan` + `CarePlanItem` (cascade у `CarePlan.items` уже есть);
   - `Appointment` клиента — мягко: проставить `client_id=NULL` + `guest_name=client.full_name` (чтобы сохранить историю записей в расписании врача), либо удалить только будущие записи.
   - Опционально удалять связанного `User` (если `Client.user_id` есть и роль CLIENT, и нет других клиентов на этом пользователе). Безопаснее — деактивировать (`is_active=False`), не удалять.
4. Транзакция: либо всё, либо ничего — обернуть в `try/except` с `db.rollback()`.

### Фронтенд

5. `frontend/src/pages/ClientsPage.tsx` — в карточке клиента (список) добавить иконку «корзина» (только для `admin`/`doctor`). По клику — модальное подтверждение «Удалить клиента и всю историю? Действие необратимо», ввод названия клиента для подтверждения (как safety guard).
6. `frontend/src/pages/ClientDetailPage.tsx` — кнопка «Удалить клиента» в шапке (рядом с «Карточка клиента #N»), вызывает тот же `DELETE /clients/{id}`. После успеха — `navigate('/app/clients')` и инвалидация `['clients']`, `['dashboard']`.
7. Обработка 403 (доктор пытается удалить чужого клиента) — красная плашка с текстом из backend.

### Приёмка

- Под `doctor@example.com` можно удалить «своего» клиента и нельзя — чужого (403).
- Под `admin@example.com` можно удалить любого.
- После удаления список клиентов и счётчики на дашборде обновляются.
- Файлы фото визитов физически удаляются из `backend/uploads/visits/<visit_id>/`.

---

## Задача 6. Тёмная / светлая тема

Цель: переключатель «Светлая / Тёмная», запоминание выбора между сессиями, минимальное вмешательство в существующую палитру.

### Подход

Tailwind v4 поддерживает `dark:` варианты через стратегию `class`. Включаем `dark` через корневой `<html class="dark">` и переключаем JS-ом. CSS-переменные `--color-brand-*` уже в `index.css` — добавим тёмные эквиваленты в `:root.dark`.

### Шаги

1. `frontend/src/index.css`:
   - Объявить параллельно набор переменных для тёмной темы:
     ```
     :root { --bg: #fafafa; --fg: #18181b; --card: #ffffff; --border: #e4e4e7; }
     :root.dark { --bg: #0b0b0f; --fg: #f4f4f5; --card: #1a1a20; --border: #27272a; }
     ```
   - Заменить в `body` `bg-zinc-50 text-zinc-900` на использование переменных (`background: var(--bg); color: var(--fg);`).
   - Добавить директиву `@variant dark (&:where(.dark, .dark *))` в начало файла (Tailwind v4-стиль), чтобы заработали `dark:`-классы.
2. Создать `frontend/src/lib/theme.ts`:
   - функция `getTheme()` читает из `localStorage.bt_theme` (`'light' | 'dark' | 'system'`), дефолт `system`;
   - `applyTheme(theme)` ставит/снимает класс `dark` у `<html>`, для `system` — слушает `matchMedia('(prefers-color-scheme: dark)')`.
3. Создать React context `ThemeProvider` (в `frontend/src/auth/AuthContext.tsx` рядом или новый `frontend/src/lib/ThemeContext.tsx`). Оборачиваем `<App/>` в `frontend/src/App.tsx`.
4. Компонент `ThemeToggle` в `frontend/src/components/ui.tsx`: три кнопки-чипа (Светлая / Системная / Тёмная) или просто свитч «солнце/луна». Добавить в `Layout.tsx` в правую часть шапки, рядом с `<Badge>`.
5. **Аккуратная адаптация существующего дизайна** — вместо массовой замены классов добавить минимум `dark:`-вариантов в часто используемых местах:
   - `Card`: `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800`,
   - `CardHeader`: `border-zinc-100 dark:border-zinc-800`,
   - `Input`: `bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700`,
   - `Button` (variants `outline`, `ghost`): добавить `dark:hover:bg-zinc-800`, `dark:text-zinc-200`,
   - `Layout` header: `bg-white/90 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800`, навигационная пилюля `bg-zinc-100 dark:bg-zinc-800`,
   - Текст: глобально через CSS-переменную body, отдельные `text-zinc-500` оставляем (нейтральны на обоих фонах).
6. Цвета brand-* (фиолетовая палитра) **оставляем без изменений** — на тёмном фоне они читаются хорошо (см. контраст в `oklch(0.52 0.24 310)`).
7. Графики (см. задачу 7) — использовать `currentColor` или CSS-переменные для линий/осей, чтобы они автоматически переключались.

### Приёмка

- Переключатель в шапке мгновенно меняет тему всего приложения.
- Выбор сохраняется после перезагрузки.
- Режим «Системная» подхватывает `prefers-color-scheme`.
- В тёмной теме сохранены акцентные цвета (фиолетовый brand) и общая визуальная иерархия.

---

## Задача 7. Информационные графики на дашборде

Библиотека: **Recharts**. Установить: `npm i recharts` в `frontend`.

Все графики добавляются на `frontend/src/pages/DashboardPage.tsx` для ролей `admin`/`doctor`. Под клиента дашборд не трогаем.

### Бэкенд — новые эндпоинты

Новый файл `backend/app/routers/analytics.py` (либо расширить `admin.py`), все требуют `require_roles(ADMIN, DOCTOR)`, фильтрация по `doctor_user_id` для роли DOCTOR.

1. `GET /admin/analytics/appointments-30d` → `[{date: 'YYYY-MM-DD', count: int}, ...]` — записи за 30 дней (линия). Реализуется по аналогии с `series_7d` в `admin.dashboard`, но с `timedelta(days=29)` и без `revenue_placeholder`.
2. `GET /admin/analytics/appointments-status?days=30` → `[{status: 'pending'|'confirmed'|'cancelled', count: int}]` — для воронки/donut.
3. `GET /admin/analytics/procedures-top?days=30&limit=10` → `[{procedure_id, name, count}]` — топ процедур (join `Appointment` × `Procedure`, group by procedure_id).
4. `GET /admin/analytics/age-groups` → `[{bucket: '18-24'|'25-34'|'35-44'|'45-54'|'55+', count: int}]` — считается из `Client.birth_date` (где не NULL). Клиенты без даты идут в bucket `'unknown'`.

Все эндпоинты добавить в `backend/app/schemas.py` как pydantic-модели (`AnalyticsPointOut`, `StatusBucketOut`, `ProcedureCountOut`, `AgeBucketOut`) и зарегистрировать в `main.py`.

### Фронтенд — виджеты

Создать папку `frontend/src/pages/dashboard/charts/`:

1. `Appointments30dWidget.tsx` — `<LineChart>` (Recharts) с `XAxis` (date), `YAxis`, `Tooltip`, одна линия `count`. Высота ~220px. Цвет линии — `var(--color-brand-600)`.
2. `StatusFunnelWidget.tsx` — `<PieChart>` с тремя сегментами (pending/confirmed/cancelled). Цвета: brand-500 / emerald-500 / red-500. Легенда снизу.
3. `TopProceduresWidget.tsx` — `<BarChart>` горизонтальный, до 10 баров.
4. `AgeGroupsWidget.tsx` — `<BarChart>` вертикальный по 5–6 группам.

Все виджеты:
- используют `useQuery` к соответствующему эндпоинту, ключ `['analytics', '<name>']`,
- обёрнуты в существующий `<Card>/<CardHeader>/<CardContent>`,
- адаптивны (`<ResponsiveContainer width="100%" height={220}>`),
- учитывают тёмную тему (см. задачу 6): передавать `stroke="currentColor"` для осей и сетки.

### Размещение

`DashboardPage.tsx` — добавить новую секцию `<div className="grid gap-4 lg:grid-cols-2">` под существующим блоком «Уведомления»:
```
Appointments30dWidget       | StatusFunnelWidget
TopProceduresWidget         | AgeGroupsWidget
```

`WeekChartWidget` оставить как есть (короткий обзор недели) — он остаётся в правой колонке быстрых действий.

### Приёмка

- На дашборде admin/doctor видны 4 новых графика, данные подгружаются с бэка.
- При смене темы цвета осей/сетки подстраиваются.
- Под ролью `client` дашборд графиков не показывает (только личный виджет).
- Для DOCTOR — графики ограничены его клиентами/записями.

---

## Порядок реализации (рекомендуемый)

1. Задача 3 (исправление доступа) — мелкая, разблокирует тестирование клиентом.
2. Задача 1 (уникальность телефона) — миграция + защита API.
3. Задача 4 (удаление клиента) — расширение CRUD.
4. Задача 2 (план в визите) — миграция + связка UI.
5. Задача 6 (тема) — затрагивает многие компоненты, делать до графиков, чтобы графики сразу подружить с темой.
6. Задача 7 (графики) — бэкенд-эндпоинты + Recharts.

После каждой задачи: smoke-проверка под тремя ролями (admin / doctor / client), `npm run build` без ошибок, `alembic upgrade head` без ошибок.
