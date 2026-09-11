import math
from datetime import datetime, timezone


def calculate_risk_score(alerts):
    """
    Time-weighted risk score. Each alert contributes exp(-k * age_hours)
    where the half-life is 24 hours, so recent alerts count more than old ones.
    Score is scaled by 10 and capped at 100.
    """
    if not alerts:
        return 0.0

    now = datetime.now(timezone.utc)
    DECAY_HALFLIFE_HOURS = 24.0
    k = math.log(2) / DECAY_HALFLIFE_HOURS

    weighted_sum = 0.0
    for alert in alerts:
        ts = getattr(alert, "timestamp", None)
        if ts is None:
            weighted_sum += 1.0
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_hours = max(0.0, (now - ts).total_seconds() / 3600.0)
        weighted_sum += math.exp(-k * age_hours)

    return round(min(weighted_sum * 10.0, 100.0), 2)


def get_risk_level(score):
    """Convert risk score into a risk level."""
    if score >= 70:
        return "HIGH"
    elif score >= 40:
        return "MEDIUM"
    else:
        return "LOW"
