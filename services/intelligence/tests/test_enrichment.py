import hashlib
import json
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import httpx
import pytest
from pathlib import Path
from app import enrichment as engine

REGIONAL_CASES = json.loads((Path(__file__).resolve().parents[3] / "tests/fixtures/toronto-merchants.json").read_text(encoding="utf-8"))


def test_regional_rules_match_shared_typescript_cases_without_external_requests(monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *a, **k: pytest.fail("Known regional descriptors must stay local"))
    cases = REGIONAL_CASES["positive"]
    result = engine.enrich(request([case["raw"] for case in cases]))
    for row, case in zip(result["items"], cases):
        assert (row["merchant"], row["category"], row["method"]) == (case["merchant"], case["category"], "local"), case["raw"]
        assert not row["externalEligible"]
        assert not row["attempted"]
        assert row["category"] is None or row["category"] in engine.CATEGORIES
    for raw in REGIONAL_CASES["negative"]:
        assert engine.local_alias(raw) is None, raw


def test_groq_gets_regional_glossary_and_only_cleaned_unresolved_descriptors(monkeypatch):
    def post(_self, url, **kwargs):
        messages = kwargs["json"]["messages"]
        context = messages[0]["content"]
        for term in ["PRES/", "Ryerson", "OneCard", "MiWay", "Textbooks and Supplies", "null category"]:
            assert term in context
        batch = json.loads(messages[1]["content"])
        assert batch == [{"id": 0, "descriptor": "UNFAMILIAR CAMPUS COPY SHOP"}]
        content = {"items": [{"id": 0, "merchant": "Campus Copy Shop", "category": "Textbooks and Supplies"}]}
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    result = engine.enrich(request(["PRES/A1B2C3D4E5 TORONTO ON CAN", "TMU ONECARD LOAD", "INTERAC ETRNSFR SENT EXAMPLE", "PERFORMANCE PLAN", "TELEPHONE ORDER 28JUL2026UNFAMILIAR CAMPUS COPY SHOP ON"]))
    assert result["items"][0]["method"] == "local"
    assert result["items"][1]["category"] is None
    assert result["items"][-1]["category"] == "Textbooks and Supplies"


def request(names, external=True):
    return engine.EnrichmentRequest(items=[dict(key=hashlib.sha256(name.encode()).hexdigest(), raw=name) for name in names], allowExternal=external)


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-only")
    monkeypatch.delenv("GROQ_MODEL", raising=False)
    monkeypatch.setattr(engine, "_next_call", 0)
    monkeypatch.setattr(engine, "_requests", 0)
    monkeypatch.setattr(engine, "_day", "")


def test_cleanup_preserves_brand_digits_acronyms_and_unmarked_words():
    assert engine.pre_clean_string("SQ * STARBUCKS #1234 ON CA") == "STARBUCKS"
    for name in ["3M", "7-Eleven", "H&M", "ON RUNNING", "CO OP", "Studio 54"]:
        assert engine.pre_clean_string(name) == name
    assert engine.pre_clean_string("PAYPAL * SP * Netflix #123 ON") == "Netflix"


def test_local_aliases_and_opt_out_make_no_external_request(monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *a, **k: pytest.fail("Unexpected external request"))
    result = engine.enrich(request(["SQ * STARBUCKS #12 ON", "unknown shop"], False))
    assert result["items"][0]["merchant"] == "Starbucks"
    assert result["items"][1]["method"] == "unresolved"


def test_known_brands_with_store_city_and_reference_suffixes_resolve_locally(monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *a, **k: pytest.fail("Unexpected external request"))
    rows = engine.enrich(request(["SQ *STARBUCKS STORE 1042 TORONTO", "SPOTIFY CAN *3948291 TORONTO ON"]))["items"]
    assert [(row["merchant"], row["category"]) for row in rows] == [("Starbucks", "Coffee"), ("Spotify", "Subscriptions")]
    for descriptor in ["Starbucks Consulting", "Spotify Scam", "My Netflix Store", "PRESTOLOGY"]:
        assert engine.local_alias(descriptor) is None


def test_missing_key_falls_back_and_private_descriptors_are_not_sent(monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *a, **k: pytest.fail("Unexpected external request"))
    assert engine.enrich(request(["INTERAC Alice", "merchant@example.com", "ACCT 123456789"]))["status"] == "local"
    monkeypatch.delenv("GROQ_API_KEY")
    assert engine.enrich(request(["Some Shop"]))["status"] == "not_configured"


