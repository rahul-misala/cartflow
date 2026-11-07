import { seed } from "../prisma/seed";
import { exportAllData } from "./export-data";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n========================================================");
  console.log("[Reproducibility] Starting automated verification...");
  console.log("========================================================\n");

  const checksumsPath = path.resolve(process.cwd(), "exports", "checksums.json");

  // Run 1
  console.log(">>> RUN 1: Seeding starter dataset...");
  await seed("starter");
  await exportAllData();

  if (!fs.existsSync(checksumsPath)) {
    console.error("Run 1 failed: checksums.json was not created.");
    process.exit(1);
  }
  const run1Checksums: Record<string, { rowCount: number; bytes: number; sha256: string }> = JSON.parse(
    fs.readFileSync(checksumsPath, "utf8")
  );

  // Run 2
  console.log("\n>>> RUN 2: Re-seeding starter dataset with same seed (20261022)...");
  await seed("starter");
  await exportAllData();

  const run2Checksums: Record<string, { rowCount: number; bytes: number; sha256: string }> = JSON.parse(
    fs.readFileSync(checksumsPath, "utf8")
  );

  // Compare
  console.log("\n========================================================");
  console.log("[Reproducibility] Comparing Run 1 vs Run 2 Checksums...");
  console.log("========================================================\n");

  let mismatches = 0;
  const files = Object.keys(run1Checksums);

  console.log("| Status | File Name | Rows | Size | SHA-256 Match |");
  console.log("|---|---|---:|---:|---|");

  for (const file of files) {
    const c1 = run1Checksums[file];
    const c2 = run2Checksums[file];

    if (!c2) {
      console.log(`| ✖ MISSING | ${file} | - | - | Missing in Run 2 |`);
      mismatches++;
      continue;
    }

    const rowMatch = c1.rowCount === c2.rowCount;
    const byteMatch = c1.bytes === c2.bytes;
    const hashMatch = c1.sha256 === c2.sha256;

    if (rowMatch && byteMatch && hashMatch) {
      console.log(`| ✔ MATCH | ${file} | ${c1.rowCount.toLocaleString()} | ${c1.bytes.toLocaleString()} B | ${c1.sha256.slice(0, 16)}... |`);
    } else {
      console.log(`| ✖ MISMATCH | ${file} | R1:${c1.rowCount} R2:${c2.rowCount} | R1:${c1.bytes} R2:${c2.bytes} | ${c1.sha256 !== c2.sha256 ? "HASH DIFFERENCE" : "SIZE DIFFERENCE"} |`);
      mismatches++;
    }
  }

  console.log("\n========================================================");
  if (mismatches === 0) {
    console.log(`[Reproducibility] SUCCESS: All ${files.length} exported files matched identically across consecutive runs!`);
    console.log("========================================================\n");
    process.exit(0);
  } else {
    console.error(`[Reproducibility] FAILURE: Found ${mismatches} file mismatch(es).`);
    console.log("========================================================\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Reproducibility Error]", err);
  process.exit(1);
});
