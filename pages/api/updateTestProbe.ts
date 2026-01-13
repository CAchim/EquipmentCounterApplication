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

  if (group === "admin") {
    const fromBody = (bodyPlant ?? "").trim();
    if (fromBody !== "") return fromBody;
    const fromSession = (readUserPlant(session?.user) || "").trim();
    return fromSession || null;
  }

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
    original_name,
    new_name,
    new_quantity,
    fixture_plant,
  } = body;

  if (!adapter_code || !fixture_type) {
    return res
      .status(400)
      .json({ message: "Missing adapter code or fixture type" });
  }

  if (!original_name || !new_name || new_quantity === undefined) {
    return res.status(400).json({
      message: "Missing original_name, new_name or new_quantity",
    });
  }

  const quantityNum = Number(new_quantity);
  if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
    return res.status(400).json({ message: "Quantity must be > 0" });
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
    // Strategy:
    // 1) delete old part_number
    // 2) addOrUpdate new part_number with new quantity
    await queryDatabase("CALL deleteTestProbe(?,?,?,?,?)", [
      adapter_code,
      fixture_type,
      effectivePlant,
      original_name,
      who,
    ]);

    await queryDatabase("CALL addOrUpdateTestProbe(?,?,?,?,?,?)", [
      adapter_code,
      fixture_type,
      effectivePlant,
      new_name,
      quantityNum,
      who,
    ]);

    const raw = await queryDatabase<any>(
      "CALL getTestProbesForProject(?,?,?)",
      [adapter_code, fixture_type, effectivePlant]
    );
    const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;

    const probes = (rows as any[]).map((row) => ({
      part_number: row.part_number,
      quantity: row.quantity,
    }));

    return res.status(200).json({
      message: "Test probe updated successfully",
      testProbes: probes,
    });
  } catch (error: any) {
    console.error("Error updating test probe:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      details: error?.sqlMessage || error?.message || "Unknown error",
    });
  }
}
