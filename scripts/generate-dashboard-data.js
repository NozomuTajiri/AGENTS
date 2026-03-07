import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.cwd(), "docs/dashboard-data.json");

const siteData = {
  updatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? "local-preview",
  metrics: [
    { value: "1500h+", label: "生成AI活用支援" },
    { value: "20件/年", label: "講演・研修目安" },
    { value: "3領域", label: "DX / 開発 / AI支援" },
  ],
};

async function main() {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(siteData, null, 2)}\n`, "utf8");
  console.log(`Wrote site data to ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to generate site data.", error);
  process.exitCode = 1;
});
