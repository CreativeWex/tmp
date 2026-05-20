from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, DbSession, require_roles
from app.models import Appointment, AppointmentStatus, Client, ClinicSettings, DoctorProfile, User, UserRole
from app.schemas import AdminUserCreate, ClinicSettingsOut, ClinicSettingsUpdate, DashboardOut, UserOut
from app.security import get_password_hash

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
    u = User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role=body.role,
        phone=body.phone,
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
                phone=body.phone,
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
    return DashboardOut(
        appointments_week=q_ap.count(),
        cancellations_week=q_cancel.count(),
        clients_total=clients_q.count(),
        revenue_placeholder=0.0,
    )
