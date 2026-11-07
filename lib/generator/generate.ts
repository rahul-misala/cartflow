import { faker } from "@faker-js/faker";
import {
  FIXED_FAKER_SEED,
  BASE_TIMESTAMP,
  padZero,
  customerId,
  consentId,
  sessionId,
  cartId,
  lineId,
  messageInstanceId,
  sendAttemptId,
  sendEventId,
  orderId,
  attributionId,
  groundTruthIssueId,
  ANOMALIES_DEF,
  CAMPAIGNS_DEF,
  PRODUCTS_CATALOG,
} from "./constants";
import { calculateCartTotals } from "../domain/calculations";
import {
  evaluateContactEligibility,
  PriorSendRecord,
  ConsentRecord,
} from "../domain/eligibility";
import { evaluateOrderAttribution } from "../domain/attribution";
import {
  Channel,
  ConsentStatus,
  ConsentSource,
  CartStatus,
  SendStatus,
  SendEventType,
  OrderStatus,
  GroundTruthIssueType,
  IssueSeverity,
} from "../domain/types";

export type Scale = "starter" | "full";

export interface ScaleConfig {
  scale: Scale;
  totalCarts: number;
  abandonedCarts: number;
  targetSendAttempts: number;
  customerCount: number;
}

export const SCALE_CONFIGS: Record<Scale, ScaleConfig> = {
  starter: {
    scale: "starter",
    totalCarts: 1000,
    abandonedCarts: 400,
    targetSendAttempts: 200,
    customerCount: 650,
  },
  full: {
    scale: "full",
    totalCarts: 50000,
    abandonedCarts: 20000,
    targetSendAttempts: 10000,
    customerCount: 30000,
  },
};

export interface GeneratedDataset {
  customers: any[];
  consents: any[];
  sessions: any[];
  carts: any[];
  cartLines: any[];
  campaigns: any[];
  messageTemplates: any[];
  messageInstances: any[];
  sendAttempts: any[];
  sendEvents: any[];
  orders: any[];
  attributions: any[];
  groundTruthIssues: any[];
}