def test_batches_twenty_validates_ids_and_limits_repeat_requests(monkeypatch):
    calls = []
    def post(_self, url, **kwargs):
        output = kwargs["json"]["response_format"]
        assert output["type"] == "json_schema"
        assert output["json_schema"]["strict"] is True
        batch = json.loads(kwargs["json"]["messages"][1]["content"])
        assert all(set(r) == {"id", "descriptor"} for r in batch)
        calls.append(batch)
        result = {"items": [{"id": r["id"], "merchant": "Shop " + str(r["id"]), "category": "Shopping"} for r in reversed(batch)]}
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(result)}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    result = engine.enrich(request([f"Unknown merchant {i}" for i in range(25)]))
    assert len(calls[0]) == 20
    assert result["items"][0]["merchant"] == "Shop 0"
    assert sum(r["attempted"] for r in result["items"]) == 20
    assert engine.enrich(request(["Another shop"]))["status"] == "rate_limited"
    assert len(calls) == 1


@pytest.mark.parametrize("items", [[{"id": 999, "merchant": "Bad", "category": "Shopping"}], [{"id": 0, "merchant": "Bad", "category": "Made up"}], [{"id": 0, "merchant": "https://bad.test", "category": "Shopping"}], [{"id": 0, "merchant": "PAYPAL", "category": "Shopping"}]])
def test_invalid_response_is_discarded_atomically(monkeypatch, items):
    def post(_self, url, **_kwargs):
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"items": items})}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    result = engine.enrich(request(["Unknown merchant"]))
    assert result["status"] == "unavailable"
    assert result["items"][0]["merchant"] is None


def test_rate_limit_honors_retry_after_without_sleep_or_retry(monkeypatch):
    calls = []
    def post(_self, url, **_kwargs):
        calls.append(url)
        return httpx.Response(429, headers={"retry-after": "120"}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    assert engine.enrich(request(["Some Shop"]))["status"] == "rate_limited"
    assert engine.enrich(request(["Other Shop"]))["status"] == "rate_limited"
    assert len(calls) == 1


@pytest.mark.parametrize("content", [
    [], {"items": [None]}, {"items": [12]}, {"items": [{"id": True, "merchant": "Shop", "category": "Shopping"}]},
    {"items": [{"id": 0, "merchant": None, "category": "Shopping"}]},
    {"items": [{"id": 0, "merchant": "Shop", "category": "Shopping"}], "extra": "ignored?"},
])
def test_malformed_shapes_and_unidentified_categories_fall_back(monkeypatch, content):
    def post(_self, url, **_kwargs):
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    result = engine.enrich(request(["Unknown merchant"]))
    assert result["status"] == "unavailable"
    assert result["items"][0]["merchant"] is None


def test_custom_model_uses_json_mode_and_ambiguous_answer_is_a_completed_miss(monkeypatch):
    monkeypatch.setenv("GROQ_MODEL", "custom-json-model")
    def post(_self, url, **kwargs):
        assert kwargs["json"]["response_format"] == {"type": "json_object"}
        content = {"items": [{"id": 0, "merchant": None, "category": None}]}
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    row = engine.enrich(request(["Unknown merchant"]))["items"][0]
    assert row["attempted"] is True
    assert row["merchant"] is None


def test_generic_and_private_descriptors_are_completed_locally(monkeypatch):
    monkeypatch.setattr(httpx.Client, "post", lambda *a, **k: pytest.fail("Unexpected external request"))
    result = engine.enrich(request(["POS PURCHASE", "PAYPAL", "ACCT 123456789", "merchant@example.com", "1234"]))
    assert result["status"] == "local"
    assert all(not row["externalEligible"] for row in result["items"])


def test_invalid_provider_choice_shape_falls_back(monkeypatch):
    def post(_self, url, **_kwargs):
        return httpx.Response(200, json={"choices": [None]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    assert engine.enrich(request(["Unknown merchant"]))["status"] == "unavailable"


def test_retry_after_accepts_http_dates_and_rejects_nonfinite_values():
    future = format_datetime(datetime.now(timezone.utc) + timedelta(minutes=5), usegmt=True)
    assert 295 <= engine.retry_delay(future) <= 300
    for value in ["NaN", "Infinity", "invalid", "-1"]:
        assert engine.retry_delay(value) == 60


@pytest.mark.parametrize("failure", ["timeout", "truncated", "duplicate"])
def test_external_failures_preserve_local_aliases_and_reject_partial_batches(monkeypatch, failure):
    def post(_self, url, **_kwargs):
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout")
        content = {"items": [{"id": 0, "merchant": "Shop", "category": "Shopping"}] * 2}
        return httpx.Response(200, json={"choices": [{"finish_reason": "length" if failure == "truncated" else "stop",
                                                    "message": {"content": json.dumps(content)}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.Client, "post", post)
    result = engine.enrich(request(["SQ * STARBUCKS #123 ON", "Unknown shop A", "Unknown shop B"]))
    assert result["status"] == "unavailable"
    assert result["items"][0]["merchant"] == "Starbucks"
    assert all(row["merchant"] is None for row in result["items"][1:])
