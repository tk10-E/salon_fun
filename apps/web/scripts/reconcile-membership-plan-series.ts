import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnvFileIfPresent(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readFlag(flagName: string) {
  return process.argv.includes(flagName);
}

function readOption(optionName: string) {
  const index = process.argv.findIndex((value) => value === optionName);
  if (index < 0) {
    return null;
  }

  return process.argv[index + 1]?.trim() || null;
}

const projectRoot = process.cwd();
loadEnvFileIfPresent(path.join(projectRoot, ".env.local"));
loadEnvFileIfPresent(path.join(projectRoot, ".env.vercel.production"));

async function main() {
  const { reconcileLegacyMembershipPlanSeries } = await import(
    "../lib/appointmentPlanReservations"
  );

  const report = await reconcileLegacyMembershipPlanSeries({
    dryRun: readFlag("--dry-run"),
    membershipId: readOption("--membership-id"),
    notifyPendingFirstSlot: !readFlag("--dry-run"),
    salonId: readOption("--salon-id"),
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
