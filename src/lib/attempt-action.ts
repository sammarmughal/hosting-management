/** Keep transport failures in the same recoverable UI as action validation failures. */
export async function attemptAction<T>(action: () => Promise<T>): Promise<T | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  try {
    return await action()
  } catch {
    return { ok: false, error: "Couldn’t complete this action. Check your connection and try again." }
  }
}
