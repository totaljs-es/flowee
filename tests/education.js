// Tests of the Education Edition: the access of the teachers and the students to the FlowStreams.
//
//   npm install && npm test
//
// It starts a small fake OpenPlatform and a temporary copy of this application (nothing is written in this folder),
// and then calls the API as a teacher and as three students. Use TOTAL5=/path/to/total5 to test another copy of the framework.

const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Http = require('http');
const Crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = Path.join(__dirname, '..');
const OP_PORT = 8470;
const APP_PORT = 8471;
const BASE = 'http://127.0.0.1:' + APP_PORT;

const md5 = (value, salt) => Crypto.createHash('md5').update(value + (salt || ''), 'utf8').digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The users of the fake OpenPlatform: a teacher (sa) and three students
const USERS = {
	teacher: { id: 't1', name: 'Teacher', sa: true, groups: ['g1', 'g2'], permissions: ['create', 'remove'] },
	s1: { id: 's1', name: 'Student 1', sa: false, groups: ['g1'], permissions: ['create'] },
	s2: { id: 's2', name: 'Student 2', sa: false, groups: ['g2'], permissions: ['create'] },
	s3: { id: 's3', name: 'Student 3', sa: false, groups: ['g1', 'g2'], permissions: [] }
};

const GROUPS = [{ id: 'g1', name: 'Class A' }, { id: 'g2', name: 'Class B' }, { id: 'g3', name: 'Class C' }];

function fakeop() {
	return Http.createServer(function(req, res) {
		const token = new URL(req.url, 'http://x').searchParams.get('token').split('~')[0];
		const user = USERS[token];
		if (!user) {
			res.statusCode = 401;
			res.end('Invalid');
			return;
		}
		const output = Object.assign({ iframe: false, openplatformid: 'op', openplatform: 'http://127.0.0.1:' + OP_PORT, appid: 'flow', language: 'en', platform: { name: 'OpenPlatform', groups: GROUPS, apps: [] } }, user);
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(output));
	}).listen(OP_PORT);
}

function opurl(name) {
	const base = 'http://127.0.0.1:' + OP_PORT + '/verify/?token=' + name;
	return base + '~' + md5(base, 'REQ');
}

async function api(user, schema, data) {
	const response = await fetch(BASE + '/fapi/?openplatform=' + encodeURIComponent(opurl(user)), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema: schema, data: data }) });
	const text = await response.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (e) {}
	return { status: response.status, json: json, text: text.slice(0, 160) };
}

function socket(user, id) {
	return new Promise(function(resolve) {
		const ws = new WebSocket('ws://127.0.0.1:' + APP_PORT + '/fapi/' + id + '/?openplatform=' + encodeURIComponent(opurl(user)));
		let received = false;
		ws.onmessage = () => received = true;
		ws.onopen = () => setTimeout(function() {
			const open = ws.readyState === 1;
			ws.close();
			resolve({ open: open, received: received });
		}, 1500);
		ws.onerror = () => resolve({ open: false, received: false });
		ws.onclose = () => resolve({ open: false, received: received });
	});
}

const denied = r => r.status !== 200 || !!(r.json && (r.json.error || (Array.isArray(r.json) && r.json[0] && r.json[0].error)));

