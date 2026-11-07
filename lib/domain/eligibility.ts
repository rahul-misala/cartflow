import { EligibilityStatus, Channel } from "./types";

export interface ConsentRecord {
  id: string;
  channel: string;
  status: string; // "OPT_IN" | "OPT_OUT"
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface PriorSendRecord {
  sentAt: Date | null;
  channel: string;
  status?: string;
}

export interface EligibilityInput {
  cartId: string;
  cartStatus: string;
  hasCompletedPurchase: boolean;
  channel: Channel;
  proposedSendTime: Date;
  consents: ConsentRecord[];
  priorSends: PriorSendRecord[];
  isValidContactAddress?: boolean;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  isEligible: boolean;
  suppressionReason: string | null;
  detail: string;
}

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function evaluateContactEligibility(
  input: EligibilityInput
): EligibilityResult {
  const {
    cartStatus,
    hasCompletedPurchase,
    channel,
    proposedSendTime,
    consents,
    priorSends,
    isValidContactAddress = true,
  } = input;

  const proposedTime = proposedSendTime.getTime();

  // Gate 1: Cart Abandonment
  if (cartStatus !== "ABANDONED") {
    return {
      status: "NOT_ABANDONED",
      isEligible: false,
      suppressionReason: `Cart is in state '${cartStatus}' (must be ABANDONED for recovery dispatch).`,
      detail: "Gate 1 Failed: Cart is active, expired, or already closed.",
    };
  }

  // Gate 2: Prior Purchase
  if (hasCompletedPurchase) {
    return {
      status: "ALREADY_PURCHASED",
      isEligible: false,
      suppressionReason: "Order already completed for this cart prior to dispatch.",
      detail: "Gate 2 Failed: Customer already purchased.",
    };
  }

  // Gate 3 & 4: Consent check
  // Filter for this channel where effectiveFrom <= proposedSendTime
  const channelConsents = consents
    .filter(
      (c) =>
        c.channel === channel &&
        new Date(c.effectiveFrom).getTime() <= proposedTime
    )
    .sort(
      (a, b) =>
        new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime()
    );

  if (channelConsents.length === 0) {
    return {
      status: "NO_CONSENT",
      isEligible: false,
      suppressionReason: `No recorded consent for channel '${channel}' prior to proposed send time.`,
      detail: `Gate 3 Failed: Customer has never opted in to ${channel} notifications.`,
    };
  }

  const latestConsent = channelConsents[channelConsents.length - 1];

  if (latestConsent.status === "OPT_OUT") {
    return {
      status: "OPTED_OUT",
      isEligible: false,
      suppressionReason: `Customer explicitly opted out of ${channel} messaging on ${new Date(
        latestConsent.effectiveFrom
      ).toISOString()}.`,
      detail: `Gate 4 Failed: Latest consent state is OPT_OUT.`,
    };
  }

  // Check consent expiration: effectiveFrom <= t AND (effectiveTo IS NULL OR t < effectiveTo)
  if (
    latestConsent.effectiveTo &&
    proposedTime >= new Date(latestConsent.effectiveTo).getTime()
  ) {
    return {
      status: "CONSENT_EXPIRED",
      isEligible: false,
      suppressionReason: `Customer consent for ${channel} expired on ${new Date(
        latestConsent.effectiveTo
      ).toISOString()} prior to proposed send time.`,
      detail: `Gate 4 Failed: Consent expired before proposed send time.`,
    };
  }

  // Gate 5: Frequency Cap
  // Rolling window: [t - 7 days, t) - strictly excluding sends exactly at proposedSendTime
  const windowStart = proposedTime - SEVEN_DAYS_MS;
  const recentSends = priorSends.filter((send) => {
    if (send.channel !== channel || !send.sentAt) return false;
    // Count only actual dispatched messages, not suppressed or cancelled
    if (send.status === "SUPPRESSED" || send.status === "CANCELLED") return false;

    const sendTime = new Date(send.sentAt).getTime();
    return sendTime >= windowStart && sendTime < proposedTime;
  });

  if (recentSends.length >= 2) {
    return {
      status: "FREQUENCY_CAPPED",
      isEligible: false,
      suppressionReason: `Frequency cap exceeded: customer already received ${recentSends.length} ${channel} recovery messages in the rolling 7-day window [t - 7d, t) (cap: 2).`,
      detail: `Gate 5 Failed: ${recentSends.length} messages dispatched since ${new Date(
        windowStart
      ).toISOString()}.`,
    };
  }

  // Gate 6: Contact Validity / Other Suppression
  if (!isValidContactAddress) {
    return {
      status: "OTHER_SUPPRESSED",
      isEligible: false,
      suppressionReason: `Contact endpoint for ${channel} is invalid or suppressed on provider blacklist.`,
      detail: "Gate 6 Failed: Destination address/phone suppressed.",
    };
  }

  // All gates passed
  return {
    status: "ELIGIBLE",
    isEligible: true,
    suppressionReason: null,
    detail: `All eligibility gates cleared for channel ${channel}. Recent sends in 7d window: ${recentSends.length}/2.`,
  };
}
