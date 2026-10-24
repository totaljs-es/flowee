# AGENTS.md

Guidance for AI coding agents. The first part is for an agent that **uses** Flow Education Edition; the second is for one that **works on** this repository.

## Project

Flow Education Edition (`flow_ee`, version 2.0) is [Total.js Flow](https://www.totaljs.com/flow/) prepared for a classroom, built with UPM (Universidad Politécnica de Madrid). It is based on Total.js Flow 11 and runs inside [OpenPlatform](https://docs.totaljs.com/openplatform/): the users, their groups and their permissions come from it.

- **Students** work only with their own FlowStreams (the ones of their groups; if a FlowStream has an owner, only the owner).
- **Teachers** (the users with `sa`) see all of them, prepare **practice templates** in the *Classroom* panel and hand them out to groups or to every student.
- English and Spanish (`resources/es.resource`; the language follows the user in OpenPlatform).

Node.js 24 (the Docker image is `node:24-alpine`). Dependency: `total5`. Plain JavaScript, no TypeScript (Total.js does not support it: never add types or `.d.ts`). License: MIT.

## Using it

```bash
npm install
npm start                      # node index.js 8000
```

```bash
docker run -p 8000:8000 ghcr.io/totaljs-es/flowee      # also totaljses/flowee on Docker Hub
docker compose up                                      # docker-compose.yaml keeps databases and flowstream in volumes
```

- **It needs OpenPlatform.** Register it as an application (it serves its own `openplatform.json`), create a group for each class, give the application to the groups, and give the permission `create` to the students (`remove` is optional).
- **Configuration** is the `config` file. `op_groups` (optional) is the address of the users API of OpenPlatform and is needed for *one copy for each student*; `flowstream_worker : fork` makes each FlowStream its own process; `flowstream_memory` limits the memory of each one. The README has the whole table.
- **Data:** FlowStreams are saved by Flow as usual. This edition adds `group`, `ownerid`, `ownername`, `template` and `templateid` to a FlowStream.
- The documentation is `README.md`. For models: `llms.txt`.

## Repository layout

- `index.js` starts Total.js 5 (`F.run`). `config` is the configuration. `version` is the release notes of the edition.
- `actions/` are the actions of the API (`streams.js`, `variables.js`, `settings.js`, `console.js`, `cdn.js`, `auth.js`); `controllers/default.js` the routes of the pages; `views/` the pages of the designer.
- `definitions/` has the shared logic. **`definitions/education.js` is where the access rules live** (`FUNC.streamaccess`, `FUNC.streamgroupallowed`, `FUNC.streamgroups`); `definitions/flowstream.js` and `definitions/auth.js` connect them to Flow and to the session.
- `modules/openplatform.js` talks to OpenPlatform; `modules/cdn.js` is the CDN cache.
- `plugins/classroom/` (the teacher panel) and `plugins/bookmarks/` are the plugins of the interface: `index.js` (backend) and `public/` (frontend).
- `--components--/` are extra Flow components; `--extensions--/` and `extensions.js` load 3rd-party extensions into each FlowStream (do not remove `extensions.js`).
- `--bundles--/*.bundle` are the **built** application and plugins; `bundle.sh` builds them. The Docker image runs from the bundles, not from the source.
- `tests/education.js` is the test. `resources/es.resource` has the Spanish texts. `Dockerfile` and `docker-compose.yaml` build and run the image.
- `.github/workflows/docker-image.yml` builds the image (linux/amd64 and linux/arm64) and publishes it to `ghcr.io/<owner>/flowee` on every push to `master` (`latest`, `sha-…`) and on every tag `v*` (`1.2.3`, `1.2`). A pull request only builds it. It needs no secrets.
- For agents: this file, `CLAUDE.md` and `GEMINI.md` (they import it), `.github/copilot-instructions.md`, `.claude/skills/` (two checklists: change and bundle, verify a change), `.claude/settings.json` (the commands that are safe to run without asking), and `llms.txt`. For Codex this file is the native entry point; the entries of `.agents/skills/` reuse the checklists of `.claude/skills/`.

## Commands

```bash
npm install
npm test                      # tests/education.js: 45 checks, starts a fake OpenPlatform and a temporary copy of the app
npm start                     # port 8000
./bundle.sh                   # rebuild --bundles--/*.bundle from the source
docker build -t flowee .      # the image
```

The test writes nothing in this folder. `TOTAL5=/path/to/total5 npm test` tests another copy of the framework.

## Conventions

- Plain JavaScript in the style of Total.js 5: tabs, single quotes, semicolons. Use the Total.js globals (`NEWACTION`, `FUNC`, `CONF`, `REPO`, `Flow`…) as the surrounding code does.
- Actions return with `$.callback()` and fail with `$.invalid()`. **The access to a FlowStream is checked on the server in every action and in the connection of the editor**: a new action that receives a FlowStream id must call `FUNC.streamaccess` (and `FUNC.streamgroupallowed` if it chooses a group). Hiding something in the interface is not security.
- New texts are written in English in the code (`@(Text)`) and translated in `resources/es.resource`.
- A change comes with a check in `tests/education.js`, and a check must be able to fail: **break the rule on purpose and see the check fail** before you trust it.

## Pitfalls

- **The bundles are the product.** After a change in `actions/`, `controllers/`, `definitions/`, `modules/`, `views/`, `resources/`, `public/`, `extensions.js`, `version` or a plugin, run `./bundle.sh` and commit the regenerated `--bundles--/*.bundle`. The `Dockerfile` copies `app.bundle`, `bookmarks.bundle` and `classroom.bundle` by name: a new plugin needs its own `COPY` line there.
- **Do not commit** runtime state: `databases/`, `flowstream/`, `logs/`, `node_modules/`, `index.js.json`, `index.js.map`, `package-lock.json` (all in `.gitignore`).
- The image has no lock file: `npm install` takes `total5` `latest`. Say so if a behaviour depends on the version of the framework.
- A student must never be able to stop the others: keep `flowstream_worker : fork` as the default of this edition.
- The first image published to `ghcr.io` may start private: make the package public in its settings if it should be pulled without logging in.
