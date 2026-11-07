# Cart Recovery Control Center

An operations dashboard and forensic audit platform that simulates, monitors, and explains end-to-end e-commerce abandoned cart recovery workflows: synthetic generation, time-based cart abandonment classification, contact consent & frequency suppression gating, multi-channel recovery messaging, append-only send event lifecycles, single-touch deterministic order attribution, and intentional ground-truth anomaly auditing.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **SQLite local database**, **Faker**, and **Vitest**.

---

## 1. Quick Start & Commands

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+` or `v11+`

### Available Commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Runs Prisma SQLite migrations and synchronizes schema |
| `npm run seed:starter` | Seeds the standard starter dataset (1,000 carts, 400 abandoned, 201 sends, 4 anomalies) |
| `npm run seed:full` | Seeds the full-scale dataset (50,000 carts, 20,000 abandoned, 10,001 sends, 4 anomalies) |
| `npm run validate` | Runs comprehensive data validation (16 checks separating clean baseline from expected anomalies) |
| `npm run export` | Generates 26 CSV & JSON export files and updates `docs/source-manifest.md` |
| `npm run verify:reproducibility` | Re-seeds starter data twice and compares row counts and SHA-256 hashes across all exports |
| `npm run test` | Runs 24 automated Vitest unit tests covering domain rules and boundary conditions |
| `npm run lint` | Runs ESLint check across all project files |
| `npm run build` | Compiles optimized Next.js production build |
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run start` | Starts Next.js production server |

### Quick Start Execution

```bash
# Initialize database, seed starter data, and validate
npm run db:migrate
npm run seed:starter
npm run validate
npm run export
npm run test
npm run dev
```

The application will be accessible at: `http://localhost:3000`.

---

## 2. Core Architecture & Stack

```
CartFlow / Cart Recovery Control Center
├── app/
│   ├── layout.tsx                     # Global layout, navigation header, status pill
│   ├── page.tsx                       # Operations Dashboard (KPIs, Funnel, Campaigns, Channels)
│   ├── carts/
│   │   ├── page.tsx                   # Abandoned-Cart Work Queue (Filterable/Paginated Table)
│   │   └── [id]/page.tsx              # Deep Forensic Cart Audit (Timeline, Gates, Math, Attribution)
│   ├── exceptions/page.tsx            # Ground-Truth Anomaly Catalog & Investigation
│   ├── api/exports/ground-truth/      # Download API for ground truth JSON and CSV
│   └── globals.css                    # Tailwind CSS and theme design tokens
├── components/
│   ├── dashboard/                     # MetricCards, FunnelVisualizer, CampaignPerformance, ChannelBreakdown
│   └── carts/                         # CartFilters
├── lib/
│   ├── db.ts                          # Prisma Client singleton
│   ├── domain/
│   │   ├── types.ts                   # Domain types, Enums, and interfaces
│   │   ├── abandonment.ts             # Pure domain cart abandonment and 30d expiration rule
│   │   ├── eligibility.ts             # 6-gate contact consent, expiration & frequency-cap rule
│   │   ├── attribution.ts             # Deterministic single-touch purchase attribution rule
│   │   └── calculations.ts            # Derived cart lines arithmetic & tax calculation
│   ├── generator/
│   │   ├── constants.ts               # Fixed seed, base time, deterministic ID formatters, catalogs
│   │   └── generate.ts                # Deterministic synthetic data generator (starter & full scale)
│   └── metrics.ts                     # Aggregation queries for operations dashboard
├── prisma/
│   ├── schema.prisma                  # Prisma ORM schema with relations
│   ├── migrations/                    # SQLite database migrations
│   └── seed.ts                        # Seed execution CLI supporting --scale starter | full
├── scripts/
│   ├── validate-data.ts               # Comprehensive data validation suite
│   ├── export-data.ts                 # Full export pipeline for JSON, CSV, and SHA-256 manifest
│   └── verify-reproducibility.ts      # Automated verification of consecutive run checksums
├── tests/
│   └── domain.test.ts                 # Vitest test suite covering all core business rules
├── docs/
│   ├── business-rules.md              # Detailed business rules specification
│   ├── data-dictionary.md             # Complete entity schema and field definitions
│   └── source-manifest.md             # Auto-generated SHA-256 checksums and anomaly documentation
└── exports/                           # Generated CSV, JSON, and checksum manifests
```

---

## 3. Data Model & Cardinalities

Deterministic, zero-padded entity IDs are used across all tables:

