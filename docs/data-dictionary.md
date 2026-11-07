# Data Dictionary: Cart Recovery Control Center

This document specifies the entity schemas, field definitions, data types, constraints, and derivation rules for all tables in the Cart Recovery Control Center database.

---

## 1. Customer (`Customer`)
Represents an e-commerce customer.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `CUS-000001` (zero-padded) | Exact prefix `CUS-` followed by 6 digits | Deterministic customer identifier. |
| `email` | String | Yes | Unique | RFC 5322 email string | Must contain `@` and valid domain | Primary email contact address. |
| `phone` | String | Yes | Unique | E.164 phone string | `+1` followed by 10 digits | Mobile contact number for SMS. |
| `firstName` | String | Yes | No | 1-50 chars | Non-empty | Customer first name. |
| `lastName` | String | Yes | No | 1-50 chars | Non-empty | Customer last name. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= 2026-10-01T00:00:00Z` | Account creation timestamp. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Timestamp of latest profile update. |

---

## 2. Consent (`Consent`)
Historical, immutable record of customer channel consent and opt-out preferences. Records are appended; history is never overwritten.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `CNS-000001` | Exact prefix `CNS-` followed by 6 digits | Deterministic consent record identifier. |
| `customerId` | String | Yes | FK | Valid `Customer.id` | Must reference existing customer | Linked customer. |
| `channel` | String | Yes | No | `EMAIL`, `SMS` | Member of channel enum | Contact channel governed by this consent. |
| `status` | String | Yes | No | `OPT_IN`, `OPT_OUT` | Member of consent status enum | Whether consent is granted or withdrawn. |
| `source` | String | Yes | No | `CHECKOUT_CHECKBOX`, `ACCOUNT_SETTINGS`, `SMS_REPLY_STOP`, `EMAIL_FOOTER` | Known acquisition or withdrawal channel | Provenance of the consent action. |
| `effectiveFrom`| DateTime | Yes | No | ISO 8601 timestamp | Valid date | Start timestamp of this consent status. |
| `effectiveTo` | DateTime | No | No | ISO 8601 timestamp | Must be `> effectiveFrom` if set | End timestamp (consent expired if `<= t`). |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record insertion timestamp. |

---

## 3. Session (`Session`)
A distinct browsing session initiated by a customer on a device.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `SES-000001` | Exact prefix `SES-` followed by 6 digits | Deterministic session identifier. |
| `customerId` | String | Yes | FK | Valid `Customer.id` | Must reference existing customer | Session owner. |
| `deviceType` | String | Yes | No | `DESKTOP`, `MOBILE`, `TABLET` | Member of device enum | Client device form-factor. |
| `browser` | String | Yes | No | `CHROME`, `SAFARI`, `FIREFOX`, `EDGE` | Member of browser enum | Client web browser. |
| `ipAddress` | String | Yes | No | IPv4 address string | Valid IPv4 format | Simulated client IP address. |
| `startedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= customer.createdAt` | Session start timestamp. |
| `endedAt` | DateTime | No | No | ISO 8601 timestamp | `>= startedAt` if present | Session termination timestamp. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record creation timestamp. |

---

## 4. Cart (`Cart`)
A shopping cart containing items selected by a customer during a session.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `CART-2026-000001` | Prefix `CART-YYYY-` followed by 6 digits | Deterministic cart identifier. |
| `sessionId` | String | Yes | FK | Valid `Session.id` | Must reference existing session | Originating session. |
| `customerId` | String | Yes | FK | Valid `Customer.id` | Must match `session.customerId` | Cart owner. |
| `status` | String | Yes | No | `ACTIVE`, `ABANDONED`, `RECOVERED`, `CONVERTED_EXTERNAL`, `EXPIRED` | Member of cart status enum | Lifecycle state. Expired at 30 days inactivity. |
| `subtotal` | Float | Yes | No | Positive currency float (2 decimals) | `= sum(CartLine.lineTotal)` | Sum of product prices * quantities. |
| `taxTotal` | Float | Yes | No | Positive currency float (2 decimals) | `= round(subtotal * 0.08, 2)` | Estimated sales tax (8%). |
| `grandTotal` | Float | Yes | No | Positive currency float (2 decimals) | `= round(subtotal + taxTotal, 2)` | Header total payable. Checked in data validation. |
| `currency` | String | Yes | No | `USD` | ISO 4217 currency code | Cart transaction currency. |
| `itemCount` | Int | Yes | No | Non-negative integer | `= sum(CartLine.quantity)` | Total number of items in cart. |
| `lastActivityAt`| DateTime | Yes | No | ISO 8601 timestamp | `>= session.startedAt` | Last user interaction (add/update item). |
| `abandonedAt` | DateTime | No | No | ISO 8601 timestamp | `>= lastActivityAt + 60m` | Timestamp cart was classified as abandoned. |
| `recoveredAt` | DateTime | No | No | ISO 8601 timestamp | `>= abandonedAt` | Timestamp attributed purchase completed. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Initial cart creation time | Record creation timestamp. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Last database update timestamp. |

---

## 5. CartLine (`CartLine`)
An individual product item entry within a cart.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `LINE-2026-000001` | Prefix `LINE-YYYY-` followed by 6 digits | Deterministic line item identifier. |
| `cartId` | String | Yes | FK | Valid `Cart.id` | Must reference existing cart | Containing cart. |
| `sku` | String | Yes | No | `SKU-XXXX-XXXX` | Product stock keeping unit | Product SKU. |
| `title` | String | Yes | No | Product title string | 1-100 chars | Display name of product. |
| `price` | Float | Yes | No | Positive float (2 decimals) | `> 0` | Unit price at time of addition. |
| `quantity` | Int | Yes | No | Positive integer | `> 0` | Selected quantity. |
| `lineTotal` | Float | Yes | No | Positive float (2 decimals) | `= round(price * quantity, 2)` | Total price for this line. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Addition timestamp. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Line modification timestamp. |

---

## 6. Campaign (`Campaign`)
Recovery campaign configuration and trigger rule definition.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `CMP-2026-000001` | Prefix `CMP-YYYY-` followed by 6 digits | Deterministic campaign identifier. |
| `name` | String | Yes | No | E.g. "Email Reminder", "SMS Reminder", "Email Discount Recovery" | 1-100 chars | Human-readable campaign title. |
| `channel` | String | Yes | No | `EMAIL`, `SMS` | Channel enum | Communication medium. |
| `description` | String | Yes | No | Text description | Descriptive text | Operational explanation of objective. |
| `triggerDelayMinutes` | Int | Yes | No | Positive integer (e.g. 60, 120, 1440) | `>= 0` | Scheduled delay after cart abandonment. |
| `isActive` | Boolean | Yes | No | `true`, `false` | Boolean | Whether new instances are generated. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Creation timestamp | Initial creation. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Configuration update time. |

---

## 7. MessageTemplate (`MessageTemplate`)
A creative variant (A/B) within a campaign.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `TMPL-2026-000001` | Prefix `TMPL-YYYY-` followed by 6 digits | Deterministic template identifier. |
| `campaignId` | String | Yes | FK | Valid `Campaign.id` | Must reference existing campaign | Parent campaign. |
| `variant` | String | Yes | No | `A`, `B` | Variant label | A/B testing cohort assignment. |
| `subject` | String | No | No | Subject line string | Required for EMAIL, null for SMS | Notification header/subject. |
| `body` | String | Yes | No | Template copy text with token placeholders | Non-empty | Notification body copy. |
| `offerDiscountPercent` | Int | Yes | No | `0`, `10`, `15` | Non-negative integer | Promotional incentive percentage. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Creation timestamp | Initial template creation. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Last copy update. |

---

## 8. MessageInstance (`MessageInstance`)
A scheduled message evaluation for an abandoned cart and template.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `MSG-CART-2026-XXXXXX-NN` | Pattern `MSG-CART-YYYY-XXXXXX-NN` | Deterministic sequence identifier per cart. |
| `cartId` | String | Yes | FK, Composite Unique | Valid `Cart.id` | With `templateId` and `scheduledAt` | Target abandoned cart. |
| `templateId` | String | Yes | FK, Composite Unique | Valid `MessageTemplate.id` | With `cartId` and `scheduledAt` | Creative variant assigned. |
| `scheduledAt` | DateTime | Yes | Composite Unique | ISO 8601 timestamp | `= cart.abandonedAt + delay` | Scheduled dispatch timestamp. |
| `eligibilityStatus` | String | Yes | No | `ELIGIBLE`, `NO_CONSENT`, `OPTED_OUT`, `CONSENT_EXPIRED`, `FREQUENCY_CAPPED`, `ALREADY_PURCHASED`, `NOT_ABANDONED`, `OTHER_SUPPRESSED` | Status enum | Evaluated contact eligibility result. |
| `suppressionReason`| String | No | No | Explanatory message | Non-null when ineligible | Operational explanation of block. |
| `evaluatedAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Time decision was evaluated. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record creation time. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Last state update. |