export function generateSyntheticData(scale: Scale = "starter"): GeneratedDataset {
  faker.seed(FIXED_FAKER_SEED);

  const config = SCALE_CONFIGS[scale];
  const baseTimeMs = BASE_TIMESTAMP.getTime();

  // 1. Campaigns & Message Templates
  const campaigns: any[] = [];
  const messageTemplates: any[] = [];

  for (const cmp of CAMPAIGNS_DEF) {
    campaigns.push({
      id: cmp.id,
      name: cmp.name,
      channel: cmp.channel,
      description: cmp.description,
      triggerDelayMinutes: cmp.triggerDelayMinutes,
      isActive: cmp.isActive,
      createdAt: new Date(baseTimeMs),
      updatedAt: new Date(baseTimeMs),
    });

    for (const tmpl of cmp.templates) {
      messageTemplates.push({
        id: tmpl.id,
        campaignId: cmp.id,
        variant: tmpl.variant,
        subject: tmpl.subject,
        body: tmpl.body,
        offerDiscountPercent: tmpl.offerDiscountPercent,
        createdAt: new Date(baseTimeMs),
        updatedAt: new Date(baseTimeMs),
      });
    }
  }

  // 2. Customers & Consents
  const customers: any[] = [];
  const consents: any[] = [];
  let consentCounter = 0;

  for (let i = 1; i <= config.customerCount; i++) {
    const cid = customerId(i);
    // Customers registered over first 8 days
    const createdOffsetHours = (i * 17) % (8 * 24);
    const createdAt = new Date(baseTimeMs + createdOffsetHours * 3600 * 1000);

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@example.com`.replace(/[^a-z0-9.@]/g, "");
    const phone = `+1${faker.string.numeric(10)}`;

    customers.push({
      id: cid,
      email,
      phone,
      firstName,
      lastName,
      createdAt,
      updatedAt: createdAt,
    });

    // Special deterministic assignment for Customer #8 to guarantee opt-out anomaly target in both scales:
    if (i === 8) {
      consentCounter++;
      const emailConsentFrom = new Date(createdAt.getTime() + 1000);
      const optOutTime = new Date(emailConsentFrom.getTime() + 2 * 24 * 3600 * 1000); // Opts out 2 days later

      consents.push({
        id: consentId(consentCounter),
        customerId: cid,
        channel: "EMAIL",
        status: "OPT_IN",
        source: "CHECKOUT_CHECKBOX",
        effectiveFrom: emailConsentFrom,
        effectiveTo: optOutTime,
        createdAt: emailConsentFrom,
      });

      consentCounter++;
      consents.push({
        id: consentId(consentCounter),
        customerId: cid,
        channel: "EMAIL",
        status: "OPT_OUT",
        source: "EMAIL_FOOTER",
        effectiveFrom: optOutTime,
        effectiveTo: null,
        createdAt: optOutTime,
      });
    } else {
      // Email Consent
      // 85% initial opt-in
      const hasEmailConsent = (i * 7) % 100 < 85;
      if (hasEmailConsent) {
        consentCounter++;
        const emailConsentFrom = new Date(createdAt.getTime() + 1000);

        // 5% have expired consent (CONSENT_EXPIRED outcome): opt-in with effectiveTo in past
        const hasExpiredConsent = (i * 23) % 100 < 5;
        // 8% withdraw consent later (OPT_OUT)
        const willOptOut = !hasExpiredConsent && (i * 13) % 100 < 8;

        let effectiveTo: Date | null = null;
        if (hasExpiredConsent) {
          effectiveTo = new Date(emailConsentFrom.getTime() + 2 * 24 * 3600 * 1000); // expired after 2 days
        } else if (willOptOut) {
          effectiveTo = new Date(emailConsentFrom.getTime() + 3 * 24 * 3600 * 1000);
        }

        consents.push({
          id: consentId(consentCounter),
          customerId: cid,
          channel: "EMAIL",
          status: "OPT_IN",
          source: "CHECKOUT_CHECKBOX",
          effectiveFrom: emailConsentFrom,
          effectiveTo,
          createdAt: emailConsentFrom,
        });

        if (willOptOut && effectiveTo) {
          consentCounter++;
          consents.push({
            id: consentId(consentCounter),
            customerId: cid,
            channel: "EMAIL",
            status: "OPT_OUT",
            source: "EMAIL_FOOTER",
            effectiveFrom: effectiveTo,
            effectiveTo: null,
            createdAt: effectiveTo,
          });
        }
      }
    }

    // SMS Consent (60% initial opt-in)
    const hasSmsConsent = (i * 11) % 100 < 60;
    if (hasSmsConsent) {
      consentCounter++;
      const smsConsentFrom = new Date(createdAt.getTime() + 2000);
      const willSmsOptOut = (i * 19) % 100 < 10;
      const smsOptOutTime = willSmsOptOut
        ? new Date(smsConsentFrom.getTime() + 2 * 24 * 3600 * 1000)
        : null;

      consents.push({
        id: consentId(consentCounter),
        customerId: cid,
        channel: "SMS",
        status: "OPT_IN",
        source: "CHECKOUT_CHECKBOX",
        effectiveFrom: smsConsentFrom,
        effectiveTo: smsOptOutTime,
        createdAt: smsConsentFrom,
      });

      if (willSmsOptOut && smsOptOutTime) {
        consentCounter++;
        consents.push({
          id: consentId(consentCounter),
          customerId: cid,
          channel: "SMS",
          status: "OPT_OUT",
          source: "SMS_REPLY_STOP",
          effectiveFrom: smsOptOutTime,
          effectiveTo: null,
          createdAt: smsOptOutTime,
        });
      }
    }
  }

  // Pre-index consents by customer
  const consentsByCustomer = new Map<string, ConsentRecord[]>();
  for (const c of consents) {
    if (!consentsByCustomer.has(c.customerId)) {
      consentsByCustomer.set(c.customerId, []);
    }
    consentsByCustomer.get(c.customerId)!.push(c);
  }

  // 3. Sessions & Carts
  const deviceTypes = ["DESKTOP", "MOBILE", "TABLET"];
  const browsers = ["CHROME", "SAFARI", "FIREFOX", "EDGE"];

  const sessions: any[] = [];
  const carts: any[] = [];
  const cartLines: any[] = [];
  let lineCounter = 0;

  for (let cartIdx = 1; cartIdx <= config.totalCarts; cartIdx++) {
    const cId = cartId(cartIdx);
    const sId = sessionId(cartIdx);

    // Explicit assignment: Cart #8 is assigned to Customer #8 for the anomaly
    const custIdx = cartIdx === 8 ? 8 : ((cartIdx * 31) % config.customerCount) + 1;
    const cust = customers[custIdx - 1];

    const device = deviceTypes[(cartIdx * 3) % deviceTypes.length];
    const browser = browsers[(cartIdx * 7) % browsers.length];
    const ip = `192.168.${(cartIdx * 5) % 254 + 1}.${(cartIdx * 11) % 254 + 1}`;

    // Session starts after customer creation
    const sessionOffsetHours = cartIdx === 8 ? 60 : ((cartIdx * 29) % (10 * 24)) + 4; // Cart 8 starts 60h after cust creation (after opt-out)
    const sessionStartedAt = new Date(cust.createdAt.getTime() + sessionOffsetHours * 3600 * 1000);
    const sessionEndedAt = new Date(sessionStartedAt.getTime() + 45 * 60 * 1000);

    sessions.push({
      id: sId,
      customerId: cust.id,
      deviceType: device,
      browser,
      ipAddress: ip,
      startedAt: sessionStartedAt,
      endedAt: sessionEndedAt,
      createdAt: sessionStartedAt,
    });

    // Cart lines (1 to 4 items)
    const lineCount = ((cartIdx * 7) % 4) + 1;
    const currentLines: any[] = [];

    for (let l = 0; l < lineCount; l++) {
      lineCounter++;
      const product = PRODUCTS_CATALOG[(cartIdx + l * 5) % PRODUCTS_CATALOG.length];
      const quantity = ((cartIdx + l) % 3) + 1;
      const lineTotal = Math.round(product.price * quantity * 100) / 100;

      const lineRecord = {
        id: lineId(lineCounter),
        cartId: cId,
        sku: product.sku,
        title: product.title,
        price: product.price,
        quantity,
        lineTotal,
        createdAt: sessionStartedAt,
        updatedAt: sessionStartedAt,
      };

      currentLines.push(lineRecord);
      cartLines.push(lineRecord);
    }

    const totals = calculateCartTotals(currentLines);

    // Cart Status assignment:
    const isAbandonedTarget = cartIdx <= config.abandonedCarts;
    let initialStatus: CartStatus = "ACTIVE";
    let lastActivityAt = new Date(sessionStartedAt.getTime() + 25 * 60 * 1000);
    let abandonedAt: Date | null = null;

    if (isAbandonedTarget) {
      initialStatus = "ABANDONED";
      abandonedAt = new Date(lastActivityAt.getTime() + 60 * 60 * 1000);
    } else {
      const remCategory = cartIdx % 10;
      if (remCategory < 5) {
        initialStatus = "ACTIVE";
      } else if (remCategory < 8) {
        initialStatus = "CONVERTED_EXTERNAL";
      } else {
        // 30-day fixed expiration policy
        initialStatus = "EXPIRED";
        lastActivityAt = new Date(sessionStartedAt.getTime() - 31 * 24 * 3600 * 1000);
      }
    }

    carts.push({
      id: cId,
      sessionId: sId,
      customerId: cust.id,
      status: initialStatus,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      currency: "USD",
      itemCount: totals.itemCount,
      lastActivityAt,
      abandonedAt,
      recoveredAt: null,
      createdAt: sessionStartedAt,
      updatedAt: abandonedAt || lastActivityAt,
    });
  }

  // Pre-index carts
  const cartMap = new Map<string, any>();
  for (const c of carts) {
    cartMap.set(c.id, c);
  }

  // 4. Message Instances, Send Attempts, and Send Events
  const messageInstances: any[] = [];
  const sendAttempts: any[] = [];
  const sendEvents: any[] = [];
  const orders: any[] = [];
  const attributions: any[] = [];

  let sendCounter = 0;
  let eventCounter = 0;
  let orderCounter = 0;
  let attributionCounter = 0;

  // Track customer channel sends for rolling 7-day frequency capping
  const customerChannelSends = new Map<string, PriorSendRecord[]>();

  // Helper to add send events
  function addSendEvent(sendAttemptIdStr: string, eventType: SendEventType, occurredAt: Date, metadata?: string) {
    eventCounter++;
    sendEvents.push({
      id: sendEventId(eventCounter),
      sendAttemptId: sendAttemptIdStr,
      eventType,
      occurredAt,
      metadata: metadata || null,
      createdAt: occurredAt,
    });
  }

  // Process abandoned carts to generate message instances and sends
  for (let cartIdx = 1; cartIdx <= config.abandonedCarts; cartIdx++) {
    const c = carts[cartIdx - 1];
    const customer = customers.find((cu) => cu.id === c.customerId)!;
    const custConsents = consentsByCustomer.get(c.customerId) || [];

    // Deterministic A/B variant assignment based on stable hash of cartId modulo 2:
    const variantIdx = cartIdx % 2 === 0 ? 1 : 0; // 0 -> Variant A, 1 -> Variant B

    const campaignsToEvaluate = [
      { cmp: CAMPAIGNS_DEF[0], template: CAMPAIGNS_DEF[0].templates[variantIdx] }, // Email Reminder (60m)
      { cmp: CAMPAIGNS_DEF[1], template: CAMPAIGNS_DEF[1].templates[variantIdx] }, // SMS Reminder (120m)
      { cmp: CAMPAIGNS_DEF[2], template: CAMPAIGNS_DEF[2].templates[variantIdx] }, // Email Discount (1440m)
    ];

    let instanceIdx = 0;
    for (const evalDef of campaignsToEvaluate) {
      instanceIdx++;
      const cmp = evalDef.cmp;
      const tmpl = evalDef.template;
      const scheduledAt = new Date(c.abandonedAt!.getTime() + cmp.triggerDelayMinutes * 60 * 1000);

      // Check if cart has already converted before this scheduled send
      const hasCompletedPurchase = c.status === "RECOVERED" && c.recoveredAt && c.recoveredAt <= scheduledAt;

      // Prior sends for this customer
      const prior = customerChannelSends.get(customer.id) || [];

      // Evaluate eligibility using pure domain function
      const eligibility = evaluateContactEligibility({
        cartId: c.id,
        cartStatus: hasCompletedPurchase ? "RECOVERED" : c.status,
        hasCompletedPurchase: Boolean(hasCompletedPurchase),
        channel: cmp.channel as Channel,
        proposedSendTime: scheduledAt,
        consents: custConsents,
        priorSends: prior,
      });

      const mInstId = messageInstanceId(c.id, instanceIdx);
      const mInst = {
        id: mInstId,
        cartId: c.id,
        templateId: tmpl.id,
        scheduledAt,
        eligibilityStatus: eligibility.status,
        suppressionReason: eligibility.suppressionReason,
        evaluatedAt: scheduledAt,
        createdAt: c.abandonedAt!,
        updatedAt: scheduledAt,
      };

      messageInstances.push(mInst);

      // If eligible and within target send attempt count, dispatch SendAttempt
      if (eligibility.isEligible && sendCounter < config.targetSendAttempts) {
        sendCounter++;
        const sAttemptId = sendAttemptId(sendCounter);

        // Record this dispatched send for frequency capping
        prior.push({
          channel: cmp.channel,
          sentAt: scheduledAt,
          status: "SENT",
        });
        customerChannelSends.set(customer.id, prior);

        // 1. Initial Send Event: SENT
        addSendEvent(sAttemptId, "SENT", scheduledAt);

        // Simulate delivery lifecycle outcomes
        const roll = (sendCounter * 19) % 100;
        let sendStatus: SendStatus = "SENT";
        let deliveredAt: Date | null = null;
        let openedAt: Date | null = null;
        let clickedAt: Date | null = null;
        let failedReason: string | null = null;

        if (roll < 3) {
          sendStatus = "BOUNCED";
          failedReason = "550 5.1.1 User unknown or mailbox unavailable";
          addSendEvent(sAttemptId, "BOUNCED", new Date(scheduledAt.getTime() + 15 * 1000), failedReason);
        } else if (roll < 5) {
          sendStatus = "FAILED";
          failedReason = "421 4.4.2 Gateway connection timeout";
          addSendEvent(sAttemptId, "FAILED", new Date(scheduledAt.getTime() + 30 * 1000), failedReason);
        } else {
          // Delivered
          deliveredAt = new Date(scheduledAt.getTime() + 45 * 1000);
          sendStatus = "DELIVERED";
          addSendEvent(sAttemptId, "DELIVERED", deliveredAt);

          if (roll < 60) {
            // Opened
            openedAt = new Date(deliveredAt.getTime() + 8 * 60 * 1000);
            sendStatus = "OPENED";
            addSendEvent(sAttemptId, "OPENED", openedAt);

            if (roll < 25) {
              // Clicked
              clickedAt = new Date(openedAt.getTime() + 4 * 60 * 1000);
              sendStatus = "CLICKED";
              addSendEvent(sAttemptId, "CLICKED", clickedAt);
            }
          } else if (cmp.channel === "SMS" && roll < 75) {
            // SMS direct click
            clickedAt = new Date(deliveredAt.getTime() + 5 * 60 * 1000);
            sendStatus = "CLICKED";
            addSendEvent(sAttemptId, "CLICKED", clickedAt);
          }
        }

        const sendRecord = {
          id: sAttemptId,
          messageInstanceId: mInstId,
          status: sendStatus,
          sentAt: scheduledAt,
          deliveredAt,
          openedAt,
          clickedAt,
          failedReason,
          createdAt: scheduledAt,
          updatedAt: clickedAt || openedAt || deliveredAt || scheduledAt,
        };

        sendAttempts.push(sendRecord);

        // Simulate Recovery Conversion:
        const willRecover =
          (sendStatus === "CLICKED" && ((sendCounter * 11) % 100 < 70)) ||
          ((sendStatus === "DELIVERED" || sendStatus === "OPENED") && ((sendCounter * 13) % 100 < 15));

        if (willRecover && c.status === "ABANDONED") {
          orderCounter++;
          const ordId = orderId(orderCounter);
          const purchasedAt = new Date(
            (clickedAt || deliveredAt || scheduledAt).getTime() + 35 * 60 * 1000
          );

          // Update cart to RECOVERED
          c.status = "RECOVERED";
          c.recoveredAt = purchasedAt;
          c.updatedAt = purchasedAt;

          const orderRecord = {
            id: ordId,
            cartId: c.id,
            customerId: customer.id,
            orderNumber: `ON-2026-${padZero(orderCounter, 6)}`,
            subtotal: c.subtotal,
            taxTotal: c.taxTotal,
            total: c.grandTotal,
            currency: "USD",
            status: "COMPLETED",
            purchasedAt,
            createdAt: purchasedAt,
            updatedAt: purchasedAt,
          };
          orders.push(orderRecord);

          // Attribute order deterministically
          const candidateSendAttempts = [
            {
              id: sendRecord.id,
              cartId: c.id,
              customerId: customer.id,
              status: sendRecord.status,
              eligibilityStatus: "ELIGIBLE",
              sentAt: sendRecord.sentAt,
              deliveredAt: sendRecord.deliveredAt,
              clickedAt: sendRecord.clickedAt,
            },
          ];

          const attrDecision = evaluateOrderAttribution(
            {
              id: orderRecord.id,
              cartId: c.id,
              customerId: customer.id,
              total: orderRecord.total,
              purchasedAt: orderRecord.purchasedAt,
            },
            candidateSendAttempts
          );

          if (attrDecision) {
            attributionCounter++;
            attributions.push({
              id: attributionId(attributionCounter),
              orderId: ordId,
              sendAttemptId: attrDecision.sendAttemptId,
              attributionReason: attrDecision.attributionReason,
              attributionWindowHours: attrDecision.attributionWindowHours,
              attributedRevenue: attrDecision.attributedRevenue,
              attributedAt: purchasedAt,
              isAnomaly: false,
              createdAt: purchasedAt,
            });
          }
        }
      }
    }
  }

  // Also generate organic converted orders for non-abandoned / converted_external carts
  const convertedExternalCarts = carts.filter((c) => c.status === "CONVERTED_EXTERNAL");
  for (const c of convertedExternalCarts) {
    orderCounter++;
    const ordId = orderId(orderCounter);
    const purchasedAt = new Date(c.lastActivityAt.getTime() + 15 * 60 * 1000);
    orders.push({
      id: ordId,
      cartId: c.id,
      customerId: c.customerId,
      orderNumber: `ON-2026-${padZero(orderCounter, 6)}`,
      subtotal: c.subtotal,
      taxTotal: c.taxTotal,
      total: c.grandTotal,
      currency: "USD",
      status: "COMPLETED",
      purchasedAt,
      createdAt: purchasedAt,
      updatedAt: purchasedAt,
    });
  }

  // 5. Intentional Labelled Anomalies (Ground Truth Issues)
  // EXACTLY FOUR CANONICAL ANOMALIES in both STARTER and FULL scales:
  const groundTruthIssues: any[] = [];

  // Anomaly 1: MESSAGE_SENT_AFTER_OPTOUT
  // Target: Cart #8 and Customer #8 (who opted out on EMAIL at createdAt + 2 days)
  const cust8 = customers[7]; // CUS-000008
  const cart8 = carts[7]; // CART-2026-000008
  const optOutRec = consents.find((cn) => cn.customerId === cust8.id && cn.status === "OPT_OUT" && cn.channel === "EMAIL")!;
  const anomalySendTime = new Date(optOutRec.effectiveFrom.getTime() + 4 * 3600 * 1000); // 4h after opt-out

  sendCounter++;
  const optOutSendId = sendAttemptId(sendCounter);

  // Find or use message instance for Cart #8
  const cart8Msg = messageInstances.find((m) => m.cartId === cart8.id) || messageInstances[0];

  sendAttempts.push({
    id: optOutSendId,
    messageInstanceId: cart8Msg.id,
    status: "SENT",
    sentAt: anomalySendTime,
    deliveredAt: new Date(anomalySendTime.getTime() + 30 * 1000),
    openedAt: null,
    clickedAt: null,
    failedReason: null,
    createdAt: anomalySendTime,
    updatedAt: anomalySendTime,
  });

  addSendEvent(optOutSendId, "SENT", anomalySendTime);
  addSendEvent(optOutSendId, "DELIVERED", new Date(anomalySendTime.getTime() + 30 * 1000));

  groundTruthIssues.push({
    id: ANOMALIES_DEF.OPT_OUT_VIOLATION.issueId,
    issueType: ANOMALIES_DEF.OPT_OUT_VIOLATION.issueType,
    severity: ANOMALIES_DEF.OPT_OUT_VIOLATION.severity,
    relatedEntityType: ANOMALIES_DEF.OPT_OUT_VIOLATION.relatedEntityType,
    relatedEntityId: optOutSendId,
    expectedDecision: "SUPPRESSED with OPTED_OUT",
    observedState: `Dispatched SENT at ${anomalySendTime.toISOString()} after customer opted out at ${optOutRec.effectiveFrom.toISOString()}`,
    description: "Recovery email dispatched despite active opt-out record due to asynchronous preference sync race condition.",
    createdAt: anomalySendTime,
  });

  // Anomaly 2: CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE
  // Target: First completed order's cart
  const anomalyOrder = orders.find((o) => o.cartId !== null)!;
  const targetCart = cartMap.get(anomalyOrder.cartId!)!;
  targetCart.status = "ABANDONED";
  targetCart.abandonedAt = new Date(anomalyOrder.purchasedAt.getTime() + 2 * 3600 * 1000);

  groundTruthIssues.push({
    id: ANOMALIES_DEF.ABANDONED_AFTER_PURCHASE.issueId,
    issueType: ANOMALIES_DEF.ABANDONED_AFTER_PURCHASE.issueType,
    severity: ANOMALIES_DEF.ABANDONED_AFTER_PURCHASE.severity,
    relatedEntityType: ANOMALIES_DEF.ABANDONED_AFTER_PURCHASE.relatedEntityType,
    relatedEntityId: targetCart.id,
    expectedDecision: "Cart state CONVERTED_EXTERNAL / RECOVERED; cannot be marked ABANDONED after completed checkout",
    observedState: `Cart status is ABANDONED with abandonedAt ${targetCart.abandonedAt.toISOString()} despite order ${anomalyOrder.id} completed at ${anomalyOrder.purchasedAt.toISOString()}`,
    description: "Late order notification webhook failed, causing cart lifecycle cron to erroneously flag paid cart as abandoned.",
    createdAt: targetCart.abandonedAt,
  });

  // Anomaly 3: DOUBLE_COUNTED_ATTRIBUTION
  // Target: Duplicate attribution for the first attributed order
  const normalAttribution = attributions[0];
  const secondSend = sendAttempts.find((s) => s.id !== normalAttribution.sendAttemptId && s.status === "DELIVERED") || sendAttempts[1];

  attributionCounter++;
  const secondAttrId = attributionId(attributionCounter);
  const doubleAttr = {
    id: secondAttrId,
    orderId: normalAttribution.orderId,
    sendAttemptId: secondSend.id,
    attributionReason: "DOUBLE_COUNTED_ANOMALY",
    attributionWindowHours: normalAttribution.attributionWindowHours + 12,
    attributedRevenue: normalAttribution.attributedRevenue,
    attributedAt: new Date(normalAttribution.attributedAt.getTime() + 60 * 1000),
    isAnomaly: true,
    createdAt: new Date(normalAttribution.attributedAt.getTime() + 60 * 1000),
  };
  attributions.push(doubleAttr);

  groundTruthIssues.push({
    id: ANOMALIES_DEF.DOUBLE_COUNTED_ATTRIBUTION.issueId,
    issueType: ANOMALIES_DEF.DOUBLE_COUNTED_ATTRIBUTION.issueType,
    severity: ANOMALIES_DEF.DOUBLE_COUNTED_ATTRIBUTION.severity,
    relatedEntityType: ANOMALIES_DEF.DOUBLE_COUNTED_ATTRIBUTION.relatedEntityType,
    relatedEntityId: secondAttrId,
    expectedDecision: "Strict single-touch attribution; exactly one send credited per order",
    observedState: `Order ${normalAttribution.orderId} has 2 attribution records (${normalAttribution.id} and ${secondAttrId})`,
    description: "Concurrent attribution pipeline jobs processed SMS and Email campaigns simultaneously without distributed locking.",
    createdAt: doubleAttr.createdAt,
  });

  // Anomaly 4: CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE
  // Target: Cart #1 (or first cart)
  const staleCart = carts[0];
  const cartLinesForStale = cartLines.filter((l) => l.cartId === staleCart.id);
  const lineToUpdate = cartLinesForStale[0];
  const oldQty = lineToUpdate.quantity;
  lineToUpdate.quantity = oldQty + 3;
  lineToUpdate.lineTotal = Math.round(lineToUpdate.price * lineToUpdate.quantity * 100) / 100;
  // Keep staleCart.grandTotal and subtotal unmodified
  const expectedTotals = calculateCartTotals(cartLinesForStale);

  groundTruthIssues.push({
    id: ANOMALIES_DEF.STALE_CART_TOTAL.issueId,
    issueType: ANOMALIES_DEF.STALE_CART_TOTAL.issueType,
    severity: ANOMALIES_DEF.STALE_CART_TOTAL.severity,
    relatedEntityType: ANOMALIES_DEF.STALE_CART_TOTAL.relatedEntityType,
    relatedEntityId: staleCart.id,
    expectedDecision: `Header grandTotal should be $${expectedTotals.grandTotal.toFixed(2)} based on line items`,
    observedState: `Header grandTotal is stale at $${staleCart.grandTotal.toFixed(2)} (delta: $${(expectedTotals.grandTotal - staleCart.grandTotal).toFixed(2)})`,
    description: "Cart line quantity was incremented via direct REST patch bypassing the cart total recalculation trigger.",
    createdAt: new Date(staleCart.lastActivityAt.getTime() + 5 * 60 * 1000),
  });

  return {
    customers,
    consents,
    sessions,
    carts,
    cartLines,
    campaigns,
    messageTemplates,
    messageInstances,
    sendAttempts,
    sendEvents,
    orders,
    attributions,
    groundTruthIssues,
  };
}
