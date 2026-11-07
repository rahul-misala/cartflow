import React from "react";
import { Mail, MessageSquare, Tag, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface CampaignItem {
  id: string;
  name: string;
  channel: string;
  sends: number;
  delivered: number;
  clicked: number;
  recoveredOrders: number;
  revenue: number;
  conversionRate: number;
}

interface CampaignPerformanceProps {
  campaigns: CampaignItem[];
}

export function CampaignPerformance({ campaigns }: CampaignPerformanceProps) {
  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Campaign Performance</h3>
          <p className="text-xs text-slate-400">Recovery velocity, conversion rates, and attributed revenue by campaign</p>
        </div>
        <Link
          href="/carts"
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
        >
          View in Queue <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3">Campaign</th>
              <th className="py-3 px-3">Channel</th>
              <th className="py-3 px-3 text-right">Sends</th>
              <th className="py-3 px-3 text-right">Delivered</th>
              <th className="py-3 px-3 text-right">Clicks</th>
              <th className="py-3 px-3 text-right">Recovered</th>
              <th className="py-3 px-3 text-right">Conv. Rate</th>
              <th className="py-3 px-3 text-right">Attributed Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {campaigns.map((cmp) => {
              const isEmail = cmp.channel === "EMAIL";
              const isDiscount = cmp.name.includes("Discount");
              const Icon = isDiscount ? Tag : isEmail ? Mail : MessageSquare;

              return (
                <tr key={cmp.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-1.5 rounded ${isEmail ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{cmp.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{cmp.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${isEmail ? "bg-indigo-950 text-indigo-300 border border-indigo-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"}`}>
                      {cmp.channel}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300">{cmp.sends.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300">{cmp.delivered.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300">{cmp.clicked.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-cyan-400">{cmp.recoveredOrders.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-teal-400">{cmp.conversionRate.toFixed(1)}%</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                    ${cmp.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
