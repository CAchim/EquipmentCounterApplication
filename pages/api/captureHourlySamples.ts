import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

const SECRET = process.env.ANALYTICS_SECRET || "analyticsSecret123";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const secret = (req.query.secret as string) || "";
  if (secret !== SECRET) return res.status(403).json({ message: "Forbidden" });

  const plant = typeof req.query.plant === "string" ? req.query.plant.trim() : "";

  try {
    await queryDatabase("CALL captureHourlySamples(?)", [plant]); // '' => all plants
    return res.status(200).json({ ok: true, plant: plant || "ALL" });
  } catch (e: any) {
    console.error("[captureHourlySamples] error:", e);
    return res.status(500).json({ ok: false, error: String(e?.sqlMessage || e?.message || e) });
  }
}
