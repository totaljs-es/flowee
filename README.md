[![UPM](https://www.upm.es/themes/comun/logos/institucional.png)](https://upm.es/internacional/) 

# Total.js Flow Education Edition.

__Special thanks to UPM. [(Universidad Politécnica de Madrid)](https://www.upm.es/internacional/)__

[![Made in EU](https://cdn.componentator.com/eu-small.png)](https://european-union.europa.eu/)

- [Website](https://www.totaljs.com/flow/)
- [__Documentation__](https://docs.totaljs.com/flow10/)
- [Chat support](https://platform.totaljs.com/?open=messenger)
- [Join __Total.js Telegram__](https://t.me/totalplatform)
- [Support](https://www.totaljs.com/support/)

## Education Edition

This special edition of Total.js Flow was born thanks to UPM. [(Universidad Politécnica de Madrid)](https://www.upm.es/internacional/) In order to use Total.js Flow in a classroom.

## What is different in this edition of Total.js Flow?

This edition is based on **Total.js Flow 11** and adds the classroom layer:

- This version must be working inside [OpenPlatform](https://docs.totaljs.com/openplatform/).
- Every FlowStream belongs to a group of OpenPlatform (the field *OpenPlatform group* of the FlowStream).
- **Students** see and work only with the FlowStreams of their own groups. They can create FlowStreams only in their groups.
- **Teachers** (users `sa` of OpenPlatform) see and work with every FlowStream and can choose any group.
- The rules are applied in the list, in every action on a FlowStream (read, save, remove, pause, restart, export, import, variables) and in the connection of the editor, so knowing the identifier of a FlowStream is not enough to open it.
- The global variables, the settings and the console of the application are for the teachers.
- The groups come with the session of OpenPlatform. The setting `op_groups` of the `config` is optional.

### Classroom (teachers)

The teachers have a new section, **Classroom**:

- **Practice templates.** In the menu of a FlowStream choose *Use as template*. The template is not shown to the students.
- **Assign.** Choose a template and the groups: every group receives a copy, or, with *One copy for each student of the group*, every student receives his own copy. The students see only their own copy (the copies have an owner). Assigning again does not repeat the copies that already exist.
- **Overview.** A table with the student, the group, the FlowStream, its status, the messages and the last change. It can be filtered by group, by template and by text.
- **Restore.** The work of a student can be replaced by the template again. A copy can be removed or opened as any FlowStream.

The copies for each student need the address of the users API of OpenPlatform in the setting `op_groups` of the `config` (the public API of the users, with its token). Without it, the template is copied once for each group.

The FlowStreams that a student creates are private to him. The FlowStreams that a teacher creates in a group are shared by the students of that group.

We are still working on additional tasks in collaboration with UPM.

## Tests

```bash
npm install
npm test
```

The test starts a fake OpenPlatform and a temporary copy of the application, and checks the access of a teacher and of three students. Nothing is written in the folder of the project.

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

```bash
docker pull totaljses/flowee
docker run -p 8000:8000 totaljses/flowee
````
