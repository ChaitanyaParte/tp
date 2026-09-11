from datetime import datetime


def is_night_time():
    """Returns True if the current time is between 8 PM and 6 AM."""
    current_hour = datetime.now().hour
    return current_hour >= 20 or current_hour < 6


def analyze_detection(total_people, male_count, female_count):
    """
    Analyze detection counts and return safety alerts for suspicious situations.
    Note: SURROUNDED alerts from the AI pipeline arrive via /alerts directly
    (proximity-based); this function provides a count-ratio fallback.
    """
    alerts = []

    # Rule 1: Lone woman at night
    if female_count == 1 and male_count == 0 and is_night_time():
        alerts.append({
            "type": "LONE_WOMAN",
            "severity": "HIGH",
            "confidence": 0.90,
            "description": "One woman detected alone during nighttime.",
        })

    # Rule 2: Women significantly outnumbered at night (ratio-based fallback;
    # spatial SURROUNDED alerts come directly from the AI pipeline via /alerts)
    if female_count >= 1 and male_count >= 3 and is_night_time():
        ratio = male_count / female_count
        if ratio >= 3:
            alerts.append({
                "type": "SURROUNDED",
                "severity": "HIGH",
                "confidence": round(min(0.60 + (ratio - 3) * 0.05, 0.90), 2),
                "description": (
                    f"{male_count} men with {female_count} woman(en) detected at night."
                ),
            })

    return alerts
