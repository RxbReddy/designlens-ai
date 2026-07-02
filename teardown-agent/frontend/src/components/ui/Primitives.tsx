/**
 * Shared UI primitives — Badge, Card, ProgressDot, ConfidencePill
 */
"use client";

import React from "react";
import type { Confidence } from "@/types/agent";

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "accent";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "bg-white/5 text-[rgb(var(--text-tertiary))] border border-white/8",
    success: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20",
    warning: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
    error: "bg-red-400/10 text-red-400 border border-red-400/20",
    info: "bg-blue-400/10 text-blue-400 border border-blue-400/20",
    accent: "bg-indigo-500/12 text-indigo-400 border border-indigo-500/20",
  };

  const sizeStyles: Record<string, string> = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium uppercase tracking-wider ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ConfidencePill
// ---------------------------------------------------------------------------
interface ConfidencePillProps {
  confidence: Confidence;
}

export function ConfidencePill({ confidence }: ConfidencePillProps) {
  const map: Record<Confidence, { label: string; variant: BadgeProps["variant"] }> = {
    high: { label: "High Confidence", variant: "success" },
    medium: { label: "Medium Confidence", variant: "warning" },
    low: { label: "Low Confidence", variant: "error" },
  };
  const { label, variant } = map[confidence];
  return <Badge variant={variant}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}

export function Card({ children, className = "", noPad = false }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-white/8 bg-[rgb(var(--bg-surface))] ${noPad ? "" : "p-5"} ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

export function SectionHeader({ icon, title, subtitle, badge }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[rgb(var(--text-primary))] tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-[rgb(var(--text-tertiary))] mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------
export function Divider({ className = "" }: { className?: string }) {
  return <div className={`border-t border-white/6 ${className}`} />;
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <p className="text-xs text-[rgb(var(--text-muted))]">{message}</p>
    </div>
  );
}
