# Business Rules Specification: Cart Recovery Control Center

This document specifies the core domain rules governing cart abandonment, contact eligibility, consent expiration, frequency capping, campaign scheduling, immutable event lifecycles, deterministic single-touch attribution, and intentional anomaly auditing.

---

## 1. Cart Abandonment & Lifecycle Rules

### 1.1 Inactivity Abandonment Criteria
A shopping cart is classified as **Abandoned** if and only if all of the following conditions hold at evaluation time $t$:
1. **No Completed Purchase**: The cart has no associated order in `COMPLETED` status.
2. **Inactivity Threshold**: The elapsed time between the cart's `lastActivityAt` and the evaluation time is at least **60 minutes** (`lastActivityAt <= evaluationTime - 60 minutes`).
3. **Open Lifecycle State**: The cart is in `ACTIVE` status and is not already marked `RECOVERED` or `EXPIRED`.

### 1.2 Fixed Cart Retention Expiration Policy
- **Threshold**: Exactly **30 days (720 hours)** after `lastActivityAt` without a completed checkout (`lastActivityAt <= evaluationTime - 30 days`).
- **Precedence**: Expiration is a terminal lifecycle state (`EXPIRED`). It supersedes recovery scheduling; an expired cart cannot transition to `ABANDONED` and is suppressed from all campaigns (`Gate 1: NOT_ABANDONED`).

### 1.3 Lifecycle State Machine
- `ACTIVE`: The customer is currently browsing or interacted with the cart within the last 60 minutes.
- `ABANDONED`: Inactivity $\ge$ 60 minutes without purchase; enrolled in recovery workflows.
- `RECOVERED`: The customer completed a purchase attributed to recovery messaging.
- `CONVERTED_EXTERNAL`: The customer completed a purchase organically without recovery attribution (or outside window).
- `EXPIRED`: Inactivity reached 30 days without conversion.

---

## 2. Contact Eligibility, Consent Expiry & Frequency Suppression

Before scheduling or dispatching any recovery message to a customer, the system evaluates contact eligibility at the proposed message dispatch timestamp $t$.

### 2.1 Deterministic Evaluation Precedence (6 Gates)
1. **Cart Abandonment Gate**: If cart is not in `ABANDONED` status, return `NOT_ABANDONED`.
2. **Order Completion Gate**: If a completed checkout already exists for this cart (`purchasedAt <= t`), return `ALREADY_PURCHASED`.
3. **Consent Existence Gate**: Look up consent records for `(customerId, channel)` where `effectiveFrom <= t`. If no record exists, return `NO_CONSENT`.
4. **Consent Status & Expiration Gate**:
   - Filter all records for that customer and channel where `effectiveFrom <= t`, sorted ascending by `effectiveFrom`.
   - Take the latest record:
     - If latest status is `OPT_OUT`: return `OPTED_OUT`.
     - If latest status is `OPT_IN`:
       - If `effectiveTo != null` and `t >= effectiveTo`: return `CONSENT_EXPIRED`.
       - If `effectiveTo == null` or `t < effectiveTo`: consent is active and valid.
