from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    CLIENT = "client"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class VisitPhotoKind(str, enum.Enum):
    BEFORE = "before"
    AFTER = "after"
    OTHER = "other"


class RoutinePeriod(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False, length=20), default=UserRole.CLIENT)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor_profile: Mapped[Optional["DoctorProfile"]] = relationship(back_populates="user", uselist=False)
    clients_owned: Mapped[List["Client"]] = relationship(
        "Client", foreign_keys="Client.doctor_user_id", back_populates="doctor"
    )


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    # list of {weekday: 0-6 (Mon=0), start: "09:00", end: "18:00"}
    working_hours: Mapped[list] = mapped_column(SQLITE_JSON, default=list)

    user: Mapped["User"] = relationship(back_populates="doctor_profile")


class ClinicSettings(Base):
    __tablename__ = "clinic_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="Клиника")
    cancellation_hours_before: Mapped[int] = mapped_column(Integer, default=24)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contraindications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor: Mapped[Optional["User"]] = relationship(foreign_keys=[doctor_user_id], back_populates="clients_owned")
    portal_user: Mapped[Optional["User"]] = relationship(foreign_keys=[user_id])
    visits: Mapped[List["Visit"]] = relationship(back_populates="client")
    appointments: Mapped[List["Appointment"]] = relationship(back_populates="client")
    care_plans: Mapped[List["CarePlan"]] = relationship(back_populates="client")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    visit_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="visits")
    photos: Mapped[List["VisitPhoto"]] = relationship(back_populates="visit")


class VisitPhoto(Base):
    __tablename__ = "visit_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"))
    file_path: Mapped[str] = mapped_column(String(512))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[VisitPhotoKind] = mapped_column(
        Enum(VisitPhotoKind, native_enum=False, length=20), default=VisitPhotoKind.OTHER
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    visit: Mapped["Visit"] = relationship(back_populates="photos")


class Procedure(Base):
    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, default=15)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    appointments: Mapped[List["Appointment"]] = relationship(back_populates="procedure")


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (UniqueConstraint("doctor_user_id", "start_at", name="uq_doctor_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"))
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id"), nullable=True)
    guest_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    guest_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    guest_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, native_enum=False, length=20), default=AppointmentStatus.CONFIRMED
    )
    cancellation_token: Mapped[str] = mapped_column(String(64), default=lambda: uuid.uuid4().hex)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor: Mapped["User"] = relationship(foreign_keys=[doctor_user_id])
    procedure: Mapped["Procedure"] = relationship(back_populates="appointments")
    client: Mapped[Optional["Client"]] = relationship(back_populates="appointments")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    inci: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    skin_types: Mapped[list] = mapped_column(SQLITE_JSON, default=list)  # e.g. ["dry","oily"]
    concerns: Mapped[list] = mapped_column(SQLITE_JSON, default=list)  # e.g. ["acne"]
    contraindications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_clinic_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


class CarePlan(Base):
    __tablename__ = "care_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    doctor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    skin_type: Mapped[str] = mapped_column(String(64))
    concerns: Mapped[list] = mapped_column(SQLITE_JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="care_plans")
    items: Mapped[List["CarePlanItem"]] = relationship(
        back_populates="care_plan",
        cascade="all, delete-orphan",
    )


class CarePlanItem(Base):
    __tablename__ = "care_plan_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    care_plan_id: Mapped[int] = mapped_column(ForeignKey("care_plans.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    period: Mapped[RoutinePeriod] = mapped_column(Enum(RoutinePeriod, native_enum=False, length=20))
    step_order: Mapped[int] = mapped_column(Integer, default=0)
    frequency: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    care_plan: Mapped["CarePlan"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()
