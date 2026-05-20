from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import Appointment, AppointmentStatus, UserRole
from app.services.notifications import send_sms, send_telegram

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.post("/dispatch-demo", dependencies=[Depends(require_roles(UserRole.ADMIN))])
async def dispatch_demo(db: Session = Depends(get_db)) -> dict:
    """Отправляет напоминания по записям на ближайшие 48 часов (демо, без точного окна)."""
    now = datetime.utcnow()
    window_end = now + timedelta(hours=48)
    aps = (
        db.query(Appointment)
        .filter(
            Appointment.status != AppointmentStatus.CANCELLED,
            Appointment.start_at >= now,
            Appointment.start_at <= window_end,
        )
        .all()
    )
    sent = 0
    for ap in aps:
        name = ap.guest_name or "Клиент"
        phone = ap.guest_phone or ""
        text = f"Напоминание BeautyTrack: {name}, визит {ap.start_at.isoformat(timespec='minutes')}"
        await send_telegram(text)
        if phone:
            await send_sms(phone, text)
        sent += 1
    return {"appointments": len(aps), "notifications_sent": sent}