(async function() {

	const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'flowee-'));
	const dir = Path.join(tmp, 'app');
	const skip = new Set(['.git', 'node_modules', 'tests', '--bundles--']);

	Fs.cpSync(ROOT, dir, { recursive: true, filter: file => !skip.has(Path.basename(file)) });
	Fs.mkdirSync(Path.join(dir, 'node_modules'));
	Fs.symlinkSync(process.env.TOTAL5 || Path.dirname(require.resolve('total5/package.json', { paths: [ROOT] })), Path.join(dir, 'node_modules', 'total5'));
	Fs.mkdirSync(Path.join(dir, 'databases'));
	Fs.writeFileSync(Path.join(dir, 'databases', 'memorize_preferences.json'), JSON.stringify({ op_reqtoken: 'REQ', op_restoken: 'RES', token: 'privatetoken', name: 'Flow EE', env: 'dev' }));

	const op = fakeop();
	const app = spawn(process.execPath, ['index.js', String(APP_PORT), '--release'], { cwd: dir, stdio: 'ignore' });
	const results = [];

	function check(name, ok, detail) {
		results.push(ok);
		console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  -> ' + detail));
	}

	try {

		await sleep(5000);

		let r = await api('s1', 'Streams');
		check('a student starts with an empty list', r.status === 200 && Array.isArray(r.json) && !r.json.length, r.text);

		r = await api('s1', 'Streams|groups');
		check('a student sees only his group', r.json && r.json.length === 1 && r.json[0].id === 'g1' && r.json[0].name === 'Class A', r.text);
		r = await api('teacher', 'Streams|groups');
		check('the teacher sees all the groups', r.json && r.json.length === 3, r.text);

		r = await api('s1', 'Streams|save', { name: 'Student 1 flow', group: 'g1', icon: 'ti ti-microchip' });
		check('a student creates a FlowStream in his group', r.json && r.json.success, r.text);
		r = await api('s1', 'Streams|save', { name: 'Intruder', group: 'g2', icon: 'ti ti-microchip' });
		check('a student cannot create a FlowStream in the group of other students', denied(r), r.text);
		r = await api('s2', 'Streams|save', { name: 'Student 2 flow', group: 'g2', icon: 'ti ti-microchip' });
		check('another student creates a FlowStream in his group', r.json && r.json.success, r.text);
		r = await api('s3', 'Streams|save', { name: 'Without permission', group: 'g1', icon: 'ti ti-microchip' });
		check('a user without the permission "create" cannot create', denied(r), r.text);

		await sleep(1500);

		r = await api('teacher', 'Streams');
		const all = r.json || [];
		check('the teacher sees all the FlowStreams', all.length === 2, r.text);
		const one = all.find(m => m.name === 'Student 1 flow') || {};
		const two = all.find(m => m.name === 'Student 2 flow') || {};

		r = await api('s1', 'Streams');
		check('a student sees only the FlowStreams of his group', r.json && r.json.length === 1 && r.json[0].name === 'Student 1 flow', r.text);
		r = await api('s3', 'Streams');
		check('a student in two groups sees both', r.json && r.json.length === 2, r.text);

		for (const [schema, data] of [['Streams|read', { id: two.id }], ['Streams|raw', { id: two.id }], ['Streams|export', { id: two.id }], ['Streams|pause', { id: two.id, is: 1 }], ['Streams|restart', { id: two.id }], ['Variables|read', { id: two.id }], ['Variables|save', { id: two.id, data: { x: 1 } }], ['Streams|remove', { id: two.id }], ['Streams|save', { id: two.id, name: 'Taken', group: 'g1', icon: 'ti ti-microchip' }], ['Streams|save', { id: two.id, name: 'Taken', group: 'g2', icon: 'ti ti-microchip' }]]) {
			r = await api('s1', schema, data);
			check('a student cannot use ' + schema + ' on the FlowStream of other students', denied(r), r.text);
		}

		r = await api('s1', 'Variables|read', {});
		check('a student cannot read the global variables', denied(r), r.text);
		r = await api('s1', 'Console|read');
		check('a student cannot read the console', denied(r), r.text);
		r = await api('s1', 'Settings|read');
		check('a student cannot read the settings', denied(r), r.text);

		r = await api('s2', 'Streams|read', { id: two.id });
		check('a student reads his own FlowStream', r.json && r.json.name === 'Student 2 flow', r.text);
		r = await api('teacher', 'Streams|read', { id: one.id });
		check('the teacher reads the FlowStream of a student', r.json && r.json.name === 'Student 1 flow', r.text);
		r = await api('s2', 'Streams');
		check('the FlowStream of a student was not changed by other students', r.json && r.json.length === 1 && r.json[0].name === 'Student 2 flow', r.text);

		let ws = await socket('s1', one.id);
		check('a student opens the editor of his FlowStream', ws.open, JSON.stringify(ws));
		ws = await socket('s1', two.id);
		check('a student cannot stay in the editor of other students', !ws.open && !ws.received, JSON.stringify(ws));
		ws = await socket('teacher', two.id);
		check('the teacher opens any editor', ws.open, JSON.stringify(ws));

	} catch (e) {
		check('the tests finished without an error', false, e && e.stack);
	}

	app.kill();
	op.close();
	Fs.rmSync(tmp, { recursive: true, force: true });

	const passed = results.filter(Boolean).length;
	console.log('\n' + passed + ' of ' + results.length + ' checks passed');
	process.exit(passed === results.length ? 0 : 1);

})();
