"""Add unique phone index and careplan visit_id

Revision ID: 002
Revises: 001
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.database import engine
    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE clients SET phone = NULL
            WHERE phone IS NOT NULL AND id NOT IN (
                SELECT MIN(id) FROM clients WHERE phone IS NOT NULL GROUP BY phone
            )
        """))
        conn.execute(text("""
            UPDATE users SET phone = NULL
            WHERE phone IS NOT NULL AND id NOT IN (
                SELECT MIN(id) FROM users WHERE phone IS NOT NULL GROUP BY phone
            )
        """))
        try:
            conn.commit()
        except Exception:
            pass

    try:
        op.create_index("ix_clients_phone_unique", "clients", ["phone"], unique=True)
    except Exception:
        pass
    try:
        op.create_index("ix_users_phone_unique", "users", ["phone"], unique=True)
    except Exception:
        pass

    try:
        op.add_column("care_plans", sa.Column("visit_id", sa.Integer(), nullable=True))
    except Exception:
        pass
    try:
        op.create_foreign_key("fk_careplan_visit", "care_plans", "visits", ["visit_id"], ["id"])
    except Exception:
        pass
    try:
        op.create_index("ix_careplans_visit_id", "care_plans", ["visit_id"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("ix_careplans_visit_id", table_name="care_plans")
    except Exception:
        pass
    try:
        op.drop_constraint("fk_careplan_visit", "care_plans", type_="foreignkey")
    except Exception:
        pass
    try:
        op.drop_column("care_plans", "visit_id")
    except Exception:
        pass
    try:
        op.drop_index("ix_users_phone_unique", table_name="users")
    except Exception:
        pass
    try:
        op.drop_index("ix_clients_phone_unique", table_name="clients")
    except Exception:
        pass
