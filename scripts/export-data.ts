import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function toCsv(rows: any[], columns: string[]): string {
  const header = columns.join(",") + "\n";
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          if (val instanceof Date) return val.toISOString();
          if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
          return String(val);
        })
        .join(",")
    )
    .join("\n");
  return header + body;
}

export async function exportAllData() {
  console.log("\n======================================================");
  console.log("[Exporter] Exporting database records to exports/ ...");
  console.log("======================================================\n");

  const exportsDir = path.resolve(process.cwd(), "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const [
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
  ] = await Promise.all([
    prisma.customer.findMany({ orderBy: { id: "asc" } }),
    prisma.consent.findMany({ orderBy: { id: "asc" } }),
    prisma.session.findMany({ orderBy: { id: "asc" } }),
    prisma.cart.findMany({ orderBy: { id: "asc" } }),
    prisma.cartLine.findMany({ orderBy: { id: "asc" } }),
    prisma.campaign.findMany({ orderBy: { id: "asc" } }),
    prisma.messageTemplate.findMany({ orderBy: { id: "asc" } }),
    prisma.messageInstance.findMany({ orderBy: { id: "asc" } }),
    prisma.sendAttempt.findMany({ orderBy: { id: "asc" } }),
    prisma.sendEvent.findMany({ orderBy: { id: "asc" } }),
    prisma.order.findMany({ orderBy: { id: "asc" } }),
    prisma.attribution.findMany({ orderBy: { id: "asc" } }),
    prisma.groundTruthIssue.findMany({ orderBy: { id: "asc" } }),
  ]);

  const exportsConfig: Array<{ name: string; rows: any[]; cols: string[] }> = [
    {
      name: "customers",
      rows: customers,
      cols: ["id", "email", "phone", "firstName", "lastName", "createdAt"],
    },
    {
      name: "consents",
      rows: consents,
      cols: ["id", "customerId", "channel", "status", "source", "effectiveFrom", "effectiveTo", "createdAt"],
    },
    {
      name: "sessions",
      rows: sessions,
      cols: ["id", "customerId", "deviceType", "browser", "ipAddress", "startedAt", "endedAt"],
    },
    {
      name: "carts",
      rows: carts,
      cols: ["id", "sessionId", "customerId", "status", "subtotal", "taxTotal", "grandTotal", "currency", "itemCount", "lastActivityAt", "abandonedAt", "recoveredAt"],
    },
    {
      name: "cart_lines",
      rows: cartLines,
      cols: ["id", "cartId", "sku", "title", "price", "quantity", "lineTotal"],
    },
    {
      name: "campaigns",
      rows: campaigns,
      cols: ["id", "name", "channel", "description", "triggerDelayMinutes", "isActive"],
    },
    {
      name: "message_templates",
      rows: messageTemplates,
      cols: ["id", "campaignId", "variant", "subject", "body", "offerDiscountPercent"],
    },
    {
      name: "message_instances",
      rows: messageInstances,
      cols: ["id", "cartId", "templateId", "scheduledAt", "eligibilityStatus", "suppressionReason", "evaluatedAt"],
    },
    {
      name: "send_attempts",
      rows: sendAttempts,
      cols: ["id", "messageInstanceId", "status", "sentAt", "deliveredAt", "openedAt", "clickedAt", "failedReason"],
    },
    {
      name: "send_events",
      rows: sendEvents,
      cols: ["id", "sendAttemptId", "eventType", "occurredAt", "metadata", "createdAt"],
    },
    {
      name: "orders",
      rows: orders,
      cols: ["id", "cartId", "customerId", "orderNumber", "subtotal", "taxTotal", "total", "currency", "status", "purchasedAt"],
    },
    {
      name: "attributions",
      rows: attributions,
      cols: ["id", "orderId", "sendAttemptId", "attributionReason", "attributionWindowHours", "attributedRevenue", "attributedAt", "isAnomaly"],
    },
    {
      name: "ground_truth",
      rows: groundTruthIssues,
      cols: ["id", "issueType", "severity", "relatedEntityType", "relatedEntityId", "expectedDecision", "observedState", "description", "createdAt"],
    },
  ];

  const manifestFiles: Record<string, { rowCount: number; bytes: number; sha256: string }> = {};

  for (const exp of exportsConfig) {
    const jsonPath = path.join(exportsDir, `${exp.name}.json`);
    const csvPath = path.join(exportsDir, `${exp.name}.csv`);

    fs.writeFileSync(jsonPath, JSON.stringify(exp.rows, null, 2), "utf8");
    fs.writeFileSync(csvPath, toCsv(exp.rows, exp.cols), "utf8");

    manifestFiles[`${exp.name}.json`] = {
      rowCount: exp.rows.length,
      bytes: fs.statSync(jsonPath).size,
      sha256: sha256File(jsonPath),
    };

    manifestFiles[`${exp.name}.csv`] = {
      rowCount: exp.rows.length,
      bytes: fs.statSync(csvPath).size,
      sha256: sha256File(csvPath),
    };
  }

  // Write checksum manifest JSON
  const checksumsPath = path.join(exportsDir, "checksums.json");
  fs.writeFileSync(checksumsPath, JSON.stringify(manifestFiles, null, 2), "utf8");

  // Determine current scale based on carts count
  const detectedScale = carts.length >= 25000 ? "full" : "starter";

  // Write docs/source-manifest.md
  const sourceManifestPath = path.resolve(process.cwd(), "docs", "source-manifest.md");
  let manifestMd = `# Source Manifest & Data Checksums\n\n`;
  manifestMd += `| Parameter | Value |\n`;
  manifestMd += `|---|---|\n`;
  manifestMd += `| **Generator Version** | \`1.1.0\` |\n`;
  manifestMd += `| **Dataset Scale** | \`${detectedScale}\` (${carts.length.toLocaleString()} carts) |\n`;
  manifestMd += `| **Fixed Seed** | \`20261022\` |\n`;
  manifestMd += `| **Base Timestamp** | \`2026-10-01T00:00:00.000Z\` |\n`;
  manifestMd += `| **Generated At** | \`${new Date().toISOString()}\` |\n`;
  manifestMd += `| **Generation Command** | \`npm run seed:${detectedScale} && npm run export\` |\n\n`;

  manifestMd += `## Export Files & SHA-256 Checksums\n\n`;
  manifestMd += `| Export File | Row Count | File Size (Bytes) | SHA-256 Checksum |\n`;
  manifestMd += `|---|---:|---:|---|\n`;

  for (const [filename, info] of Object.entries(manifestFiles)) {
    manifestMd += `| \`${filename}\` | ${info.rowCount.toLocaleString()} | ${info.bytes.toLocaleString()} | \`${info.sha256}\` |\n`;
  }

  manifestMd += `\n## Ground-Truth Anomalies Catalog (${groundTruthIssues.length} Labelled Issues)\n\n`;
  manifestMd += `| Issue ID | Severity | Category | Target Entity | Prescribed Decision | Observed State |\n`;
  manifestMd += `|---|---|---|---|---|---|\n`;
  for (const issue of groundTruthIssues) {
    manifestMd += `| **${issue.id}** | \`${issue.severity}\` | \`${issue.issueType}\` | \`${issue.relatedEntityType}:${issue.relatedEntityId}\` | ${issue.expectedDecision} | ${issue.observedState} |\n`;
  }

  fs.writeFileSync(sourceManifestPath, manifestMd, "utf8");

  console.log(`[Exporter] Successfully generated ${Object.keys(manifestFiles).length} export files.`);
  console.log(`[Exporter] Wrote checksum manifest to ${checksumsPath}`);
  console.log(`[Exporter] Updated documentation in ${sourceManifestPath}\n`);
}

async function main() {
  try {
    await exportAllData();
  } catch (err) {
    console.error("[Exporter Error]", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
