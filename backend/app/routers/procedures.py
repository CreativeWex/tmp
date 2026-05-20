from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, DbSession, require_roles
from app.models import Procedure, UserRole
from app.schemas import ProcedureCreate, ProcedureOut

router = APIRouter(prefix="/procedures", tags=["procedures"])


@router.get("", response_model=list[ProcedureOut])
def list_procedures(db: DbSession, user: CurrentUser) -> list[Procedure]:
    return db.query(Procedure).order_by(Procedure.id.asc()).all()


@router.post("", response_model=ProcedureOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def create_procedure(body: ProcedureCreate, db: DbSession) -> Procedure:
    p = Procedure(
        name=body.name,
        duration_minutes=body.duration_minutes,
        buffer_after_minutes=body.buffer_after_minutes,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{procedure_id}", response_model=ProcedureOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def patch_procedure(procedure_id: int, body: ProcedureCreate, db: DbSession) -> Procedure:
    p = db.query(Procedure).filter(Procedure.id == procedure_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Не найдено")
    p.name = body.name
    p.duration_minutes = body.duration_minutes
    p.buffer_after_minutes = body.buffer_after_minutes
    db.commit()
    db.refresh(p)
    return p
