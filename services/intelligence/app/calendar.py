import calendar
from datetime import date, timedelta


def occurrences(anchor: date, frequency: str, start: date, end: date):
    if frequency == "Once":
        return [anchor] if start <= anchor <= end else []
    result = []
    if frequency == "Monthly":
        # Start near the requested window; retain Jan-31 -> Feb-28 -> Mar-31 anchoring.
        offset = max(0, (start.year - anchor.year) * 12 + start.month - anchor.month - 1)
        for i in range(offset, offset + 30):
            month = anchor.year * 12 + anchor.month - 1 + i
            year, m = divmod(month, 12)
            current = date(year, m + 1, min(anchor.day, calendar.monthrange(year, m + 1)[1]))
            if current > end:
                break
            if current >= start:
                result.append(current)
    else:
        interval = 7 if frequency == "Weekly" else 14
        first = max(0, ((start - anchor).days + interval - 1) // interval)
        current = anchor + timedelta(days=first * interval)
        while current <= end:
            result.append(current)
            current += timedelta(days=interval)
    return result
