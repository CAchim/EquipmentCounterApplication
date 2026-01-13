import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

type AnyUser = Record<string, any>;

function str(v: any) {
  return typeof v === "string" ? v.trim() : "";
}
function lc(v: any) {
  return String(v ?? "").toLowerCase();
}
function isAdminOrIE(session: any) {
  const g = lc(session?.user?.user_group);
  return g === "admin" || g === "engineer";
}
function modifiedBy(session: any) {
  return session?.user?.email || session?.user?.user_id || "system";
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

  try {
    const session = await getServerSession(
      req,
      res,
      authOptions as NextAuthOptions
    );
    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!isAdminOrIE(session)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const adapter_code = str(body.adapter_code);
    const fixture_type = str(body.fixture_type);
    const fixture_plant = str(body.fixture_plant);

    if (!adapter_code || !fixture_type) {
      return res.status(400).json({ message: "Missing adapter_code or fixture_type" });
    }

    const effectivePlant = getEffectivePlant(session, fixture_plant || null);
    if (!effectivePlant) {
      return res
        .status(400)
        .json({ message: "Missing fixture_plant for this user" });
    }

    const result = await queryDatabase(
      "CALL removeAllTestProbes(?,?,?,?)",
      [adapter_code, fixture_type, effectivePlant, modifiedBy(session)]
    );

    return res.status(200).json({ message: result });
  } catch (err) {
    console.error("removeAllTPs error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