| Entity | ID Format | Description |
|---|---|---|
| `Customer` | `CUS-000001` | Unique customer profile |
| `Consent` | `CNS-000001` | Immutable ledger of channel opt-in, opt-out, and expiration preferences |
| `Session` | `SES-000001` | Browsing session with device and browser attributes |
| `Cart` | `CART-2026-000001` | Shopping cart with lifecycle states and derived totals |
| `CartLine` | `LINE-2026-000001` | Individual product item in cart |
| `Campaign` | `CMP-2026-000001` | Recovery campaign definition (e.g. Email Reminder, SMS) |
| `MessageTemplate` | `TMPL-2026-000001` | Creative A/B variant copy and incentive discount |
| `MessageInstance` | `MSG-CART-2026-XXXXXX-01` | Evaluated campaign trigger for an abandoned cart |
| `SendAttempt` | `SEND-2026-000001` | Gateway dispatch attempt with derived latest status |
| `SendEvent` | `EVT-2026-000001` | Immutable, append-only event stream (`SENT`, `DELIVERED`, etc.) |
| `Order` | `ORD-2026-000001` | Completed purchase checkout transaction |
| `Attribution` | `ATT-2026-000001` | Deterministic credit assigned to a recovery send |
| `GroundTruthIssue` | `ISSUE-2026-000001` | Catalog of intentionally injected anomalies |

### Entity Relationships
```
Customer 1—N Consent
Customer 1—N Session
Session 1—N Cart
Cart 1—N CartLine
Customer 1—N Order
Campaign 1—N MessageTemplate
Cart 0—N MessageInstance
MessageTemplate 1—N MessageInstance
MessageInstance 1—N SendAttempt
SendAttempt 1—N SendEvent (Immutable Event Stream)
Order 0—1 Attribution (Normal) / 1—N (Anomaly)
Attribution N—1 SendAttempt
```

---

## 4. Business Rules Summary

