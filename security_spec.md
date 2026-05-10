# Security Specification for V-Astra AI

## 1. Data Invariants
- A chat session must be owned by the authenticated user.
- Messages must belong to a session owned by the user.
- Users can only read/write their own sessions and messages.
- User profiles can only be managed by the owner.
- Timestamps must be server-validated where possible.

## 2. The "Dirty Dozen" Payloads

1. **Identity Theft (Session)**: Create a session with someone else's `userId`.
2. **Session Hijack**: Update another user's session title.
3. **Ghost Message**: Send a message to a session owned by another user.
4. **Role Spoofing**: Send a message with `role: "admin"` (if not in enum).
5. **Timeline Warp**: Set a `createdAt` in the future.
6. **Shadow Update**: Add a field `isVerified: true` to a UserProfile.
7. **Bypass Owner**: Delete a session belonging to another user.
8. **Resource Exhaustion**: Send a message with 10MB of text.
9. **ID Poisoning**: Create a session with a document ID that is just a very long string of junk.
10. **PII Leak**: Read another user's private settings in `/users/{userId}`.
11. **Malicious Role**: A user trying to set their role to 'model' for an incoming message (the app should handle this, but the DB should ensure integrity).
12. **Orphaned Write**: Create a message in a session that doesn't exist yet (not directly possible in Firestore if we enforce existence of parent).

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify these scenarios. Due to environment limits, I will focus on the rules logic.
