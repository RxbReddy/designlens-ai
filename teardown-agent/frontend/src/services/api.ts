/**
 * api.ts — Backend service layer for DesignLens AI.
 *
 * - In REAL mode  : talks to the ADK FastAPI server at NEXT_PUBLIC_API_URL.
 * - In MOCK mode  : returns static realistic data without any network call.
 *
 * Mock mode is enabled when NEXT_PUBLIC_MOCK_API=true or the env variable
 * is missing (safe default for zero-config demos).
 */

import type { AgentId, AnalysisResult, VisionOutput, SubsystemOutput, TradeoffOutput, CostOutput } from "@/types/agent";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const IS_MOCK =
  process.env.NEXT_PUBLIC_MOCK_API === "true" ||
  (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV !== "production");

// ADK session identifiers
const USER_ID = "frontend-user";
const APP_NAME = "app";

// ---------------------------------------------------------------------------
// ADK session helpers
// ---------------------------------------------------------------------------
async function createSession(): Promise<string> {
  const sessionId = `session-${Date.now()}`;
  const res = await fetch(
    `${API_BASE}/apps/${APP_NAME}/users/${USER_ID}/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: {} }),
    }
  );
  if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
  const data = await res.json();
  return data.id ?? sessionId;
}

// ---------------------------------------------------------------------------
// Build the ADK RunAgentRequest payload with an inline image
// ---------------------------------------------------------------------------
function buildRunRequest(sessionId: string, base64: string, mimeType: string) {
  return {
    appName: APP_NAME,
    userId: USER_ID,
    sessionId,
    newMessage: {
      role: "user",
      parts: [
        { text: "Perform a full engineering teardown of this product image." },
        { inlineData: { data: base64, mimeType } },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// SSE streaming runner — yields agent events
// ---------------------------------------------------------------------------
export type StreamEvent =
  | { type: "agent_start"; agentId: AgentId }
  | { type: "agent_complete"; agentId: AgentId; output: unknown }
  | { type: "done"; result: AnalysisResult }
  | { type: "error"; message: string };

/**
 * Maps an ADK event `author` field to our internal AgentId.
 */
function authorToAgentId(author: string): AgentId | null {
  const map: Record<string, AgentId> = {
    vision_agent: "vision_agent",
    subsystem_agent: "subsystem_agent",
    tradeoff_agent: "tradeoff_agent",
    cost_agent: "cost_agent",
    report_agent: "report_agent",
  };
  return map[author] ?? null;
}

/**
 * Streams analysis events from the ADK /run_sse endpoint.
 * Calls `onEvent` for each meaningful event.
 */
export async function streamAnalysis(
  base64: string,
  mimeType: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  if (IS_MOCK) {
    await runMockAnalysis(onEvent);
    return;
  }

  let sessionId: string;
  try {
    sessionId = await createSession();
  } catch (err) {
    onEvent({ type: "error", message: String(err) });
    return;
  }

  const body = buildRunRequest(sessionId, base64, mimeType);

  const res = await fetch(`${API_BASE}/run_sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `API error ${res.status}` });
    return;
  }

  const result: AnalysisResult = {
    visionOutput: null,
    subsystemOutput: null,
    tradeoffOutput: null,
    costOutput: null,
    reportMarkdown: null,
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let activeAgent: AgentId | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith("data:")) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }

      const author = event["author"] as string | undefined;
      if (!author) continue;

      const agentId = authorToAgentId(author);
      if (!agentId) continue;

      // Detect agent start (first event for this agent)
      if (agentId !== activeAgent) {
        activeAgent = agentId;
        onEvent({ type: "agent_start", agentId });
      }

      // Detect turn completion — extract output from state delta
      const actions = event["actions"] as Record<string, unknown> | undefined;
      const stateDelta = actions?.["stateDelta"] as Record<string, unknown> | undefined;

      if (stateDelta) {
        const outputKey = `${author.replace("_agent", "_output")}` as string;
        const rawOutput = stateDelta[outputKey];

        if (rawOutput !== undefined) {
          onEvent({ type: "agent_complete", agentId, output: rawOutput });

          // Accumulate into result
          if (agentId === "vision_agent") result.visionOutput = rawOutput as VisionOutput;
          else if (agentId === "subsystem_agent") result.subsystemOutput = rawOutput as SubsystemOutput;
          else if (agentId === "tradeoff_agent") result.tradeoffOutput = rawOutput as TradeoffOutput;
          else if (agentId === "cost_agent") result.costOutput = rawOutput as CostOutput;
          else if (agentId === "report_agent") result.reportMarkdown = String(rawOutput);
        }
      }

      // Check if pipeline is complete
      const turnComplete = event["turnComplete"] as boolean | undefined;
      if (turnComplete && agentId === "report_agent") {
        onEvent({ type: "done", result });
        return;
      }
    }
  }

  // Fallback: emit done after stream closes
  onEvent({ type: "done", result });
}

