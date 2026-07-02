"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LandingPage from "@/components/LandingPage";
import UploadPreview from "@/components/UploadPreview";
import AnalysisProgress from "@/components/AnalysisProgress";
import EngineeringDashboard from "@/components/EngineeringDashboard";
import MarkdownReport from "@/components/MarkdownReport";
import { useAgentRunner } from "@/hooks/useAgentRunner";
import type { AppScreen, UploadedFile } from "@/types/agent";

// Simple page-level fade transition
const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [showReport, setShowReport] = useState(false);

  const { stages, runnerState, result, errorMessage, startAnalysis, reset } =
    useAgentRunner();

  // ── Handlers ──────────────────────────────────────────────
  const handleFileReady = useCallback((file: UploadedFile) => {
    setUploadedFile(file);
    setScreen("uploaded");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!uploadedFile) return;
    setScreen("analyzing");
    setShowReport(false);
    await startAnalysis(uploadedFile);
    setScreen("dashboard");
  }, [uploadedFile, startAnalysis]);

  const handleReset = useCallback(() => {
    reset();
    setUploadedFile(null);
    setShowReport(false);
    setScreen("landing");
  }, [reset]);

  // ── Render ────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      {screen === "landing" && (
        <motion.div key="landing" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <LandingPage onFileReady={handleFileReady} />
        </motion.div>
      )}

      {screen === "uploaded" && uploadedFile && (
        <motion.div key="uploaded" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <UploadPreview
            file={uploadedFile}
            onClear={handleReset}
            onAnalyze={handleAnalyze}
          />
        </motion.div>
      )}

      {screen === "analyzing" && uploadedFile && (
        <motion.div key="analyzing" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <AnalysisProgress
            stages={stages}
            imagePreviewUrl={uploadedFile.previewUrl}
          />
        </motion.div>
      )}

      {screen === "dashboard" && result && uploadedFile && !showReport && (
        <motion.div key="dashboard" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <EngineeringDashboard
            result={result}
            file={uploadedFile}
            onViewReport={() => setShowReport(true)}
            onReset={handleReset}
          />
        </motion.div>
      )}

      {screen === "dashboard" && result && showReport && (
        <motion.div key="report" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <MarkdownReport
            markdown={result.reportMarkdown ?? "# No report generated."}
            onBack={() => setShowReport(false)}
            onReset={handleReset}
          />
        </motion.div>
      )}

      {/* Error state */}
      {runnerState === "error" && (
        <motion.div
          key="error"
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 flex items-center justify-center bg-[rgb(var(--bg-base))] z-50"
        >
          <div className="max-w-sm text-center px-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2">Analysis Failed</h2>
            <p className="text-sm text-[rgb(var(--text-tertiary))] mb-6">{errorMessage ?? "An unexpected error occurred."}</p>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
