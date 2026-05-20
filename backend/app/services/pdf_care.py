from __future__ import annotations

from typing import Optional

from fpdf import FPDF
from sqlalchemy.orm import Session, joinedload

from app.models import CarePlan, CarePlanItem, Client, RoutinePeriod


def _ascii_fold(text: Optional[str]) -> str:
    if not text:
        return ""
    return "".join(ch if ord(ch) < 128 else "?" for ch in text)


def build_care_plan_pdf(db: Session, plan_id: int) -> bytes:
    plan = (
        db.query(CarePlan)
        .options(joinedload(CarePlan.items).joinedload(CarePlanItem.product))
        .filter(CarePlan.id == plan_id)
        .first()
    )
    if not plan:
        raise ValueError("Care plan not found")
    client = db.query(Client).filter(Client.id == plan.client_id).first()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Helvetica", size=14)
    pdf.cell(0, 10, "BeautyTrack - care routine", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 8, f"Client: {_ascii_fold(client.full_name) if client else plan.client_id}", ln=True)
    pdf.cell(0, 8, f"Skin type: {_ascii_fold(plan.skin_type)}", ln=True)
    if plan.concerns:
        pdf.cell(0, 8, "Focus: " + ", ".join(_ascii_fold(c) for c in plan.concerns), ln=True)
    pdf.ln(4)

    morning = [i for i in plan.items if i.period == RoutinePeriod.MORNING]
    evening = [i for i in plan.items if i.period == RoutinePeriod.EVENING]
    morning.sort(key=lambda x: x.step_order)
    evening.sort(key=lambda x: x.step_order)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Morning", ln=True)
    pdf.set_font("Helvetica", size=11)
    for idx, it in enumerate(morning, start=1):
        name = _ascii_fold(it.product.name) if it.product else str(it.product_id)
        freq = _ascii_fold(it.frequency) or "daily"
        pdf.multi_cell(0, 7, f"{idx}. {name} - {freq}")
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Evening", ln=True)
    pdf.set_font("Helvetica", size=11)
    for idx, it in enumerate(evening, start=1):
        name = _ascii_fold(it.product.name) if it.product else str(it.product_id)
        freq = _ascii_fold(it.frequency) or "daily"
        pdf.multi_cell(0, 7, f"{idx}. {name} - {freq}")

    if plan.notes:
        pdf.ln(4)
        pdf.set_font("Helvetica", "I", 10)
        pdf.multi_cell(0, 6, f"Doctor notes: {_ascii_fold(plan.notes)}")

    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    return out.encode("latin-1")