---

## 9. SendAttempt (`SendAttempt`)
A delivery dispatch attempt for an eligible message instance.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `SEND-2026-000001` | Prefix `SEND-YYYY-` followed by 6 digits | Deterministic send identifier. |
| `messageInstanceId` | String | Yes | FK | Valid `MessageInstance.id` | Must reference instance | Associated message evaluation. |
| `status` | String | Yes | No | `SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `FAILED`, `SUPPRESSED` | Attempt status enum | Derived latest lifecycle status. |
| `sentAt` | DateTime | No | No | ISO 8601 timestamp | `= messageInstance.scheduledAt` | Gateway dispatch timestamp. |
| `deliveredAt` | DateTime | No | No | ISO 8601 timestamp | `>= sentAt` | Delivery confirmation timestamp. |
| `openedAt` | DateTime | No | No | ISO 8601 timestamp | `>= deliveredAt` | Open/read timestamp. |
| `clickedAt` | DateTime | No | No | ISO 8601 timestamp | `>= openedAt` (or delivered for SMS) | Link click timestamp. |
| `failedReason` | String | No | No | Error reason string | Present if BOUNCED or FAILED | Gateway response error code. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record creation time. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Last update time. |

---

## 10. SendEvent (`SendEvent`)
Immutable, append-only lifecycle event stream for a recovery message dispatch.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `EVT-2026-000001` | Prefix `EVT-YYYY-` followed by 6 digits | Deterministic event identifier. |
| `sendAttemptId` | String | Yes | FK | Valid `SendAttempt.id` | Must reference send attempt | Target delivery attempt. |
| `eventType` | String | Yes | No | `SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `FAILED`, `SUPPRESSED` | Member of event type enum | Event transition recorded. |
| `occurredAt` | DateTime | Yes | No | ISO 8601 timestamp | Non-decreasing sequence | Exact timestamp event took place. |
| `metadata` | String | No | No | Optional metadata/reason text | String | Gateway error code, user agent, or reason. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record insertion timestamp. |

