import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const exportsDir = path.resolve(process.cwd(), "exports");
  const filename = format === "csv" ? "ground_truth.csv" : "ground_truth.json";
  const filePath = path.join(exportsDir, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (format === "csv") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
