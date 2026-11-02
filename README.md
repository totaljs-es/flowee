[![UPM](https://www.upm.es/themes/comun/logos/institucional.png)](https://upm.es/internacional/) 

# Total.js Flow Education Edition

__Special thanks to UPM. [(Universidad Politécnica de Madrid)](https://www.upm.es/internacional/)__

[![Made in EU](https://cdn.componentator.com/eu-small.png)](https://european-union.europa.eu/)

- [Website](https://www.totaljs.com/flow/)
- [__Documentation__](https://docs.totaljs.com/flow10/)
- [Chat support](https://platform.totaljs.com/?open=messenger)
- [Join __Total.js Telegram__](https://t.me/totalplatform)
- [Support](https://www.totaljs.com/support/)

## What is this?

**Total.js Flow Education Edition** is [Total.js Flow](https://www.totaljs.com/flow/) prepared to be used in a classroom. It was born thanks to UPM and its version 2 is based on **Total.js Flow 11**.

Flow lets everybody draw FlowStreams (diagrams of components connected by messages) in the browser, for automation, integrations and IoT. In a class, every student needs a place of his own, and the teacher needs to see everything and to give the same exercise to everybody. That is what this edition adds:

- Students work only with **their own FlowStreams**.
- The teacher sees **all of them** and can follow the work of the class.
- The teacher prepares **practice templates** and hands them out to groups or to every student with one click.

The interface is available in **English** and **Spanish** (it follows the language of the user in OpenPlatform).

## How it works

This edition must work inside [OpenPlatform](https://docs.totaljs.com/openplatform/): the users, their groups and their permissions come from it.

| | Teacher (user `sa`) | Student |
|---|---|---|
| FlowStreams in the list | all | only the ones of his groups (and, if a FlowStream has an owner, only his own) |
| Create a FlowStream | in any group, or without a group | only in his groups, and he needs the permission `create` |
| Code of the components (read, edit, remove) | yes | no: they work with the components of the palette of their group and of the template |
| Import FlowStreams | yes | no (they can duplicate their own FlowStream) |
| Edit, run, pause, restart, export, remove | any FlowStream | only his own (`remove` needs the permission `remove`) |
| Editor of a FlowStream | any | only his own |
| Variables of a FlowStream | any | only his own |
| Global variables, settings, console, CDN cache | yes | no |
| Classroom (templates and overview) | yes | no |

The rules are applied in the list, in every action on a FlowStream (read, save, remove, pause, restart, export, import, variables) and in the connection of the editor, so knowing the identifier of a FlowStream is not enough to open it.

### Groups and owners

- Every FlowStream belongs to **a group of OpenPlatform** (the field *OpenPlatform group* of the FlowStream). The list shows the FlowStreams grouped by the name of the group.
- A FlowStream can also have an **owner**. A FlowStream created by a student, and the copies that the teacher hands out to each student, are private to their owner. A FlowStream created by a teacher in a group, without an owner, is shared by all the students of that group.
- A student with only one group does not need to choose it: it is assigned to the FlowStreams that he creates or imports.

## Classroom (teachers)

The teachers have a new section in the left menu: **Classroom**.

### Practice templates

1. Build the exercise as any FlowStream.
2. In the menu of the FlowStream choose **Use as template**. A template is not shown to the students.
3. In **Classroom** press **Assign** in the template and choose the groups:
   - by default **every group receives one copy**, shared by the students of the group;
   - with **One copy for each student of the group**, every student receives **his own copy**, named *template · student*. Only the student and the teachers see it.
4. Assigning again does not repeat the copies that already exist, so it can be used when new students arrive.

A copy keeps the design, the components, the variables and the description of the template, and it starts running by itself.

### Overview

A table with the student, the group, the FlowStream (and the template it comes from), its status (running or paused, errors), the number of messages and the date of the last change. It can be filtered by group, by template and by text, so the teacher can see at once who has not started the exercise and who is working on it.

### Component palette

The students cannot add or edit components, so you decide which ones each group has:

1. Add the components you want to a FlowStream of your own (for example one called *Library*), from the store as usual.
2. In **Classroom**, in *Component palette*, choose a group and tick the components. Save.
3. The FlowStreams of that group get those components (they restart once), and so does every new FlowStream that a student creates or duplicates in the group. The code is kept on the server: nobody in the class can change it.

A component that you remove from a palette stays in the FlowStreams that already have it. The palettes are kept in the preferences of the application (`palettes`).

### Activity

In **Classroom**, *Activity* lists what the students do with their FlowStreams, newest first: they open the editor, apply changes (one record every minute at most), create, duplicate, remove, pause, resume, restart, change the variables, export or deliver; and what the application does by itself (pausing for inactivity, delivering when an exam ends). It also records when a teacher opens or observes the editor of a student, with the name of the teacher. It uses the filters of the students table (group and text) and a period (24 hours, 7 days, 30 days or all the time), and it can be downloaded as a table (CSV).

The activity has **personal data**. It is kept in `databases/activity/` (one file for each month, in the `databases` volume of the container), only for **365 days** by default: `FLOWEE_ACTIVITY_DAYS` changes it and `0` keeps it forever. The months that are older than the retention are deleted every day, and the teacher can clear everything with *Clear the activity*. Tell the students that it is recorded.

### Forbidden components

In **Classroom**, *Forbidden components* takes components away from a group (the palette adds, this removes):

1. Choose a group. The list shows every component found in the FlowStreams, and marks with a warning the ones whose code looks like it reaches files or the shell (`child_process`, `exec`, `fs`, `eval`…). It is a warning from reading the code, not a proof.
2. Tick the ones to forbid, and/or tick *Also forbid the ones that look like they reach files or the shell* to do it automatically with every component, also the ones that arrive later.
3. The FlowStreams of the group lose those components (they restart once), and so does every new FlowStream, copy of a template or restored copy of the group. The nodes that used them stop working. Forbidden wins over the palette.

The rules are kept in the preferences of the application (`denied`). The templates of the teacher are not touched, so they keep their components.

### Observe in real time

In the menu of a row of the students table, **Observe in real time** opens the editor of that student's FlowStream in a new tab, **read only**: an orange bar says so, the controls to change things are not there, and the server refuses any message that would change the FlowStream (the design, the components, the variables, pausing, restarting or removing), so it does not depend on the interface. The teacher sees what the student does: the changes that he applies, the messages and the errors, as they happen. The list of connected editors of the student shows that the teacher is there.

### Exam mode

In **Classroom**, *Exam mode* schedules an exam for a group of OpenPlatform with a start and an end:

- **Before the start and after the end** the students of the group have no access to their FlowStreams (not even with the editor open), and they cannot create new ones in the group. The teachers always have access, and the other groups are not affected.
- **While it is open**, if *Block exporting, copying and duplicating* is ticked (it is by default), a student cannot export, read the raw data or duplicate a FlowStream, so the work does not leave the exam. He can still deliver.
- **When it ends**, if *Deliver the work of every student* is ticked (it is by default), the application delivers the work of every student by itself (they appear in *Deliveries* as *Automatic*). It is done once.
- The students see a message when they enter: the exam is open (until when), has not started or has finished.

After the end the group stays closed until the teacher chooses *End the exam and restore the access* in the menu of the exam. Editing the exam changes its dates and options.

### Deliveries

A student hands in a FlowStream with **Deliver** in its menu. The server keeps a **frozen copy** (design, components and variables) with its date and number: the student can go on working and deliver again, and the copy that the teacher has never changes. The last 20 deliveries of each FlowStream are kept, as files in `databases/deliveries/` (the `databases` volume of the container).

In **Classroom**, *Deliveries* lists them with the same filters (group, template, text) as the students table. For each one the teacher can:

- **Open as a FlowStream:** it becomes a FlowStream of the teacher, without a group, so no student sees it. It can be run and inspected.
- **Download** the copy as JSON.
- **Remove** it.

*Download the last deliveries* gives one JSON file with the last delivery of each FlowStream of the group (and the template) selected in the filters, to grade them.

### Limits for each student

In **Classroom**, *Limits for each student* sets two things (0 is without limit):

- **FlowStreams for each student:** how many FlowStreams a student can create or duplicate. The copies that you hand out from a template are not counted, and the teachers have no limit. At the limit the student gets a clear message.
- **Days without work before pausing:** the running FlowStreams of a student that he has not edited, resumed or restarted for those days are paused (every minute the application looks for them). The student can resume them from the list, and the overview of Classroom shows them as *Inactive*.

The memory of each FlowStream is limited with `flowstream_memory`. `FLOWEE_MAX_STREAMS` and `FLOWEE_IDLE_DAYS` give the default values until the teacher saves them in the panel.

### Restore, open and remove

From the menu of each row the teacher can **open** the FlowStream of a student to help him, **restore** it from the template (the work of the student is replaced by the template) or **remove** it.

## Configuration

The file `config` has the usual settings of Flow plus these:

| Setting | What it does |
|---|---|
| `op_groups` | Optional. The address of the users API of OpenPlatform (`https://my_openplatform/users/?token=[]`, it is enabled in the settings of OpenPlatform). It is needed for **one copy for each student**; without it a template is copied once for each group. The groups of the users come with the session of OpenPlatform, so it is not needed for the rest. |
| `sso` | Optional. The address of an OpenPlatform in the cloud (`https://my.openplatform.cloud`): the sign-in is verified there and the groups and the teacher (`sa`) come from its session. |
| `flowstream_worker` | `fork` (default of this edition): each FlowStream runs in its own process, so a student cannot stop the others. |
| `flowstream_memory` | Maximum memory in MB of each FlowStream (`0` is automatic). Recommended in a class. |
| `$proxytimeout` | Timeout of the proxy of the FlowStreams, in seconds. |

### If Flow EE does not open inside OpenPlatform

When OpenPlatform is served over `https://` and Flow EE is registered with an `http://` address, the browser blocks it (*Mixed Content: requested an insecure frame*) and the application stays blank. Flow EE needs an address with `https://` and a valid certificate (usually the reverse proxy in front of it has it), and OpenPlatform must have that address:

1. Serve Flow EE over `https://` (the proxy with the certificate of its own host name).
2. Set `FLOWEE_OP_URL` (or `op_url` in the config) to that address, for example `https://flowee.my.university`. Behind a proxy that ends the TLS, Flow EE only sees `http://` and it would publish that address in its `openplatform.json`; this setting fixes it.
3. In OpenPlatform, change the address of the application (Setup, Apps) to the same `https://` address.

### If the groups do not appear

The groups of a student come with his session of OpenPlatform. The teacher (the user with `sa`) gets them from the users API of OpenPlatform when `op_groups` (or `FLOWEE_OP_GROUPS`) is set, and from the session when it is not. When there is no group to choose, Flow EE says why when the teacher or the student enters, and the log of the application and the panel of Classroom say what happened with `op_groups`:

- **unset:** there is no `op_groups`: set `FLOWEE_OP_GROUPS` (or `op_groups` in the config) with the address of the users API, `https://my_openplatform/users/?token=THE_TOKEN`, without the brackets of the example.
- **unreachable:** the server of Flow EE cannot reach that address (the name or the port, the network of the container, the certificate). `localhost` inside a container is not the host.
- **denied:** OpenPlatform refuses the token: the public API of the users must be enabled in its settings and the token must be the same.
- **invalid:** the answer is not the users API of OpenPlatform.
- A student with no groups, or whose group does not have the application, sees an empty list: check his groups in OpenPlatform. A teacher needs the `sa` option.

### Configure from the environment

Every setting can also be given as an environment variable: `FLOWEE_` plus the key in upper case. It wins over the file `config` and an empty value is ignored, so a container is configured without editing files (the `docker-compose.yaml` has them all, and reads a `.env` file):

| Variable | Setting |
|---|---|
| `FLOWEE_OP_REQTOKEN`, `FLOWEE_OP_RESTOKEN` | the tokens of the application in OpenPlatform (instead of pasting them in the settings) |
| `FLOWEE_OP_GROUPS` | `op_groups` |
| `FLOWEE_OP_URL` | the public address of Flow EE, with `https://` when it is behind a proxy with a certificate (see below) |
| `FLOWEE_SSO` | `sso` |
| `FLOWEE_OPENPLATFORM` | the address of OpenPlatform for the sign-in redirect |
| `FLOWEE_FLOWSTREAM_WORKER`, `FLOWEE_FLOWSTREAM_MEMORY` | `flowstream_worker`, `flowstream_memory` |
| `FLOWEE_PROXYTIMEOUT` | `$proxytimeout` |
| `FLOWEE_NAME` | `name` |
| `FLOWEE_MAX_STREAMS`, `FLOWEE_IDLE_DAYS` | the default of the limits for each student (see Limits for each student) |
| `FLOWEE_ACTIVITY_DAYS` | the days that the activity is kept (365 by default, 0 forever) |

```bash
docker run -p 8000:8000 -e FLOWEE_SSO=https://my.openplatform.cloud -e FLOWEE_FLOWSTREAM_MEMORY=512 ghcr.io/totaljs-es/flowee
```

Every FlowStream is an independent process: a class with many students needs memory for them. As a reference, plan for the memory of the largest class that runs at the same time and limit it with `flowstream_memory`.

## OpenPlatform

1. Register Flow EE in OpenPlatform as an application (its `openplatform.json` is served by the application).
2. Create a **group for each class** (or for each student if you want the work of each student to stay private even without owners).
3. Give the application to the groups of the students and of the teachers. The users with `sa` are the teachers.
4. The application offers two permissions: **Create Flows** (`create`) and **Remove Flows** (`remove`). Give `create` to the students.
5. Open Flow EE for the first time, sign in with the default account that the login page shows and, in the settings, paste the **request token** and the **response token** of the application (the same ones that you gave to OpenPlatform), or give them as `FLOWEE_OP_REQTOKEN` and `FLOWEE_OP_RESTOKEN`. From then on the users enter through OpenPlatform.
6. Optional: enable the public API of the users in OpenPlatform and put its address in `op_groups`.

## Data

The FlowStreams are saved by Flow as usual. This edition adds these properties to a FlowStream: `group` (the id of the group of OpenPlatform), `ownerid` and `ownername` (the student), `template` (the FlowStream is a template) and `templateid` (the template that a copy comes from).

## Tests

```bash
npm install
npm test
```

The test starts a fake OpenPlatform and a temporary copy of the application, and checks the access of a teacher and of several students (the list, every action on a FlowStream, the editor, the variables, the settings, the templates, the copies for each student, the privacy between classmates and the restoring of a copy). Nothing is written in the folder of the project.

## Translations

`resources/es.resource` has the Spanish texts. The texts of Flow that are not in the file are shown in English.

## Ideas for the next versions

We are still working on additional tasks in collaboration with UPM, and we are open to ideas. Tell us what your class needs.

## Installation

There are several ways to provide Flow EE. You can use our cloud services and run Flow EE without installation, or use Docker, or download the source code locally.

### Locally

- install [Node.js platform](https://nodejs.org/en/)
- download Flow EE source code
- open terminal/command-line:
	- `cd flowee`
	- `npm install`

__Run__:

```
npm run start
```

or directly using node executable (port is optional, default 8000)

```
node index.js <port>
```

### Flow in Docker

From the GitHub Container Registry ([package](https://github.com/totaljs-es/flowee/pkgs/container/flowee), built by GitHub Actions on every push to `master`):

```bash
docker pull ghcr.io/totaljs-es/flowee
docker run -p 8000:8000 \
  -v flowee-databases:/www/databases -v flowee-flowstream:/www/flowstream -v flowee-private:/www/private \
  ghcr.io/totaljs-es/flowee
```

The three volumes keep the settings, the FlowStreams of the class and the private files when the container is replaced by a newer image. With the source code, `docker compose up` does the same.

The website of this edition (English and Spanish) is in [`docs/`](docs/index.html): https://totaljs-es.github.io/flowee/
