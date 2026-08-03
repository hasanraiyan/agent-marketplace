/**
 * Shared bulk-delete runner for the Developer Platform's `POST
 * /:resource/bulk-delete` endpoints. Runs each id's existing single-delete
 * service method independently (`Promise.allSettled`) so one blocked/
 * not-found id doesn't abort the rest of the batch.
 *
 * Failure reasons are intentionally generic — not the raw service error
 * message — to preserve the same existence-hiding behavior (AD-07 §29)
 * every single-delete controller already applies: a caller can't tell
 * whether an id failed because it doesn't exist, isn't theirs, or (for
 * Provider/Skill/MCP) is still referenced by an Agent.
 */
export async function bulkDelete(ids, deleteOne) {
  const settled = await Promise.allSettled(ids.map((id) => deleteOne(id)));

  const deleted = [];
  const failed = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deleted.push(ids[index]);
    } else {
      failed.push({
        id: ids[index],
        reason: 'Not found, not authorized, or blocked by a dependency',
      });
    }
  });

  return { deleted, failed };
}

export default bulkDelete;
