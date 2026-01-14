import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";
import {
  sendCounterWarningEmail,
  sendCounterLimitEmail,
} from "../../lib/email/emailService";

type ProjectRow = {
  entry_id: number;
  project_name: string;
  adapter_code: string;
  fixture_type: string;
  fixture_plant: string;
  owner_email: string | null;
  warning_at: number | null;
  contacts_limit: number | null;
  contacts: number | null;
};

type TestProbeInfo = { partNumber: string; qty: number };

/* ======================= Config via env ======================= */

const MONITOR_SECRET = process.env.MONITOR_CONTACTS_SECRET;
if (!MONITOR_SECRET) {
  throw new Error("MONITOR_CONTACTS_SECRET is not set");
}

const WINDOW_HOURS = Number(process.env.CONTACT_MONITOR_WINDOW_HOURS || "24");

const MAX_EMAILS_PER_RUN = Number(process.env.CONTACT_MONITOR_MAX_EMAILS || "1000");

const MONITOR_TRIGGERED_BY = "contacts_monitor";

/** Global counter for throttling per run */
let emailsSentThisRun = 0;

/** Per-run caches */
const groupEmailCache = new Map<string, string[]>(); // key: `${plant}|${group}`
const testProbesCache = new Map<string, TestProbeInfo[]>(); // key: `${plant}|${adapter}|${fixture}`
const ownerNameCache = new Map<string, string | null>(); // key: owner_email

/* ======================= Small helpers ======================= */

/**
 * serverless-mysql / mysql can return different shapes:
 *  - SELECT -> rows (array of objects)
 *  - CALL proc -> [rows, ...]
 *  - some wrappers -> [[rows], fields]
 *
 * This normalizes to "array of row objects".
 */
function normalizeRows<T = any>(rows: any): T[] {
  if (!Array.isArray(rows)) return [];
  // if first element is also an array, it usually contains the actual rows
  if (Array.isArray(rows[0])) return (rows[0] as T[]) ?? [];
  return rows as T[];
}

