from fastapi import APIRouter, Depends

from app.deps import require_roles
from app.models import UserRole
from app.services.notifications import send_sms, send_telegram

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/test-telegram", dependencies=[Depends(require_roles(UserRole.ADMIN))])
async def test_telegram() -> dict:
    ok = await send_telegram("BeautyTrack: тестовое сообщение")
    return {"ok": ok}


@router.post("/test-sms", dependencies=[Depends(require_roles(UserRole.ADMIN))])
async def test_sms(phone: str, text: str = "BeautyTrack SMS test") -> dict:
    return await send_sms(phone, text)
