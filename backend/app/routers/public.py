from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Appointment, AppointmentStatus, ClinicSettings, Procedure, User, UserRole
from app.schemas import ClinicPublicOut, DoctorScheduleOut, ProcedureOut, PublicBookIn, PublicBookOut, SlotOut
from app.services.notifications import send_sms, send_telegram
from app.services.slots import get_free_slots

router = APIRouter(prefix="/public", tags=["public"])


def _get_clinic_by_slug(db: Session, slug: str) -> ClinicSettings:
    c = db.query(ClinicSettings).filter(ClinicSettings.slug == slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="Клиника не найдена")
    return c


def _hours_before_cancel(clinic: Optional[ClinicSettings]) -> int:
    if clinic and clinic.cancellation_hours_before:
        return clinic.cancellation_hours_before
    return settings.cancellation_hours_before


def _assert_change_allowed(ap: Appointment, clinic: Optional[ClinicSettings]) -> None:
    hours = _hours_before_cancel(clinic)
    limit = ap.start_at - timedelta(hours=hours)
    if datetime.utcnow() > limit:
        raise HTTPException(status_code=400, detail="Изменение недоступно: прошёл допустимый срок")


@router.get("/clinics/{slug}", response_model=ClinicPublicOut)
def public_clinic(slug: str, db: Session = Depends(get_db)) -> ClinicPublicOut:
    clinic = _get_clinic_by_slug(db, slug)
    procedures = db.query(Procedure).filter(Procedure.active.is_(True)).all()
    doctors = db.query(User).filter(User.role == UserRole.DOCTOR, User.is_active.is_(True)).all()
    doc_out: list[DoctorScheduleOut] = []
    for d in doctors:
        wh = d.doctor_profile.working_hours if d.doctor_profile else []
        doc_out.append(DoctorScheduleOut(user_id=d.id, full_name=d.full_name, working_hours=wh or []))
    return ClinicPublicOut(
        slug=clinic.slug,
        name=clinic.name,
        procedures=[ProcedureOut.model_validate(p) for p in procedures],
        doctors=doc_out,
    )


@router.get("/clinics/{slug}/slots", response_model=list[SlotOut])
def public_slots(
    slug: str,
    doctor_user_id: int,
    procedure_id: int,
    day: date,
    db: Session = Depends(get_db),
) -> list[SlotOut]:
    _get_clinic_by_slug(db, slug)
    slots = get_free_slots(db, doctor_user_id, procedure_id, day)
    return [SlotOut(start_at=s, end_at=e) for s, e in slots]


@router.post("/clinics/{slug}/book", response_model=PublicBookOut)
async def public_book(slug: str, body: PublicBookIn, db: Session = Depends(get_db)) -> PublicBookOut:
    clinic = _get_clinic_by_slug(db, slug)
    proc = db.query(Procedure).filter(Procedure.id == body.procedure_id, Procedure.active.is_(True)).first()
    if not proc:
        raise HTTPException(status_code=400, detail="Процедура недоступна")
    doctor = db.query(User).filter(User.id == body.doctor_user_id, User.role == UserRole.DOCTOR).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Врач не найден")

    block_min = proc.duration_minutes + proc.buffer_after_minutes
    end_at = body.start_at + timedelta(minutes=block_min)
    clash = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_user_id == body.doctor_user_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.start_at < end_at,
            Appointment.end_at > body.start_at,
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=409, detail="Слот уже занят")

    free = get_free_slots(db, body.doctor_user_id, body.procedure_id, body.start_at.date())
    allowed = any(abs((s - body.start_at).total_seconds()) < 1 for s, _ in free)
    if not allowed:
        raise HTTPException(status_code=400, detail="Слот недоступен")

    ap = Appointment(
        doctor_user_id=body.doctor_user_id,
        procedure_id=body.procedure_id,
        client_id=None,
        guest_name=body.guest_name,
        guest_phone=body.guest_phone,
        guest_email=str(body.guest_email) if body.guest_email else None,
        start_at=body.start_at,
        end_at=end_at,
        status=AppointmentStatus.CONFIRMED,
    )
    db.add(ap)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Слот уже занят")
    db.refresh(ap)

    msg = f"Новая запись: {clinic.name}\n{body.guest_name}, {proc.name}\n{ap.start_at.isoformat()}"
    await send_telegram(msg)
    await send_sms(body.guest_phone, f"Вы записаны в {clinic.name}. Управление: токен {ap.cancellation_token}")

    return PublicBookOut(appointment_id=ap.id, cancellation_token=ap.cancellation_token)


@router.post("/appointments/{appointment_id}/cancel")
async def public_cancel(appointment_id: int, token: str, db: Session = Depends(get_db)) -> dict:
    ap = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not ap or ap.cancellation_token != token:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    clinic = db.query(ClinicSettings).first()
    _assert_change_allowed(ap, clinic)
    ap.status = AppointmentStatus.CANCELLED
    db.commit()
    await send_telegram(f"Отмена записи #{appointment_id}")
    return {"ok": True}


@router.patch("/appointments/{appointment_id}/reschedule")
async def public_reschedule(
    appointment_id: int,
    token: str,
    new_start_at: datetime,
    db: Session = Depends(get_db),
) -> dict:
    ap = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not ap or ap.cancellation_token != token:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    clinic = db.query(ClinicSettings).first()
    _assert_change_allowed(ap, clinic)

    proc = db.query(Procedure).filter(Procedure.id == ap.procedure_id).first()
    if not proc:
        raise HTTPException(status_code=400, detail="Процедура не найдена")
    block_min = proc.duration_minutes + proc.buffer_after_minutes
    new_end = new_start_at + timedelta(minutes=block_min)

    clash = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_user_id == ap.doctor_user_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.id != ap.id,
            Appointment.start_at < new_end,
            Appointment.end_at > new_start_at,
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=409, detail="Слот занят")

    free = get_free_slots(db, ap.doctor_user_id, ap.procedure_id, new_start_at.date())
    if not any(abs((s - new_start_at).total_seconds()) < 1 for s, _ in free):
        raise HTTPException(status_code=400, detail="Слот недоступен")

    ap.start_at = new_start_at
    ap.end_at = new_end
    db.commit()
    await send_telegram(f"Перенос записи #{appointment_id} на {new_start_at.isoformat()}")
    return {"ok": True}