5. **Rolling 7-Day Frequency Cap Gate**:
   - Window: strictly $[t - 7\text{ days}, t)$.
   - Count only **actual dispatched messages** (`SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `FAILED`) on that channel where $t - 7\text{ days} \le \text{sentAt} < t$.
   - A send at the exact proposed timestamp $t$ is excluded ($< t$).
   - Merely scheduled or `SUPPRESSED` messages do NOT consume quota.
   - If count $\ge 2$: return `FREQUENCY_CAPPED`.
6. **Suppression / Contact Endpoint Gate**: Validate email/phone formatting and suppression lists. If invalid, return `OTHER_SUPPRESSED`.
7. **Approval**: If all gates pass, return `ELIGIBLE`.

### 2.2 Explicit Outcome Codes
| Outcome Code | Meaning | Action Taken |
|---|---|---|
| `ELIGIBLE` | All criteria satisfied. | Message scheduled and dispatched. |
| `NO_CONSENT` | Customer never granted consent for this channel. | Suppressed; send attempt marked `SUPPRESSED`. |
| `OPTED_OUT` | Customer explicitly withdrew consent before proposed send. | Suppressed; send attempt marked `SUPPRESSED`. |
| `CONSENT_EXPIRED` | Customer opt-in consent expired prior to proposed send. | Suppressed; send attempt marked `SUPPRESSED`. |
| `FREQUENCY_CAPPED` | Customer received 2 dispatched messages on this channel in $[t - 7\text{d}, t)$. | Suppressed; send attempt marked `SUPPRESSED`. |
| `ALREADY_PURCHASED` | Customer completed checkout prior to scheduled send time. | Suppressed; send attempt marked `SUPPRESSED`. |
| `NOT_ABANDONED` | Cart is active (<60m inactive), closed, or expired (>30d). | Suppressed; send attempt marked `SUPPRESSED`. |
| `OTHER_SUPPRESSED` | Unreachable endpoint or carrier blacklist. | Suppressed; send attempt marked `SUPPRESSED`. |

---

## 3. Campaigns, Variants, and Immutable Event Streams

### 3.1 Standard Campaigns
1. **Email Reminder (`CMP-2026-000001`)**:
   - Channel: `EMAIL` | Trigger Delay: 60 minutes after abandonment.
   - Variant A: Helpful tone ("Items left in your cart — finish checking out")
   - Variant B: Urgency tone ("Still thinking about it? Your items are reserved")
   - Incentive: 0% discount.

2. **SMS Reminder (`CMP-2026-000002`)**:
   - Channel: `SMS` | Trigger Delay: 120 minutes after abandonment.
   - Variant A / B: Conversational nudge with secure link.
   - Incentive: 0% discount.

3. **Email Discount Recovery (`CMP-2026-000003`)**:
   - Channel: `EMAIL` | Trigger Delay: 1,440 minutes (24 hours) after abandonment.
   - Variant A: 10% coupon code (`SAVE10`).
   - Variant B: 15% coupon code (`RECOVER15`).

### 3.2 A/B Variant Allocation & Campaign Stopping Rules
- **Variant Allocation**: Deterministic assignment based on stable numeric hash of cart ID modulo 2 (`variant = (cartNumber % 2 == 0) ? "A" : "B"`).
- **Campaign Evaluation Sequence**: Evaluated strictly at each campaign's scheduled trigger time ($t = \text{abandonedAt} + \text{delay}$).
- **Stop Rule**: If an order completes at or before a campaign's trigger time, all subsequent campaigns evaluate to `ALREADY_PURCHASED` and no sends occur.
- **Identity & Uniqueness**: Each message instance receives a deterministic sequence ID (`MSG-CART-2026-XXXXXX-01`, `-02`, etc.) and enforces `@@unique([cartId, templateId, scheduledAt])`.

### 3.3 Immutable SendEvent Audit Log
Rather than overwriting state, every dispatch progression appends an immutable `SendEvent` record (`EVT-2026-000001`):
```text
SENT → DELIVERED → OPENED → CLICKED
```
Terminal alternatives:
- Gateway hard bounce: `SENT` $\rightarrow$ `BOUNCED` (with error metadata)
- Gateway timeout: `SENT` $\rightarrow$ `FAILED` (with error metadata)
- Suppression: `SUPPRESSED` (with reason)

`SendAttempt.status` is retained as a derived projection for query convenience, while `SendEvent` is the audit source of truth.

---

## 4. Deterministic Purchase Attribution Rule

### 4.1 Strict Attribution Boundary
An order is attributed to a recovery send if and only if all of the following conditions hold:
1. **Customer & Cart Match**: `order.customerId == send.cart.customerId` and `order.cartId == send.cartId`.
2. **Eligible Send**: The message was deemed `ELIGIBLE` and dispatched.
3. **Strict Window**:
   $$0 < \text{order.purchasedAt} - \text{send.sentAt} \le 168\text{ hours (7 days)}$$
   - A send at the exact same timestamp as the order is NOT attributable ($> 0$).
   - A send at exactly 168 hours (604,800,000 ms) IS attributable ($\le 168\text{h}$).
   - A send $> 168$ hours prior is NOT attributable.
4. **Deterministic Single-Touch Tie-Breaker**:
   - **Priority 1**: The latest eligible send with a `CLICKED` event occurring on or before order purchase (`clickedAt <= purchasedAt`).
   - **Priority 2**: If no qualifying clicked send exists, the latest eligible send with a `DELIVERED` event occurring on or before order purchase (`deliveredAt <= purchasedAt`).
5. **Cardinality**: Exactly **one send** receives attribution per normal order.

### 4.2 Output Fields
- `attributionReason`: `LAST_CLICKED_SEND` or `LAST_DELIVERED_SEND`.
- `attributionWindowHours`: Exact elapsed hours between `send.sentAt` and `order.purchasedAt`.
- `attributedRevenue`: Equal to `order.total`.

---

## 5. Labelled Intentional Anomalies (Ground Truth Issues)

Four intentional anomalies are injected after clean baseline generation to test compliance monitoring. Each anomaly is assigned a permanent canonical issue ID:

1. **`ISSUE-2026-000001`** (`CRITICAL`): `MESSAGE_SENT_AFTER_OPTOUT`
   - Target: `SEND_ATTEMPT` (`SEND-2026-000201` in starter, `SEND-2026-010001` in full)
   - Prescribed Decision: `SUPPRESSED with OPTED_OUT`
   - Observed State: `SENT` dispatched 4 hours after customer opted out.
   - Cause: Asynchronous preference sync webhook race condition.

2. **`ISSUE-2026-000002`** (`HIGH`): `CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE`
   - Target: `CART` (`CART-2026-000001`)
   - Prescribed Decision: `CONVERTED_EXTERNAL` / `RECOVERED` (never abandoned after completed order).
   - Observed State: Cart status is `ABANDONED` with completed order already present.
   - Cause: Late checkout webhook delivery caused abandonment cron job to misclassify paid cart.

3. **`ISSUE-2026-000003`** (`CRITICAL`): `DOUBLE_COUNTED_ATTRIBUTION`
   - Target: `ATTRIBUTION` (`ATT-2026-000055` in starter, `ATT-2026-002695` in full)
   - Prescribed Decision: Strict single-touch attribution (1 attribution per order).
   - Observed State: Order received dual attribution records across different campaign channels.
   - Cause: Concurrent attribution pipeline workers lacked distributed locking.

4. **`ISSUE-2026-000004`** (`MEDIUM`): `CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE`
   - Target: `CART` (`CART-2026-000001`)
   - Prescribed Decision: Header grandTotal matches computed sum of CartLine totals + 8% tax.
   - Observed State: Header grandTotal is stale ($395.26 vs computed $1,043.26).
   - Cause: Direct line quantity update bypassed header cache invalidation listener.
