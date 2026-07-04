"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Eye, Cpu, TrendingUp, BarChart2, FileText, Package,
  Layers, AlertTriangle, ArrowRight, ChevronDown, ChevronUp,
  Download, Home
} from "lucide-react";
import type { AnalysisResult, SubsystemKey, UploadedFile } from "@/types/agent";
import { Badge, Card, ConfidencePill, SectionHeader, Divider, EmptyState } from "@/components/ui/Primitives";

// ---------------------------------------------------------------------------
// Subsystem display names and colours
// ---------------------------------------------------------------------------
const SUBSYSTEM_META: Record<SubsystemKey, { label: string; color: string }> = {
  propulsion_system: { label: "Propulsion", color: "text-orange-400" },
  power_system: { label: "Power", color: "text-yellow-400" },
  structure_enclosure_system: { label: "Structure", color: "text-blue-400" },
  sensing_payload_system: { label: "Sensing / Payload", color: "text-violet-400" },
  control_electronics_system: { label: "Control Electronics", color: "text-indigo-400" },
  communication_navigation_system: { label: "Communication / Nav", color: "text-cyan-400" },
  thermal_system: { label: "Thermal", color: "text-red-400" },
  fasteners_mechanisms: { label: "Fasteners / Mechanisms", color: "text-slate-400" },
  uncertain: { label: "Uncertain", color: "text-zinc-400" },
};

