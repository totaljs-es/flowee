---
name: flowee-verify-change
description: Use when you finish a change to Flow Education Edition (code, a plugin, the Dockerfile or the workflow) and have to check it before you say that it works.
---

# Verify a change

Say that something works only after you have **run** it. In this order, from the cheapest:

1. **The tests:** `npm test` (needs `npm install` once). It starts a fake OpenPlatform and a temporary copy of the app, and checks a teacher and three students. Report the numbers as they are (`45 of 45 checks passed`), and what failed.
2. **Make the check able to fail.** Break the rule on purpose (remove the call to `FUNC.streamaccess` in the action that you touched) and see the check fail, then put it back. A check that you never saw fail may check nothing.
3. **The bundles are up to date:** run `./bundle.sh` and look at `git status`. If the bundles change, they were out of date and are part of the change.
4. **The image** (if you changed `Dockerfile`, the bundles or `package.json`): `docker build -t flowee .` and `docker run --rm -p 8000:8000 flowee`, then open `http://localhost:8000`. If Docker is not available, say that the image was not built.
5. **The workflow** (`.github/workflows/docker-image.yml`) can only be fully verified on GitHub: it runs on a pull request (build only) and on a push to `main` (publish). Say so instead of calling it verified.
6. **Clean:** `git status` shows no `databases/`, `flowstream/`, `logs/` or `index.js.map`.
