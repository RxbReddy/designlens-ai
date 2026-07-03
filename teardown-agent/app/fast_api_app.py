# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import logging
import os

import google.auth
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.adk.cli.fast_api import get_fast_api_app
from google.auth.exceptions import DefaultCredentialsError

from app.app_utils.typing import Feedback

# ---------------------------------------------------------------------------
# Logging — gracefully falls back to stdlib logging when GCP creds are absent
# ---------------------------------------------------------------------------
try:
    from google.cloud import logging as google_cloud_logging
    from app.app_utils.telemetry import setup_telemetry

    setup_telemetry()
    _, project_id = google.auth.default()
    logging_client = google_cloud_logging.Client()
    _gcp_logger = logging_client.logger(__name__)

    def _log(payload: dict) -> None:
        _gcp_logger.log_struct(payload, severity="INFO")

except (DefaultCredentialsError, Exception):
    logging.basicConfig(level=logging.INFO)
    _std_logger = logging.getLogger(__name__)

    def _log(payload: dict) -> None:  # type: ignore[misc]
        _std_logger.info("Feedback: %s", payload)


# ---------------------------------------------------------------------------
# CORS — ALLOW_ORIGINS env var overrides the default local-dev list
# ---------------------------------------------------------------------------
_env_origins = os.getenv("ALLOW_ORIGINS", "")
allow_origins: list[str] = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
)

# ---------------------------------------------------------------------------
# ADK FastAPI app
# ---------------------------------------------------------------------------
logs_bucket_name = os.environ.get("LOGS_BUCKET_NAME")
AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
session_service_uri = None
artifact_service_uri = f"gs://{logs_bucket_name}" if logs_bucket_name else None

app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=artifact_service_uri,
    allow_origins=allow_origins,
    session_service_uri=session_service_uri,
)
app.title = "teardown-agent"
app.description = "API for interacting with the Agent teardown-agent"

# Explicit CORS middleware so preflight OPTIONS requests always succeed
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/feedback")
def collect_feedback(feedback: Feedback) -> dict[str, str]:
    """Collect and log feedback.

    Args:
        feedback: The feedback data to log

    Returns:
        Success message
    """
    _log(feedback.model_dump())
    return {"status": "success"}


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
