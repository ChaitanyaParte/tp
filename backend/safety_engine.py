from datetime import datetime


def is_night_time():
    """
    Returns True if the current time is between
    8 PM and 6 AM.
    """

    current_hour = datetime.now().hour

    return current_hour >= 20 or current_hour < 6


def analyze_detection(total_people, male_count, female_count):
    """
    Analyze a detection and return a safety alert
    if a suspicious situation is detected.
    """

    alerts = []

    # Rule 1: Lone woman at night
    if (
        female_count == 1
        and male_count == 0
        and is_night_time()
    ):
        alerts.append({
            "type": "LONE_WOMAN",
            "severity": "HIGH",
            "confidence": 0.90,
            "description": "One woman detected alone during nighttime."
        })

    return alerts