from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Client, Product


def normalize_skin(s: str) -> str:
    return s.strip().lower()


def score_product(product: Product, skin_type: str, concerns: List[str], allergy_tokens: List[str]) -> float:
    st = normalize_skin(skin_type)
    score = 0.0
    pts = [normalize_skin(x) for x in (product.skin_types or [])]
    if st in pts or "all" in pts:
        score += 3.0
    elif not pts:
        score += 0.5

    prod_concerns = {normalize_skin(c) for c in (product.concerns or [])}
    for c in concerns:
        cn = normalize_skin(c)
        if cn in prod_concerns:
            score += 2.0

    hay = f"{product.name or ''} {product.inci or ''}".lower()
    for tok in allergy_tokens:
        t = tok.strip().lower()
        if len(t) >= 2 and t in hay:
            return -1.0

    if product.contraindications:
        low = product.contraindications.lower()
        for tok in allergy_tokens:
            t = tok.strip().lower()
            if len(t) >= 2 and t in low:
                return -1.0

    return score


def allergy_tokens_from_client(client: Optional[Client]) -> List[str]:
    if not client or not client.allergies:
        return []
    parts = []
    for chunk in client.allergies.replace(";", ",").split(","):
        chunk = chunk.strip()
        if chunk:
            parts.append(chunk)
    return parts


def recommend_top_products(
    db: Session,
    client_id: int,
    skin_type: str,
    concerns: List[str],
    limit: int = 3,
) -> List[Product]:
    client = db.query(Client).filter(Client.id == client_id).first()
    tokens = allergy_tokens_from_client(client)

    products = db.query(Product).all()
    scored: List[tuple[float, Product]] = []
    for p in products:
        s = score_product(p, skin_type, concerns, tokens)
        if s < 0:
            continue
        scored.append((s, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    out: List[Product] = []
    for _, p in scored[:limit]:
        out.append(p)
    if len(out) < limit:
        for _, p in scored[limit:]:
            if p not in out:
                out.append(p)
            if len(out) >= limit:
                break
    return out[:limit]
