import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_level(total_xp: float, modifier: float) -> tuple[int, float, float]:
    """Compute (level, current_xp_in_level, xp_required_for_next_level) from total XP.

    Base 1000 XP per level, +10% per level, scaled by modifier.
    """
    if modifier <= 0:
        modifier = 1.0
    xp = total_xp
    lvl = 0
    required = 1000.0 * modifier
    while xp >= required:
        xp -= required
        lvl += 1
        required = 1000.0 * modifier * (1.1 ** lvl)
    return lvl, xp, required
