# Диаграммы BeautyTrack (PlantUML)

## 1) Диаграмма вариантов использования

```plantuml
@startuml
left to right direction

actor Admin
actor Doctor
actor Client
actor Guest as "Public user"

rectangle BeautyTrack {
  usecase UC1 as "Авторизация"
  usecase UC2 as "Управление клиентами"
  usecase UC3 as "Ведение визитов и фото"
  usecase UC4 as "Управление записями"
  usecase UC5 as "Публичная онлайн-запись"
  usecase UC6 as "Подбор рекомендаций"
  usecase UC7 as "Формирование плана ухода"
  usecase UC8 as "Экспорт плана в PDF"
  usecase UC9 as "Настройки клиники"
  usecase UC10 as "Отправка уведомлений"
}

Admin --> UC1
Admin --> UC2
Admin --> UC4
Admin --> UC9
Admin --> UC10

Doctor --> UC1
Doctor --> UC2
Doctor --> UC3
Doctor --> UC4
Doctor --> UC6
Doctor --> UC7
Doctor --> UC8

Client --> UC1
Client --> UC4

Guest --> UC5
UC5 .> UC10 : <<include>>
UC7 .> UC6 : <<include>>
UC8 .> UC7 : <<include>>
@enduml
```

## 2) Доменная модель предметной области

```plantuml
@startuml
hide methods
skinparam classAttributeIconSize 0

class User {
  +id: int
  +email: string
  +role: enum
}

class DoctorProfile {
  +id: int
  +doctor_user_id: int
  +work_start: time
  +work_end: time
}

class Client {
  +id: int
  +doctor_user_id: int
  +full_name: string
  +phone: string
  +skin_type: string
}

class Visit {
  +id: int
  +client_id: int
  +doctor_user_id: int
  +visit_date: datetime
  +notes: text
}

class VisitPhoto {
  +id: int
  +visit_id: int
  +file_path: string
  +photo_type: string
}

class Procedure {
  +id: int
  +name: string
  +duration_min: int
}

class Appointment {
  +id: int
  +doctor_user_id: int
  +client_id: int
  +procedure_id: int
  +start_at: datetime
  +status: string
}

class Product {
  +id: int
  +name: string
  +category: string
  +skin_type: string
}

class CarePlan {
  +id: int
  +client_id: int
  +doctor_user_id: int
  +created_at: datetime
}

class CarePlanItem {
  +id: int
  +care_plan_id: int
  +product_id: int
  +usage_text: string
}

class ClinicSettings {
  +id: int
  +clinic_name: string
  +public_slug: string
}

User "1" -- "0..1" DoctorProfile
User "1" -- "0..*" Client : doctor
User "1" -- "0..*" Appointment : doctor
User "1" -- "0..*" CarePlan : doctor

Client "1" -- "0..*" Visit
Visit "1" -- "0..*" VisitPhoto

Client "1" -- "0..*" Appointment
Procedure "1" -- "0..*" Appointment

Client "1" -- "0..*" CarePlan
CarePlan "1" -- "1..*" CarePlanItem
Product "1" -- "0..*" CarePlanItem
@enduml
```

## 3) BPMN-схема процессов

```plantuml
@startuml
|Guest|
start
:Открыть страницу /book/{slug};
:Выбрать процедуру;
:Выбрать врача;
:Выбрать дату и слот;
:Ввести контакты;

|System|
:Проверить доступность слота;
if (Слот доступен?) then (Да)
  :Создать Appointment;
  :Сгенерировать cancellation token;
  :Отправить Telegram/SMS уведомление;
  :Запланировать напоминание за 48 часов;

  |Guest|
  :Получить подтверждение записи;
  if (Нужно отменить запись?) then (Да)
    :Открыть ссылку отмены;
    |System|
    :Проверить токен и время до визита;
    if (Отмена разрешена?) then (Да)
      :Обновить статус Appointment=cancelled;
      :Отправить уведомление об отмене;
      |Guest|
      :Получить подтверждение отмены;
    else (Нет)
      |Guest|
      :Получить отказ в отмене;
    endif
  else (Нет)
  endif
else (Нет)
  |Guest|
  :Показать сообщение об ошибке;
  :Выбрать другой слот;
endif

|Doctor|
:Авторизоваться в кабинете;
:Открыть карточку клиента;
:Добавить визит и фото до/после;
:Запросить рекомендации по уходу;

|System|
:Рассчитать score продуктов;
:Сформировать CarePlan и CarePlanItem;
:Сгенерировать PDF плана ухода;

|Doctor|
:Скачать PDF и выдать рекомендации клиенту;

|Admin|
:Проверить дашборд и расписание;
:Запустить dispatch reminders;

|System|
:Найти записи в окне 48 часов;
:Отправить batch уведомлений;
stop
@enduml
```

