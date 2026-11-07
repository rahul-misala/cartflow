import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CartFilters } from "@/components/carts/CartFilters";
import {
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface SearchProps {
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
    eligibility?: string;
    channel?: string;
    isException?: string;
  };
}

export default async function CartsWorkQueuePage({ searchParams }: SearchProps) {
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const search = searchParams.search?.trim();
  const statusFilter = searchParams.status && searchParams.status !== "ALL" ? searchParams.status : undefined;
  const eligibilityFilter = searchParams.eligibility && searchParams.eligibility !== "ALL" ? searchParams.eligibility : undefined;
  const channelFilter = searchParams.channel && searchParams.channel !== "ALL" ? searchParams.channel : undefined;
  const exceptionOnly = searchParams.isException === "YES";

  // Build Prisma where clause
  const where: any = {};

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { customerId: { contains: search } },
      { customer: { firstName: { contains: search } } },
      { customer: { lastName: { contains: search } } },
      { customer: { email: { contains: search } } },
    ];
  }

  if (eligibilityFilter) {
    where.messages = {
      some: {
        eligibilityStatus: eligibilityFilter,
      },
    };
  }

  if (channelFilter) {
    where.messages = {
      ...where.messages,
      some: {
        ...(where.messages?.some || {}),
        template: {
          campaign: {
            channel: channelFilter,
          },
        },
      },
    };
  }

  // Ground truth issues for anomaly tags
  const groundTruthIssues = await prisma.groundTruthIssue.findMany();
  const anomalyCartIds = new Set(
    groundTruthIssues
      .filter((i) => i.relatedEntityType === "CART")
      .map((i) => i.relatedEntityId)
  );

  // If user filtered for exceptions only
  if (exceptionOnly) {
    where.id = { in: Array.from(anomalyCartIds) };
  }

  const [totalMatching, carts] = await Promise.all([
    prisma.cart.count({ where }),
    prisma.cart.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { lastActivityAt: "desc" },
      include: {
        customer: true,
        lines: true,
        messages: {
          take: 3,
          include: {
            template: {
              include: {
                campaign: true,
              },
            },
            sendAttempts: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalMatching / pageSize) || 1;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RECOVERED":
        return "bg-teal-950 text-teal-300 border-teal-800";
      case "ABANDONED":
        return "bg-amber-950 text-amber-300 border-amber-800";
      case "ACTIVE":
        return "bg-blue-950 text-blue-300 border-blue-800";
      case "CONVERTED_EXTERNAL":
        return "bg-cyan-950 text-cyan-300 border-cyan-800";
      case "EXPIRED":
        return "bg-slate-900 text-slate-400 border-slate-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getEligibilityBadge = (eligibility: string) => {
    switch (eligibility) {
      case "ELIGIBLE":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "OPTED_OUT":
        return "bg-rose-950 text-rose-300 border-rose-800";
      case "CONSENT_EXPIRED":
        return "bg-orange-950 text-orange-300 border-orange-800";
      case "FREQUENCY_CAPPED":
        return "bg-yellow-950 text-yellow-300 border-yellow-800";
      case "NO_CONSENT":
        return "bg-slate-900 text-slate-400 border-slate-800";
      case "ALREADY_PURCHASED":
        return "bg-blue-950 text-blue-300 border-blue-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
            <span>Abandoned-Cart Work Queue</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operational triage: evaluate contact suppression, campaign targeting, and recovery outcomes.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
          <span>Found: <strong className="text-white">{totalMatching.toLocaleString()}</strong> carts</span>
          <span className="text-slate-600">|</span>
          <span>Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong></span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <CartFilters />

      {/* Carts Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Cart ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4 text-right">Value</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4">Campaign / Channel</th>
                <th className="py-3.5 px-4">Eligibility Gate</th>
                <th className="py-3.5 px-4">Recovery State</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {carts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No carts match the specified filter criteria. Try resetting filters.
                  </td>
                </tr>
              ) : (
                carts.map((cart) => {
                  const latestMsg = cart.messages[0];
                  const campaign = latestMsg?.template?.campaign;
                  const template = latestMsg?.template;
                  const isAnomaly = anomalyCartIds.has(cart.id);

                  // Calculate elapsed hours since last activity
                  const evalBaseTime = new Date("2026-10-15T00:00:00Z"); // benchmark time
                  const elapsedHours = Math.max(
                    0,
                    Math.round(
                      (evalBaseTime.getTime() - new Date(cart.lastActivityAt).getTime()) /
                        (3600 * 1000)
                    )
                  );

                  return (
                    <tr
                      key={cart.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Cart ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/carts/${cart.id}`}
                            className="font-mono font-bold text-indigo-400 group-hover:text-indigo-300 hover:underline flex items-center gap-1"
                          >
                            <span>{cart.id}</span>
                          </Link>
                          {isAnomaly && (
                            <span
                              title="Intentional Ground Truth Anomaly"
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-0.5"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>ANOMALY</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">
                          {cart.customer.firstName} {cart.customer.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <span>{cart.customerId}</span>
                          <span className="text-slate-600">•</span>
                          <span className="truncate max-w-[130px]">{cart.customer.email}</span>
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ${cart.grandTotal.toFixed(2)}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300 font-mono text-[11px]">
                          {new Date(cart.lastActivityAt).toISOString().replace("T", " ").slice(0, 16)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {elapsedHours}h elapsed
                        </div>
                      </td>

                      {/* Campaign / Channel */}
                      <td className="py-3.5 px-4">
                        {campaign ? (
                          <div>
                            <span className="font-medium text-slate-300 block">
                              {campaign.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Variant {template?.variant} • {campaign.channel}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">None assigned</span>
                        )}
                      </td>

                      {/* Eligibility Gate */}
                      <td className="py-3.5 px-4">
                        {latestMsg ? (
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getEligibilityBadge(
                                latestMsg.eligibilityStatus
                              )}`}
                            >
                              {latestMsg.eligibilityStatus}
                            </span>
                            {latestMsg.suppressionReason && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5" title={latestMsg.suppressionReason}>
                                {latestMsg.suppressionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Pending Eval</span>
                        )}
                      </td>

                      {/* Recovery State */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getStatusBadge(
                            cart.status
                          )}`}
                        >
                          {cart.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/carts/${cart.id}`}
                          className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Audit</span>
                          <ArrowRight className="w-3 h-3 text-indigo-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                href={`/carts?page=${Math.max(1, page - 1)}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${eligibilityFilter ? `&eligibility=${eligibilityFilter}` : ""}`}
                aria-disabled={page <= 1}
                className={`p-2 rounded-lg border border-slate-800 text-xs flex items-center gap-1 ${
                  page <= 1
                    ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-500"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-200"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Link>

              <span className="px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-xs font-semibold">
                {page}
              </span>

              <Link
                href={`/carts?page=${Math.min(totalPages, page + 1)}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${eligibilityFilter ? `&eligibility=${eligibilityFilter}` : ""}`}
                aria-disabled={page >= totalPages}
                className={`p-2 rounded-lg border border-slate-800 text-xs flex items-center gap-1 ${
                  page >= totalPages
                    ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-500"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-200"
                }`}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
