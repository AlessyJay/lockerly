# Lockerly

## Memory docs (read first, update last)
The `memory-docs/` folder is Claude's handoff between sessions. Both files are imported below, so they load automatically.

**At the end of every task that changed anything, before the final reply:**
1. Add a dated entry at the top of `memory-docs/session-log.md`: what was done and why, files touched, what's left or broken.
2. Update its "Current state" section.
3. If architecture, conventions, env, or known issues changed, update `memory-docs/overview.md` to match (delete stale lines; don't just append).

Keep it factual and short. Write what the next session needs to continue without re-reading the whole codebase.

@memory-docs/overview.md
@memory-docs/session-log.md
