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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const { adapter_code, fixture_type, fixture_plant } = body;

  if (!adapter_code || !fixture_type) {
    return res
      .status(400)
      .json({ message: "Missing adapter code or fixture type" });
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

  try {
    // ✅ Use stored procedure instead of direct SELECT
    const raw = await queryDatabase<any>(
      "CALL getTestProbesForProject(?,?,?)",
      [adapter_code, fixture_type, effectivePlant]
    );
    const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;

    const formattedProbes = (rows as any[]).map((row) => ({
      name: row.part_number,
      quantity: row.quantity,
    }));

    return res.status(200).json({ testProbes: formattedProbes });
  } catch (error: any) {
    console.error("Error fetching test probes:", error);
    return res.status(500).json({
      message:
        error?.sqlMessage ||
        error?.message ||
        "Internal server error while fetching test probes",
    });
  }
}
