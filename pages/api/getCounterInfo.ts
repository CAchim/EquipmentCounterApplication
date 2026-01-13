import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

import {
  sendCounterWarningEmail,
  sendCounterLimitEmail,
  sendCounterResetEmail,
  sendOwnerChangedEmail,
  sendOwnerRemovedEmail,
  sendLimitsChangedEmail,
  sendProjectDeletedEmail,
} from "../../lib/email/emailService";

/* ============================== Helpers ============================== */

type AnyUser = Record<string, any>;

const lc = (v: any) => String(v ?? "").toLowerCase();

const strOrEmpty = (v: any): string => (typeof v === "string" ? v.trim() : "");

function toIntOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function requireAuth(
  session: any,
  res: NextApiResponse
): { ok: true } | { ok: false } {
  if (!session?.user) {
    res.status(401).json({ message: "Unauthorized" });
    return { ok: false };
  }
  return { ok: true };
}

function isAdminOrIE(session: any): boolean {
  const g = lc(session?.user?.user_group);
  return g === "admin" || g === "engineer";
}

function getModifiedByFallback(session: any): string {
  return (
    (session?.user?.email as string) ||
    (session?.user?.user_id as string) ||
    "system"
  );
}

/** Safe reader for user's plant (may be name or numeric id). */
function readUserPlantFromSession(session: unknown): string | null {
  const u = (session as any)?.user ?? {};
  const fp = u.fixture_plant;
  const pn = u.plant_name;
  const pid = u.plant_id;
  if (typeof fp === "string" && fp.trim() !== "") return fp.trim();
  if (typeof pn === "string" && pn.trim() !== "") return pn.trim();
  if (pid != null) return String(pid);
  return null;
}

/** If value looks numeric, resolve Plants.entry_id -> plant_name; otherwise return as-is. */
async function resolvePlantIfNumeric(
  plantMaybeId: string | null
): Promise<string | null> {
  if (!plantMaybeId) return null;
  const v = plantMaybeId.trim();
  if (!/^\d+$/.test(v)) return v; // already a name

  const rows = await queryDatabase(
    "SELECT plant_name FROM Plants WHERE entry_id = ? LIMIT 1",
    [Number(v)]
  );
  if (Array.isArray(rows) && rows.length > 0 && rows[0].plant_name) {
    return String(rows[0].plant_name);
  }
  return v;
}

