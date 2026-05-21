import re

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession
from app.models import Client, User, UserRole
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from app.security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_phone(s: str) -> str:
    s = s.strip()
    s = re.sub(r'[\s\-\(\)]', '', s)
    return s


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DbSession) -> TokenOut:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    token = create_access_token(sub=user.email)
    return TokenOut(access_token=token)


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: DbSession) -> TokenOut:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email уже занят")

    phone = _normalize_phone(body.phone) if body.phone else None

    if phone:
        if db.query(User).filter(User.phone == phone).first():
            raise HTTPException(status_code=409, detail="Телефон уже используется")
        if db.query(Client).filter(Client.phone == phone).first():
            raise HTTPException(status_code=409, detail="Телефон уже используется")

    user = User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role=UserRole.CLIENT,
        phone=phone,
    )
    db.add(user)
    db.flush()

    existing_client = None
    if phone:
        existing_client = (
            db.query(Client).filter(Client.phone == phone, Client.user_id.is_(None)).first()
        )
    if not existing_client:
        existing_client = (
            db.query(Client).filter(Client.email == body.email, Client.user_id.is_(None)).first()
        )

    if existing_client:
        existing_client.user_id = user.id
    else:
        client = Client(
            doctor_user_id=None,
            user_id=user.id,
            full_name=body.full_name,
            phone=phone,
            email=body.email,
        )
        db.add(client)

    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(sub=user.email))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
