"use client";

import React from "react";
import { motion } from "framer-motion";
import { Download, ArrowLeft, FileText, FileCode, File, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";

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

function downloadHTML(content: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Engineering Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
        h1, h2, h3 { color: #111; margin-top: 2em; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: 600; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto; border: 1px solid #eee; }
        code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
        blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; color: #6b7280; margin: 1.5rem 0; }
      </style>
    </head>
    <body>
      ${marked.parse(content)}
    </body>
    </html>
  `;
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `designlens-teardown-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPDF(content: string) {
  const html2pdf = (await import("html2pdf.js")).default;
  const container = document.createElement("div");
  // Simple PDF styling wrapper
  container.innerHTML = `
    <div style="font-family: Helvetica, Arial, sans-serif; color: #000; line-height: 1.5; padding: 20px;">
      <style>
        h1, h2, h3 { color: #000; margin-top: 1.5em; page-break-after: avoid; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 8px; text-align: left; }
        th { background-color: #eee; font-weight: bold; }
        pre { background: #f4f4f4; padding: 12px; border: 1px solid #ccc; white-space: pre-wrap; font-family: monospace; font-size: 11px; }
        code { font-family: monospace; }
        p, li { margin-bottom: 0.5em; }
      </style>
      ${await marked.parse(content)}
    </div>
  `;

  const opt = {
    margin:       15,
    filename:     `designlens-teardown-${new Date().toISOString().slice(0, 10)}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
  };

  html2pdf().set(opt).from(container).save();
}

function DownloadDropdown({ markdown, variant = "primary" }: { markdown: string, variant?: "primary" | "secondary" }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseBtnClass = variant === "primary"
    ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
    : "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-[var(--border-default)] text-[rgb(var(--text-secondary))] text-sm font-medium transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className={baseBtnClass}>
        <Download size={variant === "primary" ? 11 : 13} />
        {variant === "primary" ? "Download" : "Download Report"}
        <ChevronDown size={variant === "primary" ? 11 : 13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${variant === "primary" ? "right-0" : "left-1/2 -translate-x-1/2"} mt-2 w-44 rounded-xl border border-[var(--border-default)] bg-[rgb(var(--bg-elevated))] shadow-xl overflow-hidden z-50 py-1.5`}>
          <button onClick={() => { downloadMarkdown(markdown); setIsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-overlay))] flex items-center gap-2 transition-colors">
            <FileText size={14} className="text-blue-400" /> Markdown (.md)
          </button>
          <button onClick={() => { downloadHTML(markdown); setIsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-overlay))] flex items-center gap-2 transition-colors">
            <FileCode size={14} className="text-orange-400" /> HTML Document
          </button>
          <button onClick={() => { downloadPDF(markdown); setIsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-overlay))] flex items-center gap-2 transition-colors">
            <File size={14} className="text-red-400" /> PDF Document
          </button>
        </div>
      )}
    </div>
  );
}

export default function MarkdownReport({ markdown, onBack, onReset }: MarkdownReportProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[rgb(var(--bg-base)/0.9)] backdrop-blur-md">
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
            <DownloadDropdown markdown={markdown} variant="primary" />
            <button
              id="new-analysis-btn-report"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-overlay))] text-[rgb(var(--text-secondary))] text-xs font-medium transition-colors border border-[var(--border-default)]"
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
          className="rounded-2xl border border-[var(--border-default)] bg-[rgb(var(--bg-surface))] p-8"
        >
          <div className="prose-engineering">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        </motion.div>

        <div className="mt-6 flex justify-center">
          <DownloadDropdown markdown={markdown} variant="secondary" />
        </div>
      </main>
    </div>
  );
}
