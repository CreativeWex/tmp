import re
from datetime import date as date_t, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.deps import CurrentUser, DbSession, require_roles
from app.models import (
    Appointment,
    AppointmentStatus,
    Client,
    ClinicSettings,
    DoctorProfile,
    User,
    UserRole,
    Visit,
    VisitPhoto,
)
from app.schemas import (
    AdminUserCreate,
    ClinicSettingsOut,
    ClinicSettingsUpdate,
    DashboardOut,
    DashboardScheduleItemOut,
    DashboardSeriesPoint,
    RecentVisitOut,
    UpcomingBirthdayOut,
    UserOut,
)
from app.security import get_password_hash


def _normalize_phone(s: str) -> str:
    s = s.strip()
    s = re.sub(r'[\s\-\(\)]', '', s)
    return s

router = APIRouter(prefix="/admin", tags=["admin"])


def _default_hours() -> list[dict]:
    out: list[dict] = []
    for wd in range(0, 5):
        out.append({"weekday": wd, "start": "09:00", "end": "18:00"})
    return out


@router.post("/users", response_model=UserOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def create_user(body: AdminUserCreate, db: DbSession) -> UserOut:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email занят")

    phone = _normalize_phone(body.phone) if body.phone else None
    if phone:
        if db.query(User).filter(User.phone == phone).first():
            raise HTTPException(status_code=409, detail="Телефон уже используется")
        if db.query(Client).filter(Client.phone == phone).first():
            raise HTTPException(status_code=409, detail="Телефон уже используется")

    u = User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role=body.role,
        phone=phone,
    )
    db.add(u)
    db.flush()
    if body.role == UserRole.DOCTOR:
        db.add(DoctorProfile(user_id=u.id, working_hours=_default_hours()))
    if body.role == UserRole.CLIENT:
        db.add(
            Client(
                doctor_user_id=None,
                user_id=u.id,
                full_name=body.full_name,
                phone=phone,
                email=body.email,
            )
        )
    db.commit()
    db.refresh(u)
    return UserOut.model_validate(u)


