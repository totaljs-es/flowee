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