Full specifications are documented in [`docs/business-rules.md`](file:///c:/Users/rahul/OneDrive/Desktop/CartFlow/docs/business-rules.md).

### 1. Cart Abandonment & Retention
- A cart becomes abandoned when inactive for at least **60 minutes** with no completed purchase.
- **Fixed 30-Day Retention Policy**: A cart expires at **30 days (720 hours)** of inactivity without purchase. `EXPIRED` is a terminal state that blocks all recovery messaging.

### 2. Contact Eligibility & Consent Expiry (6 Gates)
Evaluated deterministically at proposed message time $t$:
1. **Cart Abandonment**: Must be in `ABANDONED` status (`NOT_ABANDONED` if active/closed/expired).
2. **Prior Checkout**: Must have no completed checkout (`ALREADY_PURCHASED` if order exists).
3. **Consent Existence**: Customer must have a consent record with `effectiveFrom <= t` (`NO_CONSENT`).
4. **Consent Status & Expiration**:
   - The latest record with `effectiveFrom <= t` is checked.
   - If `status == OPT_OUT`: returns `OPTED_OUT`.
   - If `status == OPT_IN` and `effectiveTo != null && t >= effectiveTo`: returns `CONSENT_EXPIRED`.
   - Otherwise, consent is valid.
5. **Rolling 7-Day Frequency Cap**:
   - Evaluated strictly over the window $[t - 7\text{ days}, t)$.
   - Counts only dispatched recovery messages on that channel (`SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `FAILED`).
   - A send at the exact proposed time $t$ is excluded ($< t$). Suppressed messages do not consume capacity.
   - Limit: Maximum **2 recovery messages per customer per channel in 7 days**. Returns `FREQUENCY_CAPPED` if exceeded.
6. **Suppression / Contact Endpoint**: Returns `OTHER_SUPPRESSED` if endpoint is invalid or blacklisted.
7. If all gates pass: returns `ELIGIBLE`.

### 3. Campaigns, Stopping Rules, and Send Events
- **A/B Variant Allocation**: Assigned by stable numeric hash of cart ID modulo 2 (`cartNumber % 2 == 0 ? "A" : "B"`).
- **Trigger Sequence**: Email Reminder (60m delay), SMS Reminder (120m delay), Email Discount Recovery (1440m delay).
- **Stop Rule**: When an order is completed, subsequent campaigns evaluate to `ALREADY_PURCHASED` and are suppressed.
- **Append-Only Event Stream**: All dispatch progressions write immutable `SendEvent` records (`SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `OPENED` $\rightarrow$ `CLICKED`), or terminal `BOUNCED`, `FAILED`, and `SUPPRESSED`.

### 4. Deterministic Single-Touch Attribution
An order is attributed to recovery messaging when:
- Order matches the same customer and cart.
- Recovery send was `ELIGIBLE` and dispatched strictly within the window:
  $$0 < \text{order.purchasedAt} - \text{send.sentAt} \le 168\text{ hours (7 days)}$$
- A send at the exact same timestamp as the order is not attributable ($> 0$).
- **Single-Touch Tie-Breaker**:
  - Priority 1: Latest eligible send with a `CLICKED` event occurring on or before order purchase (`clickedAt <= purchasedAt`).
  - Priority 2: Latest eligible send with a `DELIVERED` event occurring on or before order purchase (`deliveredAt <= purchasedAt`).
- Exactly **one send** receives attribution per normal order.

---

## 5. Deterministic Generation & Reproducibility Verification

The synthetic generator uses fixed Faker seed `20261022` and base timestamp `2026-10-01T00:00:00.000Z` without relative `Date.now()` calls.

### Automated Reproducibility Verification
Run:
```bash
npm run verify:reproducibility
```
This automated test:
1. Seeds the `starter` dataset and exports all 26 CSV/JSON tables.
2. Re-seeds the `starter` dataset a second time from scratch and exports again.
3. Performs an automated byte-by-byte SHA-256 comparison across all 26 exported files.
4. Outputs a verification table confirming 100% exact match across all row counts, file sizes, and cryptographic checksums.

Current checksums and row counts are stored dynamically in [`docs/source-manifest.md`](file:///c:/Users/rahul/OneDrive/Desktop/CartFlow/docs/source-manifest.md).

---

## 6. Ground-Truth Intentional Anomalies

Four intentional anomalies are injected after clean baseline generation to test operational surveillance. They are recorded in `GroundTruthIssue`:

1. **`ISSUE-2026-000001`** (`CRITICAL`): `MESSAGE_SENT_AFTER_OPTOUT`
   - **Target**: `SEND_ATTEMPT` (`SEND-2026-000201` in starter, `SEND-2026-010001` in full)
   - **Prescribed**: `SUPPRESSED with OPTED_OUT`.
   - **Observed**: `SENT` dispatched 4 hours after recipient opted out.
   - **Root Cause**: Asynchronous preference webhook race condition.

2. **`ISSUE-2026-000002`** (`HIGH`): `CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE`
   - **Target**: `CART` (`CART-2026-000001`)
   - **Prescribed**: `CONVERTED_EXTERNAL` / `RECOVERED` (never abandoned after completed order).
   - **Observed**: Cart status is `ABANDONED` with completed order already present.
   - **Root Cause**: Late checkout webhook delivery caused cart lifecycle cron to misclassify paid cart.

3. **`ISSUE-2026-000003`** (`CRITICAL`): `DOUBLE_COUNTED_ATTRIBUTION`
   - **Target**: `ATTRIBUTION` (`ATT-2026-000055` in starter, `ATT-2026-002695` in full)
   - **Prescribed**: Strict single-touch attribution (exactly 1 attribution per order).
   - **Observed**: Order received dual attribution records across different campaign channels.
   - **Root Cause**: Concurrent channel attribution workers lacked distributed locking.

4. **`ISSUE-2026-000004`** (`MEDIUM`): `CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE`
   - **Target**: `CART` (`CART-2026-000001`)
   - **Prescribed**: Header grandTotal `$1,043.26` matches sum of line items + 8% tax.
   - **Observed**: Header grandTotal is stale at `$395.26` (delta: `$648.00`).
   - **Root Cause**: Direct cart line quantity update bypassed header cache invalidation listener.

---

## 7. Demo Walkthrough

### 1. Operations Dashboard (`/`)
- Real-time aggregated metrics (Total Carts, Abandoned Carts, Eligible vs Suppressed, Recovery Sends, Recovered Orders, Attributed Revenue, and Conversion Rate).
- Funnel Visualization: Carts $\rightarrow$ Abandoned $\rightarrow$ Eligible $\rightarrow$ Sent $\rightarrow$ Clicked $\rightarrow$ Recovered.
- Campaign Performance and Channel Efficiency breakdowns.
- Active Anomalies Alert Panel.

### 2. Work Queue (`/carts`)
- Paginated/filterable table with Cart ID, Customer, Value, Inactivity Age, Channel, Eligibility Gate (including `CONSENT_EXPIRED`), Recovery State, and Anomaly badges.
- Live search by Cart ID, Customer ID, or Customer Name.
- Filters for Recovery State, Eligibility Gate, Channel, and Known Anomalies.

### 3. Forensic Cart Audit (`/carts/[id]`)
- Customer profile, session device/browser, client IP.
- Dynamic Line Items & Arithmetic Reconciliation with stale header detection.
- Plain-language Contact Eligibility Gate breakdown.
- Historical Customer Consent Ledger.
- Purchase Attribution & Recovery ROI Card.
- **Immutable SendEvent Timeline**: Full event progression from session initiation to message delivery and purchase.
- **Ground-Truth Anomaly Diagnostic Panel**: Triggered when an anomaly affects the cart.

### 4. Exceptions Center (`/exceptions`)
- Master catalog of all 4 injected anomalies with severity badges and root-cause explanations.
- Side-by-side comparison of Prescribed Domain Decision vs Observed Data Violation.
- Direct **"Investigate Cart"** deep-links into the forensic audit timeline.
- CSV and JSON export downloads via `/api/exports/ground-truth`.
