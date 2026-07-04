"""
Custom trace generator that uses the ADK Runner directly.

The Vertex AI SDK's `run_inference` strips inline_data (images) from prompts
via `_get_content_text()`, sending only text to the agent. This causes all
cases to receive the same text-only prompt, leading to hallucinated results.

This script bypasses that by constructing full multimodal Content objects
and feeding them directly to the ADK Runner.
"""
import asyncio
import base64
import json
import os
import sys
import uuid
from datetime import datetime


class BytesEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles bytes and sets from ADK model_dump()."""
    def default(self, o):
        if isinstance(o, bytes):
            return base64.b64encode(o).decode("utf-8")
        if isinstance(o, set):
            return list(o)
        return super().default(o)

# Ensure project root is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from dotenv import load_dotenv
load_dotenv()

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types


async def run_single_case(agent, case: dict) -> dict:
    """Run a single eval case through the ADK Runner with full multimodal content."""
    case_id = case["eval_case_id"]
    prompt = case["prompt"]
    parts_raw = prompt.get("parts", [])

    # Build proper genai Parts preserving both text and inline_data
    parts = []
    for p in parts_raw:
        if "text" in p:
            parts.append(genai_types.Part(text=p["text"]))
        elif "inline_data" in p:
            inline = p["inline_data"]
            parts.append(genai_types.Part(
                inline_data=genai_types.Blob(
                    mime_type=inline["mime_type"],
                    data=base64.b64decode(inline["data"]),
                )
            ))

    new_message = genai_types.Content(role="user", parts=parts)

    # Create isolated session per case
    app_name = "eval_run"
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())

    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )

    runner = Runner(agent=agent, app_name=app_name, session_service=session_service)

    events = []
    print(f"  Running agent for {case_id}...")
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        if event:
            event_dict = event.model_dump(exclude_none=True)
            if "content" in event_dict and "parts" in event_dict["content"]:
                events.append(event_dict)

    # Build the trace output in the same format as agents-cli
    turns = [{"events": []}]

    # Add the user event first
    user_event = {
        "author": "user",
        "content": {
            "role": "user",
            "parts": parts_raw,  # preserve original parts with base64
        }
    }
    turns[0]["events"].append(user_event)

    # Add agent events
    for ev in events:
        turns[0]["events"].append(ev)

    # Build the final response from the last event
    responses = []
    if events:
        last_event = events[-1]
        responses.append({"response": last_event.get("content", {})})

    result = {
        "eval_case_id": case_id,
        "prompt": prompt,
        "agent_data": {
            "turns": turns,
        },
        "responses": responses,
    }
    return result


async def main():
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "tests/eval/datasets/teardown-dataset.json"

    print(f"Loading dataset from {dataset_path}...")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)

    eval_cases = dataset["eval_cases"]
    print(f"Found {len(eval_cases)} eval cases.")

    # Import the agent
    from app.agent import root_agent
    print(f"Agent loaded: {root_agent.name}")

    results = []
    for i, case in enumerate(eval_cases):
        case_id = case["eval_case_id"]
        print(f"\n[{i+1}/{len(eval_cases)}] Processing {case_id}...")
        try:
            result = await run_single_case(root_agent, case)
            results.append(result)
            # Print a brief summary
            agent_events = [e for e in result["agent_data"]["turns"][0]["events"] if e.get("author") != "user"]
            vision_events = [e for e in agent_events if e.get("author") == "vision_agent"]
            if vision_events:
                vision_text = vision_events[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if "out_of_scope" in vision_text:
                    print(f"  -> Vision classified as OUT_OF_SCOPE")
                else:
                    # Try to extract category
                    try:
                        import re
                        json_match = re.search(r'\{[\s\S]*\}', vision_text)
                        if json_match:
                            vj = json.loads(json_match.group())
                            cat = vj.get("product_identification", {}).get("category", "unknown")
                            print(f"  -> Vision classified as: {cat}")
                    except:
                        print(f"  -> Vision output (first 100 chars): {vision_text[:100]}")
            print(f"  -> {len(agent_events)} agent events captured")
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                "eval_case_id": case_id,
                "prompt": case.get("prompt"),
                "agent_data": {"turns": []},
                "responses": [],
                "error": str(e),
            })

    # Write output trace
    os.makedirs("artifacts/traces", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"artifacts/traces/traces_{timestamp}.json"

    trace_output = {"eval_cases": results}
    with open(output_path, "w") as f:
        json.dump(trace_output, f, indent=2, cls=BytesEncoder)

    print(f"\n{'='*60}")
    print(f"Traces saved to: {output_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
