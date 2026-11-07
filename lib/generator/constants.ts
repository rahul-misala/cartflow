export const FIXED_FAKER_SEED = 20261022;
export const BASE_TIMESTAMP = new Date("2026-10-01T00:00:00Z");

export function padZero(num: number, length: number): string {
  return num.toString().padStart(length, "0");
}

export function customerId(n: number): string {
  return `CUS-${padZero(n, 6)}`;
}

export function consentId(n: number): string {
  return `CNS-${padZero(n, 6)}`;
}

export function sessionId(n: number): string {
  return `SES-${padZero(n, 6)}`;
}

export function cartId(n: number): string {
  return `CART-2026-${padZero(n, 6)}`;
}

export function lineId(n: number): string {
  return `LINE-2026-${padZero(n, 6)}`;
}

export function campaignId(n: number): string {
  return `CMP-2026-${padZero(n, 6)}`;
}

export function templateId(n: number): string {
  return `TMPL-2026-${padZero(n, 6)}`;
}

export function messageInstanceId(cartIdStr: string, index: number): string {
  return `MSG-${cartIdStr}-${padZero(index, 2)}`;
}

export function sendAttemptId(n: number): string {
  return `SEND-2026-${padZero(n, 6)}`;
}

export function sendEventId(n: number): string {
  return `EVT-2026-${padZero(n, 6)}`;
}

export function orderId(n: number): string {
  return `ORD-2026-${padZero(n, 6)}`;
}

export function attributionId(n: number): string {
  return `ATT-2026-${padZero(n, 6)}`;
}

export function groundTruthIssueId(n: number): string {
  return `ISSUE-2026-${padZero(n, 6)}`;
}

export const ANOMALIES_DEF = {
  OPT_OUT_VIOLATION: {
    issueId: "ISSUE-2026-000001",
    issueType: "MESSAGE_SENT_AFTER_OPTOUT" as const,
    severity: "CRITICAL" as const,
    relatedEntityType: "SEND_ATTEMPT" as const,
  },
  ABANDONED_AFTER_PURCHASE: {
    issueId: "ISSUE-2026-000002",
    issueType: "CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE" as const,
    severity: "HIGH" as const,
    relatedEntityType: "CART" as const,
  },
  DOUBLE_COUNTED_ATTRIBUTION: {
    issueId: "ISSUE-2026-000003",
    issueType: "DOUBLE_COUNTED_ATTRIBUTION" as const,
    severity: "CRITICAL" as const,
    relatedEntityType: "ATTRIBUTION" as const,
  },
  STALE_CART_TOTAL: {
    issueId: "ISSUE-2026-000004",
    issueType: "CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE" as const,
    severity: "MEDIUM" as const,
    relatedEntityType: "CART" as const,
  },
};

export const CAMPAIGNS_DEF = [
  {
    id: campaignId(1),
    name: "Email Reminder",
    channel: "EMAIL",
    description: "First-touch recovery reminder for high-intent shoppers within 1 hour.",
    triggerDelayMinutes: 60,
    isActive: true,
    templates: [
      {
        id: templateId(1),
        variant: "A",
        subject: "Items left in your cart — finish checking out",
        body: "Hi {{firstName}}, we saved your CartFlow cart! Return now to complete your order before items sell out.",
        offerDiscountPercent: 0,
      },
      {
        id: templateId(2),
        variant: "B",
        subject: "Still thinking about it? Your items are reserved",
        body: "Hey {{firstName}}, your favorite items are waiting in your cart. Checkout is quick and secure.",
        offerDiscountPercent: 0,
      },
    ],
  },
  {
    id: campaignId(2),
    name: "SMS Reminder",
    channel: "SMS",
    description: "Mobile conversational nudge sent 2 hours post-abandonment with direct checkout link.",
    triggerDelayMinutes: 120,
    isActive: true,
    templates: [
      {
        id: templateId(3),
        variant: "A",
        subject: null,
        body: "Hi {{firstName}}, you left items in your cart. Tap to resume your order: https://cartflow.local/resume/{{cartId}}",
        offerDiscountPercent: 0,
      },
      {
        id: templateId(4),
        variant: "B",
        subject: null,
        body: "CartFlow Alert: Your bag is saved! Tap to complete checkout now: https://cartflow.local/resume/{{cartId}}",
        offerDiscountPercent: 0,
      },
    ],
  },
  {
    id: campaignId(3),
    name: "Email Discount Recovery",
    channel: "EMAIL",
    description: "Incentivized 24-hour winback recovery offering 10% to 15% discount.",
    triggerDelayMinutes: 1440,
    isActive: true,
    templates: [
      {
        id: templateId(5),
        variant: "A",
        subject: "Take 10% off your CartFlow order today!",
        body: "Hi {{firstName}}, here is an exclusive 10% code: SAVE10. Apply at checkout within 48 hours.",
        offerDiscountPercent: 10,
      },
      {
        id: templateId(6),
        variant: "B",
        subject: "Special offer: 15% off if you complete your order now",
        body: "Hi {{firstName}}, we want you back! Enjoy 15% off with code RECOVER15. Tap to shop your reserved cart.",
        offerDiscountPercent: 15,
      },
    ],
  },
];

export const PRODUCTS_CATALOG = [
  { sku: "SKU-TECH-0101", title: "Wireless Noise-Canceling Headphones", price: 199.99 },
  { sku: "SKU-TECH-0102", title: "Ergonomic Mechanical Keyboard", price: 129.5 },
  { sku: "SKU-TECH-0103", title: "Ultra-Precision Optical Mouse", price: 59.99 },
  { sku: "SKU-TECH-0104", title: "USB-C Multiport Docking Station", price: 89.0 },
  { sku: "SKU-HOME-0201", title: "Pour-Over Coffee Dripper Kit", price: 42.0 },
  { sku: "SKU-HOME-0202", title: "Double-Walled Thermal Travel Mug", price: 28.5 },
  { sku: "SKU-HOME-0203", title: "Smart Ambient LED Desk Lamp", price: 74.95 },
  { sku: "SKU-WEAR-0301", title: "Merino Wool Everyday Hoodie", price: 110.0 },
  { sku: "SKU-WEAR-0302", title: "Water-Resistant Commuter Backpack", price: 135.0 },
  { sku: "SKU-WEAR-0303", title: "Seamless Performance Athletic Socks (3-Pack)", price: 24.0 },
  { sku: "SKU-FIT-0401", title: "High-Density Foam Roller", price: 32.5 },
  { sku: "SKU-FIT-0402", title: "Adjustable Resistance Band Set", price: 29.99 },
];
