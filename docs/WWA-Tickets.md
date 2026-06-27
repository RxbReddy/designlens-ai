# Backlog Items (WWA Format)

## 1. Setup Base ADK Routing Architecture
**Why:** To ensure we use the required course material (Agent Development Kit), we need a supervisor node to handle state transfer between agents rather than passing strings manually.
**What:** Initialize the ADK environment. Create a dummy `ImageReceiver` node and a dummy `ReportOutput` node that simply passes a hardcoded JSON state through the pipeline.
**Acceptance Criteria:**
- ADK project structure is initialized.
- A script can run the pipeline from start to finish with dummy nodes.
- State (JSON) is successfully logged at each node transition.

## 2. Build Mock MCP Cost Database Server
**Why:** The Kaggle rubric requires demonstrating tool use. An MCP server acting as a mock database satisfies this requirement and provides a safe, deterministic tool for our Cost Agent.
**What:** Create a simple MCP Python server that exposes a `get_material_cost(material_name)` tool. The tool should query a static local JSON file with ~20 common manufacturing materials and prices.
**Acceptance Criteria:**
- The MCP server starts successfully on a local port or stdio.
- The `get_material_cost` tool returns correct JSON responses.

## 3. Implement Vision Agent (Gemini Prompting)
**Why:** We need to extract structured data from the user's uploaded image to feed the rest of the pipeline.
**What:** Create the ADK Vision Agent. Pass the user's image to Gemini 1.5 Pro with a highly constrained prompt and 2 few-shot examples to output JSON containing: Product Type, Components, and Materials.
**Acceptance Criteria:**
- Agent accepts an image file path.
- Returns correctly formatted JSON mapping to our defined schema.
- Handles edge cases where the image is unclear gracefully.

## 4. Implement Cost Agent with MCP Tool Use
**Why:** This is our flagship agent that proves to the judges we know how to wire agents to external tools.
**What:** Create the ADK Cost Agent. Provide it with the MCP `get_material_cost` tool. Write instructions so that it reads the materials from the incoming state JSON, queries the MCP tool for each material, and appends the cost estimates to the state.
**Acceptance Criteria:**
- Agent successfully reads the incoming state.
- Agent successfully executes the MCP tool.
- Agent appends accurate cost data to the output state.

## 5. Implement Subsystem, Trade-off, and Report Agents
**Why:** To complete the core value proposition of the enterprise tool, we need the specialized engineering reasoning and the final markdown compilation.
**What:** Implement the remaining 3 agents as prompt-based LLM calls within the ADK structure. Subsystem Agent groups components; Trade-off Agent analyzes the groupings; Report Agent formats the final state payload into a beautiful Markdown document.
**Acceptance Criteria:**
- All agents successfully read and modify the shared state.
- Report Agent outputs a clean, readable Markdown file.

## 6. Record 5-Minute Video Presentation
**Why:** The video is a mandatory submission requirement and is heavily weighted in the "Communication & Presentation" category of the rubric.
**What:** Write a script highlighting the Enterprise Value, the ADK architecture, the MCP tool use, and a live demo of the pipeline. Record and edit the video to strict 5-minute limits.
**Acceptance Criteria:**
- Video clearly shows the architecture graph.
- Video shows a live terminal execution of the agents.
- Video is under 5 minutes.
