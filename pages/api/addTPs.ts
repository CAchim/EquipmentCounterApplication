import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

type AnyUser = Record<string, any>;

function lc(v: any): string {
  return String(v ?? "").toLowerCase();
}

function readUserPlant(u?: AnyUser | null): string | null {
  if (!u) return null;
  return (
    (u.fixture_plant as string) ??
    (u.plant_name as string) ??
    (u.plant_id != null ? String(u.plant_id) : null) ??
    null
  );
}

function getEffectivePlant(
  session: { user?: AnyUser } | null,
  bodyPlant?: string | null
): string | null {
  const group = lc(session?.user?.user_group);

  // Admin: uses explicit plant from body (dropdown), optional fallback to session
  if (group === "admin") {
    const fromBody = (bodyPlant ?? "").trim();
    if (fromBody !== "") return fromBody;
    const fromSession = (readUserPlant(session?.user) || "").trim();
    return fromSession || null;
  }

  // Non-admin: always uses plant from session
  if (session) {
    const fromSession = (readUserPlant(session.user) || "").trim();
    return fromSession || null;
  }

  return null;
}

function modifiedBy(session: any): string {
  return session?.user?.email || session?.user?.user_id || "system";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

  const {
    adapter_code,
    fixture_type,
    testProbes,
    fixture_plant, // optional; for admins from dropdown
  } = body || {};

  if (!adapter_code || !fixture_type) {
    return res
      .status(400)
      .json({ message: "Missing adapter code or fixture type" });
  }

  if (!Array.isArray(testProbes) || testProbes.length === 0) {
    return res.status(400).json({ message: "No test probes provided" });
  }

  const session = await getServerSession(
    req,
    res,
    authOptions as NextAuthOptions
  );

  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const effectivePlant = getEffectivePlant(session, fixture_plant ?? null);
  if (!effectivePlant) {
    return res
      .status(400)
      .json({ message: "Missing fixture_plant for this user" });
  }

  const who = modifiedBy(session);

  try {
    for (const rawProbe of testProbes) {
      const pn = String(
        rawProbe.part_number ?? rawProbe.name ?? ""
      ).trim();
      const qtyNum = Number(rawProbe.quantity);

      if (!pn || !Number.isFinite(qtyNum) || qtyNum <= 0) {
        // Skip invalid rows instead of crashing the whole request
        continue;
      }

      // ✅ All logic delegated to stored procedure
      await queryDatabase("CALL addOrUpdateTestProbe(?,?,?,?,?,?)", [
        adapter_code,
        fixture_type,
        effectivePlant,
        pn,
        qtyNum,
        who,
      ]);
    }

    return res.status(200).json({
      message: "All test probes added successfully.",
    });
  } catch (error: any) {
    console.error("Error adding test probes:", error);
    return res.status(500).json({
      message:
        error?.sqlMessage ||
        error?.message ||
        "Internal server error while adding test probes",
    });
  }
}