## 4) Диаграмма компонентов

```plantuml
@startuml
package "BeautyTrack System" {
  [Frontend SPA\nReact + Vite] as FE
  [Auth Context] as AUTH
  [API Client] as APIC

  [FastAPI App] as API
  [Routers Layer] as ROUTERS
  [Services Layer] as SERVICES
  [Security/JWT] as SEC
  [PDF Service] as PDF
  [Recommendation Engine] as RECO
  [Notification Service] as NOTIFY

  database "SQLite" as DB
  [Telegram API] as TG
  [Twilio API] as TWILIO
}

FE --> AUTH
FE --> APIC
APIC --> API
API --> ROUTERS
ROUTERS --> SERVICES
ROUTERS --> SEC
SERVICES --> DB
SERVICES --> PDF
SERVICES --> RECO
SERVICES --> NOTIFY
NOTIFY --> TG
NOTIFY --> TWILIO
@enduml
```

## 5) Компонентая диаграмма обработки данных

```plantuml
@startuml
skinparam componentStyle rectangle

actor User
component "UI Form\n(Booking/Care Plan)" as UI
component "Validation\nFrontend" as FVAL
component "HTTP API\n/api/v1/*" as HTTP
component "Pydantic Schemas\nRequest/Response" as SCHEMA
component "Business Logic\nRouters + Services" as BIZ
component "Recommendation Rules" as RULES
component "SQLAlchemy ORM" as ORM
database "SQLite DB" as DB
component "PDF Builder\nfpdf2" as PDF
component "Notification Gateway\nTelegram/SMS" as NG

User --> UI
UI --> FVAL
FVAL --> HTTP
HTTP --> SCHEMA
SCHEMA --> BIZ
BIZ --> RULES
BIZ --> ORM
ORM --> DB
BIZ --> PDF
BIZ --> NG
PDF --> UI : link to file
NG --> User : delivery status
@enduml
```

## 6) UML диаграмма классов

```plantuml
@startuml
skinparam classAttributeIconSize 0

class AuthRouter {
  +login()
  +me()
}

class ClientsRouter {
  +list_clients()
  +create_client()
  +add_visit()
}

class PublicRouter {
  +slots()
  +book()
  +cancel()
}

class CarePlansRouter {
  +recommendations()
  +upsert_care_plan()
  +care_plan_pdf()
}

class RecommendationService {
  +select_products()
  +score_product()
}

class PdfCareService {
  +build_care_plan_pdf()
}

class NotificationService {
  +send_telegram()
  +send_sms()
}

class SlotService {
  +build_slots()
  +is_slot_available()
}

class SecurityService {
  +create_access_token()
  +verify_password()
  +get_current_user()
}

class User
class Client
class Appointment
class CarePlan
class Product

AuthRouter --> SecurityService
ClientsRouter --> Client
ClientsRouter --> User
PublicRouter --> SlotService
PublicRouter --> Appointment
PublicRouter --> NotificationService
CarePlansRouter --> RecommendationService
CarePlansRouter --> PdfCareService
CarePlansRouter --> CarePlan
RecommendationService --> Product
@enduml
```

## 7) Диаграмма развертывания

```plantuml
@startuml
node "Developer Workstation" {
  node "Browser\nhttp://localhost:5173" as Browser
  node "Frontend Dev Server\nVite (Node.js 20+)" as Vite
  node "Backend API\nUvicorn + FastAPI (Python 3.9+)\nhttp://localhost:8000" as Backend
  database "SQLite\nbeautytrack.db" as SQLite
}

cloud "External Services" {
  node "Telegram Bot API" as Telegram
  node "Twilio SMS API" as Twilio
}

Browser --> Vite : UI requests
Vite --> Backend : REST /api/v1
Backend --> SQLite : SQLAlchemy
Backend --> Telegram : HTTP
Backend --> Twilio : HTTP
@enduml
```