/** Fetch a project row by entry_id (single source of truth for plant/keys). */
async function getProjectById(entry_id: number) {
  const rows = await queryDatabase(
    `SELECT
       entry_id,
       project_name,
       adapter_code,
       fixture_type,
       fixture_plant,
       owner_email,
       contacts_limit,
       warning_at,
       contacts
     FROM Projects
     WHERE entry_id = ?
     LIMIT 1`,
    [entry_id]
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function normalizeBody(body: Record<string, any>) {
  return {
    action: strOrEmpty(body.action),
    entry_id: toIntOrNull(body.entry_id),
    project_name: strOrEmpty(body.project_name),
    adapter_code: strOrEmpty(body.adapter_code),
    fixture_type: strOrEmpty(body.fixture_type),
    owner_email: strOrEmpty(body.owner_email),
    contacts_limit: body.contacts_limit,
    warning_at: body.warning_at,
    modified_by: strOrEmpty(body.modified_by),
    fixture_plant: strOrEmpty(body.fixture_plant),
    part_number: strOrEmpty(body.part_number),
    qty: body.qty != null ? Number(body.qty) : null,
    plant: typeof body.plant === "string" ? body.plant.trim() : null,
  };
}

/** Fetch first_name from Users table given an email */
async function getUserFirstName(email: string | null): Promise<string | null> {
  if (!email) return null;

  const rows = await queryDatabase(
    "SELECT first_name FROM Users WHERE email = ? LIMIT 1",
    [email]
  );

  if (Array.isArray(rows) && rows.length > 0 && rows[0].first_name) {
    return String(rows[0].first_name);
  }

  return null;
}

/** Write into fixture_events (safe, non-blocking for user experience). */
async function safeAddFixtureEvent(args: {
  fixturePlant: string;
  adapterCode: string;
  fixtureType: string;
  eventType: string;
  eventDetails?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  actor?: string | null;
}) {
  try {
    await queryDatabase("CALL addFixtureEvent(?,?,?,?,?,?,?,?)", [
      args.fixturePlant,
      args.adapterCode,
      args.fixtureType,
      args.eventType,
      args.eventDetails ?? null,
      args.oldValue ?? null,
      args.newValue ?? null,
      args.actor ?? null,
    ]);
  } catch (e) {
    // Don’t break the API if analytics logging fails
    console.error("[fixture_events] addFixtureEvent failed:", e);
  }
}

/* ============================== Handler ============================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    const session = await getServerSession(
      req,
      res,
      authOptions as NextAuthOptions
    );

    const body = (req.body || {}) as Record<string, any>;
    const {
      action,
      entry_id,
      project_name,
      adapter_code,
      fixture_type,
      owner_email,
      contacts_limit,
      warning_at,
      modified_by,
      fixture_plant,
      part_number,
      qty,
      plant,
    } = normalizeBody(body);

    const groupLC = lc(session?.user?.user_group);

    switch (action) {
      /* --------------------------- READ LIST --------------------------- */
      case "getProjects": {
        let filterPlant: string | null = null;

        if (groupLC === "admin") {
          filterPlant = plant && plant.length ? plant : null;
        } else if (session) {
          filterPlant = await resolvePlantIfNumeric(
            readUserPlantFromSession(session)
          );
        } else {
          filterPlant = null;
        }

        const rows = await queryDatabase("CALL getProjectsByPlant(?)", [
          filterPlant,
        ]);
        const data = Array.isArray(rows) ? rows[0] ?? [] : [];
        return res.status(200).json({ message: data });
      }

      /* -------------------------- CREATE -------------------------- */
      case "createProject": {
        if (!requireAuth(session, res).ok) return;

        const isAdmin = groupLC === "admin";
        const basePlant = isAdmin
          ? fixture_plant
          : readUserPlantFromSession(session);
        const targetPlant = await resolvePlantIfNumeric(basePlant);

        if (!targetPlant) {
          return res.status(400).json({ message: "Missing fixture_plant" });
        }

        const limitNum = Number(contacts_limit);
        const warnNum = Number(warning_at);
        if (!Number.isFinite(limitNum) || !Number.isFinite(warnNum)) {
          return res.status(400).json({ message: "Invalid numeric values" });
        }

        const who = modified_by || getModifiedByFallback(session);

        try {
          const result = await queryDatabase(
            "CALL insertProject(?,?,?,?,?,?,?,?)",
            [
              project_name,
              adapter_code,
              fixture_type,
              owner_email,
              limitNum,
              warnNum,
              who,
              targetPlant,
            ]
          );

          // Optional: you can log CREATED here if you want
          // await safeAddFixtureEvent({ fixturePlant: targetPlant, adapterCode: adapter_code, fixtureType: fixture_type, eventType: "CREATED", actor: who });

          return res.status(200).json({ message: result });
        } catch (e: any) {
          const msg = (e?.sqlMessage || e?.message || "").toString();
          if (msg.includes("already exists") || e?.errno === 1002) {
            return res.status(409).json({
              message:
                "The adapter code already exists with the specified fixture type in this plant!",
            });
          }
          if (msg.includes("contacts_limit") || e?.errno === 1003) {
            return res
              .status(400)
              .json({ message: "Limit must be greater than Warning." });
          }
          if (msg.includes("required") || e?.errno === 1001) {
            return res.status(400).json({ message: msg });
          }
          console.error("insertProject error:", e);
          return res.status(500).json({ message: "Server error" });
        }
      }

      /* -------------------------- UPDATE OWNER -------------------------- */
      case "updateOwner": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });
        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const oldOwnerEmail: string | null = proj.owner_email || null;
        const newOwnerEmail: string | null = owner_email || null;
        const oldOwnerName = await getUserFirstName(oldOwnerEmail);
        const newOwnerName = await getUserFirstName(newOwnerEmail);
        const triggeredBy = getModifiedByFallback(session);

        const result = await queryDatabase("CALL updateOwnerEmail(?,?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          newOwnerEmail,
          triggeredBy,
        ]);

        // Analytics event
        /*await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "OWNER_CHANGED",
          eventDetails: "Owner email updated",
          oldValue: oldOwnerEmail ?? null,
          newValue: newOwnerEmail ?? null,
          actor: triggeredBy,
        });*/

        // NEW owner email
        if (newOwnerEmail) {
          (async () => {
            try {
              await sendOwnerChangedEmail({
                to: newOwnerEmail,
                newOwnerName: newOwnerName ?? newOwnerEmail,
                projectName: proj.project_name,
                adapterCode: proj.adapter_code,
                fixtureType: proj.fixture_type,
                fixturePlant: proj.fixture_plant,
                oldOwnerEmail: oldOwnerEmail ?? undefined,
                triggeredBy,
              });
            } catch (err) {
              console.error(
                "[updateOwner] sendOwnerChangedEmail (new owner) error:",
                err
              );
            }
          })();
        }

        // OLD owner email
        if (oldOwnerEmail && oldOwnerEmail !== newOwnerEmail) {
          (async () => {
            try {
              await sendOwnerRemovedEmail({
                to: oldOwnerEmail,
                oldOwnerName: oldOwnerName ?? oldOwnerEmail,
                projectName: proj.project_name,
                adapterCode: proj.adapter_code,
                fixtureType: proj.fixture_type,
                fixturePlant: proj.fixture_plant,
                newOwnerEmail: newOwnerEmail ?? undefined,
                triggeredBy,
              });
            } catch (err) {
              console.error(
                "[updateOwner] sendOwnerRemovedEmail (old owner) error:",
                err
              );
            }
          })();
        }

        return res.status(200).json({ message: result });
      }

      /* -------------------- UPDATE LIMIT / WARNING -------------------- */
      case "updateContactsLimitAndWarning": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });
        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });

        const limitNum = Number(contacts_limit);
        const warnNum = Number(warning_at);
        if (!Number.isFinite(limitNum) || !Number.isFinite(warnNum)) {
          return res.status(400).json({ message: "Invalid numeric values" });
        }

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const oldLimit = Number(proj.contacts_limit ?? 0);
        const oldWarning = Number(proj.warning_at ?? 0);
        const ownerEmail = (proj.owner_email as string | null | undefined) ?? null;
        const triggeredBy = getModifiedByFallback(session);

        try {
          const result = await queryDatabase(
            "CALL updateLimitAndWarning(?,?,?,?,?,?)",
            [
              proj.adapter_code,
              proj.fixture_type,
              proj.fixture_plant,
              limitNum,
              warnNum,
              triggeredBy,
            ]
          );

          /*// Analytics event
          await safeAddFixtureEvent({
            fixturePlant: proj.fixture_plant,
            adapterCode: proj.adapter_code,
            fixtureType: proj.fixture_type,
            eventType: "LIMIT_WARNING_CHANGED",
            eventDetails: "Limit/warning updated",
            oldValue: `limit=${oldLimit};warning=${oldWarning}`,
            newValue: `limit=${limitNum};warning=${warnNum}`,
            actor: triggeredBy,
          });*/

          if (ownerEmail) {
            (async () => {
              try {
                await sendLimitsChangedEmail({
                  to: ownerEmail,
                  ownerName: null,
                  projectName: proj.project_name,
                  adapterCode: proj.adapter_code,
                  fixtureType: proj.fixture_type,
                  fixturePlant: proj.fixture_plant,
                  oldWarningAt: oldWarning,
                  oldLimit,
                  newWarningAt: warnNum,
                  newLimit: limitNum,
                  triggeredBy,
                });
              } catch (err) {
                console.error(
                  "[updateContactsLimitAndWarning] sendLimitsChangedEmail error:",
                  err
                );
              }
            })();
          }

          return res.status(200).json({ message: result });
        } catch (e: any) {
          const msg = (e?.sqlMessage || e?.message || "").toString();
          if (msg.includes("contacts_limit") || e?.errno === 1003) {
            return res.status(200).json({ message: { affectedRows: 0 } });
          }
          console.error("updateLimitAndWarning error:", e);
          return res.status(500).json({ message: "Server error" });
        }
      }

      /* --------------------------- RESET (ID-based) -------------------------- */
      case "resetCounter": {
        if (!requireAuth(session, res).ok) return;
        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const performedBy = getModifiedByFallback(session);
        const triggeredBy = performedBy;

        // FIX: your SELECT returns "contacts", not "current_contacts"
        const oldContacts = Number(proj.contacts ?? 0);

        const ownerEmail = (proj.owner_email as string | null | undefined) ?? null;

        const result = await queryDatabase("CALL resetCounterForProject(?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          performedBy,
        ]);

        /*// Analytics event
        await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "RESET",
          eventDetails: "Counter reset",
          oldValue: String(oldContacts),
          newValue: "0",
          actor: performedBy,
        });*/

        if (ownerEmail) {
          (async () => {
            try {
              await sendCounterResetEmail({
                to: ownerEmail,
                ownerName: null,
                projectName: proj.project_name,
                adapterCode: proj.adapter_code,
                fixtureType: proj.fixture_type,
                fixturePlant: proj.fixture_plant,
                performedBy,
                oldContacts,
                triggeredBy,
              });
            } catch (err) {
              console.error("[resetCounter] sendCounterResetEmail error:", err);
            }
          })();
        }

        return res.status(200).json({ message: result });
      }

      /* -------------------------- DELETE (ID-based) -------------------------- */
      case "deleteProject": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });
        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const deletedBy = getModifiedByFallback(session);
        const triggeredBy = deletedBy;

        const ownerEmail: string | null = (proj.owner_email as string) || null;
        const warningAt: number | null =
          proj.warning_at != null ? Number(proj.warning_at) : null;
        const limit: number | null =
          proj.contacts_limit != null ? Number(proj.contacts_limit) : null;

        if (ownerEmail) {
          (async () => {
            try {
              await sendProjectDeletedEmail({
                to: ownerEmail,
                firstName: null,
                projectName: proj.project_name,
                adapterCode: proj.adapter_code,
                fixtureType: proj.fixture_type,
                fixturePlant: proj.fixture_plant,
                warningAt,
                limit,
                deletedBy,
                triggeredBy,
              });
            } catch (err) {
              console.error("[deleteProject] sendProjectDeletedEmail error:", err);
            }
          })();
        }

        const result = await queryDatabase("CALL deleteProjectForPlant(?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          deletedBy,
        ]);

        /*// Analytics event (log after delete call, but we still have proj data)
        await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "DELETED",
          eventDetails: "Project deleted",
          oldValue: proj.project_name ?? null,
          newValue: null,
          actor: deletedBy,
        });*/

        return res.status(200).json({ message: result });
      }

      /* ====================== TEST PROBES (ID-based) ====================== */

      case "getTestProbes": {
        if (entry_id != null) {
          const proj = await getProjectById(entry_id);
          if (!proj) return res.status(404).json({ message: "Project not found" });

          const rows = await queryDatabase("CALL getTestProbesForProject(?,?,?)", [
            proj.adapter_code,
            proj.fixture_type,
            proj.fixture_plant,
          ]);
          const data = Array.isArray(rows) ? rows[0] ?? [] : [];
          return res.status(200).json({ message: data });
        } else {
          const rows = await queryDatabase(
            `SELECT entry_id, adapter_code, fixture_type, fixture_plant
               FROM Projects
              WHERE adapter_code = ? AND fixture_type = ?
              ORDER BY last_update DESC
              LIMIT 1`,
            [adapter_code, fixture_type]
          );
          if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "Project not found" });
          }
          const p = rows[0];
          const r2 = await queryDatabase("CALL getTestProbesForProject(?,?,?)", [
            p.adapter_code,
            p.fixture_type,
            p.fixture_plant,
          ]);
          const data = Array.isArray(r2) ? r2[0] ?? [] : [];
          return res.status(200).json({ message: data });
        }
      }

      case "addOrUpdateTestProbe": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });

        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });
        if (!part_number || !Number.isFinite(qty!) || qty! <= 0) {
          return res.status(400).json({ message: "Invalid part_number/qty" });
        }

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const actor = getModifiedByFallback(session);

        const result = await queryDatabase("CALL addOrUpdateTestProbe(?,?,?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          part_number,
          Number(qty),
          actor,
        ]);

        /*await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "TP_CHANGED",
          eventDetails: `Probe ${part_number} set qty=${Number(qty)}`,
          oldValue: null,
          newValue: `${part_number} x${Number(qty)}`,
          actor,
        });*/

        return res.status(200).json({ message: result });
      }

      case "deleteTestProbe": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });

        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });
        if (!part_number)
          return res.status(400).json({ message: "Missing part_number" });

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const actor = getModifiedByFallback(session);

        const result = await queryDatabase("CALL deleteTestProbe(?,?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          part_number,
          actor,
        ]);

        /*await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "TP_DELETED",
          eventDetails: `Probe deleted: ${part_number}`,
          oldValue: part_number,
          newValue: null,
          actor,
        });*/

        return res.status(200).json({ message: result });
      }

      case "removeAllTestProbes": {
        if (!requireAuth(session, res).ok) return;
        if (!isAdminOrIE(session))
          return res.status(403).json({ message: "Forbidden" });

        if (entry_id == null)
          return res.status(400).json({ message: "Missing entry_id" });

        const proj = await getProjectById(entry_id);
        if (!proj) return res.status(404).json({ message: "Project not found" });

        const actor = getModifiedByFallback(session);

        const result = await queryDatabase("CALL removeAllTestProbes(?,?,?,?)", [
          proj.adapter_code,
          proj.fixture_type,
          proj.fixture_plant,
          actor,
        ]);

        /*await safeAddFixtureEvent({
          fixturePlant: proj.fixture_plant,
          adapterCode: proj.adapter_code,
          fixtureType: proj.fixture_type,
          eventType: "TP_REMOVE_ALL",
          eventDetails: "All test probes removed",
          oldValue: null,
          newValue: null,
          actor,
        });*/

        return res.status(200).json({ message: result });
      }

      default:
        return res.status(400).json({ message: "Unknown action" });
    }
  } catch (err: any) {
    console.error("getCounterInfo error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
