"""Bootstrap schema from SQLAlchemy models

Revision ID: 001
Revises:
Create Date: 2026-04-19

"""

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.database import Base, engine

    Base.metadata.create_all(bind=engine)


def downgrade() -> None:
    from app.database import Base, engine

    Base.metadata.drop_all(bind=engine)
