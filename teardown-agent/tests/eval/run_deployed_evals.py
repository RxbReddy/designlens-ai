import os
import sys
import json
import re
import uuid
import base64
import requests
import subprocess
from datetime import datetime


def _infer_author(event_data: dict) -> str:
    """Infer agent author from event content for stream_reasoning_engine responses.

    The stream_reasoning_engine endpoint returns events without 'author' metadata.
    This function inspects the text content to match against known JSON schema markers
    for each agent in the teardown pipeline.
    """
    content = event_data.get("content", {})
    parts = content.get("parts", [])
    text = ""
    for part in parts:
        text += part.get("text", "")

    # Try to extract JSON from markdown code blocks or raw text
    json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_match = re.search(r"(\{[\s\S]*\})", text)
        json_str = json_match.group(1) if json_match else ""

    if json_str:
        try:
            parsed = json.loads(json_str)
            keys = set(parsed.keys())
            # vision_agent: has product_identification
            if "product_identification" in keys:
                return "vision_agent"
            # subsystem_agent: has propulsion_system or power_system
            if "propulsion_system" in keys or "power_system" in keys:
                return "subsystem_agent"
            # cost_agent: has material_lookup_results or cost_drivers
            if "material_lookup_results" in keys or "cost_drivers" in keys:
                return "cost_agent"
            # tradeoff_agent: has tradeoff_output
            if "tradeoff_output" in keys:
                return "tradeoff_agent"
        except json.JSONDecodeError:
            pass

    # If no JSON matched, it's likely the markdown report from report_agent
    if text and not json_str:
        return "report_agent"
    # Fallback: if it's the last event or contains markdown headers
    if "##" in text or "# " in text:
        return "report_agent"

    return "unknown"


def get_gcp_token():
    """Retrieve Google Cloud access token using gcloud CLI."""
    try:
        return subprocess.check_output("gcloud auth print-access-token", shell=True).decode().strip()
    except Exception as e:
        print(f"Error getting GCP token: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    metadata_path = "deployment_metadata.json"
    dataset_path = "tests/eval/datasets/teardown-dataset.json"

    if not os.path.exists(metadata_path):
        print(f"Error: {metadata_path} not found. Ensure the deployment was successful.", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(dataset_path):
        print(f"Error: {dataset_path} not found.", file=sys.stderr)
        sys.exit(1)

    print("Loading deployment metadata...")
    with open(metadata_path, "r") as f:
        meta = json.load(f)

    engine_id = meta.get("remote_agent_runtime_id")
    if not engine_id:
        print("Error: remote_agent_runtime_id not found in metadata.", file=sys.stderr)
        sys.exit(1)

    # Parse engine ID to build target URL
    # e.g., projects/184347428779/locations/us-east1/reasoningEngines/6161733530800881664
    parts = engine_id.split("/")
    if len(parts) < 6:
        print(f"Error: Invalid engine ID format: {engine_id}", file=sys.stderr)
        sys.exit(1)

    location = parts[3]
    base_url = f"https://{location}-aiplatform.googleapis.com/reasoningEngines/v1/{engine_id}/api"
    print(f"Deployed Agent URL: {base_url}")

    print("Retrieving GCP credentials...")
    token = get_gcp_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print("Loading evaluation dataset...")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)

    eval_cases = dataset["eval_cases"]
    print(f"Loaded {len(eval_cases)} evaluation cases.")

    results = []

    for i, case in enumerate(eval_cases):
        case_id = case["eval_case_id"]
        prompt = case["prompt"]
        parts_raw = prompt.get("parts", [])

        print(f"\n[{i+1}/{len(eval_cases)}] Running Case: {case_id} ...")

        # Create isolated session for this case
        user_id = f"eval-user-{uuid.uuid4()}"

        session_url = f"{base_url}/apps/app/users/{user_id}/sessions"
        try:
            print("  Creating session...")
            session_resp = requests.post(session_url, headers=headers, json={}, timeout=30)
            if session_resp.status_code != 200:
                print(f"  [ERROR] Failed to create session: {session_resp.status_code} - {session_resp.text}")
                continue

            # Use the server-assigned session ID (not a locally generated one)
            session_data = session_resp.json()
            session_id = session_data.get("id") or session_data.get("session_id")
            if not session_id:
                print(f"  [ERROR] No session ID in response: {session_data}")
                continue
            print(f"  Session ID: {session_id}")

            # Call stream_reasoning_engine endpoint
            run_url = f"{base_url}/stream_reasoning_engine"
            payload = {
                "class_method": "async_stream_query",
                "input": {
                    "message": {
                        "role": "user",
                        "parts": parts_raw
                    },
                    "user_id": user_id,
                    "session_id": session_id
                }
            }

            print("  Sending query stream...")
            run_resp = requests.post(run_url, headers=headers, json=payload, stream=True, timeout=300)
            if run_resp.status_code != 200:
                print(f"  [ERROR] stream_reasoning_engine returned status {run_resp.status_code}: {run_resp.text}")
                continue

            events = []
            for line in run_resp.iter_lines():
                if line:
                    decoded = line.decode("utf-8").strip()
                    try:
                        event_data = json.loads(decoded)
                        # Infer author from content when not provided (stream_reasoning_engine format)
                        if "author" not in event_data and "content" in event_data:
                            author = _infer_author(event_data)
                            event_data["author"] = author
                        events.append(event_data)
                        author = event_data.get("author", "unknown")
                        print(f"    <- Received event from: {author}")
                    except Exception as e:
                        print(f"    [WARNING] Failed to parse event line: {decoded} (Error: {e})")

            # Format the case results matching generate_traces format
            turns = [{"events": []}]
            
            # User query event
            turns[0]["events"].append({
                "author": "user",
                "content": {
                    "role": "user",
                    "parts": parts_raw
                }
            })

            # Agent events
            for ev in events:
                turns[0]["events"].append(ev)

            # Responses
            responses = []
            if events:
                # Filter for model response events or use the last content event
                last_content_event = None
                for ev in reversed(events):
                    if "content" in ev:
                        last_content_event = ev
                        break
                if last_content_event:
                    responses.append({"response": last_content_event["content"]})

            results.append({
                "eval_case_id": case_id,
                "prompt": prompt,
                "agent_data": {
                    "turns": turns,
                },
                "responses": responses,
            })

        except Exception as e:
            print(f"  [ERROR] Exception occurred during case run: {e}")

    # Save traces to file
    output_dir = "artifacts/traces"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "traces_deployed.json")

    print(f"\nSaving traces to {output_file}...")
    trace_data = {
        "eval_cases": results
    }
    with open(output_file, "w") as f:
        json.dump(trace_data, f, indent=2)

    print("\nRunning verification on traces...")
    result = subprocess.run(["uv", "run", "python", "tests/eval/eval_runner.py", output_file])
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
