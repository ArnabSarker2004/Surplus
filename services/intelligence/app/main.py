import hmac
import os
from threading import BoundedSemaphore
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .contracts import ForecastRequest
from .engine import VERSION, analyze
from .assistant import answers
from .cards import compare_cards
from .enrichment import EnrichmentRequest, enrich

app = FastAPI(title="Surplus Financial Intelligence", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
security = HTTPBearer(auto_error=False)
capacity = BoundedSemaphore(2)


def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    expected = os.environ.get("INTELLIGENCE_SERVICE_TOKEN", "")
    if len(expected) < 32 or not credentials or not hmac.compare_digest(credentials.credentials, expected):
        raise HTTPException(status_code=401, detail="Service authentication required")


@app.middleware("http")
async def private_responses(request: Request, call_next):
    if int(request.headers.get("content-length", "0")) > 20_000_000:
        return JSONResponse(status_code=413, content={"detail": "Forecast payload too large"})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def invalid_payload(_request, _error):
    # Pydantic normally echoes offending input; financial payloads must not be echoed.
    return JSONResponse(status_code=422, content={"detail": "Invalid forecast payload"})


@app.get("/health")
def health():
    return {"status": "ok", "version": VERSION}


@app.post("/v1/forecast", dependencies=[Depends(authorize)])
def forecast(request: ForecastRequest):
    if not capacity.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Forecast engine busy; retry shortly")
    try:
        report = analyze(request)
        report["assistant"] = answers(report)
        report["creditCards"] = compare_cards(request, report["liquidity"])
        return report
    finally:
        capacity.release()


@app.post("/v1/enrich", dependencies=[Depends(authorize)])
def enrich_merchants(request: EnrichmentRequest):
    return enrich(request)
