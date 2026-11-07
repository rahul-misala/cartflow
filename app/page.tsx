import React from "react";
import Link from "next/link";
import { getDashboardMetrics } from "@/lib/metrics";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { FunnelVisualizer } from "@/components/dashboard/FunnelVisualizer";
import { CampaignPerformance } from "@/components/dashboard/CampaignPerformance";
import { ChannelBreakdown } from "@/components/dashboard/ChannelBreakdown";
import { RecentExceptionsPanel } from "@/components/dashboard/RecentExceptionsPanel";
import { ArrowRight, ShoppingCart, AlertOctagon, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Operations Active • Local Simulation
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Abandoned-Cart Recovery Control Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic recovery orchestration, contact suppression gates, single-touch attribution, and audit trails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/carts"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open Work Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/exceptions"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span>Ground Truth Anomaly Catalog</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <MetricCards metrics={metrics} />

      {/* Recovery Conversion Funnel */}
      <FunnelVisualizer funnel={metrics.funnel} />

      {/* 2-Column Section: Campaigns & Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CampaignPerformance campaigns={metrics.campaignPerformance} />
        </div>
        <div className="lg:col-span-1">
          <ChannelBreakdown channels={metrics.channelPerformance} />
        </div>
      </div>

      {/* Anomalies Panel */}
      <RecentExceptionsPanel exceptions={metrics.recentExceptions} />
    </div>
  );
}
