"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Cpu, TrendingUp, BarChart2, FileText, Check, Loader2, Clock } from "lucide-react";
import type { AgentId, AgentStage, AgentStatus } from "@/types/agent";

interface AnalysisProgressProps {
  stages: AgentStage[];
  imagePreviewUrl: string;
}

const AGENT_ICONS: Record<AgentId, React.ElementType> = {
  vision_agent: Eye,
  subsystem_agent: Cpu,
  tradeoff_agent: TrendingUp,
  cost_agent: BarChart2,
  report_agent: FileText,
};

const STATUS_CONFIG: Record<AgentStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  idle: {
    label: "Waiting",
    color: "text-[rgb(var(--text-muted))]",
    bgColor: "bg-white/4",
    borderColor: "border-white/8",
  },
  running: {
    label: "Processing",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
  },
  complete: {
    label: "Complete",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
  error: {
    label: "Error",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    borderColor: "border-red-400/20",
  },
};

function StageRow({ stage }: { stage: AgentStage }) {
  const Icon = AGENT_ICONS[stage.id];
  const cfg = STATUS_CONFIG[stage.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${cfg.bgColor} ${cfg.borderColor}`}
    >
      {/* Icon bubble */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.borderColor} ${cfg.bgColor}`}
      >
        <Icon size={15} className={cfg.color} />
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${stage.status === "idle" ? "text-[rgb(var(--text-tertiary))]" : "text-[rgb(var(--text-primary))]"}`}>
          {stage.label}
        </p>
        <p className="text-xs text-[rgb(var(--text-tertiary))] mt-0.5 leading-snug">
          {stage.description}
        </p>
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        <AnimatePresence mode="wait">
          {stage.status === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
            </motion.div>
          )}
          {stage.status === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 border border-emerald-400/30">
                <Check size={10} strokeWidth={2.5} className="text-emerald-400" />
              </div>
            </motion.div>
          )}
          {stage.status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Clock size={14} className="text-[rgb(var(--text-muted))]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function AnalysisProgress({ stages, imagePreviewUrl }: AnalysisProgressProps) {
  const completeCount = stages.filter((s) => s.status === "complete").length;
  const progress = (completeCount / stages.length) * 100;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.02) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.02) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgb(99 102 241 / 0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-semibold text-[rgb(var(--text-primary))] tracking-tight">
            DesignLens <span className="text-indigo-400">AI</span>
          </span>
          <span className="text-xs text-[rgb(var(--text-tertiary))]">
            {completeCount} / {stages.length} agents complete
          </span>
        </div>

        {/* Thumbnail + progress bar */}
        <div className="flex items-center gap-4 mb-6 p-3 rounded-xl bg-[rgb(var(--bg-surface))] border border-white/8">
          <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 border border-white/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreviewUrl}
              alt="Analyzing"
              className="h-full w-full object-cover"
            />
            {/* Subtle scan animation overlay */}
            <motion.div
              className="absolute inset-x-0 h-0.5 bg-indigo-400/60"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[rgb(var(--text-primary))]">
                Analyzing product…
              </p>
              <span className="text-[10px] text-[rgb(var(--text-tertiary))]">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/6 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-indigo-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Stage list */}
        <div className="space-y-2">
          {stages.map((stage) => (
            <StageRow key={stage.id} stage={stage} />
          ))}
        </div>

        <p className="text-center text-[10px] text-[rgb(var(--text-muted))] mt-6">
          AI agents are running in parallel where possible · Do not close this tab
        </p>
      </div>
    </div>
  );
}
