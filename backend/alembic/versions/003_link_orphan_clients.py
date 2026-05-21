"""Link orphan clients to their portal users

Revision ID: 003
Revises: 002
Create Date: 2026-05-21

"""
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.database import engine
    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE clients SET user_id = (
                SELECT u.id FROM users u
                WHERE u.role = 'client'
                  AND (
                    (clients.email IS NOT NULL AND u.email = clients.email)
                    OR (clients.phone IS NOT NULL AND u.phone = clients.phone)
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM clients c2 WHERE c2.user_id = u.id
                  )
                LIMIT 1
            )
            WHERE clients.user_id IS NULL
        """))
        try:
            conn.commit()
        except Exception:
            pass


def downgrade() -> None:
    pass
