# Instructions for GitHub Copilot

The full instructions of this repository are in `AGENTS.md`. The ones that matter most:

- Flow Education Edition is Total.js Flow 11 for a classroom, on Total.js 5, inside OpenPlatform. Plain JavaScript (tabs, single quotes), no TypeScript.
- The access to a FlowStream is checked on the server (`FUNC.streamaccess` in `definitions/education.js`) in every action: a student only works with his own FlowStreams.
- The Docker image runs from `--bundles--/*.bundle`: after a change, run `./bundle.sh` and commit the bundles.
- Run `npm test` before you say that something works. A check must be able to fail: break the rule and see it fail.
- Do not commit `databases/`, `flowstream/`, `logs/`, `node_modules/`.
