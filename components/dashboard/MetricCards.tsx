import React from "react";
import {
  ShoppingCart,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Send,
  ShoppingBag,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface MetricCardsProps {
  metrics: {
    totalCarts: number;
    abandonedCarts: number;
    eligibleContacts: number;
    suppressedContacts: number;
    recoverySends: number;
    recoveredOrders: number;
    attributedRevenue: number;
    recoveryConversionRate: number;
  };
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const cards = [
    {
      title: "Total Carts",
      value: metrics.totalCarts.toLocaleString(),
      subtext: "Baseline simulated volume",
      icon: ShoppingCart,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      title: "Abandoned Carts",
      value: metrics.abandonedCarts.toLocaleString(),
      subtext: `${Math.round((metrics.abandonedCarts / metrics.totalCarts) * 100)}% abandonment rate`,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      title: "Eligible Contacts",
      value: metrics.eligibleContacts.toLocaleString(),
      subtext: "Passed consent & freq-cap",
      icon: ShieldCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Suppressed Contacts",
      value: metrics.suppressedContacts.toLocaleString(),
      subtext: "Blocked by consent/frequency",
      icon: ShieldAlert,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      title: "Recovery Sends",
      value: metrics.recoverySends.toLocaleString(),
      subtext: "Dispatched gateway attempts",
      icon: Send,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      title: "Recovered Orders",
      value: metrics.recoveredOrders.toLocaleString(),
      subtext: "Attributed purchases",
      icon: ShoppingBag,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
    },
    {
      title: "Attributed Revenue",
      value: `$${metrics.attributedRevenue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      subtext: "Deterministic recovery ROI",
      icon: DollarSign,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
      border: "border-teal-500/20",
    },
    {
      title: "Recovery Conv. Rate",
      value: `${metrics.recoveryConversionRate.toFixed(1)}%`,
      subtext: "Orders per recovery send",
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-xl bg-slate-900/60 border ${card.border} backdrop-blur-sm transition-all hover:bg-slate-900/90`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                {card.title}
              </span>
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white font-mono">
                {card.value}
              </div>
              <p className="mt-1 text-xs text-slate-400">{card.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
