from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Client,
    ClinicSettings,
    DoctorProfile,
    Procedure,
    Product,
    User,
    UserRole,
)
from app.security import get_password_hash


def _default_hours() -> list[dict]:
    return [{"weekday": d, "start": "09:00", "end": "18:00"} for d in range(0, 5)]


def seed_if_empty(db: Session) -> None:
    if db.query(User).first():
        return

    clinic = ClinicSettings(
        slug=settings.public_clinic_slug,
        name="BeautyTrack Клиника",
        cancellation_hours_before=settings.cancellation_hours_before,
    )
    db.add(clinic)

    admin = User(
        email="admin@example.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Администратор",
        role=UserRole.ADMIN,
    )
    doctor_user = User(
        email="doctor@example.com",
        hashed_password=get_password_hash("doctor123"),
        full_name="Доктор Иванова",
        role=UserRole.DOCTOR,
        phone="+79990001122",
    )
    client_user = User(
        email="client@example.com",
        hashed_password=get_password_hash("client123"),
        full_name="Клиент Анна",
        role=UserRole.CLIENT,
        phone="+79990003344",
    )
    db.add_all([admin, doctor_user, client_user])
    db.flush()

    db.add(DoctorProfile(user_id=doctor_user.id, working_hours=_default_hours()))

    client_row = Client(
        doctor_user_id=doctor_user.id,
        user_id=client_user.id,
        full_name=client_user.full_name,
        phone=client_user.phone,
        email=client_user.email,
        allergies="Retinol",
        contraindications="беременность",
    )
    db.add(client_row)
    db.flush()

    procedures = [
        Procedure(name="Консультация косметолога", duration_minutes=30, buffer_after_minutes=10),
        Procedure(name="Чистка лица", duration_minutes=60, buffer_after_minutes=15),
        Procedure(name="Лазерная процедура", duration_minutes=45, buffer_after_minutes=20),
    ]
    db.add_all(procedures)

    skin_cycle = ["dry", "oily", "combination", "normal"]
    concern_cycle = [["acne"], ["pigmentation"], ["rosacea"], ["wrinkles"], ["dryness"]]
    for i in range(100):
        st = skin_cycle[i % len(skin_cycle)]
        c1 = concern_cycle[i % len(concern_cycle)]
        c2 = concern_cycle[(i + 1) % len(concern_cycle)]
        concerns = list({*c1, *c2})
        skin_types = [st, "all"] if i % 7 == 0 else [st]
        db.add(
            Product(
                name=f"Средство ухода №{i + 1}",
                inci="Aqua, Glycerin, Niacinamide, Panthenol",
                skin_types=skin_types,
                concerns=concerns,
                contraindications="индивидуальная непереносимость компонентов",
                is_clinic_custom=False,
            )
        )

    db.commit()
