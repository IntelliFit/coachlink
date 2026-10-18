/**
 * Coach and student actions carry no illustration of their own; the reviewed reference images
 * live on canonical_actions. This returns a copy of the actions map where every action that is
 * linked to a canonical action (and has no image yet) gets that canonical reference image.
 * Failures leave the map unchanged: images are decoration and must never block a plan load.
 */
type ActionRecord = Record<string, any>;

interface CanonicalImageRow {
  id: string;
  reference_image_url: string | null;
}

interface CanonicalImageClient {
  from(table: "canonical_actions"): {
    select(columns: string): {
      in(column: string, values: string[]): PromiseLike<{ data: CanonicalImageRow[] | null; error: unknown }>;
    };
  };
}

function canonicalIdOf(action: ActionRecord | null | undefined): string | null {
  const id = action?.canonical_action_id ?? action?.canonicalActionId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function withCanonicalReferenceImages(
  client: CanonicalImageClient,
  actionsMap: Record<string, ActionRecord>,
): Promise<Record<string, ActionRecord>> {
  const canonicalIds = Array.from(new Set(
    Object.values(actionsMap)
      .filter((action) => !action?.reference_image_url)
      .map(canonicalIdOf)
      .filter((id): id is string => !!id),
  ));
  if (canonicalIds.length === 0) return actionsMap;

  try {
    const { data, error } = await client
      .from("canonical_actions")
      .select("id,reference_image_url")
      .in("id", canonicalIds);
    if (error || !data?.length) return actionsMap;

    const imageByCanonicalId = new Map(
      data.filter((row) => !!row.reference_image_url).map((row) => [row.id, row.reference_image_url as string]),
    );
    return Object.fromEntries(
      Object.entries(actionsMap).map(([id, action]) => {
        const image = !action?.reference_image_url ? imageByCanonicalId.get(canonicalIdOf(action) || "") : undefined;
        return [id, image ? { ...action, reference_image_url: image } : action];
      }),
    );
  } catch (error) {
    console.warn("[actionReferenceImages] canonical image lookup failed", error);
    return actionsMap;
  }
}
