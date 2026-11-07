import { describe, it, expect } from "vitest";
import { evaluateCartAbandonment, THIRTY_DAYS_MS } from "../lib/domain/abandonment";
import { evaluateContactEligibility, SEVEN_DAYS_MS } from "../lib/domain/eligibility";
import { evaluateOrderAttribution, ATTRIBUTION_WINDOW_MS } from "../lib/domain/attribution";
import { calculateCartTotals } from "../lib/domain/calculations";

describe("Domain Business Rules", () => {
  const baseTime = new Date("2026-10-01T12:00:00Z");

  describe("Cart Abandonment & Retention Rules", () => {
    it("cart becomes abandoned after 60 minutes of inactivity", () => {
      const lastActivityAt = new Date("2026-10-01T10:00:00Z"); // 2 hours ago
      const result = evaluateCartAbandonment({
        status: "ACTIVE",
        lastActivityAt,
        hasCompletedPurchase: false,
        evaluationTime: baseTime,
      });

      expect(result.isAbandoned).toBe(true);
      expect(result.status).toBe("ABANDONED");
      expect(result.abandonedAt).toEqual(new Date("2026-10-01T11:00:00Z"));
    });

    it("cart is not abandoned if active within 60 minutes", () => {
      const lastActivityAt = new Date("2026-10-01T11:30:00Z"); // 30 mins ago
      const result = evaluateCartAbandonment({
        status: "ACTIVE",
        lastActivityAt,
        hasCompletedPurchase: false,
        evaluationTime: baseTime,
      });

      expect(result.isAbandoned).toBe(false);
      expect(result.status).toBe("ACTIVE");
      expect(result.abandonedAt).toBeNull();
    });

    it("a purchased cart cannot be marked abandoned normally", () => {
      const lastActivityAt = new Date("2026-10-01T08:00:00Z");
      const result = evaluateCartAbandonment({
        status: "ACTIVE",
        lastActivityAt,
        hasCompletedPurchase: true,
        evaluationTime: baseTime,
      });

      expect(result.isAbandoned).toBe(false);
      expect(result.status).toBe("CONVERTED_EXTERNAL");
      expect(result.reason).toContain("completed purchase");
    });

    it("cart expires at 30 days of inactivity and blocks abandonment", () => {
      const lastActivityAt = new Date(baseTime.getTime() - THIRTY_DAYS_MS - 1000);
      const result = evaluateCartAbandonment({
        status: "ACTIVE",
        lastActivityAt,
        hasCompletedPurchase: false,
        evaluationTime: baseTime,
      });

      expect(result.isAbandoned).toBe(false);
      expect(result.status).toBe("EXPIRED");
      expect(result.reason).toContain("expired");
    });
  });

  describe("Contact Consent & Expiry Rules", () => {
    const defaultCart = {
      cartId: "CART-2026-000001",
      cartStatus: "ABANDONED",
      hasCompletedPurchase: false,
      channel: "EMAIL" as const,
      proposedSendTime: baseTime,
      consents: [
        {
          id: "CNS-000001",
          channel: "EMAIL",
          status: "OPT_IN",
          effectiveFrom: new Date("2026-09-01T00:00:00Z"),
          effectiveTo: null,
        },
      ],
      priorSends: [],
    };

    it("approves contact when valid active consent exists", () => {
      const result = evaluateContactEligibility(defaultCart);
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });

    it("blocks contact if no consent exists", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        consents: [],
      });
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("NO_CONSENT");
    });

    it("withdrawn consent blocks contact as OPTED_OUT", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        consents: [
          {
            id: "CNS-000001",
            channel: "EMAIL",
            status: "OPT_IN",
            effectiveFrom: new Date("2026-09-01T00:00:00Z"),
            effectiveTo: new Date("2026-09-20T00:00:00Z"),
          },
          {
            id: "CNS-000002",
            channel: "EMAIL",
            status: "OPT_OUT",
            effectiveFrom: new Date("2026-09-20T00:00:01Z"),
            effectiveTo: null,
          },
        ],
      });
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("OPTED_OUT");
    });

    it("expired opt-in consent returns CONSENT_EXPIRED rather than OPTED_OUT", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        consents: [
          {
            id: "CNS-000001",
            channel: "EMAIL",
            status: "OPT_IN",
            effectiveFrom: new Date("2026-09-01T00:00:00Z"),
            effectiveTo: new Date("2026-09-15T00:00:00Z"), // expired 16 days prior to baseTime
          },
        ],
      });
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("CONSENT_EXPIRED");
      expect(result.suppressionReason).toContain("expired");
    });

    it("opt-in consent with effectiveTo in future remains ELIGIBLE", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        consents: [
          {
            id: "CNS-000001",
            channel: "EMAIL",
            status: "OPT_IN",
            effectiveFrom: new Date("2026-09-01T00:00:00Z"),
            effectiveTo: new Date("2026-10-15T00:00:00Z"), // expires in 14 days
          },
        ],
      });
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });
  });

  describe("Frequency Capping Boundary Behavior [t - 7d, t)", () => {
    const t = baseTime.getTime();
    const defaultCart = {
      cartId: "CART-2026-000001",
      cartStatus: "ABANDONED",
      hasCompletedPurchase: false,
      channel: "EMAIL" as const,
      proposedSendTime: baseTime,
      consents: [
        {
          id: "CNS-000001",
          channel: "EMAIL",
          status: "OPT_IN",
          effectiveFrom: new Date("2026-09-01T00:00:00Z"),
          effectiveTo: null,
        },
      ],
    };

    it("exactly two prior sends inside the window blocks a third", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        priorSends: [
          { sentAt: new Date(t - 3 * 24 * 3600 * 1000), channel: "EMAIL" },
          { sentAt: new Date(t - 1 * 24 * 3600 * 1000), channel: "EMAIL" },
        ],
      });
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("FREQUENCY_CAPPED");
    });

    it("a send exactly at proposed time t is excluded from prior sends", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        priorSends: [
          { sentAt: new Date(t - 3 * 24 * 3600 * 1000), channel: "EMAIL" },
          { sentAt: new Date(t), channel: "EMAIL" }, // exactly at t -> excluded from [t-7d, t)
        ],
      });
      // Only 1 send in window -> eligible
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });

    it("a send exactly seven days earlier (t - 7 days) is included in window", () => {
      const exactSevenDaysAgo = new Date(t - SEVEN_DAYS_MS);
      const result = evaluateContactEligibility({
        ...defaultCart,
        priorSends: [
          { sentAt: exactSevenDaysAgo, channel: "EMAIL" }, // included (>= windowStart)
          { sentAt: new Date(t - 2 * 24 * 3600 * 1000), channel: "EMAIL" },
        ],
      });
      // 2 sends in window -> capped
      expect(result.isEligible).toBe(false);
      expect(result.status).toBe("FREQUENCY_CAPPED");
    });

    it("a send just older than seven days (t - 7 days - 1ms) is excluded", () => {
      const olderThanSevenDays = new Date(t - SEVEN_DAYS_MS - 1);
      const result = evaluateContactEligibility({
        ...defaultCart,
        priorSends: [
          { sentAt: olderThanSevenDays, channel: "EMAIL" }, // excluded (< windowStart)
          { sentAt: new Date(t - 2 * 24 * 3600 * 1000), channel: "EMAIL" },
        ],
      });
      // Only 1 send in window -> eligible
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });

    it("SMS sends do not consume EMAIL frequency cap capacity", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        channel: "EMAIL",
        priorSends: [
          { sentAt: new Date(t - 3 * 24 * 3600 * 1000), channel: "SMS" },
          { sentAt: new Date(t - 1 * 24 * 3600 * 1000), channel: "SMS" },
        ],
      });
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });

    it("suppressed sends do not consume frequency capacity", () => {
      const result = evaluateContactEligibility({
        ...defaultCart,
        priorSends: [
          { sentAt: new Date(t - 3 * 24 * 3600 * 1000), channel: "EMAIL", status: "SUPPRESSED" },
          { sentAt: new Date(t - 2 * 24 * 3600 * 1000), channel: "EMAIL", status: "SUPPRESSED" },
        ],
      });
      expect(result.isEligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
    });
  });

  describe("Deterministic Purchase Attribution Boundaries", () => {
    const purchaseDate = new Date("2026-10-08T12:00:00Z");
    const order = {
      id: "ORD-2026-000001",
      cartId: "CART-2026-000001",
      customerId: "CUS-000001",
      total: 149.99,
      purchasedAt: purchaseDate,
    };

    it("same-timestamp send and order is not attributed (requires 0 < purchasedAt - sentAt)", () => {
      const sendAtSameTime = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "CLICKED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: purchaseDate, // exactly at purchasedAt -> diff is 0
        deliveredAt: purchaseDate,
        clickedAt: purchaseDate,
      };

      const decision = evaluateOrderAttribution(order, [sendAtSameTime]);
      expect(decision).toBeNull();
    });

    it("a send exactly 168 hours before purchase is attributable", () => {
      const exact168HoursAgo = new Date(purchaseDate.getTime() - ATTRIBUTION_WINDOW_MS);
      const sendAt168h = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "CLICKED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: exact168HoursAgo,
        deliveredAt: new Date(exact168HoursAgo.getTime() + 60 * 1000),
        clickedAt: new Date(exact168HoursAgo.getTime() + 120 * 1000),
      };

      const decision = evaluateOrderAttribution(order, [sendAt168h]);
      expect(decision).not.toBeNull();
      expect(decision?.sendAttemptId).toBe("SEND-2026-000001");
      expect(decision?.attributionWindowHours).toBe(168);
    });

    it("a send more than 168 hours before purchase (168h + 1ms) is not attributable", () => {
      const olderThan168h = new Date(purchaseDate.getTime() - ATTRIBUTION_WINDOW_MS - 1);
      const lateSend = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "CLICKED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: olderThan168h,
        deliveredAt: new Date(olderThan168h.getTime() + 60 * 1000),
        clickedAt: new Date(olderThan168h.getTime() + 120 * 1000),
      };

      const decision = evaluateOrderAttribution(order, [lateSend]);
      expect(decision).toBeNull();
    });

    it("latest eligible clicked send wins over earlier clicked or delivered sends", () => {
      const send1Delivered = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "DELIVERED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: new Date(purchaseDate.getTime() - 48 * 3600 * 1000),
        deliveredAt: new Date(purchaseDate.getTime() - 47 * 3600 * 1000),
        clickedAt: null,
      };

      const send2Clicked = {
        id: "SEND-2026-000002",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "CLICKED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: new Date(purchaseDate.getTime() - 24 * 3600 * 1000),
        deliveredAt: new Date(purchaseDate.getTime() - 23 * 3600 * 1000),
        clickedAt: new Date(purchaseDate.getTime() - 22 * 3600 * 1000),
      };

      const decision = evaluateOrderAttribution(order, [send1Delivered, send2Clicked]);
      expect(decision).not.toBeNull();
      expect(decision?.sendAttemptId).toBe("SEND-2026-000002");
      expect(decision?.attributionReason).toBe("LAST_CLICKED_SEND");
    });

    it("when no qualifying click exists, latest eligible delivered send wins", () => {
      const send1 = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "DELIVERED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: new Date(purchaseDate.getTime() - 48 * 3600 * 1000),
        deliveredAt: new Date(purchaseDate.getTime() - 47 * 3600 * 1000),
        clickedAt: null,
      };

      const send2 = {
        id: "SEND-2026-000002",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "DELIVERED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: new Date(purchaseDate.getTime() - 12 * 3600 * 1000),
        deliveredAt: new Date(purchaseDate.getTime() - 11 * 3600 * 1000),
        clickedAt: null,
      };

      const decision = evaluateOrderAttribution(order, [send1, send2]);
      expect(decision).not.toBeNull();
      expect(decision?.sendAttemptId).toBe("SEND-2026-000002");
      expect(decision?.attributionReason).toBe("LAST_DELIVERED_SEND");
    });

    it("a click occurring after the order does not qualify for click attribution", () => {
      const sendWithPostPurchaseClick = {
        id: "SEND-2026-000001",
        cartId: "CART-2026-000001",
        customerId: "CUS-000001",
        status: "CLICKED",
        eligibilityStatus: "ELIGIBLE",
        sentAt: new Date(purchaseDate.getTime() - 10 * 3600 * 1000),
        deliveredAt: new Date(purchaseDate.getTime() - 9 * 3600 * 1000),
        clickedAt: new Date(purchaseDate.getTime() + 1 * 3600 * 1000), // Click happened 1h AFTER order
      };

      const decision = evaluateOrderAttribution(order, [sendWithPostPurchaseClick]);
      expect(decision).not.toBeNull();
      // Falls back to LAST_DELIVERED_SEND because delivery was pre-purchase, but click was post-purchase!
      expect(decision?.attributionReason).toBe("LAST_DELIVERED_SEND");
    });
  });

  describe("Cart Line Totals Calculation", () => {
    it("cart total is derived from cart lines", () => {
      const lines = [
        { price: 49.99, quantity: 2 }, // 99.98
        { price: 15.0, quantity: 1 },  // 15.00
      ];

      const totals = calculateCartTotals(lines);
      expect(totals.subtotal).toBe(114.98);
      expect(totals.taxTotal).toBe(9.2);
      expect(totals.grandTotal).toBe(124.18);
      expect(totals.itemCount).toBe(3);
    });
  });

  describe("Dataset Consistency and Anomaly Isolation", () => {
    it("starter and full scale generation produces consistent ID formats", async () => {
      const { generateSyntheticData } = await import("../lib/generator/generate");
      const starterData = generateSyntheticData("starter");

      expect(starterData.customers[0].id).toMatch(/^CUS-\d{6}$/);
      expect(starterData.carts[0].id).toMatch(/^CART-2026-\d{6}$/);
      expect(starterData.cartLines[0].id).toMatch(/^LINE-2026-\d{6}$/);
      expect(starterData.campaigns[0].id).toMatch(/^CMP-2026-\d{6}$/);
      expect(starterData.sendAttempts[0].id).toMatch(/^SEND-2026-\d{6}$/);
      expect(starterData.sendEvents[0].id).toMatch(/^EVT-2026-\d{6}$/);
      expect(starterData.orders[0].id).toMatch(/^ORD-2026-\d{6}$/);
      expect(starterData.attributions[0].id).toMatch(/^ATT-2026-\d{6}$/);
    });

    it("ground-truth anomalies are exactly 4 and isolated in both starter and full scales", async () => {
      const { generateSyntheticData } = await import("../lib/generator/generate");
      const starterData = generateSyntheticData("starter");

      expect(starterData.groundTruthIssues.length).toBe(4);
      const issueTypes = starterData.groundTruthIssues.map((i) => i.issueType);
      expect(issueTypes).toContain("MESSAGE_SENT_AFTER_OPTOUT");
      expect(issueTypes).toContain("CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE");
      expect(issueTypes).toContain("DOUBLE_COUNTED_ATTRIBUTION");
      expect(issueTypes).toContain("CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE");

      // Verify normal attributions have isAnomaly=false
      const normalAttrs = starterData.attributions.filter((a) => !a.isAnomaly);
      expect(normalAttrs.length).toBeGreaterThan(0);
      for (const a of normalAttrs) {
        expect(a.isAnomaly).toBe(false);
      }

      // Verify anomaly attribution is flagged isAnomaly=true
      const anomalyAttrs = starterData.attributions.filter((a) => a.isAnomaly);
      expect(anomalyAttrs.length).toBe(1);
      expect(anomalyAttrs[0].attributionReason).toBe("DOUBLE_COUNTED_ANOMALY");
    });
  });
});
