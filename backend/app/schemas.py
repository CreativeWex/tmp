from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AppointmentStatus, UserRole, VisitPhotoKind


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    phone: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    phone: Optional[str]


class ClientCreate(BaseModel):
    full_name: str
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    allergies: Optional[str] = None
    contraindications: Optional[str] = None


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    allergies: Optional[str] = None
    contraindications: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_user_id: Optional[int]
    user_id: Optional[int]
    full_name: str
    birth_date: Optional[date]
    phone: Optional[str]
    email: Optional[str]
    allergies: Optional[str]
    contraindications: Optional[str]


class VisitCreate(BaseModel):
    visit_date: date
    notes: Optional[str] = None


class VisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    visit_date: date
    notes: Optional[str]


class VisitPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_id: int
    url: str
    sort_order: int
    kind: VisitPhotoKind


class ProcedureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    duration_minutes: int
    buffer_after_minutes: int
    active: bool


class ProcedureCreate(BaseModel):
    name: str
    duration_minutes: int = 60
    buffer_after_minutes: int = 15


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_user_id: int
    procedure_id: int
    client_id: Optional[int]
    guest_name: Optional[str]
    guest_phone: Optional[str]
    guest_email: Optional[str]
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    procedure: Optional[ProcedureOut] = None


class AppointmentCreate(BaseModel):
    doctor_user_id: int
    procedure_id: int
    client_id: Optional[int] = None
    start_at: datetime


class PublicBookIn(BaseModel):
    doctor_user_id: int
    procedure_id: int
    start_at: datetime
    guest_name: str
    guest_phone: str
    guest_email: Optional[EmailStr] = None


class PublicBookOut(BaseModel):
    appointment_id: int
    cancellation_token: str
    message: str = "Запись создана"


class DoctorScheduleOut(BaseModel):
    user_id: int
    full_name: str
    working_hours: list


class WorkingHoursUpdate(BaseModel):
    working_hours: list


class ClinicPublicOut(BaseModel):
    slug: str
    name: str
    procedures: List[ProcedureOut]
    doctors: List[DoctorScheduleOut]


class SlotOut(BaseModel):
    start_at: datetime
    end_at: datetime


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    inci: Optional[str]
    skin_types: List[str]
    concerns: List[str]
    contraindications: Optional[str]
    is_clinic_custom: bool


class ProductCreate(BaseModel):
    name: str
    inci: Optional[str] = None
    skin_types: List[str] = Field(default_factory=list)
    concerns: List[str] = Field(default_factory=list)
    contraindications: Optional[str] = None


class RecommendIn(BaseModel):
    client_id: int
    skin_type: Literal["dry", "oily", "combination", "normal"]
    concerns: List[str] = Field(default_factory=list)


class RecommendOut(BaseModel):
    products: List[ProductOut]


class CarePlanItemIn(BaseModel):
    product_id: int
    period: Literal["morning", "evening"]
    step_order: int
    frequency: Optional[str] = None


class CarePlanCreate(BaseModel):
    client_id: int
    skin_type: str
    concerns: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    items: List[CarePlanItemIn]


class CarePlanItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    period: str
    step_order: int
    frequency: Optional[str]
    product: Optional[ProductOut] = None


class CarePlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    doctor_user_id: int
    skin_type: str
    concerns: List[str]
    notes: Optional[str]
    items: List[CarePlanItemOut]


class CarePlanPatch(BaseModel):
    items: List[CarePlanItemIn]


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: UserRole
    phone: Optional[str] = None


class ClinicSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    cancellation_hours_before: int


class ClinicSettingsUpdate(BaseModel):
    name: Optional[str] = None
    cancellation_hours_before: Optional[int] = Field(default=None, ge=2, le=48)


class DashboardOut(BaseModel):
    appointments_week: int
    cancellations_week: int
    clients_total: int
    revenue_placeholder: float = 0.0
