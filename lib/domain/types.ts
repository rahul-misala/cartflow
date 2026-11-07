export type Channel = "EMAIL" | "SMS";

export type ConsentStatus = "OPT_IN" | "OPT_OUT";

export type ConsentSource =
  | "CHECKOUT_CHECKBOX"
  | "ACCOUNT_SETTINGS"
  | "SMS_REPLY_STOP"
  | "EMAIL_FOOTER";

export type CartStatus =
  | "ACTIVE"
  | "ABANDONED"
  | "RECOVERED"
  | "CONVERTED_EXTERNAL"
  | "EXPIRED";

export type EligibilityStatus =
  | "ELIGIBLE"
  | "NO_CONSENT"
  | "OPTED_OUT"
  | "CONSENT_EXPIRED"
  | "FREQUENCY_CAPPED"
  | "ALREADY_PURCHASED"
  | "NOT_ABANDONED"
  | "OTHER_SUPPRESSED";

export type SendStatus =
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "FAILED"
  | "SUPPRESSED";

export type SendEventType =
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "FAILED"
  | "SUPPRESSED";

export type OrderStatus = "COMPLETED" | "REFUNDED" | "CANCELLED";

export type AttributionReason =
  | "LAST_CLICKED_SEND"
  | "LAST_DELIVERED_SEND"
  | "DOUBLE_COUNTED_ANOMALY";

export type GroundTruthIssueType =
  | "MESSAGE_SENT_AFTER_OPTOUT"
  | "CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE"
  | "DOUBLE_COUNTED_ATTRIBUTION"
  | "CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface CartLineInput {
  price: number;
  quantity: number;
  title: string;
  sku: string;
}

export interface CartTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  itemCount: number;
}
