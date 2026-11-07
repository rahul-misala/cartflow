import React from "react";
import { Mail, MessageSquare } from "lucide-react";

interface ChannelStat {
  channel: string;
  sends: number;
  delivered: number;
  clicked: number;
  recoveredOrders: number;
  revenue: number;
  conversionRate: number;
}

interface ChannelBreakdownProps {
  channels: ChannelStat[];
}

export function ChannelBreakdown({ channels }: ChannelBreakdownProps) {
  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Channel Efficiency</h3>
        <p className="text-xs text-slate-400">EMAIL vs SMS delivery, click-through, and recovered revenue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((ch) => {
          const isEmail = ch.channel === "EMAIL";
          const Icon = isEmail ? Mail : MessageSquare;
          const deliveryRate = ch.sends > 0 ? ((ch.delivered / ch.sends) * 100).toFixed(1) : "0";
          const ctr = ch.delivered > 0 ? ((ch.clicked / ch.delivered) * 100).toFixed(1) : "0";

          return (
            <div
              key={ch.channel}
              className={`p-5 rounded-lg border ${
                isEmail ? "border-indigo-500/20 bg-indigo-950/10" : "border-emerald-500/20 bg-emerald-950/10"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      isEmail ? "bg-indigo-600/20 text-indigo-400" : "bg-emerald-600/20 text-emerald-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">{ch.channel}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {ch.sends} total recovery dispatches
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Attributed ROI</span>
                  <span className="text-base font-mono font-bold text-white">
                    ${ch.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
                <div className="p-2 rounded bg-slate-900/50">
                  <span className="text-[10px] uppercase text-slate-400 block">Delivery Rate</span>
                  <span className="text-sm font-mono font-bold text-slate-200">{deliveryRate}%</span>
                </div>
                <div className="p-2 rounded bg-slate-900/50">
                  <span className="text-[10px] uppercase text-slate-400 block">CTR (Clicks)</span>
                  <span className="text-sm font-mono font-bold text-purple-400">{ctr}%</span>
                </div>
                <div className="p-2 rounded bg-slate-900/50">
                  <span className="text-[10px] uppercase text-slate-400 block">Orders Conv.</span>
                  <span className="text-sm font-mono font-bold text-teal-400">{ch.conversionRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