// ---------------------------------------------------------------------------
// Mock analysis — realistic staged delays with full sample data
// ---------------------------------------------------------------------------
async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMockAnalysis(onEvent: (e: StreamEvent) => void) {
  const stages: Array<{ agentId: AgentId; ms: number }> = [
    { agentId: "vision_agent", ms: 2800 },
    { agentId: "subsystem_agent", ms: 2200 },
    { agentId: "tradeoff_agent", ms: 1800 },
    { agentId: "cost_agent", ms: 1800 },
    { agentId: "report_agent", ms: 2500 },
  ];

  for (const { agentId, ms } of stages) {
    onEvent({ type: "agent_start", agentId });
    await delay(ms);
    onEvent({ type: "agent_complete", agentId, output: {} });
  }

  await delay(400);
  onEvent({ type: "done", result: MOCK_RESULT });
}

// ---------------------------------------------------------------------------
// Mock result data — representative drone teardown
// ---------------------------------------------------------------------------
const MOCK_RESULT: AnalysisResult = {
  visionOutput: {
    product_identification: {
      category: "drone",
      subcategory: "consumer camera quadcopter",
      confidence: "high",
      evidence: [
        "Four propeller assemblies are clearly visible",
        "Front camera/gimbal module identified",
        "Compact foldable frame design observed",
      ],
    },
    image_summary: [
      {
        image_id: "image_1",
        view: "angled",
        description:
          "Consumer quadcopter drone with four propellers, central molded body, front camera gimbal, motor housings, and small landing feet.",
      },
    ],
    visible_components: [
      {
        name: "Main Body Shell",
        component_type: "structure/enclosure",
        count: 1,
        location: "Center body",
        visibility: "clear",
        evidence_type: "visible",
        visual_evidence: "Gray molded central housing with panel seams",
        confidence: "high",
      },
      {
        name: "Propellers",
        component_type: "propulsion",
        count: 4,
        location: "End of each arm",
        visibility: "clear",
        evidence_type: "visible",
        visual_evidence: "Black two-blade propellers attached above motor housing",
        confidence: "high",
      },
      {
        name: "Motor Housings",
        component_type: "propulsion",
        count: 4,
        location: "Arm tips, below propellers",
        visibility: "clear",
        evidence_type: "visible",
        visual_evidence: "Dark circular housings at each arm tip",
        confidence: "high",
      },
      {
        name: "Front Camera Gimbal",
        component_type: "sensing/payload",
        count: 1,
        location: "Front underside of central body",
        visibility: "clear",
        evidence_type: "visible",
        visual_evidence: "Small camera module on a suspended bracket",
        confidence: "high",
      },
      {
        name: "Battery Bay",
        component_type: "power",
        count: 1,
        location: "Rear/top of central body",
        visibility: "partial",
        evidence_type: "inferred_from_visual",
        visual_evidence: "Rectangular rear section resembles removable battery compartment",
        confidence: "medium",
      },
    ],
    material_candidates: [
      {
        component_name: "Main body shell",
        material: "Molded ABS or polycarbonate blend",
        evidence_type: "inferred_from_visual",
        visual_evidence: "Smooth gray molded panels with rounded edges",
        confidence: "medium",
      },
      {
        component_name: "Propellers",
        material: "Nylon or glass-fiber reinforced polymer",
        evidence_type: "inferred_from_visual",
        visual_evidence: "Thin black molded blades with uniform finish",
        confidence: "medium",
      },
      {
        component_name: "Motor housing",
        material: "Aluminum alloy",
        evidence_type: "inferred_from_visual",
        visual_evidence: "Metallic sheen on motor casing",
        confidence: "medium",
      },
    ],
    materials: ["ABS plastic", "Nylon", "Aluminum alloy", "Copper windings"],
    observations: [
      "Foldable arm mechanism visible for compact storage",
      "Symmetrical X-frame layout for stable flight dynamics",
      "No propeller guards present — optimized for flight performance over safety",
    ],
    uncertainties: [
      { item: "Exact plastic resin", reason: "Surface finish suggests molded plastic but resin type cannot be confirmed visually" },
      { item: "Battery capacity", reason: "Battery label not readable; pack only partially visible" },
      { item: "Flight controller", reason: "Internal electronics enclosed and not visible" },
    ],
    downstream_hints: {
      likely_subsystems_present: ["propulsion", "structure", "power", "sensing/payload", "control", "communication"],
      cost_relevant_materials: ["molded plastic body shell", "plastic propellers", "four motor assemblies", "camera/gimbal module", "lithium battery pack"],
      do_not_assume: ["exact motor specification", "battery capacity", "sensor suite", "GPS presence", "specific plastic resin"],
    },
  },

  subsystemOutput: {
    propulsion_system: [
      { component_name: "Propellers (×4)", rationale: "Primary thrust-generating components", confidence: "high" },
      { component_name: "Motor Housings (×4)", rationale: "Brushless motors driving propellers", confidence: "high" },
    ],
    power_system: [
      { component_name: "Battery Bay", rationale: "Visible energy storage compartment", confidence: "medium" },
    ],
    structure_enclosure_system: [
      { component_name: "Main Body Shell", rationale: "Central structural chassis enclosing electronics", confidence: "high" },
      { component_name: "Folding Arms (×4)", rationale: "Structural arms providing motor mounting points", confidence: "high" },
    ],
    sensing_payload_system: [
      { component_name: "Front Camera Gimbal", rationale: "Camera sensor on stabilized mount", confidence: "high" },
    ],
    control_electronics_system: [],
    communication_navigation_system: [],
    thermal_system: [],
    fasteners_mechanisms: [
      { component_name: "Folding Hinge Joints", rationale: "Visible pivot mechanism on each arm", confidence: "medium" },
    ],
    uncertain: [],
  },

  tradeoffOutput: {
    tradeoff_output: [
      {
        tradeoff_name: "Foldable vs Rigid Frame",
        subsystem: "structure_enclosure_system",
        components: ["Folding Arms", "Main Body Shell"],
        choice_observed_or_inferred: "Foldable arm design for portability",
        alternative_considered: "Rigid fixed-arm frame",
        advantages: ["Compact storage", "Easier transport", "Consumer-friendly form factor"],
        disadvantages: ["Added mechanical complexity", "Potential hinge wear point", "Slightly reduced rigidity"],
        evidence_basis: "visible_evidence",
        confidence: "high",
        assumption_notes: [],
        uncertainty_notes: [],
      },
      {
        tradeoff_name: "No Propeller Guards",
        subsystem: "propulsion_system",
        components: ["Propellers"],
        choice_observed_or_inferred: "No propeller guards present",
        alternative_considered: "Enclosed propeller cage or guards",
        advantages: ["Reduced weight", "Better aerodynamic efficiency", "Lower manufacturing cost"],
        disadvantages: ["Reduced operator safety", "More susceptible to damage from collisions"],
        evidence_basis: "visible_evidence",
        confidence: "high",
        assumption_notes: ["Guards would add ~50g per arm"],
        uncertainty_notes: [],
      },
      {
        tradeoff_name: "Integrated Gimbal vs Fixed Camera",
        subsystem: "sensing_payload_system",
        components: ["Front Camera Gimbal"],
        choice_observed_or_inferred: "3-axis gimbal stabilization",
        alternative_considered: "Electronic Image Stabilization (EIS) only",
        advantages: ["Superior video stability", "True horizon-lock capability"],
        disadvantages: ["Added cost ($20–$60 BOM impact)", "Additional failure point", "Mechanical complexity"],
        evidence_basis: "visible_evidence",
        confidence: "medium",
        assumption_notes: ["Gimbal axis count inferred from visible suspension"],
        uncertainty_notes: ["Cannot confirm 2-axis vs 3-axis without closer inspection"],
      },
    ],
  },

  costOutput: {
    material_lookup_results: {
      ABS: { price_per_kg: "$3.50", complexity_premium: "low" },
      Aluminum: { price_per_kg: "$6.20", complexity_premium: "medium" },
      Copper: { price_per_kg: "$9.80", complexity_premium: "high" },
    },
    cost_drivers: [
      {
        component: "Front Camera Gimbal",
        subsystem: "sensing_payload_system",
        estimated_cost_range: "$18 – $65",
        evidence_type: "visible",
        confidence: "medium",
        reasoning: "Mechanically stabilized gimbal with optical module is highest unit cost visible component",
      },
      {
        component: "Brushless Motors (×4)",
        subsystem: "propulsion_system",
        estimated_cost_range: "$8 – $20 each",
        evidence_type: "inferred_from_visual",
        confidence: "medium",
        reasoning: "Four brushless motors with copper windings represent significant BOM cost",
      },
      {
        component: "Lithium Battery Pack",
        subsystem: "power_system",
        estimated_cost_range: "$12 – $35",
        evidence_type: "inferred_from_visual",
        confidence: "low",
        reasoning: "Rechargeable lithium-polymer pack estimated from form factor; capacity unknown",
      },
      {
        component: "ABS/PC Body Shell",
        subsystem: "structure_enclosure_system",
        estimated_cost_range: "$3 – $8",
        evidence_type: "inferred_from_visual",
        confidence: "medium",
        reasoning: "Molded plastic shell at ~$3.50/kg; low complexity premium",
      },
    ],
    assumptions: [
      "Motor specifications inferred from visible housing size",
      "Battery capacity assumed 2000–3000mAh based on form factor",
    ],
    uncertainty_notes: [
      "Flight controller and ESC costs are unknown (internal)",
      "Communication module (RC receiver, FPV transmitter) not visible",
    ],
  },

  reportMarkdown: `# DesignLens AI — Engineering Teardown Report

**Product:** Consumer Camera Quadcopter Drone
**Confidence:** High
**Analysis Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

---

## 1. Product Identification

A **consumer camera quadcopter drone** with a foldable X-frame design, targeting the prosumer photography and videography market. Visual evidence strongly indicates a 249g-class device with a 3-axis gimbal camera system.

**Key Identifiers:**
- Four propeller assemblies in a symmetric X-layout
- Front-mounted camera gimbal module
- Foldable arm mechanism for compact storage
- Molded plastic body with consistent panel seams

---

## 2. Visible Components

| Component | Type | Count | Confidence |
|-----------|------|-------|-----------|
| Main Body Shell | Structure/Enclosure | 1 | High |
| Propellers | Propulsion | 4 | High |
| Motor Housings | Propulsion | 4 | High |
| Front Camera Gimbal | Sensing/Payload | 1 | High |
| Battery Bay | Power | 1 | Medium |
| Folding Arm Hinges | Fasteners/Mechanisms | 4 | Medium |

---

## 3. Subsystem Breakdown

### Propulsion System
Four brushless motor + propeller assemblies mounted at arm tips. Two-blade propeller design optimized for noise reduction and efficiency in the consumer segment. No propeller guards present.

### Power System
Rear-mounted removable battery bay. Chemistry inferred as lithium-polymer based on form factor. Capacity unknown without label access.

### Structure & Enclosure
Foldable X-frame with central molded ABS/PC housing. Four arms with pivot hinges enable compact storage configuration.

### Sensing & Payload
Front-mounted camera on a mechanically stabilized gimbal bracket. Suspension geometry suggests multi-axis stabilization capability.

---

## 4. Material Candidates

| Component | Material | Confidence |
|-----------|----------|-----------|
| Body Shell | Molded ABS or PC blend | Medium |
| Propellers | Nylon or GF-reinforced polymer | Medium |
| Motor Housings | Aluminum alloy | Medium |
| Camera Lens | Optical glass or coated plastic | Low |

---

## 5. Cost Drivers

**Estimated BOM Cost Range: $55 – $140** *(visible components only)*

1. **Camera Gimbal Module** — $18–$65 (highest visible cost driver)
2. **Brushless Motors (×4)** — $32–$80 total
3. **Lithium Battery Pack** — $12–$35
4. **Molded Plastic Body** — $3–$8

> ⚠️ Internal electronics (flight controller, ESCs, communication module) are not visible and represent significant unaccounted BOM cost, typically $15–$45 for this product class.

---

## 6. Engineering Tradeoffs

### Foldable vs Rigid Frame
The foldable arm mechanism improves portability at the cost of mechanical complexity and a potential wear point at hinge pivots. **Verdict: Correct for consumer market.**

### No Propeller Guards
Weight and aerodynamic optimization chosen over operator safety. Appropriate for experienced users; limits adoption in enclosed environments.

### Gimbal vs EIS-only Stabilization
Hardware gimbal adds $20–$60 to BOM but delivers visually superior results. A key differentiator in the consumer segment.

---

## 7. Uncertainties & Limitations

- **Internal electronics**: Flight controller, ESC stack, wireless communication hardware, and GPS module are all enclosed and cannot be analyzed from external images alone.
- **Battery chemistry and capacity**: Label not readable; chemistry assumed LiPo based on market norms.
- **Exact resin grades**: Plastic part grades require material testing (e.g., FTIR spectroscopy) for confirmation.

---

## 8. Recommended Additional Views or Information

1. **Bottom-up view** — Expose battery connector, charging port, and any sensor arrays
2. **Disassembled view** — Reveal ESC, flight controller, and antenna routing
3. **Specification sheet** — Confirm motor KV rating, battery capacity, and max thrust per motor
4. **Weight breakdown** — Enable more accurate BOM cost normalization per gram
`,
};

export async function fetchImageFromURL(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(`${API_BASE}/fetch-image?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to fetch image from URL" }));
    throw new Error(errorData.detail || "Failed to fetch image from URL");
  }
  return res.json();
}
