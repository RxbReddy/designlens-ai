"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Zap, Eye, Cpu, BarChart2, FileText, ChevronRight, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import type { UploadedFile } from "@/types/agent";
import { fetchImageFromURL } from "@/services/api";

interface LandingPageProps {
  onFileReady: (file: UploadedFile) => void;
}

// ------------------------------------------------------------
// Convert File → UploadedFile (base64 + preview URL)
// ------------------------------------------------------------
async function prepareFile(file: File): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:<mime>;base64,<data>"
      const [prefix, base64] = dataUrl.split(",");
      const mimeType = prefix.replace("data:", "").replace(";base64", "");
      resolve({
        file,
        previewUrl: dataUrl,
        base64,
        mimeType,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------------------------
// Agent pipeline visual
// ------------------------------------------------------------
const PIPELINE_STEPS = [
  { icon: Eye, label: "Vision" },
  { icon: Cpu, label: "Subsystem" },
  { icon: BarChart2, label: "Trade-offs" },
  { icon: BarChart2, label: "Cost" },
  { icon: FileText, label: "Report" },
];

export default function LandingPage({ onFileReady }: LandingPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = imageUrl.trim();
    if (!targetUrl) return;

    // Normalize URL if protocol is missing
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    setIsLoading(true);
    try {
      const data = await fetchImageFromURL(targetUrl);

      // Decode base64 to Blob synchronously to avoid browser CSP block on fetch('data:...')
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });

      const ext = data.mimeType.split("/")[1] || "png";
      const file = new File([blob], `downloaded-image.${ext}`, { type: data.mimeType });

      onFileReady({
        file,
        previewUrl: `data:${data.mimeType};base64,${data.base64}`,
        base64: data.base64,
        mimeType: data.mimeType
      });
    } catch (err: any) {
      alert(err.message || "Failed to load image from URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }
      setIsLoading(true);
      try {
        const prepared = await prepareFile(file);
        onFileReady(prepared);
      } catch {
        alert("Failed to load image.");
      } finally {
        setIsLoading(false);
      }
    },
    [onFileReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const loadSample = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch sample drone image from Unsplash (compressed)
      const res = await fetch(
        "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=75&fm=jpg"
      );
      const blob = await res.blob();
      const file = new File([blob], "sample-drone.jpg", { type: "image/jpeg" });
      const prepared = await prepareFile(file);
      onFileReady(prepared);
    } catch {
      alert("Failed to load sample image. Please upload your own.");
    } finally {
      setIsLoading(false);
    }
  }, [onFileReady]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial glow center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgb(99 102 241 / 0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 text-xs font-medium">
            <Zap size={11} />
            Powered by Google ADK · 5-Agent Pipeline
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-[rgb(var(--text-primary))] mb-4 leading-tight">
            DesignLens{" "}
            <span className="text-indigo-400">AI</span>
          </h1>

          <p className="text-[rgb(var(--text-secondary))] text-base max-w-md mx-auto leading-relaxed">
            Upload an image of any engineered product. A team of AI agents will
            analyze its components, subsystems, trade-offs, and manufacturing
            cost drivers.
          </p>
        </div>

        {/* Upload zone */}
        <div
          id="upload-zone"
          className={`relative rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/8"
              : "border-white/10 bg-[rgb(var(--bg-surface))] hover:border-white/18 hover:bg-[rgb(var(--bg-elevated))]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onInputChange}
          />

          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                  <p className="text-sm text-[rgb(var(--text-tertiary))]">Preparing image…</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--bg-overlay))] border border-white/8">
                    <Upload size={22} className="text-[rgb(var(--text-tertiary))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[rgb(var(--text-primary))] mb-1">
                      Drop an image here, or click to upload
                    </p>
                    <p className="text-xs text-[rgb(var(--text-tertiary))]">
                      JPEG, PNG, WebP — any product image works
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleUrlSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LinkIcon size={14} className="text-[rgb(var(--text-tertiary))]" />
            </div>
            <input
              type="text"
              placeholder="Or paste an image URL..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isLoading}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[rgb(var(--bg-surface))] text-xs text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !imageUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 text-white text-xs font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            Fetch
          </button>
        </form>

        {/* Sample image shortcut */}
        <div className="flex justify-center mt-4">
          <button
            id="sample-image-btn"
            onClick={(e) => { e.stopPropagation(); loadSample(); }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 text-xs text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))] transition-colors disabled:opacity-40"
          >
            <ImageIcon size={12} />
            Try with a sample drone image
            <ChevronRight size={11} />
          </button>
        </div>

        {/* Pipeline diagram */}
        <div className="mt-14 flex items-center justify-center gap-1">
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--bg-surface))] border border-white/8">
                  <step.icon size={13} className="text-[rgb(var(--text-tertiary))]" />
                </div>
                <span className="text-[10px] text-[rgb(var(--text-muted))] whitespace-nowrap">
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="w-6 h-px bg-white/8 mb-4 mx-0.5" />
              )}
            </React.Fragment>
          ))}
        </div>

        <p className="text-center text-[10px] text-[rgb(var(--text-muted))] mt-5 tracking-wide uppercase">
          5 specialized AI agents · Sequential + parallel execution · ADK orchestration
        </p>
      </motion.div>
    </div>
  );
}
