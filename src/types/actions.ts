// Every Server Action returns this shape (docs/07 §2).
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
