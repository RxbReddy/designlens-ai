import asyncio
import json
import os
import sys

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.agent import root_agent
from tests.eval.generate_traces import run_single_case

async def main():
    print("=== Running Live Teardown Pipeline (Case 1: Drone) ===")
    
    # Load dataset to get Case 1
    dataset_path = "tests/eval/datasets/teardown-dataset.json"
    with open(dataset_path, "r") as f:
        dataset = json.load(f)
        
    case = dataset["eval_cases"][0] # Case 1: Drone
    
    try:
        result = await run_single_case(root_agent, case)
        
        # Extract report agent output
        agent_events = result["agent_data"]["turns"][0]["events"]
        report_event = [e for e in agent_events if e.get("author") == "report_agent"]
        cost_event = [e for e in agent_events if e.get("author") == "cost_agent"]
        
        if cost_event:
            print("\n================ COST AGENT OUTPUT JSON ================")
            print(cost_event[0].get("content", {}).get("parts", [{}])[0].get("text", ""))
            
        if report_event:
            print("\n================ FINAL REPORT AGENT OUTPUT ================")
            print(report_event[0].get("content", {}).get("parts", [{}])[0].get("text", ""))
        else:
            print("\nNo report generated or error occurred.")
            
    except Exception as e:
        print(f"Error executing pipeline: {e}")

if __name__ == "__main__":
    asyncio.run(main())
