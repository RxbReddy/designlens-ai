# DesignLens AI: Automated Engineering Teardown & Cost Analysis

**DesignLens AI** is an AI-powered multi-agent system designed to automate early-phase engineering analysis and manufacturing cost estimation for physical products.

By taking a visual input (or textual description) of a product, a coordinated team of AI agents identifies subsystems, evaluates design trade-offs, estimates material cost drivers, and compiles a comprehensive first-pass engineering report.

This project is built for the **Agents for Business** track of the Kaggle Capstone competition.

---

## 🏗️ Multi-Agent Architecture
The system uses a hybrid sequential/parallel routing pipeline built on the **Google Agent Development Kit (ADK)** and powered by **Google Gemini 1.5**:

```
                       ┌──────────────────┐
                       │   Vision Agent   │
                       └────────┬─────────┘
                                │
                       ┌────────▼─────────┐
                       │ Subsystem Agent  │
                       └────────┬─────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
         ┌────────▼─────────┐        ┌────────▼─────────┐
         │  Trade-off Agent │        │    Cost Agent    │ (MCP Tool Use)
         └────────┬─────────┘        └────────┬─────────┘
                  │                           │
                  └─────────────┬─────────────┘
                                │
                       ┌────────▼─────────┐
                       │   Report Agent   │
                       └──────────────────┘
```

1.  **Vision Agent**: Extracts product type, components, materials, and physical observations from visual inputs.
2.  **Subsystem Agent**: Categorizes identified parts into distinct functional engineering subsystems (power, sensing, structure, control, communication).
3.  **Trade-off Agent**: Analyzes mechanical, thermal, electrical, and structural design trade-offs concurrently.
4.  **Cost Agent**: Queries an external database (simulated via local tools, evolving to MCP) to fetch material pricing and rank primary manufacturing cost drivers.
5.  **Report Agent**: Consolidates intermediate state JSON outputs into a formatted, professional Markdown teardown report.

---

## 📂 Project Structure
*   **`teardown-agent/`**: Core Python ADK agent project.
    *   `app/agent.py`: Agent factories, tool schemas, and sequential/parallel orchestrators.
    *   `app/fast_api_app.py`: FastAPI server wrapper to expose the agent API.
*   **`docs/`**: Planning and project management documentation:
    *   `PRD-Teardown-Agent.md`: Product Requirements Document (blueprint, success metrics, technology choices).
    *   `PreMortem-Teardown-Agent.md`: Risk analysis mapping launch-blocking threats and mitigation dates.
    *   `WWA-Tickets.md`: Structured backlog backlog in Why-What-Acceptance format.
*   **`.agents/`**: Workspace-scoped customization directories:
    *   `CONTEXT.md`: Defines project rules and secure paved roads for development.
    *   `hooks.json`: Pre-tool hook definitions (intercepts `run_command` and audits parameters).
    *   `rules/` & `AGENTS.md`: Agent behavior rules (such as enforcing the `rtk` proxy).
*   **`.semgrep/`**: Custom security rules (checks for hardcoded secrets/API keys prior to commits).

---

## 🚀 Getting Started

### Prerequisites
Make sure you have `gcloud` or a `GEMINI_API_KEY` for authentication.

### Local Installation & Setup
1.  Navigate to the agent directory and install dependencies (creates virtualenv):
    ```bash
    cd teardown-agent
    agents-cli install
    ```
2.  Add your Gemini API Key in the `.env` file (`teardown-agent/.env`):
    ```env
    GEMINI_API_KEY="your-actual-api-key"
    ```

### Running the Agent
*   **CLI Smoke Test**: Run a quick terminal query from the `teardown-agent` folder:
    ```bash
    agents-cli run "A drone with a plastic body and aluminum motor mounts"
    ```
*   **Developer Playground**: Start the local web-based testing playground:
    ```bash
    agents-cli playground
    ```
    Access the interactive panel at: **[http://127.0.0.1:8080](http://127.0.0.1:8080)**

---

## 🔒 DevOps & Security Guardrails
*   **Tool Execution Auditing**: The `.agents/scripts/validate_tool_call.py` script automatically filters shell commands to prevent accidental deletion of codebase files.
*   **Pre-Commit Security Hooks**: Git commits are gated via `pre-commit` hooks containing standard formatting checks and a custom `semgrep` security scan checking for hardcoded secrets.
