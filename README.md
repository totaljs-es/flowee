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

### Restore, open and remove

From the menu of each row the teacher can **open** the FlowStream of a student to help him, **restore** it from the template (the work of the student is replaced by the template) or **remove** it.

## Configuration

The file `config` has the usual settings of Flow plus these:

| Setting | What it does |
|---|---|
| `op_groups` | Optional. The address of the users API of OpenPlatform (`https://my_openplatform/users/?token=[]`, it is enabled in the settings of OpenPlatform). It is needed for **one copy for each student**; without it a template is copied once for each group. The groups of the users come with the session of OpenPlatform, so it is not needed for the rest. |
| `flowstream_worker` | `fork` (default of this edition): each FlowStream runs in its own process, so a student cannot stop the others. |
| `flowstream_memory` | Maximum memory in MB of each FlowStream (`0` is automatic). Recommended in a class. |
| `$proxytimeout` | Timeout of the proxy of the FlowStreams, in seconds. |

Every FlowStream is an independent process: a class with many students needs memory for them. As a reference, plan for the memory of the largest class that runs at the same time and limit it with `flowstream_memory`.

## OpenPlatform

1. Register Flow EE in OpenPlatform as an application (its `openplatform.json` is served by the application).
2. Create a **group for each class** (or for each student if you want the work of each student to stay private even without owners).
3. Give the application to the groups of the students and of the teachers. The users with `sa` are the teachers.
4. The application offers two permissions: **Create Flows** (`create`) and **Remove Flows** (`remove`). Give `create` to the students.
5. Optional: enable the public API of the users in OpenPlatform and put its address in `op_groups`.

## Data

The FlowStreams are saved by Flow as usual. This edition adds these properties to a FlowStream: `group` (the id of the group of OpenPlatform), `ownerid` and `ownername` (the student), `template` (the FlowStream is a template) and `templateid` (the template that a copy comes from).

## Tests

```bash
npm install
npm test
```

The test starts a fake OpenPlatform and a temporary copy of the application, and checks the access of a teacher and of three students (the list, every action on a FlowStream, the editor, the variables, the settings, the templates, the copies for each student, the privacy between classmates and the restoring of a copy). Nothing is written in the folder of the project.

## Translations

`resources/es.resource` has the Spanish texts. The texts of Flow that are not in the file are shown in English.

## Ideas for the next versions

We are still working on additional tasks in collaboration with UPM. Some ideas to talk about:

- Limits for each student (number of FlowStreams, memory) and automatic pause of the FlowStreams that are not used.
- A palette of components for each course (for example, without access to files or to the shell).
- Deliveries: snapshots of the work, history of changes and export of a group to grade it.
- Exam mode: open and close the access by dates.
- Read-only observer mode to follow the editor of a student live.

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
docker run -p 8000:8000 ghcr.io/totaljs-es/flowee
```
