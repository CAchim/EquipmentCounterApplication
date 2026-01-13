import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import queryDatabase from "../../../lib/database";

const lc = (v: any) => String(v ?? "").toLowerCase();

function readUserPlantFromSession(session: any): string | null {
  const u = session?.user ?? {};
  const fp = u.fixture_plant;
  const pn = u.plant_name;
  const pid = u.plant_id;
  if (typeof fp === "string" && fp.trim() !== "") return fp.trim();
  if (typeof pn === "string" && pn.trim() !== "") return pn.trim();
  if (pid != null) return String(pid);
  return null;
}

async function resolvePlantIfNumeric(plantMaybeId: string | null): Promise<string | null> {
  if (!plantMaybeId) return null;
  const v = String(plantMaybeId).trim();
  if (!/^\d+$/.test(v)) return v;

  const rows: any = await queryDatabase(
    "SELECT plant_name FROM Plants WHERE entry_id = ? LIMIT 1",
    [Number(v)]
  );
  if (Array.isArray(rows) && rows.length && rows[0]?.plant_name) return String(rows[0].plant_name);
  return v;
}

export async function requireAnalyticsAuth(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  if (!session?.user) {
    res.status(401).json({ ok: false, message: "Unauthorized" });
    return { ok: false as const };
  }

  const groupLC = lc(session.user.user_group);
  const isAdmin = groupLC === "admin";
  const isEngineer = groupLC === "engineer";

  if (!isAdmin && !isEngineer) {
    res.status(403).json({ ok: false, message: "Forbidden" });
    return { ok: false as const };
  }

  const userPlant = await resolvePlantIfNumeric(readUserPlantFromSession(session));
  return { ok: true as const, session, isAdmin, isEngineer, userPlant };
}
