import type { Session } from "next-auth";

type AnyUser = Record<string, any>;

function readUserPlant(u?: AnyUser | null): string | null {
  if (!u) return null;
  // Try the most likely fields, in order
  return (
    (u.fixture_plant as string) ??
    (u.plant_name as string) ??
    (u.plant_id?.toString?.() as string) ??
    null
  );
}

/**
 * Decide which plant to filter by, based on:
 * - Admin: use selectedPlant (empty/undefined => show all)
 * - Non-admin (logged-in): always the user's own plant
 * - Not logged-in: show all
 *
 * Returns: string | null  (null means "show all")
 */
export function getEffectivePlantForFetch(opts: {
  session: Session | null;
  selectedPlant?: string | null;
}): string | null {
  const user = opts.session?.user as AnyUser | undefined;
  const group = user?.user_group as string | undefined;

  if (group === "admin") {
    return opts.selectedPlant && opts.selectedPlant.trim() !== ""
      ? opts.selectedPlant.trim()
      : null; // show all
  }

  if (opts.session) {
    const userPlant = readUserPlant(user);
    return userPlant ? userPlant : null; // lock to user's plant if available
  }

  // Not logged ⇒ show all
  return null;
}

/**
 * Same logic, but used server-side (API). We *ignore* any client-supplied plant
 * if the user is not admin.
 */
export function getEffectivePlantForApi(opts: {
  session: Session | null;
  clientPlant?: string | null;
}): string | null {
  return getEffectivePlantForFetch({
    session: opts.session,
    selectedPlant: opts.clientPlant,
  });
}
