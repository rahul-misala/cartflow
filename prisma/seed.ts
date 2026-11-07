import { PrismaClient } from "@prisma/client";
import { generateSyntheticData, Scale } from "../lib/generator/generate";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function chunkInsert<T>(
  modelName: string,
  delegate: { createMany: (args: { data: T[] }) => Promise<{ count: number }> },
  items: T[],
  chunkSize = 250
) {
  let inserted = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const res = await delegate.createMany({ data: chunk });
    inserted += res.count;
  }
  return inserted;
}

export async function seed(scale: Scale = "starter") {
  console.log(`\n======================================================`);
  console.log(`[Seed] Starting deterministic generation with scale: ${scale.toUpperCase()}`);
  console.log(`[Seed] Fixed Seed: 20261022 | Base Time: 2026-10-01T00:00:00.000Z`);
  console.log(`======================================================\n`);

  const startTime = Date.now();
  const dataset = generateSyntheticData(scale);

  console.log(`[Seed] In-memory generation completed in ${Date.now() - startTime}ms.`);
  console.log(`[Seed] Clearing existing SQLite database tables...`);

  // Clear existing in reverse foreign key order
  await prisma.groundTruthIssue.deleteMany();
  await prisma.attribution.deleteMany();
  await prisma.order.deleteMany();
  await prisma.sendEvent.deleteMany();
  await prisma.sendAttempt.deleteMany();
  await prisma.messageInstance.deleteMany();
  await prisma.cartLine.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.session.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.customer.deleteMany();

  console.log(`[Seed] Inserting records in topological order...`);

  // 1. Campaigns & Templates
  await chunkInsert("Campaign", prisma.campaign, dataset.campaigns);
  await chunkInsert("MessageTemplate", prisma.messageTemplate, dataset.messageTemplates);

  // 2. Customers & Consents
  await chunkInsert("Customer", prisma.customer, dataset.customers);
  await chunkInsert("Consent", prisma.consent, dataset.consents);

  // 3. Sessions, Carts, CartLines
  await chunkInsert("Session", prisma.session, dataset.sessions);
  await chunkInsert("Cart", prisma.cart, dataset.carts);
  await chunkInsert("CartLine", prisma.cartLine, dataset.cartLines);

  // 4. Message Instances, Send Attempts, and Send Events
  await chunkInsert("MessageInstance", prisma.messageInstance, dataset.messageInstances);
  await chunkInsert("SendAttempt", prisma.sendAttempt, dataset.sendAttempts);
  await chunkInsert("SendEvent", prisma.sendEvent, dataset.sendEvents);

  // 5. Orders & Attributions
  await chunkInsert("Order", prisma.order, dataset.orders);
  await chunkInsert("Attribution", prisma.attribution, dataset.attributions);

  // 6. Ground Truth Issues
  await chunkInsert("GroundTruthIssue", prisma.groundTruthIssue, dataset.groundTruthIssues);

  // Export Ground Truth files to exports/
  const exportsDir = path.resolve(process.cwd(), "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const gtJsonPath = path.join(exportsDir, "ground_truth.json");
  fs.writeFileSync(gtJsonPath, JSON.stringify(dataset.groundTruthIssues, null, 2), "utf8");

  const csvHeader = "id,issueType,severity,relatedEntityType,relatedEntityId,expectedDecision,observedState,description,createdAt\n";
  const csvRows = dataset.groundTruthIssues.map((issue) => {
    return [
      issue.id,
      issue.issueType,
      issue.severity,
      issue.relatedEntityType,
      issue.relatedEntityId,
      `"${issue.expectedDecision.replace(/"/g, '""')}"`,
      `"${issue.observedState.replace(/"/g, '""')}"`,
      `"${issue.description.replace(/"/g, '""')}"`,
      issue.createdAt.toISOString(),
    ].join(",");
  }).join("\n");

  const gtCsvPath = path.join(exportsDir, "ground_truth.csv");
  fs.writeFileSync(gtCsvPath, csvHeader + csvRows, "utf8");

  const totalDuration = Date.now() - startTime;
  console.log(`\n======================================================`);
  console.log(`[Seed] Seed finished successfully in ${totalDuration}ms!`);
  console.log(`[Seed] Scale: ${scale}`);
  console.log(`------------------------------------------------------`);
  console.log(`  Customers:          ${dataset.customers.length}`);
  console.log(`  Consents:           ${dataset.consents.length}`);
  console.log(`  Sessions:           ${dataset.sessions.length}`);
  console.log(`  Carts:              ${dataset.carts.length}`);
  console.log(`  Cart Lines:         ${dataset.cartLines.length}`);
  console.log(`  Campaigns:          ${dataset.campaigns.length}`);
  console.log(`  Templates:          ${dataset.messageTemplates.length}`);
  console.log(`  Message Instances:  ${dataset.messageInstances.length}`);
  console.log(`  Send Attempts:      ${dataset.sendAttempts.length}`);
  console.log(`  Send Events:        ${dataset.sendEvents.length}`);
  console.log(`  Orders:             ${dataset.orders.length}`);
  console.log(`  Attributions:       ${dataset.attributions.length}`);
  console.log(`  Ground Truth Issues:${dataset.groundTruthIssues.length}`);
  console.log(`======================================================\n`);
}

async function main() {
  const args = process.argv.slice(2);
  let scale: Scale = "starter";
  const scaleIdx = args.indexOf("--scale");
  if (scaleIdx !== -1 && args[scaleIdx + 1]) {
    const val = args[scaleIdx + 1].toLowerCase();
    if (val === "full" || val === "starter") {
      scale = val;
    }
  }

  try {
    await seed(scale);
  } catch (err) {
    console.error("[Seed Error]", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
