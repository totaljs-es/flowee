---
name: flowee-change
description: Use when asked to change Flow Education Edition (an action, a rule of access, a plugin of the interface, a view, a text).
---

# Change the application

1. **Read the rules first.** `definitions/education.js` is who can do what; `AGENTS.md` has the conventions. A new action that receives a FlowStream id must call `FUNC.streamaccess` (and `FUNC.streamgroupallowed` for a group). Teacher-only actions use `sa: true`.
2. **Make the change in the source** (`actions/`, `definitions/`, `plugins/<name>/`, `views/`, `resources/es.resource`). New texts are English in the code and Spanish in `resources/es.resource`.
3. **Add a check to `tests/education.js`** for the new behaviour, and for what must stay denied to a student.
4. **A new plugin?** Its folder is `plugins/<name>/{index.js, public/}`. The image copies the whole source, so nothing else is needed.
5. **Nothing to build:** the image runs from the source.
6. **Add a line to `version`** if the change is visible to users.
7. Verify it (see the skill *flowee-verify-change*).
