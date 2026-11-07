import React from "react";
import Link from "next/link";
import { AlertOctagon, ArrowRight, ShieldAlert } from "lucide-react";

interface ExceptionItem {
  id: string;
  issueType: string;
  severity: string;
  relatedEntityType: string;
  relatedEntityId: string;
  expectedDecision: string;
  observedState: string;
  createdAt: Date;
}

interface RecentExceptionsPanelProps {
  exceptions: ExceptionItem[];
}

export function RecentExceptionsPanel({ exceptions }: RecentExceptionsPanelProps) {
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

  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Active Operational Anomalies</h3>
            <p className="text-xs text-slate-400">Ground-truth intentionally injected edge cases under audit</p>
          </div>
        </div>

        <Link
          href="/exceptions"
          className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono transition-colors"
        >
          View All Anomalies ({exceptions.length}) <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exceptions.map((ex) => (
          <div
            key={ex.id}
            className="p-4 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] text-slate-400">{ex.id}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getSeverityBadge(
                    ex.severity
                  )}`}
                >
                  {ex.severity}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-200 mb-1">{ex.issueType}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{ex.observedState}</p>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="font-mono text-slate-500">Target: {ex.relatedEntityId}</span>
              <Link
                href={`/exceptions#${ex.id}`}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Inspect Issue <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
