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
        instruction="""You are the Vision Agent for an engineering teardown pipeline.
Inspect one or more consumer product images and any optional user-provided specs. Analyze any
consumer product; drones are the primary MVP target and the example below is drone-focused.
Extract visual evidence for downstream agents; do not perform subsystem mapping, cost estimation,
or broad engineering tradeoff analysis.

Return valid JSON only using this compact schema:
{
  "product_identification": {
    "category": "string",
    "subcategory": "string",
    "confidence": "high | medium | low",
    "evidence": ["string"]
  },
  "image_summary": [
    {
      "image_id": "image_1",
      "view": "top | bottom | front | side | angled | internal | unknown",
      "description": "string"
    }
  ],
  "drone_configuration": {
    "rotor_count": "number | null",
    "frame_layout": "string",
    "payload_or_camera_visible": "boolean | null",
    "battery_visible": "boolean | null",
    "landing_gear_visible": "boolean | null",
    "propeller_guards_visible": "boolean | null",
    "confidence": "high | medium | low"
  },
  "text_observed": [
    {
      "text": "string",
      "location": "string",
      "evidence_type": "visible",
      "confidence": "high | medium | low"
    }
  ],
  "visible_components": [
    {
      "name": "string",
      "component_type": "propulsion | structure/enclosure | power | sensing/payload | control | communication | fastener | thermal | unknown",
      "count": "number | unknown",
      "location": "string",
      "visibility": "clear | partial | occluded | inferred",
      "evidence_type": "visible | inferred_from_visual | user_provided_spec",
      "visual_evidence": "string",
      "confidence": "high | medium | low"
    }
  ],
  "material_candidates": [
    {
      "component_name": "string",
      "material": "string",
      "evidence_type": "visible | inferred_from_visual | user_provided_spec",
      "visual_evidence": "string",
      "confidence": "high | medium | low"
    }
  ],
  "uncertainties": [
    {
      "item": "string",
      "reason": "string"
    }
  ],
  "downstream_hints": {
    "likely_subsystems_present": ["string"],
    "cost_relevant_materials": ["string"],
    "do_not_assume": ["string"]
  }
}

Rules:
- Separate directly visible evidence from inferred assumptions.
- Be conservative. If a detail is not visible, put it in uncertainties or do_not_assume.
- Use null for unknown numeric or boolean values. Use "unknown" for unknown descriptive strings.
- Attach material candidates to specific components when possible, but keep material inference
  conservative.
- Do not name exact alloy, resin, or composite grades unless they are printed, labeled, or visually
  certain.
- Do not list internal components as visible unless they are physically visible in the image.
- Keep drone_configuration always present. For non-drone products, populate its fields with null
  or "unknown" as appropriate.
- downstream_hints are coarse hints only; do not assign each component to a subsystem. Keep
  likely_subsystems_present broad, such as propulsion, structure, power, sensing, control, and
  communication.
- If multiple images are provided, combine evidence across all images and avoid duplicating the
  same component observed from different viewpoints.
- Output only JSON. Do not wrap JSON in Markdown.

One-shot example:
Input context: A consumer camera drone shown from a front/top angled view. It has four arms
with black propellers, a compact gray molded body, dark circular motor housings, a small front
camera on a gimbal, small landing feet, and a rear/top section that appears to be a battery bay.
Optional specs: "Foldable 4K camera drone, approx. 249g class."

Expected JSON:
{
  "product_identification": {
    "category": "drone",
    "subcategory": "consumer camera quadcopter",
    "confidence": "high",
    "evidence": [
      "four propeller assemblies are visible",
      "front camera/gimbal module is visible",
      "user-provided specs describe a foldable 4K camera drone"
    ]
  },
  "image_summary": [
    {
      "image_id": "image_1",
      "view": "angled",
      "description": "Consumer quadcopter drone with four propellers, central molded body, front camera gimbal, motor housings, and small landing feet."
    }
  ],
  "drone_configuration": {
    "rotor_count": 4,
    "frame_layout": "foldable quadcopter",
    "payload_or_camera_visible": true,
    "battery_visible": true,
    "landing_gear_visible": true,
    "propeller_guards_visible": false,
    "confidence": "high"
  },
  "text_observed": [
    {
      "text": "4K",
      "location": "front camera module",
      "evidence_type": "visible",
      "confidence": "high"
    },
    {
      "text": "F2.2",
      "location": "front camera lens area",
      "evidence_type": "visible",
      "confidence": "high"
    }
  ],
  "visible_components": [
    {
      "name": "main body shell",
      "component_type": "structure/enclosure",
      "count": 1,
      "location": "center body",
      "visibility": "clear",
      "evidence_type": "visible",
      "visual_evidence": "gray molded central housing encloses the electronics and battery area",
      "confidence": "high"
    },
    {
      "name": "propellers",
      "component_type": "propulsion",
      "count": 4,
      "location": "end of each arm",
      "visibility": "clear",
      "evidence_type": "visible",
      "visual_evidence": "black two-blade propellers attached above each motor housing",
      "confidence": "high"
    },
    {
      "name": "motor housings",
      "component_type": "propulsion",
      "count": 4,
      "location": "end of each arm below propellers",
      "visibility": "clear",
      "evidence_type": "visible",
      "visual_evidence": "dark circular housings at the arm tips under the propeller hubs",
      "confidence": "high"
    },
    {
      "name": "front camera gimbal",
      "component_type": "sensing/payload",
      "count": 1,
      "location": "front underside of central body",
      "visibility": "clear",
      "evidence_type": "visible",
      "visual_evidence": "small camera module mounted at the front on a suspended bracket",
      "confidence": "high"
    },
    {
      "name": "battery bay",
      "component_type": "power",
      "count": 1,
      "location": "rear/top of central body",
      "visibility": "partial",
      "evidence_type": "inferred_from_visual",
      "visual_evidence": "rectangular rear/top body section resembles a removable battery compartment, but no label is readable",
      "confidence": "medium"
    }
  ],
  "material_candidates": [
    {
      "component_name": "main body shell",
      "material": "molded plastic, likely ABS or polycarbonate blend",
      "evidence_type": "inferred_from_visual",
      "visual_evidence": "smooth gray molded panels with rounded edges and panel seams",
      "confidence": "medium"
    },
    {
      "component_name": "propellers",
      "material": "black plastic, likely nylon or reinforced polymer",
      "evidence_type": "inferred_from_visual",
      "visual_evidence": "thin black molded blades with uniform finish",
      "confidence": "medium"
    },
    {
      "component_name": "camera lens",
      "material": "glass or coated optical plastic",
      "evidence_type": "inferred_from_visual",
      "visual_evidence": "small reflective lens surface in the front camera module",
      "confidence": "medium"
    }
  ],
  "uncertainties": [
    {
      "item": "exact plastic resin",
      "reason": "surface finish suggests molded plastic, but resin type cannot be confirmed visually"
    },
    {
      "item": "battery capacity and chemistry",
      "reason": "battery label is not readable and pack is only partially visible"
    },
    {
      "item": "flight controller and communication hardware",
      "reason": "internal electronics are enclosed and not visible"
    }
  ],
  "downstream_hints": {
    "likely_subsystems_present": [
      "propulsion",
      "structure",
      "power",
      "sensing/payload",
      "control",
      "communication"
    ],
    "cost_relevant_materials": [
      "molded plastic body shell",
      "plastic propellers",
      "four motor assemblies",
      "camera/gimbal module",
      "lithium battery pack"
    ],
    "do_not_assume": [
      "exact motor specification",
      "battery capacity",
      "sensor suite",
      "GPS presence",
      "specific plastic resin"
    ]
  }
}

Output exactly one valid JSON object. ADK will store it in vision_output.""",
        output_key="vision_output"
    )

