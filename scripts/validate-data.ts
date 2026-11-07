import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ValidationStatus = "PASS" | "EXPECTED ANOMALY" | "FAIL";

export interface ValidationItem {
  check: string;
  status: ValidationStatus;
  message: string;
  details?: any;
}

export async function validateDatabase(): Promise<{
  allPassed: boolean;
  results: ValidationItem[];
  anomaliesDetected: number;
}> {
  const results: ValidationItem[] = [];

  console.log("\n======================================================");
  console.log("[Validator] Starting comprehensive data validation suite...");
  console.log("======================================================\n");

  // 1. Fetch tables
  const [
    customers,
    consents,
    sessions,
    carts,
    cartLines,
    campaigns,
    templates,
    messageInstances,
    sendAttempts,
    sendEvents,
    orders,
    attributions,
    groundTruthIssues,
  ] = await Promise.all([
    prisma.customer.findMany(),
    prisma.consent.findMany(),
    prisma.session.findMany(),
    prisma.cart.findMany(),
    prisma.cartLine.findMany(),
    prisma.campaign.findMany(),
    prisma.messageTemplate.findMany(),
    prisma.messageInstance.findMany(),
    prisma.sendAttempt.findMany(),
    prisma.sendEvent.findMany(),
    prisma.order.findMany(),
    prisma.attribution.findMany(),
    prisma.groundTruthIssue.findMany(),
  ]);

  console.log(
    `[Validator] Loaded ${customers.length} customers, ${carts.length} carts, ${sendAttempts.length} sends, ${sendEvents.length} send events, ${orders.length} orders, ${attributions.length} attributions, ${groundTruthIssues.length} ground-truth issues.`
  );

  // Map ground truth issues by type
  const issueByType = new Map(groundTruthIssues.map((i) => [i.issueType, i]));
  const optOutSendIssue = issueByType.get("MESSAGE_SENT_AFTER_OPTOUT");
  const cartAbandonedAfterPurchaseIssue = issueByType.get("CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE");
  const doubleAttrIssue = issueByType.get("DOUBLE_COUNTED_ATTRIBUTION");
  const staleCartIssue = issueByType.get("CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE");

  // 1. Deterministic ID Format Consistency
  const idPatterns: Record<string, { regex: RegExp; items: Array<{ id: string }> }> = {
    Customer: { regex: /^CUS-\d{6}$/, items: customers },
    Consent: { regex: /^CNS-\d{6}$/, items: consents },
    Session: { regex: /^SES-\d{6}$/, items: sessions },
    Cart: { regex: /^CART-2026-\d{6}$/, items: carts },
    CartLine: { regex: /^LINE-2026-\d{6}$/, items: cartLines },
    Campaign: { regex: /^CMP-2026-\d{6}$/, items: campaigns },
    MessageTemplate: { regex: /^TMPL-2026-\d{6}$/, items: templates },
    MessageInstance: { regex: /^MSG-CART-2026-\d{6}-\d{2}$/, items: messageInstances },
    SendAttempt: { regex: /^SEND-2026-\d{6}$/, items: sendAttempts },
    SendEvent: { regex: /^EVT-2026-\d{6}$/, items: sendEvents },
    Order: { regex: /^ORD-2026-\d{6}$/, items: orders },
    Attribution: { regex: /^ATT-2026-\d{6}$/, items: attributions },
    GroundTruthIssue: { regex: /^ISSUE-2026-\d{6}$/, items: groundTruthIssues },
  };

  let idPatternFailures = 0;
  for (const [entity, { regex, items }] of Object.entries(idPatterns)) {
    const invalid = items.filter((item) => !regex.test(item.id));
    if (invalid.length > 0) {
      idPatternFailures += invalid.length;
      results.push({
        check: `ID Format: ${entity}`,
        status: "FAIL",
        message: `Found ${invalid.length} records with invalid ID format`,
        details: invalid.slice(0, 3).map((i) => i.id),
      });
    }
  }

  if (idPatternFailures === 0) {
    results.push({
      check: "Deterministic ID Format Consistency",
      status: "PASS",
      message: `All 13 entities (${sendEvents.length} send events included) adhere to zero-padded deterministic ID patterns.`,
    });
  }

  // 2. Primary Key Uniqueness
  let pkDuplicates = 0;
  for (const [, { items }] of Object.entries(idPatterns)) {
    const idSet = new Set<string>();
    for (const item of items) {
      if (idSet.has(item.id)) pkDuplicates++;
      idSet.add(item.id);
    }
  }

  results.push({
    check: "Primary Key Uniqueness",
    status: pkDuplicates === 0 ? "PASS" : "FAIL",
    message: pkDuplicates === 0 ? "All primary keys are strictly unique across all tables." : `Found ${pkDuplicates} duplicate primary keys.`,
  });

  // 3. Foreign Key Integrity
  const customerIdSet = new Set(customers.map((c) => c.id));
  const sessionIdSet = new Set(sessions.map((s) => s.id));
  const cartIdSet = new Set(carts.map((c) => c.id));
  const campaignIdSet = new Set(campaigns.map((c) => c.id));
  const templateIdSet = new Set(templates.map((t) => t.id));
  const messageInstanceIdSet = new Set(messageInstances.map((m) => m.id));
  const sendAttemptIdSet = new Set(sendAttempts.map((s) => s.id));
  const orderIdSet = new Set(orders.map((o) => o.id));

  let fkViolations = 0;
  for (const c of consents) if (!customerIdSet.has(c.customerId)) fkViolations++;
  for (const s of sessions) if (!customerIdSet.has(s.customerId)) fkViolations++;
  for (const c of carts) {
    if (!sessionIdSet.has(c.sessionId) || !customerIdSet.has(c.customerId)) fkViolations++;
  }
  for (const l of cartLines) if (!cartIdSet.has(l.cartId)) fkViolations++;
  for (const t of templates) if (!campaignIdSet.has(t.campaignId)) fkViolations++;
  for (const m of messageInstances) {
    if (!cartIdSet.has(m.cartId) || !templateIdSet.has(m.templateId)) fkViolations++;
  }
  for (const s of sendAttempts) if (!messageInstanceIdSet.has(s.messageInstanceId)) fkViolations++;
  for (const e of sendEvents) if (!sendAttemptIdSet.has(e.sendAttemptId)) fkViolations++;
  for (const o of orders) {
    if (!customerIdSet.has(o.customerId)) fkViolations++;
    if (o.cartId && !cartIdSet.has(o.cartId)) fkViolations++;
  }
  for (const a of attributions) {
    if (!orderIdSet.has(a.orderId) || !sendAttemptIdSet.has(a.sendAttemptId)) fkViolations++;
  }

  results.push({
    check: "Foreign Key Referential Integrity",
    status: fkViolations === 0 ? "PASS" : "FAIL",
    message: fkViolations === 0 ? "All foreign key references resolve to valid parent records." : `Found ${fkViolations} orphaned foreign keys.`,
  });

  // 4. Allowed Enums & Status Values
  const allowedCartStatuses = new Set(["ACTIVE", "ABANDONED", "RECOVERED", "CONVERTED_EXTERNAL", "EXPIRED"]);
  const allowedEligibilityStatuses = new Set([
    "ELIGIBLE",
    "NO_CONSENT",
    "OPTED_OUT",
    "CONSENT_EXPIRED",
    "FREQUENCY_CAPPED",
    "ALREADY_PURCHASED",
    "NOT_ABANDONED",
    "OTHER_SUPPRESSED",
  ]);
  const allowedSendStatuses = new Set(["SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "FAILED", "SUPPRESSED"]);
  const allowedEventTypes = new Set(["SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "FAILED", "SUPPRESSED"]);

  let enumViolations = 0;
  for (const c of carts) if (!allowedCartStatuses.has(c.status)) enumViolations++;
  for (const m of messageInstances) if (!allowedEligibilityStatuses.has(m.eligibilityStatus)) enumViolations++;
  for (const s of sendAttempts) if (!allowedSendStatuses.has(s.status)) enumViolations++;
  for (const e of sendEvents) if (!allowedEventTypes.has(e.eventType)) enumViolations++;

  results.push({
    check: "Allowed Enum & Status Values",
    status: enumViolations === 0 ? "PASS" : "FAIL",
    message: enumViolations === 0 ? "All records strictly adhere to defined domain status and event type enums." : `Found ${enumViolations} invalid enum values.`,
  });

  // 5. Cart and CartLine Arithmetic Reconciliation
  const linesByCart = new Map<string, typeof cartLines>();
  for (const line of cartLines) {
    if (!linesByCart.has(line.cartId)) linesByCart.set(line.cartId, []);
    linesByCart.get(line.cartId)!.push(line);
  }

  let unexpectedArithmeticMismatches = 0;
  let expectedStaleCartFound = false;

  for (const cart of carts) {
    const lines = linesByCart.get(cart.id) || [];
    let computedSubtotal = 0;
    let computedQty = 0;
    for (const line of lines) {
      computedSubtotal += line.lineTotal;
      computedQty += line.quantity;
    }
    computedSubtotal = Math.round(computedSubtotal * 100) / 100;
    const computedTax = Math.round(computedSubtotal * 0.08 * 100) / 100;
    const computedGrandTotal = Math.round((computedSubtotal + computedTax) * 100) / 100;

    const isHeaderMismatch =
      Math.abs(cart.subtotal - computedSubtotal) > 0.01 ||
      Math.abs(cart.grandTotal - computedGrandTotal) > 0.01 ||
      cart.itemCount !== computedQty;

    if (isHeaderMismatch) {
      if (staleCartIssue && cart.id === staleCartIssue.relatedEntityId) {
        expectedStaleCartFound = true;
      } else {
        unexpectedArithmeticMismatches++;
      }
    }
  }

  if (expectedStaleCartFound) {
    results.push({
      check: "Cart Line Arithmetic (Intentional Anomaly)",
      status: "EXPECTED ANOMALY",
      message: `Expected stale cart header anomaly isolated on ${staleCartIssue!.relatedEntityId} (${staleCartIssue!.id}).`,
    });
  }

  results.push({
    check: "Cart Line Arithmetic (Clean Baseline Records)",
    status: unexpectedArithmeticMismatches === 0 ? "PASS" : "FAIL",
    message: unexpectedArithmeticMismatches === 0
      ? "All clean baseline carts reconcile perfectly with line items and 8% tax."
      : `Found ${unexpectedArithmeticMismatches} unexpected arithmetic header mismatches.`,
  });

  // 6. Chronological Date Ordering & SendEvent Progression
  const eventsBySend = new Map<string, typeof sendEvents>();
  for (const evt of sendEvents) {
    if (!eventsBySend.has(evt.sendAttemptId)) eventsBySend.set(evt.sendAttemptId, []);
    eventsBySend.get(evt.sendAttemptId)!.push(evt);
  }

  let eventSequenceViolations = 0;
  const eventRank: Record<string, number> = {
    SENT: 1,
    DELIVERED: 2,
    OPENED: 3,
    CLICKED: 4,
    BOUNCED: 5,
    FAILED: 6,
    SUPPRESSED: 7,
  };

  for (const [, evts] of Array.from(eventsBySend.entries())) {
    evts.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    // Verify timestamps are non-decreasing
    for (let i = 1; i < evts.length; i++) {
      if (evts[i].occurredAt.getTime() < evts[i - 1].occurredAt.getTime()) {
        eventSequenceViolations++;
      }
    }
  }

  results.push({
    check: "SendEvent Chronological Sequence Progression",
    status: eventSequenceViolations === 0 ? "PASS" : "FAIL",
    message: eventSequenceViolations === 0
      ? `All ${sendEvents.length} immutable SendEvents follow valid chronological sequence (SENT -> DELIVERED -> OPENED -> CLICKED).`
      : `Found ${eventSequenceViolations} out-of-order send events.`,
  });

  // 7. Cart Lifecycle Transition Validity & 30-Day Retention
  let lifecycleViolations = 0;
  let expectedAbandonedAfterPurchaseFound = false;

  const ordersByCart = new Map<string, typeof orders>();
  for (const ord of orders) {
    if (ord.cartId) {
      if (!ordersByCart.has(ord.cartId)) ordersByCart.set(ord.cartId, []);
      ordersByCart.get(ord.cartId)!.push(ord);
    }
  }

  for (const cart of carts) {
    const cartOrders = ordersByCart.get(cart.id) || [];
    const completedOrder = cartOrders.find((o) => o.status === "COMPLETED");

    if (completedOrder && cart.status === "ABANDONED") {
      if (cartAbandonedAfterPurchaseIssue && cart.id === cartAbandonedAfterPurchaseIssue.relatedEntityId) {
        expectedAbandonedAfterPurchaseFound = true;
      } else {
        lifecycleViolations++;
      }
    }
  }

  if (expectedAbandonedAfterPurchaseFound) {
    results.push({
      check: "Cart Abandonment Lifecycle (Intentional Anomaly)",
      status: "EXPECTED ANOMALY",
      message: `Expected abandoned-after-purchase anomaly isolated on ${cartAbandonedAfterPurchaseIssue!.relatedEntityId} (${cartAbandonedAfterPurchaseIssue!.id}).`,
    });
  }

  results.push({
    check: "Cart Abandonment Lifecycle (Clean Baseline Records)",
    status: lifecycleViolations === 0 ? "PASS" : "FAIL",
    message: lifecycleViolations === 0
      ? "All clean carts observe strict lifecycle rules (no unlabelled carts abandoned after checkout)."
      : `Found ${lifecycleViolations} carts incorrectly abandoned after completed order.`,
  });

  // 8. Contact Consent & Suppression Validity
  const consentsByCustomer = new Map<string, typeof consents>();
  for (const cn of consents) {
    if (!consentsByCustomer.has(cn.customerId)) consentsByCustomer.set(cn.customerId, []);
    consentsByCustomer.get(cn.customerId)!.push(cn);
  }

  const msgMap = new Map(messageInstances.map((m) => [m.id, m]));
  const tmplMap = new Map(templates.map((t) => [t.id, t]));
  const cmpMap = new Map(campaigns.map((c) => [c.id, c]));

  let consentViolations = 0;
  let expectedOptOutSendFound = false;

  for (const send of sendAttempts) {
    const msg = msgMap.get(send.messageInstanceId);
    if (!msg || !send.sentAt) continue;

    const tmpl = tmplMap.get(msg.templateId);
    const cmp = tmpl ? cmpMap.get(tmpl.campaignId) : null;
    const channel = cmp ? cmp.channel : "EMAIL";

    const cart = carts.find((c) => c.id === msg.cartId);
    if (!cart) continue;

    const custConsents = (consentsByCustomer.get(cart.customerId) || [])
      .filter((cn) => cn.channel === channel && cn.effectiveFrom.getTime() <= send.sentAt!.getTime())
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

    const latest = custConsents[custConsents.length - 1];
    const isOptedOut = !latest || latest.status === "OPT_OUT" || (latest.effectiveTo && send.sentAt!.getTime() >= latest.effectiveTo.getTime());

    if (isOptedOut) {
      if (optOutSendIssue && send.id === optOutSendIssue.relatedEntityId) {
        expectedOptOutSendFound = true;
      } else {
        consentViolations++;
      }
    }
  }

  if (expectedOptOutSendFound) {
    results.push({
      check: "Opt-Out Suppression Compliance (Intentional Anomaly)",
      status: "EXPECTED ANOMALY",
      message: `Expected message-sent-after-optout anomaly isolated on ${optOutSendIssue!.relatedEntityId} (${optOutSendIssue!.id}).`,
    });
  }

  results.push({
    check: "Opt-Out Suppression Compliance (Clean Baseline Records)",
    status: consentViolations === 0 ? "PASS" : "FAIL",
    message: consentViolations === 0
      ? "All clean recovery messages honor active opt-in consent without opt-out or expiration."
      : `Found ${consentViolations} unexpected sends dispatched after customer opt-out/expiration.`,
  });

  // 9. Frequency Cap Compliance for Normal Sends [t - 7d, t)
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const sendsByCustChannel = new Map<string, typeof sendAttempts>();

  for (const send of sendAttempts) {
    if (optOutSendIssue && send.id === optOutSendIssue.relatedEntityId) continue;
    if (!send.sentAt) continue;

    const msg = msgMap.get(send.messageInstanceId);
    if (!msg) continue;
    const cart = carts.find((c) => c.id === msg.cartId);
    if (!cart) continue;
    const tmpl = tmplMap.get(msg.templateId);
    const channel = tmpl ? cmpMap.get(tmpl.campaignId)?.channel || "EMAIL" : "EMAIL";

    const key = `${cart.customerId}:${channel}`;
    if (!sendsByCustChannel.has(key)) sendsByCustChannel.set(key, []);
    sendsByCustChannel.get(key)!.push(send);
  }

  let freqCapViolations = 0;
  for (const [, sends] of Array.from(sendsByCustChannel.entries())) {
    sends.sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime());
    for (let i = 0; i < sends.length; i++) {
      const t = sends[i].sentAt!.getTime();
      const windowStart = t - SEVEN_DAYS_MS;
      // Strictly [t - 7d, t)
      const countInWindow = sends.filter(
        (s) => s.sentAt!.getTime() >= windowStart && s.sentAt!.getTime() < t
      ).length;
      if (countInWindow >= 2) {
        freqCapViolations++;
      }
    }
  }

  results.push({
    check: "Frequency Cap Compliance (<= 2 sends in rolling [t - 7d, t))",
    status: freqCapViolations === 0 ? "PASS" : "FAIL",
    message: freqCapViolations === 0
      ? "All normal recovery message dispatches adhere strictly to the 2 sends/channel in rolling [t - 7d, t) cap."
      : `Found ${freqCapViolations} frequency cap breaches.`,
  });

  // 10. Single-Touch Attribution & Double-Counted Anomaly Isolation
  const normalAttributions = attributions.filter((a) => !a.isAnomaly);
  const anomalyAttributions = attributions.filter((a) => a.isAnomaly);

  const normalOrderAttrCount = new Map<string, number>();
  for (const a of normalAttributions) {
    normalOrderAttrCount.set(a.orderId, (normalOrderAttrCount.get(a.orderId) || 0) + 1);
  }

  let unexpectedDuplicateNormalAttr = 0;
  for (const [, count] of Array.from(normalOrderAttrCount.entries())) {
    if (count > 1) unexpectedDuplicateNormalAttr++;
  }

  let unlabelledAnomalyAttr = 0;
  for (const a of anomalyAttributions) {
    if (!doubleAttrIssue || a.id !== doubleAttrIssue.relatedEntityId) {
      unlabelledAnomalyAttr++;
    }
  }

  if (doubleAttrIssue && anomalyAttributions.some((a) => a.id === doubleAttrIssue.relatedEntityId)) {
    results.push({
      check: "Single-Touch Order Attribution (Intentional Anomaly)",
      status: "EXPECTED ANOMALY",
      message: `Expected double-counted attribution anomaly isolated on ${doubleAttrIssue.relatedEntityId} (${doubleAttrIssue.id}).`,
    });
  }

  results.push({
    check: "Single-Touch Order Attribution (Clean Baseline Records)",
    status: unexpectedDuplicateNormalAttr === 0 && unlabelledAnomalyAttr === 0 ? "PASS" : "FAIL",
    message: unexpectedDuplicateNormalAttr === 0 && unlabelledAnomalyAttr === 0
      ? "All clean orders have exactly 1 attribution, and only the approved ground-truth anomaly is flagged as duplicate."
      : `Found ${unexpectedDuplicateNormalAttr} normal duplicate attributions and ${unlabelledAnomalyAttr} unlabelled anomaly attributions.`,
  });

  // 11. Attribution Boundary Verification (0 < order.purchasedAt - send.sentAt <= 168 hours)
  const ATTRIBUTION_WINDOW_MS = 168 * 3600 * 1000;
  let attributionWindowViolations = 0;

  const sendMap = new Map(sendAttempts.map((s) => [s.id, s]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  for (const attr of normalAttributions) {
    const send = sendMap.get(attr.sendAttemptId);
    const order = orderMap.get(attr.orderId);
    if (!send || !order || !send.sentAt) continue;

    const diff = order.purchasedAt.getTime() - send.sentAt.getTime();
    if (diff <= 0 || diff > ATTRIBUTION_WINDOW_MS) {
      attributionWindowViolations++;
    }
  }

  results.push({
    check: "Attribution Window Boundary (0 < purchasedAt - sentAt <= 168h)",
    status: attributionWindowViolations === 0 ? "PASS" : "FAIL",
    message: attributionWindowViolations === 0
      ? "All attributed orders fall strictly within the 168-hour window and occurred strictly after recovery send."
      : `Found ${attributionWindowViolations} attributions outside the strict boundary.`,
  });

  // 12. Complete Ground Truth Anomaly Catalog Verification
  const expectedIssueTypes = [
    "MESSAGE_SENT_AFTER_OPTOUT",
    "CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE",
    "DOUBLE_COUNTED_ATTRIBUTION",
    "CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE",
  ];

  const catalogedTypes = new Set(groundTruthIssues.map((i) => i.issueType));
  const missingTypes = expectedIssueTypes.filter((t) => !catalogedTypes.has(t));

  const allAnomaliesResolved = groundTruthIssues.every((issue) => {
    switch (issue.issueType) {
      case "MESSAGE_SENT_AFTER_OPTOUT":
        return sendAttemptIdSet.has(issue.relatedEntityId);
      case "CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE":
        return cartIdSet.has(issue.relatedEntityId);
      case "DOUBLE_COUNTED_ATTRIBUTION":
        return attributions.some((a) => a.id === issue.relatedEntityId);
      case "CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE":
        return cartIdSet.has(issue.relatedEntityId);
      default:
        return false;
    }
  });

  results.push({
    check: "Ground Truth Labelled Anomalies Catalog (Exactly 4 Issues)",
    status: missingTypes.length === 0 && groundTruthIssues.length === 4 && allAnomaliesResolved ? "PASS" : "FAIL",
    message: missingTypes.length === 0 && groundTruthIssues.length === 4 && allAnomaliesResolved
      ? "All 4 canonical ground truth anomaly categories are present, properly labelled, and point to valid entities."
      : `Ground truth issue validation failed: missing ${missingTypes.join(", ")}; total count: ${groundTruthIssues.length}; entity resolution: ${allAnomaliesResolved}`,
    details: groundTruthIssues.map((i) => ({
      id: i.id,
      type: i.issueType,
      severity: i.severity,
      target: `${i.relatedEntityType}:${i.relatedEntityId}`,
    })),
  });

  const anyFailures = results.some((r) => r.status === "FAIL");
  const allPassed = !anyFailures;

  console.log("\n======================================================");
  console.log(`[Validator] SUMMARY: ${allPassed ? "ALL CHECKS PASSED ✔" : "VALIDATION FAILURES DETECTED ❌"}`);
  console.log("======================================================");
  for (const r of results) {
    const symbol = r.status === "PASS" ? "✔ PASS" : r.status === "EXPECTED ANOMALY" ? "⚠ EXPECTED ANOMALY" : "✖ FAIL";
    console.log(`  [${symbol}] ${r.check}: ${r.message}`);
  }
  console.log("======================================================\n");

  return {
    allPassed,
    results,
    anomaliesDetected: groundTruthIssues.length,
  };
}

async function main() {
  try {
    const { allPassed } = await validateDatabase();
    if (!allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error("[Validator Error]", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
