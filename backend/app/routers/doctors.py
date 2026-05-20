from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, DbSession, require_roles
from app.models import DoctorProfile, User, UserRole
from app.schemas import DoctorScheduleOut, WorkingHoursUpdate

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("", response_model=list[DoctorScheduleOut])
def list_doctors(db: DbSession, user: CurrentUser) -> list[DoctorScheduleOut]:
    docs = db.query(User).filter(User.role == UserRole.DOCTOR, User.is_active.is_(True)).all()
    out: list[DoctorScheduleOut] = []
    for d in docs:
        wh = d.doctor_profile.working_hours if d.doctor_profile else []
        out.append(DoctorScheduleOut(user_id=d.id, full_name=d.full_name, working_hours=wh or []))
    return out


@router.patch(
    "/me/schedule",
    response_model=DoctorScheduleOut,
    dependencies=[Depends(require_roles(UserRole.DOCTOR))],
)
def update_my_schedule(body: WorkingHoursUpdate, db: DbSession, user: CurrentUser) -> DoctorScheduleOut:
    prof = user.doctor_profile
    if not prof:
        prof = DoctorProfile(user_id=user.id, working_hours=body.working_hours)
        db.add(prof)
    else:
        prof.working_hours = body.working_hours
    db.commit()
    db.refresh(prof)
    return DoctorScheduleOut(user_id=user.id, full_name=user.full_name, working_hours=prof.working_hours)
