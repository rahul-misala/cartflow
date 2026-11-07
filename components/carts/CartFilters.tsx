"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, RotateCcw } from "lucide-react";

export function CartFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "ALL");
  const [eligibility, setEligibility] = useState(searchParams.get("eligibility") || "ALL");
  const [channel, setChannel] = useState(searchParams.get("channel") || "ALL");
  const [isException, setIsException] = useState(searchParams.get("isException") || "ALL");

  const applyFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // reset to page 1

    for (const [key, val] of Object.entries(updates)) {
      if (val === "ALL" || !val) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }

    router.push(`/carts?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search, status, eligibility, channel, isException });
  };

  const handleReset = () => {
    setSearch("");
    setStatus("ALL");
    setEligibility("ALL");
    setChannel("ALL");
    setIsException("ALL");
    router.push("/carts");
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Cart ID (e.g. CART-2026-000001) or Customer ID (CUS-000001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Apply Filters</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Recovery State
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              applyFilters({ status: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All States</option>
            <option value="ABANDONED">ABANDONED</option>
            <option value="RECOVERED">RECOVERED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CONVERTED_EXTERNAL">CONVERTED_EXTERNAL</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Eligibility Gate
          </label>
          <select
            value={eligibility}
            onChange={(e) => {
              setEligibility(e.target.value);
              applyFilters({ eligibility: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ELIGIBLE">ELIGIBLE</option>
            <option value="NO_CONSENT">NO_CONSENT</option>
            <option value="OPTED_OUT">OPTED_OUT</option>
            <option value="CONSENT_EXPIRED">CONSENT_EXPIRED</option>
            <option value="FREQUENCY_CAPPED">FREQUENCY_CAPPED</option>
            <option value="ALREADY_PURCHASED">ALREADY_PURCHASED</option>
            <option value="NOT_ABANDONED">NOT_ABANDONED</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Channel
          </label>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              applyFilters({ channel: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Channels</option>
            <option value="EMAIL">EMAIL</option>
            <option value="SMS">SMS</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Ground Truth Anomaly
          </label>
          <select
            value={isException}
            onChange={(e) => {
              setIsException(e.target.value);
              applyFilters({ isException: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Carts</option>
            <option value="YES">Known Anomalies Only</option>
          </select>
        </div>
      </div>
    </div>
  );
}
