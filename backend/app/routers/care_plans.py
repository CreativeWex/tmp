from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession, require_roles
from app.models import CarePlan, CarePlanItem, Client, RoutinePeriod, UserRole
from app.schemas import (
    CarePlanCreate,
    CarePlanItemOut,
    CarePlanOut,
    CarePlanPatch,
    ProductOut,
    RecommendIn,
    RecommendOut,
)
from app.services.pdf_care import build_care_plan_pdf
from app.services.recommendations import recommend_top_products


def _can_access_client(db: Session, user, client: Client) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.DOCTOR:
        return client.doctor_user_id == user.id
    if user.role == UserRole.CLIENT:
        return client.user_id == user.id
    return False


def _get_client(db: Session, user, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    if not _can_access_client(db, user, client):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return client


def _get_plan(db: Session, user, plan_id: int) -> CarePlan:
    plan = db.query(CarePlan).filter(CarePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="План не найден")
    client = db.query(Client).filter(Client.id == plan.client_id).first()
    if not client or not _can_access_client(db, user, client):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return plan


router = APIRouter(tags=["care"])


@router.post("/recommendations", response_model=RecommendOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def recommend(body: RecommendIn, db: DbSession, user: CurrentUser) -> RecommendOut:
    _get_client(db, user, body.client_id)
    items = recommend_top_products(db, body.client_id, body.skin_type, body.concerns, limit=3)
    return RecommendOut(products=[ProductOut.model_validate(p) for p in items])


@router.post("/care-plans", response_model=CarePlanOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def create_care_plan(body: CarePlanCreate, db: DbSession, user: CurrentUser) -> CarePlanOut:
    _get_client(db, user, body.client_id)
    plan = CarePlan(
        client_id=body.client_id,
        doctor_user_id=user.id,
        skin_type=body.skin_type,
        concerns=body.concerns,
        notes=body.notes,
    )
    db.add(plan)
    db.flush()
    for it in body.items:
        db.add(
            CarePlanItem(
                care_plan_id=plan.id,
                product_id=it.product_id,
                period=RoutinePeriod(it.period),
                step_order=it.step_order,
                frequency=it.frequency,
            )
        )
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan)


@router.get("/care-plans/{plan_id}", response_model=CarePlanOut)
def get_care_plan(plan_id: int, db: DbSession, user: CurrentUser) -> CarePlanOut:
    plan = _get_plan(db, user, plan_id)
    return _serialize_plan(plan)


@router.patch("/care-plans/{plan_id}", response_model=CarePlanOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def patch_care_plan(plan_id: int, body: CarePlanPatch, db: DbSession, user: CurrentUser) -> CarePlanOut:
    plan = _get_plan(db, user, plan_id)
    if user.role == UserRole.DOCTOR and plan.doctor_user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    db.query(CarePlanItem).filter(CarePlanItem.care_plan_id == plan.id).delete()
    for it in body.items:
        db.add(
            CarePlanItem(
                care_plan_id=plan.id,
                product_id=it.product_id,
                period=RoutinePeriod(it.period),
                step_order=it.step_order,
                frequency=it.frequency,
            )
        )
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan)


@router.get("/care-plans/{plan_id}/pdf")
def care_plan_pdf(plan_id: int, db: DbSession, user: CurrentUser) -> Response:
    plan = _get_plan(db, user, plan_id)
    data = build_care_plan_pdf(db, plan.id)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="care-plan-{plan_id}.pdf"'},
    )


def _serialize_plan(plan: CarePlan) -> CarePlanOut:
    items_out = [
        CarePlanItemOut(
            id=it.id,
            product_id=it.product_id,
            period=it.period.value,
            step_order=it.step_order,
            frequency=it.frequency,
            product=ProductOut.model_validate(it.product) if it.product else None,
        )
        for it in sorted(plan.items, key=lambda x: (x.period.value, x.step_order))
    ]
    return CarePlanOut(
        id=plan.id,
        client_id=plan.client_id,
        doctor_user_id=plan.doctor_user_id,
        skin_type=plan.skin_type,
        concerns=list(plan.concerns or []),
        notes=plan.notes,
        items=items_out,
    )
