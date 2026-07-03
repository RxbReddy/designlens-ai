/**
 * useAgentRunner — React hook that drives the multi-agent analysis pipeline.
 *
 * Wraps the SSE streaming logic from api.ts and exposes reactive state for:
 *  - Which agents are idle / running / complete
 *  - The final AnalysisResult once the pipeline finishes
 */

"use client";

import { useCallback, useState } from "react";
import { streamAnalysis } from "@/services/api";
import type { AgentId, AgentStage, AgentStatus, AnalysisResult, UploadedFile } from "@/types/agent";

// ---------------------------------------------------------------------------
// Initial pipeline stage definitions
// ---------------------------------------------------------------------------
const INITIAL_STAGES: AgentStage[] = [
  {
    id: "vision_agent",
    label: "Vision Analysis",
    description: "Identifying product type, visible components, and materials",
    status: "idle",
  },
  {
    id: "subsystem_agent",
    label: "Subsystem Mapping",
    description: "Classifying components into functional engineering subsystems",
    status: "idle",
  },
  {
    id: "tradeoff_agent",
    label: "Trade-off Analysis",
    description: "Evaluating design decisions, alternatives, and engineering trade-offs",
    status: "idle",
  },
  {
    id: "cost_agent",
    label: "Cost Analysis",
    description: "Querying material cost database and ranking BOM cost drivers",
    status: "idle",
  },
  {
    id: "report_agent",
    label: "Report Generation",
    description: "Compiling findings into a structured engineering teardown report",
    status: "idle",
  },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export type RunnerState =
  | "idle"
  | "running"
  | "complete"
  | "error";

interface UseAgentRunnerReturn {
  stages: AgentStage[];
  runnerState: RunnerState;
  result: AnalysisResult | null;
  errorMessage: string | null;
  startAnalysis: (file: UploadedFile) => Promise<void>;
  reset: () => void;
}

export function useAgentRunner(): UseAgentRunnerReturn {
  const [stages, setStages] = useState<AgentStage[]>(INITIAL_STAGES);
  const [runnerState, setRunnerState] = useState<RunnerState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setAgentStatus = useCallback(
    (agentId: AgentId, status: AgentStatus) => {
      setStages((prev) =>
        prev.map((s) =>
          s.id === agentId
            ? {
                ...s,
                status,
                ...(status === "running" ? { startedAt: Date.now() } : {}),
                ...(status === "complete" ? { completedAt: Date.now() } : {}),
              }
            : s
        )
      );
    },
    []
  );

  const startAnalysis = useCallback(
    async (file: UploadedFile) => {
      // Reset state
      setStages(INITIAL_STAGES);
      setResult(null);
      setErrorMessage(null);
      setRunnerState("running");

      await streamAnalysis(file.base64, file.mimeType, (event) => {
        switch (event.type) {
          case "agent_start":
            setAgentStatus(event.agentId, "running");
            break;

          case "agent_complete":
            setAgentStatus(event.agentId, "complete");
            break;

          case "done":
            setResult(event.result);
            setRunnerState("complete");
            break;

          case "error":
            setErrorMessage(event.message);
            setRunnerState("error");
            // Mark any still-running stage as error
            setStages((prev) =>
              prev.map((s) =>
                s.status === "running" ? { ...s, status: "error" } : s
              )
            );
            break;
        }
      });
    },
    [setAgentStatus]
  );

  const reset = useCallback(() => {
    setStages(INITIAL_STAGES);
    setRunnerState("idle");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return { stages, runnerState, result, errorMessage, startAnalysis, reset };
}
