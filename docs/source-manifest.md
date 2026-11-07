# Source Manifest & Data Checksums

| Parameter | Value |
|---|---|
| **Generator Version** | `1.1.0` |
| **Dataset Scale** | `starter` (1,000 carts) |
| **Fixed Seed** | `20261022` |
| **Base Timestamp** | `2026-10-01T00:00:00.000Z` |
| **Generated At** | `2026-11-07T12:30:45.470Z` |
| **Generation Command** | `npm run seed:starter && npm run export` |

## Export Files & SHA-256 Checksums

| Export File | Row Count | File Size (Bytes) | SHA-256 Checksum |
|---|---:|---:|---|
| `customers.json` | 650 | 1,63,531 | `930602012c39fa233cc99f6917cf30ec726f534032695856367f1b899eb782d5` |
| `customers.csv` | 650 | 68,022 | `e12bf02b2d1bdd323de5b74cc797e2fe4a237a0682522ace4973909add876a88` |
| `consents.json` | 1,028 | 2,74,864 | `377000332ef767a0afd0651d62ff6af412bab2e7907000f6b21b0f9eb3af59a4` |
| `consents.csv` | 1,028 | 1,18,907 | `d17ce1af7765cdd8e878a83dbbad308f9c1b39ec52d71fd6b7f645c1f11a861d` |
| `sessions.json` | 1,000 | 2,85,893 | `c50d50c2124e40a9dd3053bc784cf967c52d2279b9dbed598d8719bcd212276e` |
| `sessions.csv` | 1,000 | 1,11,951 | `a7869aabfdef4adbeecd444fa03f161bf018ab9c1a65ac3e23534d9acb4ebb5f` |
| `carts.json` | 1,000 | 4,42,302 | `a922a8fdd0697368a5aa37566878f67a14bb524bd9185a941349ad59c08c2703` |
| `carts.csv` | 1,000 | 1,21,325 | `374581b7df344cead04508e9af46a941de7f481da23c8c100a9a07667a68fc6a` |
| `cart_lines.json` | 2,500 | 7,44,664 | `510ee25952f48faaab08d6b85c7bc8f193a4117920ed30001d1151f145c780e3` |
| `cart_lines.csv` | 2,500 | 2,47,206 | `440d2d2f895fa2052bd1b655fe7c54fad7796b208cff1d5cb900c2e05dc27b37` |
| `campaigns.json` | 3 | 1,001 | `6063f24e404546d2554a4436478c0731f45c79df91463083af13cbd0d6999ed5` |
| `campaigns.csv` | 3 | 446 | `7ce56d505efd74c7ae6efd87d9deb9aee3eb60f44e70c5c2358492166c96d307` |
| `message_templates.json` | 6 | 2,309 | `ae20f1e1bb97f3808d64f9b131de55321502c60ac0924d912988384c78cf8f14` |
| `message_templates.csv` | 6 | 1,142 | `90c52d310ace172c488f40f63db5e0fb6ca342437d9c3f311f91bc514d67bfc2` |
| `message_instances.json` | 1,200 | 4,73,414 | `e9435369b2a8998e0ab7547886e9ad7c8103713a0f772b082f75d8b8e982b8cb` |
| `message_instances.csv` | 1,200 | 1,83,604 | `827666ef5f4e7cc13e1b800111691182463b406341e4291d85f3762622681945` |
| `send_attempts.json` | 201 | 77,124 | `5bd3688f638675456de60e2adcf5f73241b90c1228077388f9520d58a92dadcf` |
| `send_attempts.csv` | 201 | 25,883 | `b875bba5e37cb33534305d8713c64a9b2d2261758c8be38f21e65ba5275ef5e3` |
| `send_events.json` | 562 | 1,23,139 | `704846c49e3751567ef45910673dc590dc597c9be6a1e3f07f04b19b8e538877` |
| `send_events.csv` | 562 | 55,231 | `3e9ec6dee992c05aa288d22b893b26f875a5a6fa0838844b0596014900a7b1b7` |
| `orders.json` | 234 | 91,988 | `318a176ce4b12781f42f0f980c9ebf14d29aeebe13e38bd2e45dca319a6d682e` |
| `orders.csv` | 234 | 30,060 | `f2682ac807de159bdf63f7300007b6ae30be64f16b305f1a50741d61890e7933` |
| `attributions.json` | 55 | 18,897 | `b360bbf29650ac019e2336f3971dca1a66fbbbd5b144b73c4011244c27ebce9a` |
| `attributions.csv` | 55 | 6,571 | `c1256a53c5b7cbb90747f2f707ff424623ebf5a476a39ff9f44c09611edf0a80` |
| `ground_truth.json` | 4 | 2,327 | `acbd78d1d1ae93dcb62297f8daf6adce0bf52ab937712f66cc6894d9f5f0a5b8` |
| `ground_truth.csv` | 4 | 1,669 | `b352df5ce34b39b7569bdf239cdc7d953e5d684c168a93216367ee9143dbd3a0` |

## Ground-Truth Anomalies Catalog (4 Labelled Issues)

| Issue ID | Severity | Category | Target Entity | Prescribed Decision | Observed State |
|---|---|---|---|---|---|
| **ISSUE-2026-000001** | `CRITICAL` | `MESSAGE_SENT_AFTER_OPTOUT` | `SEND_ATTEMPT:SEND-2026-000201` | SUPPRESSED with OPTED_OUT | Dispatched SENT at 2026-10-08T20:00:01.000Z after customer opted out at 2026-10-08T16:00:01.000Z |
| **ISSUE-2026-000002** | `HIGH` | `CART_CLASSIFIED_ABANDONED_AFTER_PURCHASE` | `CART:CART-2026-000001` | Cart state CONVERTED_EXTERNAL / RECOVERED; cannot be marked ABANDONED after completed checkout | Cart status is ABANDONED with abandonedAt 2026-10-09T06:12:45.000Z despite order ORD-2026-000001 completed at 2026-10-09T04:12:45.000Z |
| **ISSUE-2026-000003** | `CRITICAL` | `DOUBLE_COUNTED_ATTRIBUTION` | `ATTRIBUTION:ATT-2026-000055` | Strict single-touch attribution; exactly one send credited per order | Order ORD-2026-000001 has 2 attribution records (ATT-2026-000001 and ATT-2026-000055) |
| **ISSUE-2026-000004** | `MEDIUM` | `CART_TOTAL_STALE_AFTER_QUANTITY_UPDATE` | `CART:CART-2026-000001` | Header grandTotal should be $1065.25 based on line items | Header grandTotal is stale at $645.67 (delta: $419.58) |
