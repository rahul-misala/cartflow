import { AttributionReason } from "./types";

export interface CandidateSendAttempt {
  id: string;
  cartId: string;
  customerId: string;
  status: string; // "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "FAILED", "SUPPRESSED"
  eligibilityStatus: string; // "ELIGIBLE", etc.
  sentAt: Date | null;
  deliveredAt: Date | null;
  clickedAt: Date | null;
}

export interface AttributionOrderInput {
  id: string;
  cartId: string | null;
  customerId: string;
  total: number;
  purchasedAt: Date;
}

export interface AttributionDecision {
  sendAttemptId: string;
  attributionReason: AttributionReason;
  attributionWindowHours: number;
  attributedRevenue: number;
  isAttributed: boolean;
  explanation: string;
}

export const ATTRIBUTION_WINDOW_MS = 168 * 60 * 60 * 1000; // Exactly 168 hours (7 days)

export function evaluateOrderAttribution(
  order: AttributionOrderInput,
  candidateSends: CandidateSendAttempt[]
): AttributionDecision | null {
  if (!order.cartId) {
    return null;
  }

  const purchaseTime = new Date(order.purchasedAt).getTime();
  const windowStartTime = purchaseTime - ATTRIBUTION_WINDOW_MS;

  // Filter sends matching customer, cart, eligibility, and strictly:
  // 0 < order.purchasedAt - send.sentAt <= 168 hours
  const eligibleSends = candidateSends.filter((send) => {
    if (send.cartId !== order.cartId || send.customerId !== order.customerId) {
      return false;
    }
    if (send.eligibilityStatus !== "ELIGIBLE") {
      return false;
    }
    if (!send.sentAt) {
      return false;
    }

    const sentTime = new Date(send.sentAt).getTime();
    // Strictly: 0 < order.purchasedAt - send.sentAt <= 168 hours
    // Equivalent to: sentTime < purchaseTime AND sentTime >= windowStartTime
    return sentTime < purchaseTime && sentTime >= windowStartTime;
  });

  if (eligibleSends.length === 0) {
    return null;
  }

  // Priority 1: Latest eligible send that was CLICKED prior to or at order purchase
  const qualifyingClickedSends = eligibleSends.filter((s) => {
    if (s.status !== "CLICKED" || !s.clickedAt) return false;
    const clickTime = new Date(s.clickedAt).getTime();
    // A click occurring after the order does NOT qualify
    return clickTime <= purchaseTime;
  });

  if (qualifyingClickedSends.length > 0) {
    qualifyingClickedSends.sort((a, b) => {
      const timeA = new Date(a.clickedAt || a.sentAt!).getTime();
      const timeB = new Date(b.clickedAt || b.sentAt!).getTime();
      return timeB - timeA;
    });

    const winningSend = qualifyingClickedSends[0];
    const sentTime = new Date(winningSend.sentAt!).getTime();
    const windowHours = Math.round(((purchaseTime - sentTime) / (3600 * 1000)) * 10) / 10;

    return {
      sendAttemptId: winningSend.id,
      attributionReason: "LAST_CLICKED_SEND",
      attributionWindowHours: windowHours,
      attributedRevenue: order.total,
      isAttributed: true,
      explanation: `Order attributed to latest clicked recovery send (${winningSend.id}) dispatched ${windowHours} hours prior to purchase.`,
    };
  }

  // Priority 2: Latest eligible send that was DELIVERED or OPENED prior to or at order purchase
  const qualifyingDeliveredSends = eligibleSends.filter((s) => {
    if (!["DELIVERED", "OPENED", "CLICKED"].includes(s.status)) return false;
    if (!s.deliveredAt) return false;
    const deliverTime = new Date(s.deliveredAt).getTime();
    return deliverTime <= purchaseTime;
  });

  if (qualifyingDeliveredSends.length > 0) {
    qualifyingDeliveredSends.sort((a, b) => {
      const timeA = new Date(a.deliveredAt || a.sentAt!).getTime();
      const timeB = new Date(b.deliveredAt || b.sentAt!).getTime();
      return timeB - timeA;
    });

    const winningSend = qualifyingDeliveredSends[0];
    const sentTime = new Date(winningSend.sentAt!).getTime();
    const windowHours = Math.round(((purchaseTime - sentTime) / (3600 * 1000)) * 10) / 10;

    return {
      sendAttemptId: winningSend.id,
      attributionReason: "LAST_DELIVERED_SEND",
      attributionWindowHours: windowHours,
      attributedRevenue: order.total,
      isAttributed: true,
      explanation: `Order attributed to latest delivered recovery send (${winningSend.id}) dispatched ${windowHours} hours prior to purchase (no qualifying click recorded).`,
    };
  }

  return null;
}
