from fastapi import APIRouter, Depends, HTTPException

from app.deps import CurrentUser, DbSession, require_roles
from app.models import Product, UserRole
from app.schemas import ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(db: DbSession, user: CurrentUser) -> list[Product]:
    return db.query(Product).order_by(Product.id.asc()).all()


@router.post("", response_model=ProductOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def create_product(body: ProductCreate, db: DbSession, user: CurrentUser) -> Product:
    p = Product(
        name=body.name,
        inci=body.inci,
        skin_types=body.skin_types,
        concerns=body.concerns,
        contraindications=body.contraindications,
        is_clinic_custom=True,
        created_by_user_id=user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}", dependencies=[Depends(require_roles(UserRole.ADMIN))])
def delete_product(product_id: int, db: DbSession) -> dict:
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(p)
    db.commit()
    return {"ok": True}
