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

		// The public API of the users
		if (req.url.startsWith('/users/')) {
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ groups: GROUPS, users: Object.keys(USERS).map(key => Object.assign({ isdisabled: false, isinactive: false }, USERS[key])) }));
			return;
		}

		const token = (new URL(req.url, 'http://x').searchParams.get('token') || '').split('~')[0];
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
	const skip = new Set(['.git', 'node_modules', 'tests', '--bundles--', 'databases', 'flowstream', 'logs', 'private']);

	Fs.cpSync(ROOT, dir, { recursive: true, filter: file => !skip.has(Path.basename(file)) });
	Fs.mkdirSync(Path.join(dir, 'node_modules'));
	Fs.symlinkSync(process.env.TOTAL5 || Path.dirname(require.resolve('total5/package.json', { paths: [ROOT] })), Path.join(dir, 'node_modules', 'total5'));
	Fs.appendFileSync(Path.join(dir, 'config'), '\nop_groups : http://127.0.0.1:' + OP_PORT + '/users/?token=test\n');
	Fs.mkdirSync(Path.join(dir, 'databases'));
	Fs.writeFileSync(Path.join(dir, 'databases', 'memorize_preferences.json'), JSON.stringify({ op_reqtoken: 'REQ', op_restoken: 'RES', token: 'privatetoken', name: 'Flow EE', env: 'dev' }));

	const op = fakeop();
	// A group of processes: the application starts a process for each FlowStream and all of them must stop at the end
	const app = spawn(process.execPath, ['index.js', String(APP_PORT), '--release'], { cwd: dir, stdio: 'ignore', detached: true });
	const stop = () => { try { process.kill(-app.pid, 'SIGKILL'); } catch (e) {} };
	process.on('exit', stop);
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
		check('a student does not see the private FlowStreams of his classmates', r.json && r.json.length === 0, r.text);

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

		// Practice templates
		r = await api('s1', 'Classroom');
		check('a student cannot use the panel of the teacher', denied(r), r.text);
		r = await api('s1', 'Classroom|template', { id: one.id, is: true });
		check('a student cannot mark a template', denied(r), r.text);

		r = await api('teacher', 'Streams|save', { name: 'Lab 1', icon: 'ti ti-microchip' });
		check('the teacher creates a FlowStream without a group', r.json && r.json.success, r.text);
		await sleep(1000);
		const lab = ((await api('teacher', 'Streams')).json || []).find(m => m.name === 'Lab 1') || {};
		r = await api('teacher', 'Classroom|template', { id: lab.id, is: true });
		check('the teacher marks it as a template', r.json && r.json.success, r.text);

		r = await api('teacher', 'Classroom');
		check('the panel returns the groups and the students', r.json && r.json.groups.length === 3 && r.json.students.length === 3 && r.json.hasusers, r.text);

		r = await api('teacher', 'Classroom|assign', { id: lab.id, groups: ['g1'], students: true });
		check('the template is assigned with a copy for each student of the group', r.json && r.json.created === 2, r.text);
		r = await api('teacher', 'Classroom|assign', { id: lab.id, groups: ['g1'], students: true });
		check('assigning again does not repeat the copies', r.json && r.json.created === 0 && r.json.skipped === 2, r.text);
		r = await api('teacher', 'Classroom|assign', { id: lab.id, groups: ['g2'], students: false });
		check('the template is assigned to a whole group', r.json && r.json.created === 1, r.text);

		await sleep(1500);
		r = await api('s1', 'Streams');
		const names1 = (r.json || []).map(m => m.name).sort();
		check('a student sees his own work and his own copy', names1.length === 2 && names1.includes('Lab 1 · Student 1') && names1.includes('Student 1 flow'), r.text);
		r = await api('s3', 'Streams');
		const names3 = (r.json || []).map(m => m.name).sort();
		check('another student of the same group sees only his copy and the shared one', names3.length === 2 && names3.includes('Lab 1 · Student 3') && names3.includes('Lab 1 · Class B') && !names3.includes('Lab 1 · Student 1'), r.text);
		r = await api('s2', 'Streams');
		check('a student of another group sees only the shared copy and his work', (r.json || []).map(m => m.name).sort().join('|') === 'Lab 1 · Class B|Student 2 flow', r.text);

		const copy = ((await api('s1', 'Streams')).json || []).find(m => m.name === 'Lab 1 · Student 1') || {};
		r = await api('s1', 'Variables|save', { id: copy.id, data: { answer: 42 } });
		check('a student works in his copy', r.json && r.json.success, r.text);
		r = await api('s1', 'Classroom|reset', { id: copy.id });
		check('a student cannot restore a copy', denied(r), r.text);
		r = await api('teacher', 'Classroom|reset', { id: copy.id });
		check('the teacher restores a copy from the template', r.json && r.json.success, r.text);
		await sleep(1000);
		r = await api('s1', 'Variables|read', { id: copy.id });
		check('the work of the student was replaced by the template', r.json && r.json.answer === undefined, r.text);
		r = await api('teacher', 'Streams');
		const row = (r.json || []).find(m => m.id === copy.id) || {};
		check('the teacher sees the owner and the template of each copy', row.ownername === 'Student 1' && row.templateid === lab.id, JSON.stringify(row).slice(0, 160));

		let ws = await socket('s1', one.id);
		check('a student opens the editor of his FlowStream', ws.open, JSON.stringify(ws));
		ws = await socket('s1', two.id);
		check('a student cannot stay in the editor of other students', !ws.open && !ws.received, JSON.stringify(ws));
		ws = await socket('teacher', two.id);
		check('the teacher opens any editor', ws.open, JSON.stringify(ws));

	} catch (e) {
		check('the tests finished without an error', false, e && e.stack);
	}

	stop();
	op.close();
	Fs.rmSync(tmp, { recursive: true, force: true });

	const passed = results.filter(Boolean).length;
	console.log('\n' + passed + ' of ' + results.length + ' checks passed');
	process.exit(passed === results.length ? 0 : 1);

})();
