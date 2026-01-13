import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ status: 405, message: "Method not allowed" });
    }
    const session = await getServerSession(req, res, authOptions as any);

    if (!session) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    const safeSession: any = session || {};
    const user: any = safeSession.user || {};
    const userGroup = String(user.user_group || "").toLowerCase();


    if (userGroup !== "admin") {
      return res.status(403).json({ status: 403, message: "Forbidden" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { adapter_code, fixture_type, contacts, fixture_plant } = body;

    if (!adapter_code || !fixture_type || contacts === undefined || contacts === null) {
      return res.status(400).json({
        status: 400,
        message: "Missing adapter_code, fixture_type or contacts",
      });
    }

    const plant =
      fixture_plant ||
      user.fixture_plant ||
      null;

    if (!plant) {
      return res
        .status(400)
        .json({ status: 400, message: "Missing fixture_plant (no plant on session or request)" });
    }

    const numericContacts = Number(contacts);
    if (!Number.isFinite(numericContacts) || numericContacts < 0) {
      return res
        .status(400)
        .json({ status: 400, message: "contacts must be a non-negative number" });
    }

    const modifiedBy = user.email || user.name || "unknown";

    await queryDatabase("CALL updateContacts(?, ?, ?, ?, ?)", [
      adapter_code,
      fixture_type,
      plant,
      numericContacts,
      modifiedBy,
    ]);

    // We don't depend on SELECT from the procedure, we just assume no error = success
    return res.status(200).json({
      status: 200,
      message: `Contacts updated to ${numericContacts} for ${adapter_code} / ${fixture_type} at plant ${plant}`,
    });
  } catch (err: any) {
    console.error("Error in /api/updateContacts:", err);
    return res.status(500).json({
      status: 500,
      message: err.sqlMessage || err.message || "Server error",
    });
  }
}
