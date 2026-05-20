from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession, require_roles
from app.models import Appointment, AppointmentStatus, Client, Procedure, User, UserRole
from app.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _overlap(db: Session, doctor_user_id: int, start: datetime, end: datetime, exclude_id: Optional[int] = None) -> bool:
    q = db.query(Appointment).filter(
        Appointment.doctor_user_id == doctor_user_id,
        Appointment.status != AppointmentStatus.CANCELLED,
        Appointment.start_at < end,
        Appointment.end_at > start,
    )
    if exclude_id:
        q = q.filter(Appointment.id != exclude_id)
    return q.first() is not None


def _block_end(db: Session, procedure_id: int, start: datetime) -> datetime:
    proc = db.query(Procedure).filter(Procedure.id == procedure_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="Процедура не найдена")
    minutes = proc.duration_minutes + proc.buffer_after_minutes
    return start + timedelta(minutes=minutes)


@router.get("", response_model=list[AppointmentOut])
def list_my_appointments(db: DbSession, user: CurrentUser) -> list[Appointment]:
    q = db.query(Appointment).filter(Appointment.status != AppointmentStatus.CANCELLED)
    if user.role == UserRole.DOCTOR:
        q = q.filter(Appointment.doctor_user_id == user.id)
    elif user.role == UserRole.CLIENT:
        client = db.query(Client).filter(Client.user_id == user.id).first()
        if not client:
            return []
        q = q.filter(Appointment.client_id == client.id)
    elif user.role == UserRole.ADMIN:
        pass
    else:
        return []
    return q.order_by(Appointment.start_at.asc()).limit(500).all()


@router.post("", response_model=AppointmentOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def create_appointment(body: AppointmentCreate, db: DbSession, user: CurrentUser) -> Appointment:
    if user.role == UserRole.DOCTOR and body.doctor_user_id != user.id:
        raise HTTPException(status_code=403, detail="Врач может создавать записи только на себя")
    end_at = _block_end(db, body.procedure_id, body.start_at)
    if _overlap(db, body.doctor_user_id, body.start_at, end_at):
        raise HTTPException(status_code=409, detail="Слот занят")

    ap = Appointment(
        doctor_user_id=body.doctor_user_id,
        procedure_id=body.procedure_id,
        client_id=body.client_id,
        start_at=body.start_at,
        end_at=end_at,
        status=AppointmentStatus.CONFIRMED,
    )
    db.add(ap)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Слот занят")
    db.refresh(ap)
    return ap
