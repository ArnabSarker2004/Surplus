"""Weekly supervised forecasts with strictly chronological, recursive backtests."""
from dataclasses import dataclass
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def features(history, index):
    h = np.asarray(history, dtype=float)
    return [h[-1], h[-2], h[-4], float(h[-4:].mean()), float(h[-8:].mean()),
            float(h[-4:].std()), np.sin(index * 2 * np.pi / 52), np.cos(index * 2 * np.pi / 52)]


def fit_predict(values, count, method):
    values = np.asarray(values, dtype=float)
    if method == "Recent average" or len(values) < 12:
        return np.full(count, max(0, float(values[-8:].mean())) if len(values) else 0)
    x = np.asarray([features(values[:i], i) for i in range(8, len(values))])
    y = values[8:]
    model = make_pipeline(StandardScaler(), Ridge(alpha=20)) if method == "Ridge regression" else HistGradientBoostingRegressor(max_iter=60, max_leaf_nodes=7, min_samples_leaf=5, l2_regularization=10, random_state=42)
    model.fit(x, y)
    future = values.tolist()
    # Bound extrapolation to observed scale. This is disclosed, not an unconstrained trend.
    ceiling = max(float(np.max(values)) * 2, float(values.mean()) * 3, 1)
    for _ in range(count):
        prediction = float(np.clip(model.predict([features(future, len(future))])[0], 0, ceiling))
        future.append(prediction)
    return np.asarray(future[len(values):])


@dataclass
class ForecastModel:
    predictions: np.ndarray
    residuals: np.ndarray
    report: dict


def forecast_series(values, count, label):
    values = np.asarray(values, dtype=float)
    methods = ["Recent average"]
    if len(values) >= 16:
        methods.append("Ridge regression")
    if len(values) >= 30:
        methods.append("Gradient boosting")
    # Non-overlapping two-week holdouts: never train on any validation date.
    cuts = list(range(max(12, len(values) - 8), len(values) - 1, 2))
    scores, residuals = {}, {}
    for method in methods:
        errors = []
        for cut in cuts:
            prediction = fit_predict(values[:cut], 2, method)
            errors.extend(values[cut:cut + 2] - prediction)
        residuals[method] = np.asarray(errors)
        scores[method] = float(np.mean(np.abs(errors))) if errors else None
    selected = "Recent average"
    if cuts:
        best = min(methods, key=lambda m: scores[m])
        if scores[best] < scores[selected] * 0.95:
            selected = best
    errors = residuals[selected]
    if len(errors) < 4:
        errors = values[-16:] - values[-16:].mean() if len(values) else np.array([0.0])
    return ForecastModel(fit_predict(values, count, selected), errors, {
        "series": label, "selected": selected, "trainingWeeks": len(values),
        "validationWeeks": len(cuts) * 2, "mae": round(scores[selected], 2) if scores[selected] is not None else None,
        "candidates": [{"name": m, "mae": round(scores[m], 2) if scores[m] is not None else None} for m in methods],
        "reason": "Lowest chronological holdout error; learned models must beat the baseline by 5%." if cuts else "Not enough complete weeks for holdout testing; using a transparent average.",
    })
