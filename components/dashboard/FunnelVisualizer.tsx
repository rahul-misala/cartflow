import React from "react";
import { ArrowRight, ShoppingCart, Clock, CheckCircle2, Send, MousePointerClick, Award } from "lucide-react";

interface FunnelVisualizerProps {
  funnel: {
    totalCarts: number;
    abandonedCarts: number;
    eligibleContacts: number;
    sentMessages: number;
    clickedMessages: number;
    recoveredOrders: number;
  };
}

export function FunnelVisualizer({ funnel }: FunnelVisualizerProps) {
  const steps = [
    {
      label: "Total Carts",
      count: funnel.totalCarts,
      icon: ShoppingCart,
      color: "bg-blue-500",
      textColor: "text-blue-400",
      pctOfPrev: "100%",
    },
    {
      label: "Abandoned Carts",
      count: funnel.abandonedCarts,
      icon: Clock,
      color: "bg-amber-500",
      textColor: "text-amber-400",
      pctOfPrev: `${Math.round((funnel.abandonedCarts / (funnel.totalCarts || 1)) * 100)}%`,
    },
    {
      label: "Eligible Contacts",
      count: funnel.eligibleContacts,
      icon: CheckCircle2,
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
      pctOfPrev: `${Math.round((funnel.eligibleContacts / (funnel.abandonedCarts || 1)) * 100)}%`,
    },
    {
      label: "Recovery Sent",
      count: funnel.sentMessages,
      icon: Send,
      color: "bg-indigo-500",
      textColor: "text-indigo-400",
      pctOfPrev: `${Math.round((funnel.sentMessages / (funnel.eligibleContacts || 1)) * 100)}%`,
    },
    {
      label: "Links Clicked",
      count: funnel.clickedMessages,
      icon: MousePointerClick,
      color: "bg-purple-500",
      textColor: "text-purple-400",
      pctOfPrev: `${Math.round((funnel.clickedMessages / (funnel.sentMessages || 1)) * 100)}%`,
    },
    {
      label: "Recovered Orders",
      count: funnel.recoveredOrders,
      icon: Award,
      color: "bg-teal-500",
      textColor: "text-teal-400",
      pctOfPrev: `${Math.round((funnel.recoveredOrders / (funnel.clickedMessages || 1)) * 100)}%`,
    },
  ];

  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-white">Recovery Funnel Conversion</h3>
          <p className="text-xs text-slate-400">Step-by-step conversion drop-off from cart creation to order attribution</p>
        </div>
        <div className="text-xs font-mono text-slate-400 px-3 py-1 rounded-md bg-slate-800 border border-slate-700">
          End-to-End Recovery: <span className="text-teal-400 font-bold">{((funnel.recoveredOrders / (funnel.abandonedCarts || 1)) * 100).toFixed(1)}%</span> of abandoned
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const heightPct = Math.max(15, Math.min(100, (step.count / (funnel.totalCarts || 1)) * 100));

          return (
            <div
              key={idx}
              className="relative p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`p-1.5 rounded-md bg-slate-800/80 ${step.textColor}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
                  {step.pctOfPrev}
                </span>
              </div>

              <div>
                <div className="text-xl font-bold font-mono text-white mb-1">
                  {step.count.toLocaleString()}
                </div>
                <div className="text-xs font-medium text-slate-400 line-clamp-1">
                  {step.label}
                </div>
              </div>

              {/* Mini visual indicator bar */}
              <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${step.color}`}
                  style={{ width: `${heightPct}%` }}
                ></div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-slate-400">
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
