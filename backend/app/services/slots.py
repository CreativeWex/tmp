from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentStatus, DoctorProfile, Procedure, User, UserRole


def _parse_time(s: str) -> time:
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


def _block_minutes(proc: Procedure) -> int:
    return proc.duration_minutes + proc.buffer_after_minutes


def get_free_slots(
    db: Session,
    doctor_user_id: int,
    procedure_id: int,
    day: date,
    slot_step_minutes: int = 15,
) -> List[Tuple[datetime, datetime]]:
    doctor = db.query(User).filter(User.id == doctor_user_id, User.role == UserRole.DOCTOR).first()
    if not doctor or not doctor.doctor_profile:
        return []
    proc = db.query(Procedure).filter(Procedure.id == procedure_id, Procedure.active.is_(True)).first()
    if not proc:
        return []

    profile: DoctorProfile = doctor.doctor_profile
    hours: list[dict] = profile.working_hours or []
    weekday = day.weekday()  # Mon=0
    windows = [h for h in hours if int(h.get("weekday", -1)) == weekday]
    if not windows:
        return []

    block = _block_minutes(proc)
    step = timedelta(minutes=slot_step_minutes)

    busy = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_user_id == doctor_user_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.start_at < datetime.combine(day, time.max) + timedelta(days=1),
            Appointment.end_at > datetime.combine(day, time.min),
        )
        .all()
    )

    def overlaps(a_start: datetime, a_end: datetime) -> bool:
        for ap in busy:
            if a_start < ap.end_at and a_end > ap.start_at:
                return True
        return False

    slots: List[Tuple[datetime, datetime]] = []
    for w in windows:
        start_t = _parse_time(str(w["start"]))
        end_t = _parse_time(str(w["end"]))
        cursor = datetime.combine(day, start_t)
        day_end = datetime.combine(day, end_t)
        proc_end_delta = timedelta(minutes=proc.duration_minutes)
        block_delta = timedelta(minutes=block)

        while cursor + block_delta <= day_end:
            ap_end = cursor + block_delta
            client_visible_end = cursor + proc_end_delta
            if not overlaps(cursor, ap_end):
                slots.append((cursor, client_visible_end))
            cursor += step

    return slots