function getCooldownDate(): Date {
  if (WINDOW_HOURS <= 0) return new Date(0);
  const ms = WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

function isValidEmail(to: string | null | undefined): boolean {
  if (!to) return false;
  const trimmed = to.trim();
  return trimmed.includes("@");
}

function uniqEmails(list: string[]): string[] {
  return Array.from(new Set(list.map((x) => x.trim()).filter(Boolean)));
}

/* ======================= Data Fetch helpers ======================= */

async function getTestProbesForProject(params: {
  adapter_code: string;
  fixture_type: string;
  fixture_plant: string;
}): Promise<TestProbeInfo[]> {
  const { adapter_code, fixture_type, fixture_plant } = params;
  const cacheKey = `${fixture_plant}|${adapter_code}|${fixture_type}`;

  const cached = testProbesCache.get(cacheKey);
  if (cached) return cached;

  const rows: any = await queryDatabase("CALL getTestProbesForProject(?,?,?)", [
    adapter_code,
    fixture_type,
    fixture_plant,
  ]);

  const data = normalizeRows<any>(rows);

  const result = data.map((r: any) => ({
    partNumber: String(r.part_number ?? r.partNumber ?? ""),
    qty: Number(r.qty ?? r.quantity ?? 0),
  }));

  testProbesCache.set(cacheKey, result);
  return result;
}

async function fetchGroupEmailsForPlant(plant: string, groupName: string): Promise<string[]> {
  const cacheKey = `${plant}|${groupName.toLowerCase()}`;
  const cached = groupEmailCache.get(cacheKey);
  if (cached) return cached;

  const rows: any = await queryDatabase("CALL getEmailsByPlantAndGroup(?, ?)", [
    plant,
    groupName,
  ]);

  const data = normalizeRows<any>(rows);

  const emails = data
    .map((r) => String(r.email ?? r.user_email ?? r.owner_email ?? "").trim())
    .filter((e) => e && e.includes("@"));

  const unique = uniqEmails(emails);
  groupEmailCache.set(cacheKey, unique);
  return unique;
}

/** Optional improvement: try to show the owner first name in email templates */
async function fetchOwnerFirstNameByEmail(email: string | null): Promise<string | null> {
  if (!email) return null;
  const key = email.toLowerCase();

  if (ownerNameCache.has(key)) return ownerNameCache.get(key) ?? null;

  try {
    const rows: any = await queryDatabase(
      `SELECT first_name
         FROM Users
        WHERE email = ?
        LIMIT 1`,
      [email]
    );

    const data = normalizeRows<any>(rows);
    const firstName = data.length ? String(data[0]?.first_name ?? "") : "";
    const result = firstName.trim() || null;

    ownerNameCache.set(key, result);
    return result;
  } catch {
    ownerNameCache.set(key, null);
    return null;
  }
}

/* ======================= DB queries ======================= */

async function getProjectsNeedingWarning(): Promise<ProjectRow[]> {
  const cutoff = getCooldownDate();

  const rows: any = await queryDatabase(
    `
    SELECT
      p.entry_id,
      p.project_name,
      p.adapter_code,
      p.fixture_type,
      p.fixture_plant,
      p.owner_email,
      p.warning_at,
      p.contacts_limit,
      p.contacts
    FROM Projects p
    LEFT JOIN (
      SELECT
        fixture_plant,
        adapter_code,
        fixture_type,
        MAX(created_at) AS last_reset_at
      FROM fixture_events
      WHERE event_type = 'RESET'
      GROUP BY fixture_plant, adapter_code, fixture_type
    ) r
      ON r.fixture_plant = p.fixture_plant
     AND r.adapter_code  = p.adapter_code
     AND r.fixture_type  = p.fixture_type
    WHERE p.owner_email IS NOT NULL
      AND p.warning_at IS NOT NULL
      AND p.warning_at > 0
      AND p.contacts IS NOT NULL
      AND p.contacts >= p.warning_at
      AND (p.contacts_limit IS NULL OR p.contacts < p.contacts_limit)

      -- auto-disable WARNING after LIMIT until reset:
      -- if WARNING or LIMIT already sent since last reset (and inside cooldown), skip
      AND NOT EXISTS (
        SELECT 1
        FROM email_logs e
        WHERE e.adapter_code   = p.adapter_code
          AND e.fixture_type   = p.fixture_type
          AND e.fixture_plant  = p.fixture_plant
          AND e.issue_type     IN ('WARNING', 'LIMIT')
          AND e.status         = 'SENT'
          AND e.created_at     > COALESCE(r.last_reset_at, '1970-01-01 00:00:00')
          AND e.created_at     >= ?
      )
    `,
    [cutoff]
  );

  return normalizeRows<ProjectRow>(rows);
}

async function getProjectsNeedingLimit(): Promise<ProjectRow[]> {
  const cutoff = getCooldownDate();

  const rows: any = await queryDatabase(
    `
    SELECT
      p.entry_id,
      p.project_name,
      p.adapter_code,
      p.fixture_type,
      p.fixture_plant,
      p.owner_email,
      p.warning_at,
      p.contacts_limit,
      p.contacts
    FROM Projects p
    LEFT JOIN (
      SELECT
        fixture_plant,
        adapter_code,
        fixture_type,
        MAX(created_at) AS last_reset_at
      FROM fixture_events
      WHERE event_type = 'RESET'
      GROUP BY fixture_plant, adapter_code, fixture_type
    ) r
      ON r.fixture_plant = p.fixture_plant
     AND r.adapter_code  = p.adapter_code
     AND r.fixture_type  = p.fixture_type
    WHERE p.owner_email IS NOT NULL
      AND p.contacts_limit IS NOT NULL
      AND p.contacts_limit > 0
      AND p.contacts IS NOT NULL
      AND p.contacts >= p.contacts_limit

      -- one-time LIMIT per reset (and inside cooldown):
      AND NOT EXISTS (
        SELECT 1
        FROM email_logs e
        WHERE e.adapter_code   = p.adapter_code
          AND e.fixture_type   = p.fixture_type
          AND e.fixture_plant  = p.fixture_plant
          AND e.issue_type     = 'LIMIT'
          AND e.status         = 'SENT'
          AND e.created_at     > COALESCE(r.last_reset_at, '1970-01-01 00:00:00')
          AND e.created_at     >= ?
      )
    `,
    [cutoff]
  );

  return normalizeRows<ProjectRow>(rows);
}

/* ======================= Process WARNING ======================= */

async function processWarnings(): Promise<void> {
  const projects = await getProjectsNeedingWarning();

  console.log(
    `[monitorContacts] WARNING scan: found ${projects.length} candidate project(s). Cooldown window = ${WINDOW_HOURS}h`
  );

  let sent = 0;
  let failed = 0;
  let skippedInvalid = 0;
  let skippedThrottled = 0;

  for (const p of projects) {
    if (emailsSentThisRun >= MAX_EMAILS_PER_RUN) {
      skippedThrottled++;
      continue;
    }

    const to = p.owner_email;
    if (!isValidEmail(to)) {
      skippedInvalid++;
      continue;
    }

    try {
      const ownerName = await fetchOwnerFirstNameByEmail(to);

      // ✅ Warning phase: CC the plant technicians (owner still in TO)
      const ccTechs = await fetchGroupEmailsForPlant(p.fixture_plant, "technician");
      const cc = uniqEmails(ccTechs).filter((e) => e !== to);

      console.log(
        `[monitorContacts] WARNING -> ${to} (cc=${cc.length}) for ${p.project_name} (${p.adapter_code}/${p.fixture_type}), contacts=${p.contacts}, warn_at=${p.warning_at}, limit=${p.contacts_limit}`
      );

      const testProbes = await getTestProbesForProject({
        adapter_code: p.adapter_code,
        fixture_type: p.fixture_type,
        fixture_plant: p.fixture_plant,
      });

      await sendCounterWarningEmail({
        to,
        ownerName,
        projectName: p.project_name,
        adapterCode: p.adapter_code,
        fixtureType: p.fixture_type,
        fixturePlant: p.fixture_plant,
        currentContacts: Number(p.contacts ?? 0),
        warningAt: Number(p.warning_at ?? 0),
        limit: Number(p.contacts_limit ?? 0),
        triggeredBy: MONITOR_TRIGGERED_BY,
        testProbes,
        cc,
      });

      emailsSentThisRun++;
      sent++;
    } catch (err) {
      failed++;
      console.error("[monitorContacts] Failed to send WARNING email for project:", p.entry_id, err);
    }
  }

  console.log(
    `[monitorContacts] WARNING summary: sent=${sent}, failed=${failed}, skippedInvalid=${skippedInvalid}, skippedThrottled=${skippedThrottled}`
  );
}

/* ======================= Process LIMIT ======================= */

async function processLimits(): Promise<void> {
  const projects = await getProjectsNeedingLimit();

  console.log(
    `[monitorContacts] LIMIT scan: found ${projects.length} candidate project(s). Cooldown window = ${WINDOW_HOURS}h`
  );

  let sent = 0;
  let failed = 0;
  let skippedInvalid = 0;
  let skippedThrottled = 0;

  for (const p of projects) {
    if (emailsSentThisRun >= MAX_EMAILS_PER_RUN) {
      skippedThrottled++;
      continue;
    }

    const to = p.owner_email;
    if (!isValidEmail(to)) {
      skippedInvalid++;
      continue;
    }

    try {
      const ownerName = await fetchOwnerFirstNameByEmail(to);

      const limit = Number(p.contacts_limit ?? 0);
      const contacts = Number(p.contacts ?? 0);
      const critical = Math.ceil(limit * 1.1);

      const ccTechs = await fetchGroupEmailsForPlant(p.fixture_plant, "technician");
      let cc = [...ccTechs];

      if (contacts >= critical) {
        const ccEngineers = await fetchGroupEmailsForPlant(p.fixture_plant, "engineer");
        cc = [...cc, ...ccEngineers];
      }

      cc = uniqEmails(cc).filter((e) => e !== to);

      console.log(
        `[monitorContacts] LIMIT -> ${to} (cc=${cc.length}) for ${p.project_name} (${p.adapter_code}/${p.fixture_type}), contacts=${p.contacts}, limit=${p.contacts_limit}`
      );

      const testProbes = await getTestProbesForProject({
        adapter_code: p.adapter_code,
        fixture_type: p.fixture_type,
        fixture_plant: p.fixture_plant,
      });

      await sendCounterLimitEmail({
        to,
        ownerName,
        projectName: p.project_name,
        adapterCode: p.adapter_code,
        fixtureType: p.fixture_type,
        fixturePlant: p.fixture_plant,
        currentContacts: contacts,
        limit,
        triggeredBy: MONITOR_TRIGGERED_BY,
        testProbes,
        cc,
      });

      emailsSentThisRun++;
      sent++;
    } catch (err) {
      failed++;
      console.error("[monitorContacts] Failed to send LIMIT email for project:", p.entry_id, err);
    }
  }

  console.log(
    `[monitorContacts] LIMIT summary: sent=${sent}, failed=${failed}, skippedInvalid=${skippedInvalid}, skippedThrottled=${skippedThrottled}`
  );
}

/* ======================= API handler ======================= */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(
    "=== /api/monitorContacts started ===",
    `method=${req.method}, windowHours=${WINDOW_HOURS}, maxEmails=${MAX_EMAILS_PER_RUN}`
  );

  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const secret = (req.query.secret as string) || "";
  if (secret !== MONITOR_SECRET) {
    console.warn("[monitorContacts] Invalid or missing secret.");
    return res.status(403).json({ message: "Forbidden" });
  }

  emailsSentThisRun = 0;
  groupEmailCache.clear();
  testProbesCache.clear();
  ownerNameCache.clear();

  try {
    await processWarnings();
    await processLimits();

    console.log("=== /api/monitorContacts finished === totalEmailsSent=", emailsSentThisRun);

    return res.status(200).json({
      ok: true,
      emailsSent: emailsSentThisRun,
      windowHours: WINDOW_HOURS,
      maxEmailsPerRun: MAX_EMAILS_PER_RUN,
    });
  } catch (err) {
    console.error("[monitorContacts] Fatal error:", err);
    return res.status(500).json({ ok: false, message: "Monitor failed", error: String(err) });
  }
}
