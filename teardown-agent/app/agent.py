# ruff: noqa
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

import datetime
from zoneinfo import ZoneInfo

from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

import os
import google.auth
from google.auth.exceptions import DefaultCredentialsError

# Graceful authentication handling (Vertex AI vs Google AI Studio API Key)
try:
    _, project_id = google.auth.default()
    os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
    os.environ["GOOGLE_CLOUD_LOCATION"] = "global"
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
except DefaultCredentialsError:
    # Fallback to Google AI Studio if no GCP credentials are set
    if "GEMINI_API_KEY" in os.environ or "GOOGLE_API_KEY" in os.environ:
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
    else:
        # Default placeholder to prevent startup crash
        os.environ["GOOGLE_CLOUD_PROJECT"] = "placeholder-project"
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"


def get_model():
    return Gemini(
        model="gemini-flash-latest",
        retry_options=types.HttpRetryOptions(attempts=3),
    )


def get_material_cost(material_name: str) -> dict:
    """Mock tool to look up current manufacturing costs for a material.

    Args:
        material_name: The name of the material to query (e.g. 'ABS', 'aluminum', 'copper').

    Returns:
        A dict with cost information.
    """
    costs = {
        "abs": {"price_per_kg": "$3.50", "complexity_premium": "low"},
        "aluminum": {"price_per_kg": "$6.20", "complexity_premium": "medium"},
        "steel": {"price_per_kg": "$2.10", "complexity_premium": "low"},
        "copper": {"price_per_kg": "$9.80", "complexity_premium": "high"},
        "silicon": {"price_per_kg": "$25.00", "complexity_premium": "high"},
        "fr4": {"price_per_kg": "$12.00", "complexity_premium": "medium"}
    }
    mat = material_name.lower().strip()
    return costs.get(mat, {"price_per_kg": "Unknown / Custom", "complexity_premium": "high"})


# Agent Factories to prevent parent assignment conflicts
def create_vision_agent():
    return Agent(
        name="vision_agent",
        model=get_model(),
        instruction="""You are the Vision Agent.
Identify the product type, visible components, materials, and observations from the image/input.
Return your observations as a structured JSON object containing:
- product_type: string
- components: list of components
- materials: list of materials
- observations: list of general observations
Save your output into the session state key 'vision_output'.""",
        output_key="vision_output"
    )

def create_subsystem_agent():
    return Agent(
        name="subsystem_agent",
        model=get_model(),
        instruction="""You are the Subsystem Agent.
Read the identified components and materials from 'vision_output' state key.
Map each component into one of these systems: power_system, sensing_system, structure_system, control_system, communication_system, or uncertain.
Return a structured JSON object showing this mapping.
Save your output into the session state key 'subsystem_output'.""",
        output_key="subsystem_output"
    )

def create_tradeoff_agent():
    return Agent(
        name="tradeoff_agent",
        model=get_model(),
        instruction="""You are the Trade-off Agent.
Read the subsystem mappings from 'subsystem_output' and observations from 'vision_output'.
Explain the likely design trade-offs made in the product (e.g. why they chose aluminum over ABS, or why a certain battery placement was used).
Return a structured list of design trade-offs.
Save your output into the session state key 'tradeoff_output'.""",
        output_key="tradeoff_output"
    )

def create_cost_agent():
    return Agent(
        name="cost_agent",
        model=get_model(),
        instruction="""You are the Cost Agent.
Read the materials from 'vision_output' and subsystem mapping from 'subsystem_output'.
For each identified material, query the 'get_material_cost' tool to fetch current prices.
Combine this with observations to rank the top cost drivers for manufacturing this product.
Save your output into the session state key 'cost_output'.""",
        tools=[get_material_cost],
        output_key="cost_output"
    )

def create_report_agent():
    return Agent(
        name="report_agent",
        model=get_model(),
        instruction="""You are the Report Agent.
Your job is to compile the final first-pass engineering analysis report.
Read the following keys from session state:
- 'vision_output'
- 'subsystem_output'
- 'tradeoff_output'
- 'cost_output'

Generate a beautifully formatted Markdown report containing:
1. Executive Summary
2. Subsystem Breakdown Table
3. Design Trade-offs Analysis
4. Ranked Cost & Manufacturing Drivers
5. Final Engineering Recommendations

Output only the Markdown text.""",
        output_key="report_output"
    )


# Root agent coordinating the optimized hybrid sequential/parallel pipeline
root_agent = SequentialAgent(
    name="teardown_pipeline",
    sub_agents=[
        create_vision_agent(),
        create_subsystem_agent(),
        # Run Trade-off and Cost analysis concurrently
        ParallelAgent(
            name="analysis_phase",
            sub_agents=[
                create_tradeoff_agent(),
                create_cost_agent(),
            ]
        ),
        create_report_agent(),
    ]
)

app = App(
    root_agent=root_agent,
    name="app",
)
