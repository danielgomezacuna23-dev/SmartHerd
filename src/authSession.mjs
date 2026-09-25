// Supabase can confirm an existing session with SIGNED_IN after tab focus.
// Only a different account or a sign-out should discard the current workspace.
export function shouldResetWorkspace(previousUserId, nextUserId, event) {
  return event === "SIGNED_OUT" || previousUserId !== nextUserId;
}
