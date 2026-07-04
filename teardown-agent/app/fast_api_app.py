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
import sys

import google.auth
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google.adk.cli.fast_api import get_fast_api_app
from google.auth.exceptions import DefaultCredentialsError

from app.app_utils.typing import Feedback

# ---------------------------------------------------------------------------
# Logging — gracefully falls back to stdlib logging when GCP creds are absent
# ---------------------------------------------------------------------------
# Configure basic console logging at INFO level so all framework and agent logs go to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

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
from app.app_utils import services
session_service_uri = "shared://session"
artifact_service_uri = f"gs://{logs_bucket_name}" if logs_bucket_name else None

app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=artifact_service_uri,
    allow_origins=allow_origins,
    session_service_uri=session_service_uri,
)
from app.app_utils.reasoning_engine_adapter import attach_reasoning_engine_routes
attach_reasoning_engine_routes(app)

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


@app.get("/fetch-image")
def fetch_image(url: str = Query(..., description="The URL of the image or webpage to fetch")) -> dict:
    """Fetch an image from an external URL. If it's a webpage, parse it to extract the primary image.

    Args:
        url: The URL of the image or webpage.

    Returns:
        Dict containing base64 string and mimeType.
    """
    import base64
    import subprocess
    import re
    import ipaddress
    import socket
    from urllib.parse import urljoin, urlparse
    from fastapi import HTTPException

    def validate_url(target_url: str):
        try:
            parsed = urlparse(target_url)
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed URL.")

        if parsed.scheme != "https":
            raise HTTPException(status_code=400, detail="Only HTTPS URLs are allowed for security.")

        hostname = parsed.hostname
        if not hostname:
            raise HTTPException(status_code=400, detail="URL is missing a valid hostname.")

        try:
            addr_info = socket.getaddrinfo(hostname, None)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to resolve host '{hostname}': {str(e)}")

        for addr in addr_info:
            ip_str = addr[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                    raise HTTPException(status_code=400, detail="Access to local or private network resources is forbidden.")
            except ValueError:
                raise HTTPException(status_code=400, detail="Resolved IP is malformed.")

    def fetch_url_bytes(target_url: str) -> tuple[bytes, str, str]:
        """Fetch a URL using system curl for better TLS/bot compatibility.
        Returns (body_bytes, content_type, final_url).
        """
        validate_url(target_url)

        result = subprocess.run(
            [
                "curl", "-s", "-L",
                "--max-time", "20",
                "--max-filesize", "10485760",
                "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "-H", "Accept-Language: en-US,en;q=0.9",
                "-H", "Sec-Fetch-Dest: document",
                "-H", "Sec-Fetch-Mode: navigate",
                "-H", "Sec-Fetch-Site: none",
                "-w", "\n__META__%{content_type}\n__URLF__%{url_effective}",
                target_url,
            ],
            capture_output=True,
            timeout=25,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.decode(errors='ignore')[:200]}")

        raw = result.stdout
        # Extract metadata written by -w at the end
        content_type = ""
        final_url = target_url
        body = raw

        # Split off the __META__ and __URLF__ lines that curl appended
        parts = raw.rsplit(b"\n__URLF__", 1)
        if len(parts) == 2:
            final_url = parts[1].decode(errors="ignore").strip()
            raw = parts[0]
        parts = raw.rsplit(b"\n__META__", 1)
        if len(parts) == 2:
            content_type = parts[1].decode(errors="ignore").strip()
            body = parts[0]

        # Double check post-redirect SSRF
        validate_url(final_url)

        if not body:
            raise RuntimeError("Empty response body from URL")

        if len(body) > 10 * 1024 * 1024:
            raise RuntimeError("Fetched content exceeds maximum limit of 10MB")

        return body, content_type, final_url

    try:
        content, content_type, final_url = fetch_url_bytes(url)

        # If it's a webpage, extract the main image URL
        if "text/html" in content_type:
            html = content.decode("utf-8", errors="ignore")

            # Detect Cloudflare / bot-protection challenge pages
            if "_cf_chl" in html or "cf-challenge" in html or "Just a moment..." in html:
                raise HTTPException(
                    status_code=400,
                    detail="This website is protected by Cloudflare and cannot be scraped. Please paste a direct image URL instead (right-click an image → Copy image address)."
                )

            # Find og:image
            img_url = None
            og_match = re.search(r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', html)
            if not og_match:
                og_match = re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html)

            if og_match:
                img_url = og_match.group(1)
            else:
                # Find twitter:image
                tw_match = re.search(r'<meta\s+[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', html)
                if not tw_match:
                    tw_match = re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']twitter:image["\']', html)
                if tw_match:
                    img_url = tw_match.group(1)
                else:
                    # Find first img tag
                    img_tag_match = re.search(r'<img\s+[^>]*src=["\']([^"\']+)["\']', html)
                    if img_tag_match:
                        img_url = img_tag_match.group(1)

            if not img_url:
                raise HTTPException(status_code=400, detail="Webpage loaded, but could not extract a primary image from it.")

            # Resolve relative image URL
            resolved_img_url = urljoin(final_url, img_url)

            # Fetch the actual image
            content, content_type, _ = fetch_url_bytes(resolved_img_url)

        # Clean mimeType — strip charset or boundary params
        mime = content_type.split(";")[0].strip()

        if not mime.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"Fetched content is not an image (Content-Type: {mime}).")

        encoded = base64.b64encode(content).decode("utf-8")
        return {
            "base64": encoded,
            "mimeType": mime
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch resource: {str(e)}")


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
