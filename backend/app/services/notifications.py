from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_telegram(text: str, chat_id: Optional[str] = None) -> bool:
    token = settings.telegram_bot_token.strip()
    if not token:
        logger.info("Telegram skipped: no TELEGRAM_BOT_TOKEN")
        return False
    cid = (chat_id or settings.telegram_default_chat_id or "").strip()
    if not cid:
        logger.info("Telegram skipped: no chat id")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json={"chat_id": cid, "text": text})
        r.raise_for_status()
    return True


async def send_sms(to_phone: str, body: str) -> dict:
    sid = settings.twilio_account_sid.strip()
    token = settings.twilio_auth_token.strip()
    from_num = settings.twilio_from_number.strip()
    if not (sid and token and from_num):
        logger.info("SMS mock -> %s: %s", to_phone, body)
        return {"mode": "mock", "to": to_phone}

    auth = (sid, token)
    data = urlencode({"To": to_phone, "From": from_num, "Body": body})
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    async with httpx.AsyncClient(timeout=20, auth=auth) as client:
        r = await client.post(url, content=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        r.raise_for_status()
    return {"mode": "twilio", "status": r.status_code}
