"use client";

import { motion } from "framer-motion";
import { Scan, X, FileImage, AlertCircle } from "lucide-react";
import type { UploadedFile } from "@/types/agent";

interface UploadPreviewProps {
  file: UploadedFile;
  onClear: () => void;
  onAnalyze: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPreview({ file, onClear, onAnalyze }: UploadPreviewProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Subtle background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl"
      >
        {/* Logo / back link */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm font-semibold text-[rgb(var(--text-primary))] tracking-tight">
            DesignLens <span className="text-indigo-400">AI</span>
          </span>
          <button
            id="clear-image-btn"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))] transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        </div>

        {/* Image preview */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[rgb(var(--bg-surface))] mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.previewUrl}
            alt="Uploaded product"
            className="w-full max-h-[420px] object-contain"
          />
          {/* Subtle overlay gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(var(--bg-surface))] to-transparent pointer-events-none" />
        </div>

        {/* File meta */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-[rgb(var(--bg-surface))] border border-white/8">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-400">
            <FileImage size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">{file.file.name}</p>
            <p className="text-[10px] text-[rgb(var(--text-tertiary))] mt-0.5">
              {file.mimeType} · {formatBytes(file.file.size)}
            </p>
          </div>
        </div>

        {/* Notice */}
        <div className="flex items-start gap-2 mb-6 px-3 py-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15">
          <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            Analysis will use AI vision to identify components from this image. Confidence may vary based on image clarity and viewing angle.
          </p>
        </div>

        {/* Analyze CTA */}
        <button
          id="analyze-btn"
          onClick={onAnalyze}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold tracking-tight transition-all duration-150 shadow-lg shadow-indigo-600/20"
        >
          <Scan size={15} />
          Analyze Product
        </button>

        <p className="text-center text-[10px] text-[rgb(var(--text-muted))] mt-4">
          Analysis takes 15–45 seconds · 5 AI agents process your image
        </p>
      </motion.div>
    </div>
  );
}
