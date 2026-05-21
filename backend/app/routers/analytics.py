from datetime import date as date_t, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func

from app.deps import CurrentUser, DbSession, require_roles
from app.models import Appointment, AppointmentStatus, Client, Procedure, UserRole
from app.schemas import AgeBucketOut, AnalyticsPointOut, ProcedureCountOut, StatusBucketOut

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


@router.get(
    "/appointments-30d",
    response_model=list[AnalyticsPointOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def appointments_30d(db: DbSession, user: CurrentUser) -> list[AnalyticsPointOut]:
    today = date_t.today()
    start = today - timedelta(days=29)
    q = db.query(
        func.date(Appointment.start_at).label("d"),
        func.count(Appointment.id),
    ).filter(
        Appointment.start_at >= datetime.combine(start, datetime.min.time()),
        Appointment.start_at < datetime.combine(today + timedelta(days=1), datetime.min.time()),
        Appointment.status != AppointmentStatus.CANCELLED,
    )
    if user.role == UserRole.DOCTOR:
        q = q.filter(Appointment.doctor_user_id == user.id)
    counts: dict[str, int] = {}
    for d, c in q.group_by("d").all():
        key = d if isinstance(d, str) else d.isoformat()
        counts[str(key)] = int(c)
    series: list[AnalyticsPointOut] = []
    for i in range(30):
        day = start + timedelta(days=i)
        series.append(AnalyticsPointOut(date=day.isoformat(), count=counts.get(day.isoformat(), 0)))
    return series


@router.get(
    "/appointments-status",
    response_model=list[StatusBucketOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def appointments_status(
    db: DbSession,
    user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
) -> list[StatusBucketOut]:
    start = datetime.utcnow() - timedelta(days=days)
    q = db.query(
        Appointment.status,
        func.count(Appointment.id),
    ).filter(Appointment.start_at >= start)
    if user.role == UserRole.DOCTOR:
        q = q.filter(Appointment.doctor_user_id == user.id)
    result: list[StatusBucketOut] = []
    for status, count in q.group_by(Appointment.status).all():
        result.append(StatusBucketOut(status=status.value if hasattr(status, "value") else str(status), count=int(count)))
    return result


@router.get(
    "/procedures-top",
    response_model=list[ProcedureCountOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def procedures_top(
    db: DbSession,
    user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
) -> list[ProcedureCountOut]:
    start = datetime.utcnow() - timedelta(days=days)
    q = db.query(
        Appointment.procedure_id,
        Procedure.name,
        func.count(Appointment.id).label("cnt"),
    ).join(Procedure, Appointment.procedure_id == Procedure.id).filter(
        Appointment.start_at >= start,
        Appointment.status != AppointmentStatus.CANCELLED,
    )
    if user.role == UserRole.DOCTOR:
        q = q.filter(Appointment.doctor_user_id == user.id)
    rows = q.group_by(Appointment.procedure_id, Procedure.name).order_by(func.count(Appointment.id).desc()).limit(limit).all()
    return [ProcedureCountOut(procedure_id=r[0], name=r[1], count=int(r[2])) for r in rows]


@router.get(
    "/age-groups",
    response_model=list[AgeBucketOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def age_groups(db: DbSession, user: CurrentUser) -> list[AgeBucketOut]:
    q = db.query(Client).filter(Client.birth_date.isnot(None))
    if user.role == UserRole.DOCTOR:
        q = q.filter(Client.doctor_user_id == user.id)
    today = date_t.today()
    buckets: dict[str, int] = {"18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "unknown": 0}
    for c in q.all():
        if not c.birth_date:
            buckets["unknown"] += 1
            continue
        age = today.year - c.birth_date.year - (
            (today.month, today.day) < (c.birth_date.month, c.birth_date.day)
        )
        if age < 18:
            buckets["unknown"] += 1
        elif age <= 24:
            buckets["18-24"] += 1
        elif age <= 34:
            buckets["25-34"] += 1
        elif age <= 44:
            buckets["35-44"] += 1
        elif age <= 54:
            buckets["45-54"] += 1
        else:
            buckets["55+"] += 1
    return [AgeBucketOut(bucket=k, count=v) for k, v in buckets.items() if k != "unknown" or v > 0]
