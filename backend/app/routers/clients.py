from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import CurrentUser, DbSession, require_roles
from app.models import Client, User, UserRole, Visit, VisitPhoto, VisitPhotoKind
from app.schemas import ClientCreate, ClientOut, ClientUpdate, VisitCreate, VisitOut, VisitPhotoOut, VisitUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


def _can_access_client(db: Session, user: User, client: Client) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.DOCTOR:
        return client.doctor_user_id == user.id
    if user.role == UserRole.CLIENT:
        return client.user_id == user.id
    return False


def _get_client(db: Session, user: User, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    if not _can_access_client(db, user, client):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return client


@router.get("", response_model=list[ClientOut])
def list_clients(db: DbSession, user: CurrentUser) -> list[Client]:
    q = db.query(Client)
    if user.role == UserRole.DOCTOR:
        q = q.filter(Client.doctor_user_id == user.id)
    elif user.role == UserRole.CLIENT:
        q = q.filter(Client.user_id == user.id)
    return q.order_by(Client.id.desc()).all()


@router.post("", response_model=ClientOut, dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))])
def create_client(body: ClientCreate, db: DbSession, user: CurrentUser) -> Client:
    doc_id = user.id if user.role == UserRole.DOCTOR else None
    if user.role == UserRole.ADMIN:
        doc_id = None
    c = Client(
        doctor_user_id=doc_id,
        full_name=body.full_name,
        birth_date=body.birth_date,
        phone=body.phone,
        email=str(body.email) if body.email else None,
        allergies=body.allergies,
        contraindications=body.contraindications,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: DbSession, user: CurrentUser) -> Client:
    return _get_client(db, user, client_id)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, db: DbSession, user: CurrentUser) -> Client:
    c = _get_client(db, user, client_id)
    if user.role == UserRole.DOCTOR and c.doctor_user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    if user.role == UserRole.CLIENT and c.user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    data = body.model_dump(exclude_unset=True)
    if user.role == UserRole.CLIENT:
        data.pop("full_name", None)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{client_id}/visits", response_model=list[VisitOut])
def list_visits(client_id: int, db: DbSession, user: CurrentUser) -> list[Visit]:
    _get_client(db, user, client_id)
    return db.query(Visit).filter(Visit.client_id == client_id).order_by(Visit.visit_date.desc()).all()


@router.post(
    "/{client_id}/visits",
    response_model=VisitOut,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def create_visit(client_id: int, body: VisitCreate, db: DbSession, user: CurrentUser) -> Visit:
    _get_client(db, user, client_id)
    if user.role == UserRole.DOCTOR:
        c = db.query(Client).filter(Client.id == client_id).first()
        if c and c.doctor_user_id != user.id:
            raise HTTPException(status_code=403, detail="Нет доступа")
    v = Visit(client_id=client_id, visit_date=body.visit_date, notes=body.notes)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.patch(
    "/{client_id}/visits/{visit_id}",
    response_model=VisitOut,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def update_visit(
    client_id: int,
    visit_id: int,
    body: VisitUpdate,
    db: DbSession,
    user: CurrentUser,
) -> Visit:
    _get_client(db, user, client_id)
    if user.role == UserRole.DOCTOR:
        c = db.query(Client).filter(Client.id == client_id).first()
        if c and c.doctor_user_id != user.id:
            raise HTTPException(status_code=403, detail="Нет доступа")
    v = db.query(Visit).filter(Visit.id == visit_id, Visit.client_id == client_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Визит не найден")
    data = body.model_dump(exclude_unset=True)
    for k, val in data.items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v


@router.delete(
    "/{client_id}/visits/{visit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
def delete_visit(client_id: int, visit_id: int, db: DbSession, user: CurrentUser) -> None:
    _get_client(db, user, client_id)
    if user.role == UserRole.DOCTOR:
        c = db.query(Client).filter(Client.id == client_id).first()
        if c and c.doctor_user_id != user.id:
            raise HTTPException(status_code=403, detail="Нет доступа")
    v = db.query(Visit).filter(Visit.id == visit_id, Visit.client_id == client_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Визит не найден")
    for ph in list(v.photos):
        try:
            fpath = (settings.upload_dir / ph.file_path).resolve()
            base = settings.upload_dir.resolve()
            fpath.relative_to(base)
            if fpath.is_file():
                fpath.unlink()
        except (ValueError, OSError):
            pass
        db.delete(ph)
    db.delete(v)
    db.commit()
    return None


def _photo_url(photo_id: int, visit_id: int, filename: str) -> str:
    return f"/api/v1/uploads/visits/{visit_id}/{filename}"


@router.get("/{client_id}/visits/{visit_id}/photos", response_model=list[VisitPhotoOut])
def list_photos(client_id: int, visit_id: int, db: DbSession, user: CurrentUser) -> list[VisitPhotoOut]:
    _get_client(db, user, client_id)
    v = db.query(Visit).filter(Visit.id == visit_id, Visit.client_id == client_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Визит не найден")
    out: list[VisitPhotoOut] = []
    for p in v.photos:
        name = Path(p.file_path).name
        out.append(
            VisitPhotoOut(
                id=p.id,
                visit_id=p.visit_id,
                url=_photo_url(p.id, visit_id, name),
                sort_order=p.sort_order,
                kind=p.kind,
            )
        )
    return out


@router.post(
    "/{client_id}/visits/{visit_id}/photos",
    response_model=list[VisitPhotoOut],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR))],
)
async def upload_photos(
    client_id: int,
    visit_id: int,
    db: DbSession,
    user: CurrentUser,
    files: list[UploadFile] = File(...),
    kind: VisitPhotoKind = VisitPhotoKind.OTHER,
) -> list[VisitPhotoOut]:
    _get_client(db, user, client_id)
    v = db.query(Visit).filter(Visit.id == visit_id, Visit.client_id == client_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Визит не найден")
    if user.role == UserRole.DOCTOR:
        c = db.query(Client).filter(Client.id == client_id).first()
        if c and c.doctor_user_id != user.id:
            raise HTTPException(status_code=403, detail="Нет доступа")

    existing = db.query(VisitPhoto).filter(VisitPhoto.visit_id == visit_id).count()
    if existing + len(files) > 10:
        raise HTTPException(status_code=400, detail="Не более 10 фото на визит")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    visit_dir = settings.upload_dir / "visits" / str(visit_id)
    visit_dir.mkdir(parents=True, exist_ok=True)

    out: list[VisitPhotoOut] = []
    sort_base = existing
    for i, up in enumerate(files):
        ext = Path(up.filename or "img").suffix or ".jpg"
        fname = f"{uuid4().hex}{ext}"
        dest = visit_dir / fname
        content = await up.read()
        dest.write_bytes(content)
        rel = str(dest.relative_to(settings.upload_dir))
        photo = VisitPhoto(visit_id=visit_id, file_path=rel, sort_order=sort_base + i, kind=kind)
        db.add(photo)
        db.flush()
        out.append(
            VisitPhotoOut(
                id=photo.id,
                visit_id=visit_id,
                url=_photo_url(photo.id, visit_id, fname),
                sort_order=photo.sort_order,
                kind=photo.kind,
            )
        )
    db.commit()
    return out
