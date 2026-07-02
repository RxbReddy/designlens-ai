"use client";

import React from "react";
import { motion } from "framer-motion";
import { Download, ArrowLeft, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownReportProps {
  markdown: string;
  onBack: () => void;
  onReset: () => void;
}

function downloadMarkdown(content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `designlens-teardown-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarkdownReport({ markdown, onBack, onReset }: MarkdownReportProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-white/6 bg-[rgb(var(--bg-base))/90] backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="back-to-dashboard-btn"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))] transition-colors"
            >
              <ArrowLeft size={12} />
              Dashboard
            </button>
            <span className="text-white/12">·</span>
            <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-tertiary))]">
              <FileText size={11} />
              Engineering Report
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="download-report-btn"
              onClick={() => downloadMarkdown(markdown)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <Download size={11} />
              Download .md
            </button>
            <button
              id="new-analysis-btn-report"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-[rgb(var(--text-secondary))] text-xs font-medium transition-colors border border-white/8"
            >
              New Analysis
            </button>
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/8 bg-[rgb(var(--bg-surface))] p-8"
        >
          <div className="prose-engineering">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        </motion.div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => downloadMarkdown(markdown)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 text-[rgb(var(--text-secondary))] text-sm font-medium transition-colors"
          >
            <Download size={13} />
            Download Report as Markdown
          </button>
        </div>
      </main>
    </div>
  );
}
