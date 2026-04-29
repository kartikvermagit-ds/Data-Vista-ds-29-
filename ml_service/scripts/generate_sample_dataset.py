from pathlib import Path
import random

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "student_performance_sample.csv"

FIRST_NAMES = [
    "Aarav", "Diya", "Kabir", "Meera", "Ishaan", "Sara", "Vihaan", "Anika", "Rohan", "Tara",
    "Nikhil", "Priya", "Arjun", "Zoya", "Dev", "Mira", "Karan", "Ira", "Reyansh", "Leela",
]
LAST_NAMES = ["Mehta", "Nair", "Khan", "Joshi", "Roy", "Thomas", "Patel", "Bose", "Iyer", "Gupta"]


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return int(max(low, min(high, round(value))))


def grade_from_score(score: float, attendance: int, assignments: int) -> str:
    adjusted = score
    if attendance < 70:
        adjusted -= 5
    if assignments < 60:
        adjusted -= 6
    if adjusted >= 80:
        return "A"
    if adjusted >= 62:
        return "B"
    return "C"


def build_rows(count: int = 120) -> list[dict]:
    random.seed(42)
    rows = []
    for index in range(count):
        ability = random.gauss(72, 15)
        attendance = clamp(random.gauss(ability + 8, 12))
        previous = clamp(random.gauss(ability - 2, 12))
        trend_noise = random.choice([-10, -5, -2, 0, 3, 6, 9])
        last = clamp(previous + trend_noise + random.gauss(0, 5))
        average = clamp((previous + last + random.gauss(ability, 8)) / 3)
        assignments = clamp(random.gauss((attendance + average) / 2 + 3, 13))
        participation = clamp(random.gauss((attendance + average) / 2, 14))
        missing = max(0, min(8, int(round((100 - assignments) / 15 + random.random()))))
        late = max(0, min(8, int(round((100 - attendance) / 18 + random.random()))))
        study_hours = round(max(1, min(24, random.gauss(average / 10, 2.5))), 1)
        trend_score = 1 if last - previous >= 5 else -1 if last - previous <= -5 else 0
        weighted = (
            average * 0.38
            + last * 0.22
            + assignments * 0.18
            + attendance * 0.12
            + participation * 0.06
            + study_hours * 1.2
            - missing * 2.2
            - late * 1.3
            + trend_score * 3
        )
        grade = grade_from_score(weighted, attendance, assignments)
        risk = "At Risk" if grade == "C" or attendance < 70 or assignments < 60 else "Safe"

        rows.append(
            {
                "student_id": f"SV-{1001 + index}",
                "student_name": f"{FIRST_NAMES[index % len(FIRST_NAMES)]} {LAST_NAMES[index % len(LAST_NAMES)]}",
                "attendance_percentage": attendance,
                "average_marks": average,
                "last_test_score": last,
                "previous_test_score": previous,
                "assignment_score": assignments,
                "participation_score": participation,
                "missing_assignments": missing,
                "study_hours_per_week": study_hours,
                "late_submissions": late,
                "performance_trend_score": trend_score,
                "grade": grade,
                "risk_label": risk,
            }
        )
    return rows


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(build_rows()).to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
