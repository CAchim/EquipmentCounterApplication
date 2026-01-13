import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

type AnyUser = Record<string, any>;

function lc(v: any): string {
  return String(v ?? "").toLowerCase();
}

function readRawUserPlant(u?: AnyUser | null): string | null {
  if (!u) return null;
  return (
    (u.fixture_plant as string) ??
    (u.plant_name as string) ??
    (u.plant_id != null ? String(u.plant_id) : null) ??
    null
  );
}

async function resolvePlantName(userPlant: string | null): Promise<string | null> {
  if (!userPlant) return null;
  const isNumeric = /^\d+$/.test(userPlant.trim());
  if (isNumeric) {
    const raw = await queryDatabase<any>(
      "CALL getPlantNameById(?)",
      [Number(userPlant)]
    );
    const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
    if (rows.length > 0 && rows[0].plant_name) {
      return String(rows[0].plant_name);
    }
  }
  return userPlant.trim();
}

async function getEffectivePlantForRequest(opts: {
  session: { user?: AnyUser } | null;
  clientPlant?: string | null;
}): Promise<string | null> {
  const group = lc(opts.session?.user?.user_group);
  if (group === "admin") {
    const p = (opts.clientPlant ?? "").trim();
    return p !== "" ? p : null;
  }
  if (opts.session) {
    const raw = readRawUserPlant(opts.session.user);
    const resolved = await resolvePlantName(raw);
    return resolved || null;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    const session = await getServerSession(req, res, authOptions as NextAuthOptions);

    const clientPlant =
      (req.method === "POST"
        ? typeof (req.body?.plant) === "string" ? req.body.plant : null
        : typeof (req.query?.plant) === "string" ? String(req.query.plant) : null) ?? null;

    const effectivePlant = await getEffectivePlantForRequest({ session, clientPlant });

    // ✅ Stored procedure for listing projects
    const raw = await queryDatabase<any>("CALL getProjectsByPlant(?)", [effectivePlant || null]);
    const data = Array.isArray(raw) ? raw[0] ?? [] : [];
    return res.status(200).json({ message: data });
  } catch (err: any) {
    console.error("getProjects error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
