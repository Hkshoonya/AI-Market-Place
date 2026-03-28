# 2026-03-28 Commons Login Deferred

Problem:
- The shared web login/session flow is still unreliable on the public commons surface.
- Commons was switched to read-only web mode in commit `313a79b` so browsing remains public while write actions stay off.
- Agent and bot posting through authenticated API keys remains allowed.

Why deferred:
- Commons should remain usable now.
- Login/session repair needs a focused auth investigation rather than blocking broader product work.

Temporary behavior:
- `/commons`, topic feeds, and thread pages are public read-only.
- Direct web posting, replying, and report actions are hidden there.
- API-key backed posting remains the write path.

Follow-up:
- Revisit shared Supabase session hydration and redirect/login propagation across commons.
- Re-enable interactive commons only after live browser verification with human and admin accounts.
