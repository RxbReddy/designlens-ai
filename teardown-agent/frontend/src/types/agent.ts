// ============================================================
// Agent output types — mirrors the JSON schemas in agent.py
// ============================================================

export type Confidence = "high" | "medium" | "low";
export type EvidenceType =
  | "visible"
  | "inferred_from_visual"
  | "user_provided_spec"
  | "mixed"
  // values emitted by tradeoff_agent evidence_basis field
  | "visible_evidence"
  | "inferred_assumption"
  | "user_provided";

// ---- Vision Agent ----
export interface ProductIdentification {
  category: string;
  subcategory: string;
  confidence: Confidence;
  evidence: string[];
}

export interface ImageSummary {
  image_id: string;
  view: string;
  description: string;
}

export interface VisibleComponent {
  name: string;
  component_type: string;
  count: number | null;
  location: string;
  visibility: "clear" | "partial" | "occluded" | "inferred";
  evidence_type: EvidenceType;
  visual_evidence: string;
  confidence: Confidence;
}

export interface MaterialCandidate {
  component_name: string;
  material: string;
  evidence_type: EvidenceType;
  visual_evidence: string;
  confidence: Confidence;
}

export interface VisionOutput {
  product_identification: ProductIdentification;
  image_summary: ImageSummary[];
  visible_components: VisibleComponent[];
  material_candidates: MaterialCandidate[];
  materials: string[];
  observations: string[];
  uncertainties: Array<{ item: string; reason: string }>;
  downstream_hints: {
    likely_subsystems_present: string[];
    cost_relevant_materials: string[];
    do_not_assume: string[];
  };
}

// ---- Subsystem Agent ----
export type SubsystemKey =
  | "propulsion_system"
  | "power_system"
  | "structure_enclosure_system"
  | "sensing_payload_system"
  | "control_electronics_system"
  | "communication_navigation_system"
  | "thermal_system"
  | "fasteners_mechanisms"
  | "uncertain";

export interface SubsystemComponent {
  component_name: string;
  rationale: string;
  confidence: Confidence;
}

export type SubsystemOutput = Record<SubsystemKey, SubsystemComponent[]>;

// ---- Trade-off Agent ----
export interface Tradeoff {
  tradeoff_name: string;
  subsystem: SubsystemKey;
  components: string[];
  choice_observed_or_inferred: string;
  alternative_considered: string;
  advantages: string[];
  disadvantages: string[];
  evidence_basis: EvidenceType;
  confidence: Confidence;
  assumption_notes: string[];
  uncertainty_notes: string[];
}

export interface TradeoffOutput {
  tradeoff_output: Tradeoff[];
}

// ---- Cost Agent ----
export interface CostDriver {
  component: string;
  subsystem: SubsystemKey;
  estimated_cost_range?: string;
  evidence_type: EvidenceType;
  confidence: Confidence;
  reasoning: string;
}

export interface CostOutput {
  material_lookup_results: Record<string, unknown>;
  cost_drivers: CostDriver[];
  assumptions: string[];
  uncertainty_notes: string[];
}

// ---- Pipeline state ----
export type AgentId =
  | "vision_agent"
  | "subsystem_agent"
  | "tradeoff_agent"
  | "cost_agent"
  | "report_agent";

export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentStage {
  id: AgentId;
  label: string;
  description: string;
  status: AgentStatus;
  startedAt?: number;
  completedAt?: number;
}

// ---- Overall analysis result ----
export interface AnalysisResult {
  visionOutput: VisionOutput | null;
  subsystemOutput: SubsystemOutput | null;
  tradeoffOutput: TradeoffOutput | null;
  costOutput: CostOutput | null;
  reportMarkdown: string | null;
}

// ---- App-level state machine ----
export type AppScreen =
  | "landing"
  | "uploaded"
  | "analyzing"
  | "dashboard";

export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}
