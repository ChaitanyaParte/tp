def calculate_risk_score(alert_count):
    """
    Calculate a simple risk score based on
    the number of alerts.
    """

    score = alert_count * 5

    if score > 100:
        score = 100

    return score


def get_risk_level(score):
    """
    Convert risk score into a risk level.
    """

    if score >= 70:
        return "HIGH"

    elif score >= 40:
        return "MEDIUM"

    else:
        return "LOW"