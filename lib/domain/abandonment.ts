import { CartStatus } from "./types";

export interface AbandonmentEvaluationInput {
  status: string;
  lastActivityAt: Date;
  hasCompletedPurchase: boolean;
  evaluationTime: Date;
}

export interface AbandonmentEvaluationResult {
  isAbandoned: boolean;
  status: CartStatus;
  reason: string;
  abandonedAt: Date | null;
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30-day retention limit
export const SIXTY_MINUTES_MS = 60 * 60 * 1000;

export function evaluateCartAbandonment(
  input: AbandonmentEvaluationInput
): AbandonmentEvaluationResult {
  const { status, lastActivityAt, hasCompletedPurchase, evaluationTime } = input;

  // Rule 1: Cannot be abandoned if already purchased
  if (hasCompletedPurchase) {
    return {
      isAbandoned: false,
      status: status === "RECOVERED" ? "RECOVERED" : "CONVERTED_EXTERNAL",
      reason: "Cart has an associated completed purchase.",
      abandonedAt: null,
    };
  }

  // Rule 2: Cannot transition if already closed or recovered
  if (status === "RECOVERED") {
    return {
      isAbandoned: false,
      status: "RECOVERED",
      reason: "Cart has already been recovered through recovery messaging.",
      abandonedAt: null,
    };
  }

  // Rule 3: 30-day fixed retention expiration policy (supersedes abandonment)
  const elapsedMs = evaluationTime.getTime() - lastActivityAt.getTime();
  if (elapsedMs >= THIRTY_DAYS_MS || status === "EXPIRED") {
    return {
      isAbandoned: false,
      status: "EXPIRED",
      reason: `Cart lifecycle expired: inactive for ${Math.floor(
        elapsedMs / (24 * 3600 * 1000)
      )} days without completed order (policy limit: 30 days).`,
      abandonedAt: null,
    };
  }

  // Rule 4: 60 minutes of inactivity
  if (elapsedMs < SIXTY_MINUTES_MS) {
    return {
      isAbandoned: false,
      status: "ACTIVE",
      reason: `Cart is still active. Only ${Math.floor(
        elapsedMs / (60 * 1000)
      )} minutes have elapsed since last activity (threshold: 60 minutes).`,
      abandonedAt: null,
    };
  }

  // Qualified as abandoned
  const abandonedAt = new Date(lastActivityAt.getTime() + SIXTY_MINUTES_MS);

  return {
    isAbandoned: true,
    status: "ABANDONED",
    reason: `Cart abandoned: inactive for ${Math.floor(
      elapsedMs / (60 * 1000)
    )} minutes without completed checkout.`,
    abandonedAt,
  };
}
