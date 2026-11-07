import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { calculateCartTotals } from "@/lib/domain/calculations";
import {
  ArrowLeft,
  ShoppingCart,
  User,
  Shield,
  Clock,
  Send,
  ShoppingBag,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Smartphone,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface CartAuditPageProps {
  params: {
    id: string;
  };
}

export default async function CartAuditPage({ params }: CartAuditPageProps) {
  const { id } = params;

  const cart = await prisma.cart.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          consents: {
            orderBy: { effectiveFrom: "desc" },
          },
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 5,
          },
        },
      },
      session: true,
      lines: {
        orderBy: { id: "asc" },
      },
      messages: {
        orderBy: { scheduledAt: "asc" },
        include: {
          template: {
            include: {
              campaign: true,
            },
          },
          sendAttempts: {
            orderBy: { createdAt: "asc" },
            include: {
              events: {
                orderBy: { occurredAt: "asc" },
              },
              attributions: {
                include: {
                  order: true,
                },
              },
            },
          },
        },
      },
      orders: {
        orderBy: { purchasedAt: "desc" },
        include: {
          attributions: {
            include: {
              sendAttempt: {
                include: {
                  messageInstance: {
                    include: {
                      template: {
                        include: {
                          campaign: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    notFound();
  }

  // Check for related ground truth anomalies
  const relatedIssues = await prisma.groundTruthIssue.findMany({
    where: {
      OR: [
        { relatedEntityId: cart.id },
        { relatedEntityId: cart.customerId },
        {
          relatedEntityId: {
            in: cart.messages.flatMap((m) => [
              m.id,
              ...m.sendAttempts.map((s) => s.id),
              ...m.sendAttempts.flatMap((s) => s.attributions.map((a) => a.id)),
            ]),
          },
        },
        {
          relatedEntityId: {
            in: cart.orders.flatMap((o) => [
              o.id,
              ...o.attributions.map((a) => a.id),
            ]),
          },
        },
      ],
    },
  });

  // Calculate live arithmetic from lines
  const computedTotals = calculateCartTotals(cart.lines);
  const isHeaderStale =
    Math.abs(cart.grandTotal - computedTotals.grandTotal) > 0.01 ||
    Math.abs(cart.subtotal - computedTotals.subtotal) > 0.01 ||
    cart.itemCount !== computedTotals.itemCount;

  // Build Chronological Timeline Events
  interface TimelineEvent {
    id: string;
    timestamp: Date;
    title: string;
    type: "SESSION" | "CART" | "ABANDONMENT" | "ELIGIBILITY" | "SEND" | "ORDER" | "ATTRIBUTION" | "ANOMALY";
    description: string;
    badge?: string;
    badgeColor?: string;
    details?: any;
  }

  const timelineEvents: TimelineEvent[] = [];

  // Session start
  timelineEvents.push({
    id: `event-session-${cart.session.id}`,
    timestamp: cart.session.startedAt,
    title: "Browsing Session Started",
    type: "SESSION",
    description: `Customer initiated session from ${cart.session.deviceType} (${cart.session.browser}) • IP: ${cart.session.ipAddress}`,
    badge: cart.session.deviceType,
    badgeColor: "bg-blue-950 text-blue-300 border-blue-800",
  });

  // Cart created
  timelineEvents.push({
    id: `event-cart-created`,
    timestamp: cart.createdAt,
    title: "Cart Created & Items Added",
    type: "CART",
    description: `${cart.itemCount} items added to cart. Grand total: $${cart.grandTotal.toFixed(2)}`,
    badge: "CART_INIT",
    badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
  });

  // Last Activity
  timelineEvents.push({
    id: `event-last-activity`,
    timestamp: cart.lastActivityAt,
    title: "Last Cart Interaction",
    type: "CART",
    description: "Last item addition / modification timestamp recorded.",
  });

  // Abandonment marked
  if (cart.abandonedAt) {
    timelineEvents.push({
      id: `event-abandoned`,
      timestamp: cart.abandonedAt,
      title: "Cart Abandonment Evaluated",
      type: "ABANDONMENT",
      description: "Inactivity exceeded 60 minutes with no completed purchase. Cart flagged as ABANDONED.",
      badge: "ABANDONED",
      badgeColor: "bg-amber-950 text-amber-300 border-amber-800",
    });
  }

  // Message Instances & Sends
  for (const msg of cart.messages) {
    const getEligibilityBadgeColor = (status: string) => {
      switch (status) {
        case "ELIGIBLE":
          return "bg-emerald-950 text-emerald-300 border-emerald-800";
        case "OPTED_OUT":
          return "bg-rose-950 text-rose-300 border-rose-800";
        case "CONSENT_EXPIRED":
          return "bg-orange-950 text-orange-300 border-orange-800";
        case "FREQUENCY_CAPPED":
          return "bg-yellow-950 text-yellow-300 border-yellow-800";
        case "ALREADY_PURCHASED":
          return "bg-blue-950 text-blue-300 border-blue-800";
        default:
          return "bg-slate-800 text-slate-300 border-slate-700";
      }
    };

    timelineEvents.push({
      id: `event-msg-eval-${msg.id}`,
      timestamp: msg.evaluatedAt,
      title: `Campaign Evaluated: ${msg.template.campaign.name}`,
      type: "ELIGIBILITY",
      description: `Gate result: ${msg.eligibilityStatus}. Variant ${msg.template.variant} (${msg.template.campaign.channel}). ${
        msg.suppressionReason ? `Suppressed: ${msg.suppressionReason}` : "Approved for recovery dispatch."
      }`,
      badge: msg.eligibilityStatus,
      badgeColor: getEligibilityBadgeColor(msg.eligibilityStatus),
    });

    for (const send of msg.sendAttempts) {
      if (send.events && send.events.length > 0) {
        for (const evt of send.events) {
          const badgeColors: Record<string, string> = {
            SENT: "bg-indigo-950 text-indigo-300 border-indigo-800",
            DELIVERED: "bg-cyan-950 text-cyan-300 border-cyan-800",
            OPENED: "bg-purple-950 text-purple-300 border-purple-800",
            CLICKED: "bg-teal-950 text-teal-300 border-teal-800",
            BOUNCED: "bg-rose-950 text-rose-300 border-rose-800",
            FAILED: "bg-rose-950 text-rose-300 border-rose-800",
            SUPPRESSED: "bg-slate-900 text-slate-400 border-slate-700",
          };

          timelineEvents.push({
            id: `event-send-${evt.id}`,
            timestamp: evt.occurredAt,
            title: `Immutable Send Event: ${evt.eventType} (${evt.id})`,
            type: "SEND",
            description: `${msg.template.campaign.channel} attempt ${send.id}.${
              evt.metadata ? ` [Metadata: ${evt.metadata}]` : ""
            }`,
            badge: evt.eventType,
            badgeColor: badgeColors[evt.eventType] || "bg-slate-800 text-slate-300 border-slate-700",
          });
        }
      } else {
        if (send.sentAt) {
          timelineEvents.push({
            id: `event-send-${send.id}`,
            timestamp: send.sentAt,
            title: `Recovery Message Dispatched (${send.id})`,
            type: "SEND",
            description: `Dispatched via ${msg.template.campaign.channel} gateway.`,
            badge: "SENT",
            badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
          });
        }
      }
    }
  }

  // Orders
  for (const order of cart.orders) {
    timelineEvents.push({
      id: `event-order-${order.id}`,
      timestamp: order.purchasedAt,
      title: `Checkout Completed (${order.orderNumber})`,
      type: "ORDER",
      description: `Order ${order.id} completed. Total: $${order.total.toFixed(2)}. Status: ${order.status}`,
      badge: "PURCHASED",
      badgeColor: "bg-emerald-950 text-emerald-300 border-emerald-800",
    });

    for (const attr of order.attributions) {
      timelineEvents.push({
        id: `event-attr-${attr.id}`,
        timestamp: attr.attributedAt,
        title: `Single-Touch Recovery Attribution (${attr.id})`,
        type: "ATTRIBUTION",
        description: `Attributed $${attr.attributedRevenue.toFixed(2)} to recovery send ${attr.sendAttemptId} (${
          attr.attributionReason
        }) dispatched ${attr.attributionWindowHours}h prior.`,
        badge: attr.isAnomaly ? "ANOMALY_ATTRIBUTION" : "ATTRIBUTED",
        badgeColor: attr.isAnomaly
          ? "bg-rose-950 text-rose-300 border-rose-800"
          : "bg-teal-950 text-teal-300 border-teal-800",
      });
    }
  }

  // Sort timeline chronologically
  timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Find latest message instance for eligibility gate explanation
  const latestMessage = cart.messages[0];
  const latestOrder = cart.orders[0];
  const primaryAttribution = latestOrder?.attributions.find((a) => !a.isAnomaly) || latestOrder?.attributions[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link href="/carts" className="hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Work Queue
          </Link>
          <span>/</span>
          <span className="font-mono text-slate-300">{cart.id}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Status:</span>
          <span
            className={`px-3 py-1 rounded-md text-xs font-mono font-bold border ${
              cart.status === "RECOVERED"
                ? "bg-teal-950 text-teal-300 border-teal-800"
                : cart.status === "ABANDONED"
                ? "bg-amber-950 text-amber-300 border-amber-800"
                : "bg-slate-900 text-slate-300 border-slate-700"
            }`}
          >
            {cart.status}
          </span>
        </div>
      </div>

      {/* Ground Truth Anomaly Banner if present */}
      {relatedIssues.length > 0 && (
        <div className="p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Ground Truth Anomaly Detected on this Record
              </h3>
            </div>
            <Link
              href="/exceptions"
              className="text-xs text-rose-300 hover:underline font-mono flex items-center gap-1"
            >
              Open Anomaly Catalog <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {relatedIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 rounded-lg bg-slate-950/80 border border-rose-900/60 text-xs"
              >
                <div className="flex items-center justify-between font-mono mb-1">
                  <span className="font-bold text-rose-300">{issue.issueType}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-[10px] text-rose-300 font-semibold">
                    {issue.severity}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 mt-2">
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Expected Domain Decision
                    </span>
                    <span className="font-mono text-emerald-400">{issue.expectedDecision}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Observed Data State
                    </span>
                    <span className="font-mono text-rose-400">{issue.observedState}</span>
                  </div>
                </div>
                <p className="mt-2 text-slate-400 text-[11px]">{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 2 Cards: Cart Details & Customer Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cart Summary */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-400 mb-2">
            <ShoppingCart className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cart Metadata</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Cart Identifier</span>
              <span className="font-mono font-bold text-white">{cart.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Lifecycle Status</span>
              <span className="font-mono font-semibold text-slate-200">{cart.status}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Items in Cart</span>
              <span className="font-mono text-slate-200">{cart.itemCount} items</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Header Grand Total</span>
              <span className="font-mono font-bold text-emerald-400">${cart.grandTotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Created At</span>
              <span className="font-mono text-slate-300">
                {cart.createdAt.toISOString().replace("T", " ").slice(0, 19)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Last Activity</span>
              <span className="font-mono text-slate-300">
                {cart.lastActivityAt.toISOString().replace("T", " ").slice(0, 19)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Profile & Device */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-400 mb-2">
            <User className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Profile</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Customer ID</span>
              <span className="font-mono font-bold text-white">{cart.customer.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Full Name</span>
              <span className="font-medium text-slate-200">
                {cart.customer.firstName} {cart.customer.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Email Address</span>
              <span className="font-mono text-slate-300 truncate block">{cart.customer.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Phone (SMS)</span>
              <span className="font-mono text-slate-300">{cart.customer.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Session Form Factor</span>
              <span className="font-mono text-slate-300">
                {cart.session.deviceType} • {cart.session.browser}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Client IP Address</span>
              <span className="font-mono text-slate-300">{cart.session.ipAddress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Lines & Reconciliation */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">Cart Line Items & Arithmetic Reconciliation</h3>
            <p className="text-xs text-slate-400">Sum of line items, estimated tax (8%), and header reconciliation</p>
          </div>

          <div>
            {isHeaderStale ? (
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Arithmetic Discrepancy: Stale Cart Header</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Reconciled with Line Items</span>
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Product Description</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cart.lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{line.sku}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-200">{line.title}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">${line.price.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{line.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    ${line.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation Reconciliation Breakdown */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
          <div className="text-slate-400 space-y-1">
            <div>Computed Lines Subtotal: <strong className="text-slate-200">${computedTotals.subtotal.toFixed(2)}</strong></div>
            <div>Computed Estimated Tax (8%): <strong className="text-slate-200">${computedTotals.taxTotal.toFixed(2)}</strong></div>
            <div>Computed Grand Total: <strong className="text-white">${computedTotals.grandTotal.toFixed(2)}</strong></div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-right space-y-1">
            <span className="text-[11px] uppercase text-slate-400 block">Database Header Grand Total</span>
            <span className={`text-xl font-bold ${isHeaderStale ? "text-amber-400 line-through" : "text-emerald-400"}`}>
              ${cart.grandTotal.toFixed(2)}
            </span>
            {isHeaderStale && (
              <p className="text-[10px] text-amber-300 font-mono">
                Mismatch: Expected ${computedTotals.grandTotal.toFixed(2)} (Delta: ${(computedTotals.grandTotal - cart.grandTotal).toFixed(2)})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plain Language Contact Eligibility Explanation */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-indigo-400">
          <Shield className="w-5 h-5" />
          <h3 className="text-base font-semibold text-white">Contact Eligibility & Suppression Audit</h3>
        </div>

        {latestMessage ? (
          <div className="space-y-3">
            <div
              className={`p-4 rounded-lg border text-xs ${
                latestMessage.eligibilityStatus === "ELIGIBLE"
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/20 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1 font-mono font-bold">
                <span>GATE DECISION: {latestMessage.eligibilityStatus}</span>
                <span>{latestMessage.template.campaign.channel}</span>
              </div>
              <p className="text-slate-300 text-xs mt-1">
                {latestMessage.suppressionReason ||
                  "All compliance gates passed: active opt-in consent exists, customer has not withdrawn consent, and frequency cap (< 2 messages in 7 days) was honored."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Consent Verification
                </span>
                <span className="text-slate-300">
                  {cart.customer.consents.filter((c) => c.channel === latestMessage.template.campaign.channel).length > 0
                    ? `Found ${cart.customer.consents.filter((c) => c.channel === latestMessage.template.campaign.channel).length} consent record(s).`
                    : "No consent records found for this channel."}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Frequency Cap (Rolling 7 Days)
                </span>
                <span className="text-slate-300 font-mono">
                  Quota limit: 2 recovery sends / 7 days.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Target Creative Variant
                </span>
                <span className="text-slate-300 font-mono">
                  {latestMessage.template.campaign.name} (Variant {latestMessage.template.variant})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            No recovery message has been scheduled or evaluated for this cart yet.
          </p>
        )}

        {/* Customer Consent History */}
        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Historical Customer Consent Ledger
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-semibold text-slate-500 uppercase">
                  <th className="py-2 px-2">Consent ID</th>
                  <th className="py-2 px-2">Channel</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Acquisition Source</th>
                  <th className="py-2 px-2">Effective From</th>
                  <th className="py-2 px-2">Effective To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-[11px] font-mono">
                {cart.customer.consents.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2 text-slate-400">{c.id}</td>
                    <td className="py-2 px-2 text-slate-300">{c.channel}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          c.status === "OPT_IN"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400">{c.source}</td>
                    <td className="py-2 px-2 text-slate-300">
                      {c.effectiveFrom.toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2 px-2 text-slate-400">
                      {c.effectiveTo ? c.effectiveTo.toISOString().slice(0, 19).replace("T", " ") : "Active"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Attribution & Purchase Outcome Card */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-teal-400">
          <Award className="w-5 h-5" />
          <h3 className="text-base font-semibold text-white">Purchase Attribution & Recovery ROI</h3>
        </div>

        {primaryAttribution ? (
          <div className="p-4 rounded-lg bg-teal-950/20 border border-teal-500/30 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-teal-400 font-bold text-sm">
                SUCCESSFUL RECOVERY CONVERSION ATTRIBUTED
              </span>
              <span className="text-xl font-mono font-bold text-white">
                ${primaryAttribution.attributedRevenue.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-slate-300 pt-2 border-t border-teal-900/60">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Attributed Order</span>
                <span className="text-white font-bold">{primaryAttribution.orderId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Winning Send Attempt</span>
                <span className="text-cyan-400 font-bold">{primaryAttribution.sendAttemptId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Attribution Rule</span>
                <span className="text-teal-300 font-bold">{primaryAttribution.attributionReason}</span>
              </div>
            </div>

            <p className="text-slate-300 text-xs">
              Order placed within {primaryAttribution.attributionWindowHours} hours of winning recovery message dispatch (governed by single-touch 7-day attribution window).
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
            <span className="text-slate-300 font-semibold block mb-1">No Recovery Attribution</span>
            {cart.orders.length > 0 ? (
              <p>
                Order ({cart.orders[0].id}) was completed organically or outside the 7-day recovery messaging attribution window.
              </p>
            ) : (
              <p>
                This cart has not converted into a purchase yet. Recovery messages are active or suppressed per customer consent/frequency cap.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chronological Audit Timeline */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-indigo-400">
          <Clock className="w-5 h-5" />
          <h3 className="text-base font-semibold text-white">Chronological Audit Timeline</h3>
        </div>
        <p className="text-xs text-slate-400">
          Complete forensic sequence: session activity → abandonment evaluation → contact gate → message delivery → order → attribution.
        </p>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {timelineEvents.map((event) => (
            <div key={event.id} className="relative group">
              <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{event.title}</span>
                    {event.badge && (
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold ${
                          event.badgeColor || "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {event.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(event.timestamp).toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
