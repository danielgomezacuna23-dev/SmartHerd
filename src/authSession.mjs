// Supabase can confirm an existing session with SIGNED_IN after tab focus.
// A transient event without a session is not a sign-out.
export function shouldResetWorkspace(previousUserId, nextUserId, event) {
  return event === "SIGNED_OUT" || (nextUserId != null && previousUserId !== nextUserId);
}