@router.get("/settings", response_model=ClinicSettingsOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def get_settings(db: DbSession) -> ClinicSettingsOut:
    row = db.query(ClinicSettings).first()
    if not row:
        raise HTTPException(status_code=404, detail="Настройки не найдены")
    return ClinicSettingsOut.model_validate(row)


@router.patch("/settings", response_model=ClinicSettingsOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def patch_settings(body: ClinicSettingsUpdate, db: DbSession) -> ClinicSettingsOut:
    row = db.query(ClinicSettings).first()
    if not row:
        raise HTTPException(status_code=404, detail="Настройки не найдены")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return ClinicSettingsOut.model_validate(row)


@router.get("/dashboard", response_model=DashboardOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def dashboard(db: DbSession, user: CurrentUser) -> DashboardOut:
    now = datetime.utcnow()
    week_start = now - timedelta(days=7)
    q_ap = db.query(Appointment).filter(
        Appointment.start_at >= week_start,
        Appointment.status != AppointmentStatus.CANCELLED,
    )
    q_cancel = db.query(Appointment).filter(
        Appointment.status == AppointmentStatus.CANCELLED,
        Appointment.start_at >= week_start,
    )
    if user.role == UserRole.DOCTOR:
        q_ap = q_ap.filter(Appointment.doctor_user_id == user.id)
        q_cancel = q_cancel.filter(Appointment.doctor_user_id == user.id)
    clients_q = db.query(Client)
    if user.role == UserRole.DOCTOR:
        clients_q = clients_q.filter(Client.doctor_user_id == user.id)

    today = date_t.today()
    series_start = today - timedelta(days=6)
    series_q = db.query(
        func.date(Appointment.start_at).label("d"),
        func.count(Appointment.id),
    ).filter(
        Appointment.start_at >= datetime.combine(series_start, datetime.min.time()),
        Appointment.start_at < datetime.combine(today + timedelta(days=1), datetime.min.time()),
        Appointment.status != AppointmentStatus.CANCELLED,
    )
    if user.role == UserRole.DOCTOR:
        series_q = series_q.filter(Appointment.doctor_user_id == user.id)
    counts: dict[str, int] = {}
    for d, c in series_q.group_by("d").all():
        key = d if isinstance(d, str) else d.isoformat()
        counts[str(key)] = int(c)
    series: list[DashboardSeriesPoint] = []
    for i in range(7):
        day = series_start + timedelta(days=i)
        series.append(DashboardSeriesPoint(date=day.isoformat(), count=counts.get(day.isoformat(), 0)))

    return DashboardOut(
        appointments_week=q_ap.count(),
        cancellations_week=q_cancel.count(),
        clients_total=clients_q.count(),
        revenue_placeholder=0.0,
        series_7d=series,
    )


@router.get(
    "/dashboard/schedule",
    response_model=list[DashboardScheduleItemOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def dashboard_schedule(
    db: DbSession,
    user: CurrentUser,
    days: int = Query(2, ge=1, le=14),
) -> list[DashboardScheduleItemOut]:
    today_start = datetime.combine(date_t.today(), datetime.min.time())
    horizon = today_start + timedelta(days=days)
    q = (
        db.query(Appointment)
        .options(joinedload(Appointment.procedure), joinedload(Appointment.client))
        .filter(
            Appointment.start_at >= today_start,
            Appointment.start_at < horizon,
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    )
    if user.role == UserRole.DOCTOR:
        q = q.filter(Appointment.doctor_user_id == user.id)
    items: list[DashboardScheduleItemOut] = []
    for ap in q.order_by(Appointment.start_at.asc()).all():
        name = ap.client.full_name if ap.client else ap.guest_name
        items.append(
            DashboardScheduleItemOut(
                id=ap.id,
                start_at=ap.start_at,
                end_at=ap.end_at,
                procedure_name=ap.procedure.name if ap.procedure else f"#{ap.procedure_id}",
                client_full_name=name,
                status=ap.status,
            )
        )
    return items


@router.get(
    "/recent-visits",
    response_model=list[RecentVisitOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def recent_visits(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(5, ge=1, le=20),
) -> list[RecentVisitOut]:
    q = (
        db.query(Visit)
        .options(joinedload(Visit.client))
        .join(Client, Visit.client_id == Client.id)
    )
    if user.role == UserRole.DOCTOR:
        q = q.filter(Client.doctor_user_id == user.id)
    visits = q.order_by(Visit.visit_date.desc(), Visit.id.desc()).limit(limit).all()
    out: list[RecentVisitOut] = []
    for v in visits:
        photo = (
            db.query(VisitPhoto)
            .filter(VisitPhoto.visit_id == v.id)
            .order_by(VisitPhoto.sort_order.asc(), VisitPhoto.id.asc())
            .first()
        )
        photo_url: str | None = None
        if photo:
            fname = Path(photo.file_path).name
            photo_url = f"/api/v1/uploads/visits/{v.id}/{fname}"
        out.append(
            RecentVisitOut(
                visit_id=v.id,
                client_id=v.client_id,
                client_full_name=v.client.full_name if v.client else "",
                visit_date=v.visit_date,
                first_photo_url=photo_url,
            )
        )
    return out


@router.get(
    "/upcoming-birthdays",
    response_model=list[UpcomingBirthdayOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def upcoming_birthdays(
    db: DbSession,
    user: CurrentUser,
    days: int = Query(7, ge=1, le=60),
) -> list[UpcomingBirthdayOut]:
    q = db.query(Client).filter(Client.birth_date.isnot(None))
    if user.role == UserRole.DOCTOR:
        q = q.filter(Client.doctor_user_id == user.id)
    today = date_t.today()
    items: list[UpcomingBirthdayOut] = []
    for c in q.all():
        if not c.birth_date:
            continue
        bd = c.birth_date
        try:
            next_bd = bd.replace(year=today.year)
        except ValueError:
            next_bd = date_t(today.year, 3, 1)
        if next_bd < today:
            try:
                next_bd = bd.replace(year=today.year + 1)
            except ValueError:
                next_bd = date_t(today.year + 1, 3, 1)
        delta = (next_bd - today).days
        if 0 <= delta <= days:
            items.append(
                UpcomingBirthdayOut(
                    client_id=c.id,
                    full_name=c.full_name,
                    birth_date=c.birth_date,
                    days_until=delta,
                )
            )
    items.sort(key=lambda x: (x.days_until, x.full_name))
    return items[:20]
