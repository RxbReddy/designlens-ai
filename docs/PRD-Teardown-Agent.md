# Product Requirements Document (PRD)
**Project:** Automated Engineering Teardown & Cost Analysis System
**Kaggle Track:** Agents for Business

## 1. Summary
This project is an AI-powered multi-agent system designed to automate the early-phase engineering analysis of physical products. By simply uploading an image of a product or its internal components, a coordinated team of AI agents will identify subsystems, evaluate design trade-offs, estimate manufacturing cost drivers, and generate a comprehensive first-pass engineering report.

## 2. Contacts
*   **Product/Engineering Team:** You / Your Team
*   **Target Users:** Hardware Engineers, Manufacturing Analysts, Supply Chain Managers, Reverse Engineering Teams.

## 3. Background
In hardware manufacturing and competitive analysis, tearing down a product to estimate costs and understand its engineering tradeoffs is a highly manual, time-consuming process. It usually requires senior mechanical and electrical engineers spending days analyzing components. With recent advancements in multimodal LLMs and agentic orchestration (e.g., ADK, MCP), we can now automate the initial "first-pass" of this analysis, drastically reducing time-to-insight.

## 4. Objective
*   **Goal:** Build a robust, multi-agent pipeline that transforms a visual product input into structured engineering and cost insights.
*   **Why it matters:** It solves a real enterprise problem by accelerating reverse-engineering, supplier negotiation, and competitive analysis, fitting perfectly into the "Agents for Business" track.
*   **Key Results (Success Metrics):**
    *   **Accuracy:** The system correctly maps visible components to the correct subsystem >85% of the time.
    *   **Orchestration:** Successfully implement a minimum of 4 distinct agents using the Agent Development Kit (ADK) routing.
    *   **Tool Integration:** The Cost Agent successfully pulls simulated or real pricing data via an MCP tool.

## 5. Market Segment(s)
*   **Hardware Startups & Enterprise OEMs:** Teams needing rapid competitive analysis on rival products without spending weeks on manual teardowns.
*   **Supply Chain Procurement:** Buyers who need quick estimations of the major cost drivers of a part to negotiate better rates with overseas manufacturers.

## 6. Value Proposition(s)
*   **Speed to Insight:** What used to take days of manual research and reporting now takes minutes.
*   **Consistency:** By utilizing few-shot prompting and dedicated agents, the output is standardized and less prone to individual engineer biases.
*   **Agentic Power:** We are not just summarizing an image; we are mimicking a hardware engineering team's workflow (Vision → Architecture → Trade-offs → Costing → Reporting).

## 7. Solution
The solution utilizes an orchestration framework to pass state (JSON) between specialized agents.

### 7.1 Key Features & Agent Architecture
1.  **Supervisor / Router Agent:** Manages the overall state and orchestrates hand-offs.
2.  **Vision Agent:** Takes the raw image and outputs a structured JSON identifying product type, visible components, materials, and raw observations.
3.  **Subsystem Agent:** Receives the Vision JSON and maps components into likely systems: power, sensing, structure, control, communication, and uncertain.
4.  **Trade-off & Cost Driver Agent (Combined for MVP):** Receives the Subsystem JSON. Uses an **MCP Tool** (e.g., a mock database of material costs or web search) to identify the top cost drivers and rank design trade-offs.
5.  **Report Agent:** Consolidates the outputs from all previous agents into a finalized, professional engineering markdown report.

### 7.2 Technology
*   **LLM:** Google Gemini 1.5 Pro / Flash (for multimodal vision capabilities).
*   **Orchestration:** Google Agent Development Kit (ADK) or similar multi-agent framework.
*   **Tools:** Model Context Protocol (MCP) for the Cost Driver database lookup.

### 7.3 Assumptions
*   We assume the input images are of sufficient clarity and lighting for Gemini to accurately identify components.
*   We assume we can mock or source a reliable enough material cost database for the Cost Agent to demonstrate its tool-use capabilities.

## 8. Release
*   **Phase 1 (MVP - Competition Submission):** Complete the 5-agent pipeline using prompt-chaining and few-shot examples. Integrate at least one MCP tool for the Cost Agent. Output a Markdown report.
*   **Phase 2 (Post-Competition):** Add interactive chat capabilities so users can grill the "Report Agent" on specific findings, and integrate real-time CAD file analysis.
