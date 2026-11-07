import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const issues = await prisma.groundTruthIssue.findMany({
    orderBy: { severity: "asc" },
  });

  const severityCounts = {
    CRITICAL: issues.filter((i) => i.severity === "CRITICAL").length,
    HIGH: issues.filter((i) => i.severity === "HIGH").length,
    MEDIUM: issues.filter((i) => i.severity === "MEDIUM").length,
    LOW: issues.filter((i) => i.severity === "LOW").length,
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-950 text-rose-300 border-rose-800";
      case "HIGH":
        return "bg-amber-950 text-amber-300 border-amber-800";
      case "MEDIUM":
        return "bg-yellow-950 text-yellow-300 border-yellow-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  // Helper to resolve entity to cart link
  const getInvestigationLink = async (issue: typeof issues[0]) => {
    if (issue.relatedEntityType === "CART") {
      return `/carts/${issue.relatedEntityId}`;
    }
    if (issue.relatedEntityType === "SEND_ATTEMPT") {
      const send = await prisma.sendAttempt.findUnique({
        where: { id: issue.relatedEntityId },
        include: { messageInstance: true },
      });
      if (send?.messageInstance?.cartId) {
        return `/carts/${send.messageInstance.cartId}`;
      }
    }
    if (issue.relatedEntityType === "ATTRIBUTION") {
      const attr = await prisma.attribution.findUnique({
        where: { id: issue.relatedEntityId },
        include: { order: true },
      });
      if (attr?.order?.cartId) {
        return `/carts/${attr.order.cartId}`;
      }
    }
    if (issue.relatedEntityType === "ORDER") {
      const ord = await prisma.order.findUnique({
        where: { id: issue.relatedEntityId },
      });
      if (ord?.cartId) {
        return `/carts/${ord.cartId}`;
      }
    }
    return "/carts";
  };

  // Pre-resolve all links
  const issuesWithLinks = await Promise.all(
    issues.map(async (issue) => ({
      ...issue,
      link: await getInvestigationLink(issue),
    }))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
              Ground-Truth Anomaly Catalog
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 text-rose-400" />
            <span>Operational Exceptions & Audit Violations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Intentional labelled anomalies injected into the deterministic dataset to test recovery compliance monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300">
            {severityCounts.CRITICAL} Critical
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
            {severityCounts.HIGH} High
          </span>
          <span className="px-2.5 py-1 rounded bg-yellow-950/80 border border-yellow-800 text-yellow-300">
            {severityCounts.MEDIUM} Medium
          </span>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white">Isolated Synthetic Ground-Truth Catalog</h4>
            <p className="text-slate-400">
              Exported to <code className="text-indigo-300 font-mono">exports/ground_truth.json</code> and{" "}
              <code className="text-indigo-300 font-mono">exports/ground_truth.csv</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <a
            href="/api/exports/ground-truth?format=json"
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-400" />
            <span>JSON</span>
          </a>
          <a
            href="/api/exports/ground-truth?format=csv"
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </a>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-4">
        {issuesWithLinks.map((issue) => (
          <div
            id={issue.id}
            key={issue.id}
            className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getSeverityBadge(
                    issue.severity
                  )}`}
                >
                  {issue.severity}
                </span>
                <h3 className="text-sm font-bold text-white font-mono">{issue.issueType}</h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">{issue.id}</span>
                <Link
                  href={issue.link}
                  className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Investigate Cart</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Target & Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Target Entity
                </span>
                <span className="text-indigo-400 font-bold block">{issue.relatedEntityType}</span>
                <span className="text-slate-300 text-[11px]">{issue.relatedEntityId}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Prescribed Ground-Truth Decision
                </span>
                <span className="text-emerald-400 font-mono text-[11px] block">
                  {issue.expectedDecision}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Observed Data Violation
                </span>
                <span className="text-rose-400 font-mono text-[11px] block">
                  {issue.observedState}
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Root-Cause Analysis: </span>
              <span>{issue.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