// ---------------------------------------------------------------------------
// Product Overview Card
// ---------------------------------------------------------------------------
function ProductOverviewCard({ result, file }: { result: AnalysisResult; file: UploadedFile }) {
  const vision = result.visionOutput;
  if (!vision) return null;
  const { product_identification: pi } = vision;

  return (
    <Card>
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-white/8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.previewUrl} alt="Product" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="accent">{pi.category}</Badge>
            <ConfidencePill confidence={pi.confidence} />
          </div>
          <h3 className="text-base font-semibold text-[rgb(var(--text-primary))] tracking-tight capitalize">
            {pi.subcategory}
          </h3>
          <div className="mt-2 space-y-1">
            {pi.evidence.slice(0, 2).map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight size={10} className="text-indigo-400 mt-1 shrink-0" />
                <p className="text-xs text-[rgb(var(--text-tertiary))] leading-snug">{e}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {vision.observations.length > 0 && (
        <>
          <Divider className="my-4" />
          <div className="space-y-1">
            {vision.observations.map((obs, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="h-1 w-1 rounded-full bg-indigo-400/60 mt-2 shrink-0" />
                <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">{obs}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Detected Components Card
// ---------------------------------------------------------------------------
function ComponentsCard({ result }: { result: AnalysisResult }) {
  const components = result.visionOutput?.visible_components ?? [];
  if (components.length === 0) return null;

  return (
    <Card noPad>
      <div className="p-5 pb-0">
        <SectionHeader
          icon={<Package size={14} />}
          title="Detected Components"
          subtitle={`${components.length} components identified`}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-tertiary))] px-5 py-2.5">Component</th>
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-tertiary))] px-3 py-2.5">Type</th>
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-tertiary))] px-3 py-2.5 hidden sm:table-cell">Count</th>
              <th className="text-left text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-tertiary))] px-3 pr-5 py-2.5 hidden md:table-cell">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c, i) => (
              <tr key={i} className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-xs font-medium text-[rgb(var(--text-primary))]">{c.name}</p>
                  <p className="text-[10px] text-[rgb(var(--text-tertiary))] mt-0.5 truncate max-w-[180px]">{c.visual_evidence}</p>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="default">{c.component_type}</Badge>
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <span className="text-xs text-[rgb(var(--text-secondary))]">
                    {c.count ?? "—"}
                  </span>
                </td>
                <td className="px-3 pr-5 py-3 hidden md:table-cell">
                  <ConfidencePill confidence={c.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subsystem Breakdown Card
// ---------------------------------------------------------------------------
function SubsystemCard({ result }: { result: AnalysisResult }) {
  const subsystems = result.subsystemOutput;
  if (!subsystems) return null;

  const populated = (Object.entries(subsystems) as [SubsystemKey, typeof subsystems[SubsystemKey]][])
    .filter(([, comps]) => comps.length > 0);

  return (
    <Card>
      <SectionHeader
        icon={<Layers size={14} />}
        title="Subsystem Breakdown"
        subtitle={`${populated.length} active subsystems`}
      />
      <div className="space-y-4">
        {populated.map(([key, components]) => {
          const meta = SUBSYSTEM_META[key];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-1.5 w-1.5 rounded-full bg-current ${meta.color}`} />
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <span className="text-[10px] text-[rgb(var(--text-muted))]">
                  {components.length} component{components.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-1.5 ml-3.5">
                {components.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowRight size={9} className="text-[rgb(var(--text-muted))] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-[rgb(var(--text-secondary))]">{c.component_name}</span>
                      <span className="text-[10px] text-[rgb(var(--text-muted))] ml-2">{c.rationale}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Engineering Trade-offs Card
// ---------------------------------------------------------------------------
function TradeoffsCard({ result }: { result: AnalysisResult }) {
  const tradeoffs = result.tradeoffOutput?.tradeoff_output ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);

  if (tradeoffs.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title="Engineering Trade-offs"
        subtitle={`${tradeoffs.length} design decisions analysed`}
      />
      <div className="space-y-2">
        {tradeoffs.map((t, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/8 bg-white/2 overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/2 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}
              id={`tradeoff-toggle-${i}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  <ConfidencePill confidence={t.confidence} />
                </div>
                <span className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">
                  {t.tradeoff_name}
                </span>
              </div>
              {expanded === i ? (
                <ChevronUp size={12} className="text-[rgb(var(--text-tertiary))] shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-[rgb(var(--text-tertiary))] shrink-0" />
              )}
            </button>

            {expanded === i && (
              <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1">Choice observed</p>
                  <p className="text-xs text-[rgb(var(--text-secondary))]">{t.choice_observed_or_inferred}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--text-muted))] mb-1">Alternative considered</p>
                  <p className="text-xs text-[rgb(var(--text-secondary))]">{t.alternative_considered}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1.5">Advantages</p>
                    <ul className="space-y-1">
                      {t.advantages.map((a, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-emerald-400/60 mt-1.5 shrink-0" />
                          <span className="text-[11px] text-[rgb(var(--text-tertiary))] leading-snug">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1.5">Disadvantages</p>
                    <ul className="space-y-1">
                      {t.disadvantages.map((d, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-red-400/60 mt-1.5 shrink-0" />
                          <span className="text-[11px] text-[rgb(var(--text-tertiary))] leading-snug">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cost Drivers Card
// ---------------------------------------------------------------------------
function CostCard({ result }: { result: AnalysisResult }) {
  const drivers = result.costOutput?.cost_drivers ?? [];
  if (drivers.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        icon={<BarChart2 size={14} />}
        title="Manufacturing Cost Drivers"
        subtitle="Ranked by estimated BOM impact"
      />
      <div className="space-y-3">
        {drivers.map((d, i) => {
          const rank = i + 1;
          const widthPct = Math.max(15, 100 - i * 18);
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-[rgb(var(--text-muted))] w-4">#{rank}</span>
                  <span className="text-xs font-medium text-[rgb(var(--text-primary))]">{d.component}</span>
                  <ConfidencePill confidence={d.confidence} />
                </div>
                {d.estimated_cost_range && (
                  <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                    {d.estimated_cost_range}
                  </span>
                )}
              </div>
              <div className="h-1 w-full rounded-full bg-white/6">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <p className="text-[10px] text-[rgb(var(--text-muted))] ml-6">{d.reasoning}</p>
            </div>
          );
        })}
      </div>

      {result.costOutput?.assumptions && result.costOutput.assumptions.length > 0 && (
        <>
          <Divider className="my-4" />
          <div className="flex items-start gap-2">
            <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-amber-400 font-medium mb-1">Assumptions</p>
              <ul className="space-y-0.5">
                {result.costOutput.assumptions.map((a, i) => (
                  <li key={i} className="text-[10px] text-[rgb(var(--text-muted))]">{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Engineering Dashboard — main export
// ---------------------------------------------------------------------------
interface EngineeringDashboardProps {
  result: AnalysisResult;
  file: UploadedFile;
  onViewReport: () => void;
  onReset: () => void;
}

export default function EngineeringDashboard({
  result, file, onViewReport, onReset,
}: EngineeringDashboardProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[rgb(var(--bg-base)/0.9)] backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold text-[rgb(var(--text-primary))] tracking-tight">
            DesignLens <span className="text-indigo-400">AI</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              id="home-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-overlay))] text-[rgb(var(--text-secondary))] text-xs font-medium transition-colors border border-[var(--border-default)] cursor-pointer"
            >
              <Home size={11} />
              Home
            </button>
            <button
              id="view-report-btn"
              onClick={onViewReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <FileText size={11} />
              View Report
            </button>
            <button
              id="new-analysis-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-overlay))] text-[rgb(var(--text-secondary))] text-xs font-medium transition-colors border border-[var(--border-default)] cursor-pointer"
            >
              New Analysis
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-[rgb(var(--text-primary))] tracking-tight">
              Engineering Teardown
            </h1>
            <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">
              AI-generated first-pass analysis · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </motion.div>

        {/* Cards in a 2-col grid on wider screens */}
        <div className="grid grid-cols-1 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <ProductOverviewCard result={result} file={file} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ComponentsCard result={result} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <SubsystemCard result={result} />
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <TradeoffsCard result={result} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <CostCard result={result} />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
