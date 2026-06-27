## Pre-Mortem Analysis: Automated Engineering Teardown System

### Tigers (Real Risks)

1. **MCP Tool Integration Fails (Launch-Blocking)**
   *   **Risk:** We spend too much time on prompts and fail to properly implement the Model Context Protocol (MCP) tool for the Cost Agent. The evaluation criteria heavily penalize lacking tool-use and course concepts.
2. **Architecture Over-engineering (Launch-Blocking)**
   *   **Risk:** Trying to wire up 5 distinct ADK agents takes longer than expected, and we miss the July 6 deadline with a broken pipeline.
3. **Video Presentation is Rushed (Launch-Blocking)**
   *   **Risk:** We finish coding on July 6 at 10 PM and throw together a terrible 5-minute video. The judges explicitly grade on "Communication & Presentation" via the video submission.

### Paper Tigers (Overblown Concerns)

1. **Cost Database Accuracy**
   *   **Why it's overblown:** The judges are evaluating *agentic architecture* (how the agent queries the tool), not whether the ABS plastic price is 100% accurate to today's market. We can use a mock JSON database without losing points.
2. **Vision Model Hallucinations**
   *   **Why it's overblown:** Gemini might occasionally misidentify a screw type. As long as the *system* processes the output correctly down the chain, minor AI hallucinations won't tank the submission.

### Elephants (Unspoken Worries)

1. **Agent State Passing (Context Window Limits)**
   *   **Worry:** If we pass the full JSON from Vision -> Subsystem -> Trade-off -> Cost -> Report, does the context window become too large or messy? We haven't discussed how to filter state between hand-offs.
   *   **Action:** Investigate ADK state management tools early.

### Action Plans for Launch-Blocking Tigers

*   **Risk:** MCP Tool Integration Fails
    *   **Mitigation:** Build the MCP mock database and Cost Agent *first*, before the other agents, to guarantee we have tool-use points locked in.
    *   **Owner:** Team Lead
    *   **Due Date:** June 28, 2026
*   **Risk:** Architecture Over-engineering
    *   **Mitigation:** Build the pipeline with just 2 agents first (Vision -> Report). Once that works end-to-end, insert the Subsystem, Trade-off, and Cost agents in the middle.
    *   **Owner:** Dev Team
    *   **Due Date:** June 30, 2026
*   **Risk:** Video Presentation is Rushed
    *   **Mitigation:** Hard code freeze on July 4th. Spend July 5th and 6th exclusively on the demo script and video recording.
    *   **Owner:** Presenter
    *   **Due Date:** July 4, 2026
