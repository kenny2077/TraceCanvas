"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Toolbar } from "@/components/toolbar";
import { EditorPane } from "@/components/editor-pane";
import { PreviewPane } from "@/components/preview-pane";
import { TasksSidebar } from "@/components/tasks-sidebar";
import { HistoryPane } from "@/components/history-pane";
import { WelcomeModal } from "@/components/welcome-modal";
import { SettingsModal, type SectionId } from "@/components/settings-modal";
import { ConvertChip } from "@/components/convert-chip";
import { AnalysisPanel } from "@/components/analysis-panel";
import { RepairPanel } from "@/components/repair-panel";
import { VerificationReceipt } from "@/components/verification-receipt";
import { useStore, type AgentInfo } from "@/lib/store";
import { validateHtml } from "@/lib/html/validator";
import type { VerificationReport, CheckResult } from "@/lib/verify/engine";

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const welcomeAck = useStore((s) => s.welcomeAck);
  const selectedAgent = useStore((s) => s.selectedAgent);
  const setAgents = useStore((s) => s.setAgents);
  const locale = useStore((s) => s.locale);
  const layoutMode = useStore((s) => s.layoutMode);
  const activeTaskHtml = useStore((s) => {
    const task = s.tasks.find((t) => t.id === s.activeTaskId);
    return task?.html ?? "";
  });
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    SectionId | undefined
  >(undefined);
  const [deployConfigRev, setDeployConfigRev] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Detect agents on mount so the toolbar's agent chip can resolve the
  // persisted `selectedAgent` to a label without waiting for the user to
  // open Settings or Welcome. Without this, after a hard reload the chip
  // briefly (or permanently) shows "Select agent" even though selection
  // is intact in localStorage.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { agents: AgentInfo[] };
        if (!cancelled) setAgents(data.agents);
      } catch {
        // Settings / Welcome modals will retry on open.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, setAgents]);

  // Keep <html lang="…"> in sync with the user's locale so screen readers
  // and browser features (autotranslate, hyphenation) pick the right language.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale]);

  useEffect(() => {
    if (!hydrated) return;
    if (!welcomeAck || !selectedAgent) setWelcomeOpen(true);
  }, [hydrated, welcomeAck, selectedAgent]);

  // Compute lightweight HTML validation whenever the active task's HTML changes.
  const verificationReport: VerificationReport | null = useMemo(() => {
    if (!activeTaskHtml) return null;
    const result = validateHtml(activeTaskHtml);
    const checks: CheckResult[] = [
      {
        id: "html-structural",
        label: "HTML structure",
        status: result.valid ? "pass" : "fail",
        detail: result.valid
          ? "HTML structure is valid."
          : `${result.issues.filter((i) => i.severity === "error").length} structural issue(s).`,
        metric: result.issues.filter((i) => i.severity === "error").length,
      },
      {
        id: "html-security",
        label: "HTML security",
        status: result.issues.some((i) => i.kind === "script-tag" || i.kind === "event-handler" || i.kind === "javascript-url")
          ? "fail"
          : "pass",
        detail: result.issues.some((i) => i.kind === "script-tag")
          ? "Script tag detected."
          : "No security issues.",
      },
      {
        id: "html-sanitizer",
        label: "Sanitizer",
        status: result.sanitizerRemoved > 0 ? "fail" : "pass",
        detail:
          result.sanitizerRemoved > 0
            ? `DOMPurify removed ${result.sanitizerRemoved} element(s).`
            : "DOMPurify found no issues.",
        metric: result.sanitizerRemoved,
      },
    ];
    const failCount = checks.filter((c) => c.status === "fail").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const passCount = checks.filter((c) => c.status === "pass").length;
    const total = checks.length;
    const score = Math.round(((passCount + warnCount * 0.5) / total) * 100);
    return {
      passed: failCount === 0,
      checks,
      score,
      summary: failCount === 0 ? "HTML looks good." : `${failCount} issue(s) found.`,
    };
  }, [activeTaskHtml]);

  return (
    <main className="relative flex h-screen flex-col">
      <Toolbar
        iframeRef={iframeRef}
        onOpenAgentPicker={() => setSettingsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRequestConfigureDeploy={() => {
          setSettingsInitialSection("deploy");
          setSettingsOpen(true);
        }}
        deployConfigRev={deployConfigRev}
      />
      <div
        className="flex flex-1 min-h-0"
        style={{ borderTop: "1px solid var(--line-faint)" }}
      >
        <TasksSidebar />
        <HistoryPane />
        <div className="relative flex flex-1 min-w-0">
          {layoutMode !== "preview" && (
            <section
              className="flex min-w-0 flex-1 basis-0 flex-col"
              style={
                layoutMode === "split"
                  ? { borderRight: "1px solid var(--line-faint)" }
                  : undefined
              }
            >
              <EditorPane />
              <AnalysisPanel />
            </section>
          )}
          {layoutMode !== "editor" && (
            <section className="flex min-w-0 flex-1 basis-0 flex-col">
              <PreviewPane iframeRef={iframeRef} />
              <RepairPanel />
              {activeTaskHtml && verificationReport && (
                <div className="border-t border-gray-200">
                  <button
                    onClick={() => setShowVerification(!showVerification)}
                    className="w-full px-4 py-2 text-xs text-gray-400 hover:text-gray-600 text-left transition-colors"
                  >
                    {showVerification ? "▾ Hide" : "▸ Show"} verification (
                    {verificationReport.score}/100)
                  </button>
                  {showVerification && (
                    <VerificationReceipt
                      report={verificationReport}
                      htmlBytes={activeTaskHtml.length}
                      safeToExport={verificationReport.passed}
                      onDismiss={() => setShowVerification(false)}
                    />
                  )}
                </div>
              )}
            </section>
          )}
          <ConvertChip />
        </div>
      </div>
      {welcomeOpen && <WelcomeModal onClose={() => setWelcomeOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          initialSection={settingsInitialSection}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialSection(undefined);
            setDeployConfigRev((r) => r + 1);
          }}
        />
      )}
    </main>
  );
}