---

## 11. Order (`Order`)
A completed purchase transaction placed by a customer.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `ORD-2026-000001` | Prefix `ORD-YYYY-` followed by 6 digits | Deterministic order identifier. |
| `cartId` | String | No | FK | Valid `Cart.id` | Set if converted from cart | Originating cart (if any). |
| `customerId` | String | Yes | FK | Valid `Customer.id` | Must reference existing customer | Purchasing customer. |
| `orderNumber` | String | Yes | Unique | `ON-2026-XXXXXX` | Formatted order reference | Customer-facing order number. |
| `subtotal` | Float | Yes | No | Positive float | Matches items purchased | Subtotal before taxes. |
| `taxTotal` | Float | Yes | No | Positive float | Matches sales tax | Tax charge. |
| `total` | Float | Yes | No | Positive float | `= subtotal + taxTotal` | Final charged amount. |
| `currency` | String | Yes | No | `USD` | ISO 4217 currency | Payment currency. |
| `status` | String | Yes | No | `COMPLETED`, `REFUNDED`, `CANCELLED` | Order status enum | Transaction fulfillment state. |
| `purchasedAt` | DateTime | Yes | No | ISO 8601 timestamp | Transaction timestamp | Time order was placed. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Record creation time | System creation timestamp. |
| `updatedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= createdAt` | Last update timestamp. |

---

## 12. Attribution (`Attribution`)
The deterministic single-touch credit assigned to a recovery message attempt for a completed order.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `ATT-2026-000001` | Prefix `ATT-YYYY-` followed by 6 digits | Deterministic attribution identifier. |
| `orderId` | String | Yes | FK | Valid `Order.id` | 1-to-1 with Order in clean data | Order receiving credit. |
| `sendAttemptId` | String | Yes | FK | Valid `SendAttempt.id` | SendAttempt must be ELIGIBLE | Winning recovery send attempt. |
| `attributionReason` | String | Yes | No | `LAST_CLICKED_SEND`, `LAST_DELIVERED_SEND`, `DOUBLE_COUNTED_ANOMALY` | Reason enum | Attribution methodology rule applied. |
| `attributionWindowHours` | Float | Yes | No | `0 < x <= 168.0` | Strictly `0 < t <= 168h` | Elapsed hours from send to purchase. |
| `attributedRevenue` | Float | Yes | No | Positive float | `= order.total` | Total dollar value credited to send. |
| `attributedAt` | DateTime | Yes | No | ISO 8601 timestamp | `>= order.purchasedAt` | Timestamp attribution was computed. |
| `isAnomaly` | Boolean | Yes | No | `false` (normal), `true` (anomaly) | Anomaly flag | Marks synthetic ground-truth edge cases. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Audit timestamp | Record insertion time. |

---

## 13. GroundTruthIssue (`GroundTruthIssue`)
Catalog of intentionally injected data anomalies and rule violations for verification and testing.

| Field Name | Type | Required | Uniqueness | Allowed Values / Format | Validation Rules | Description / Derivation |
|---|---|---|---|---|---|---|
| `id` | String | Yes | PK (Unique) | `ISSUE-2026-000001` | Prefix `ISSUE-YYYY-` followed by 6 digits | Deterministic issue identifier. |
| `issueType` | String | Yes | No | `MESSAGE_SENT_AFTER_OPTOUT`, `CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE`, `DOUBLE_COUNTED_ATTRIBUTION`, `CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE` | Issue type enum | Specific anomaly category. |
| `severity` | String | Yes | No | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` | Severity enum | Impact level of anomaly. |
| `relatedEntityType` | String | Yes | No | `CART`, `MESSAGE_INSTANCE`, `SEND_ATTEMPT`, `ORDER`, `ATTRIBUTION` | Target entity enum | Table of affected entity. |
| `relatedEntityId` | String | Yes | No | Valid entity ID | Must exist in target table | Primary key of affected record. |
| `expectedDecision` | String | Yes | No | Text description | Non-empty | What the business rule prescribed. |
| `observedState` | String | Yes | No | Text description | Non-empty | What was actually recorded in database. |
| `description` | String | Yes | No | Detailed explanation | Non-empty | Root-cause context for operator. |
| `createdAt` | DateTime | Yes | No | ISO 8601 timestamp | Creation timestamp | Time anomaly was logged. |