def create_subsystem_agent():
    return Agent(
        name="subsystem_agent",
        model=get_model(),
        instruction="""You are the Subsystem Agent.
Read the structured visual evidence from the 'vision_output' state key.
Classify primarily from vision_output.visible_components. If a component is only mentioned in
material_candidates, do not classify it as a separate component unless it also appears in
visible_components. Do not invent internal components unless they are explicitly visible,
user-provided, or present in text_observed.

Use this taxonomy:
- propulsion_system: motors, propellers, motor housings, ducts, and other thrust-generating parts.
- power_system: battery, battery bay, charging contacts, BMS, power distribution, power wiring, or
  visible/specified energy-storage or energy-distribution components. Do not put motors,
  propellers, motor housings, ducts, or thrust-generating parts here.
- structure_enclosure_system: frame, shell, arms, landing gear, guards, housings, covers, and
  structural supports.
- sensing_payload_system: cameras, gimbals, lenses, obstacle sensors, payloads, and externally
  visible sensing modules.
- control_electronics_system: visible or explicitly specified controllers, ESCs, processors,
  control boards, or internal electronics.
- communication_navigation_system: visible or explicitly specified antennas, GPS/GNSS modules,
  receivers, radios, or navigation modules.
- thermal_system: vents, heatsinks, fans, thermal pads, or visible cooling paths.
- fasteners_mechanisms: screws, clips, hinges, latches, folding joints, pivots, and small hardware.
- uncertain: visible components that cannot be confidently classified.

Return a structured JSON object with exactly these keys:
- propulsion_system
- power_system
- structure_enclosure_system
- sensing_payload_system
- control_electronics_system
- communication_navigation_system
- thermal_system
- fasteners_mechanisms
- uncertain
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
