// Tests of the Education Edition: the access of the teachers and the students to the FlowStreams.
//
//   npm install && npm test
//
// It starts a small fake OpenPlatform and a temporary copy of this application (nothing is written in this folder),
// and then calls the API as a teacher and as several students. Use TOTAL5=/path/to/total5 to test another copy of the framework.

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

// The users of the fake OpenPlatform: a teacher (sa) and several students
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

// Sends a message of the editor and returns the answer that carries the same callbackid
function editorcall(user, id, msg, extra) {
	return new Promise(function(resolve) {
		const ws = new WebSocket('ws://127.0.0.1:' + APP_PORT + '/fapi/' + id + '/?openplatform=' + encodeURIComponent(opurl(user)) + (extra || ''));
		let timer = null;
		msg.callbackid = 'cb1';
		ws.onmessage = function(e) {
			let data = null;
			try { data = JSON.parse(e.data); } catch (err) {}
			if (data && data.callbackid === 'cb1') {
				clearTimeout(timer);
				ws.close();
				resolve(data);
			}
		};
		ws.onopen = () => setTimeout(() => ws.send(JSON.stringify(msg)), 1200);
		ws.onerror = () => resolve(null);
		timer = setTimeout(function() { try { ws.close(); } catch (err) {} resolve(null); }, 6000);
	});
}

const COMPONENT = '<script total>exports.name = "Test"; exports.icon = "ti ti-code"; exports.group = "Test"; exports.config = {}; exports.inputs = [{ id: "input", name: "Input" }]; exports.outputs = []; exports.make = function(instance) {};</script>';

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
	const skip = new Set(['.git', 'node_modules', 'tests', 'databases', 'flowstream', 'logs', 'private']);

	Fs.cpSync(ROOT, dir, { recursive: true, filter: file => !skip.has(Path.basename(file)) });
	Fs.mkdirSync(Path.join(dir, 'node_modules'));
	Fs.symlinkSync(process.env.TOTAL5 || Path.dirname(require.resolve('total5/package.json', { paths: [ROOT] })), Path.join(dir, 'node_modules', 'total5'));
	Fs.mkdirSync(Path.join(dir, 'databases'));
	Fs.writeFileSync(Path.join(dir, 'databases', 'memorize_preferences.json'), JSON.stringify({ token: 'privatetoken', name: 'Flow EE', env: 'dev' }));

	const op = fakeop();
	// A group of processes: the application starts a process for each FlowStream and all of them must stop at the end
	const app = spawn(process.execPath, ['index.js', String(APP_PORT), '--release'], { cwd: dir, stdio: 'ignore', detached: true, env: Object.assign({}, process.env, { FLOWEE_OP_GROUPS: 'http://127.0.0.1:' + OP_PORT + '/users/?token=test', FLOWEE_OP_REQTOKEN: 'REQ', FLOWEE_OP_RESTOKEN: 'RES', FLOWEE_FLOWSTREAM_MEMORY: '512' }) });
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

		r = await api('teacher', 'Streams|save', { name: 'Template of a group', group: 'g1', icon: 'ti ti-microchip' });
		await sleep(1000);
		const gt = ((await api('teacher', 'Streams')).json || []).find(m => m.name === 'Template of a group') || {};
		await api('teacher', 'Classroom|template', { id: gt.id, is: true });
		r = await api('s1', 'Streams');
		check('a template of a group is not shown to the students', !(r.json || []).some(m => m.name === 'Template of a group'), r.text);
		r = await api('s1', 'Streams|read', { id: gt.id });
		check('a student cannot read a template of his group', denied(r), r.text);

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

		// The code of the components and the import are for the teachers
		let ans = await editorcall('s1', one.id, { TYPE: 'component_save', id: 'cheat', data: COMPONENT });
		check('a student cannot save the code of a component', ans && ans.error, JSON.stringify(ans));
		ans = await editorcall('teacher', one.id, { TYPE: 'component_save', id: 'tcomp', data: COMPONENT });
		check('the teacher saves the code of a component', ans && !ans.error, JSON.stringify(ans));
		ans = await editorcall('s1', one.id, { TYPE: 'component_read', id: 'tcomp' });
		check('a student cannot read the code of a component', ans && ans.error && !ans.data, JSON.stringify(ans));
		ans = await editorcall('teacher', one.id, { TYPE: 'component_read', id: 'tcomp' });
		check('the teacher reads the code of a component', ans && !ans.error && ans.data, JSON.stringify(ans));
		ans = await editorcall('s1', one.id, { TYPE: 'component_remove', id: 'tcomp' });
		check('a student cannot remove a component', ans && ans.error, JSON.stringify(ans));

		await sleep(2500);
		const exported = await api('teacher', 'Streams|export', { id: one.id });
		const exportedcomponents = exported.json && exported.json.value ? (JSON.parse(exported.json.value).components || {}) : {};
		check('the teacher exports a FlowStream with the code of its components', 'tcomp' in exportedcomponents, JSON.stringify(Object.keys(exportedcomponents)));
		r = await api('s1', 'Streams|export', { id: one.id });
		check('a student exports his FlowStream without the code of the components', r.json && r.json.value && !('components' in JSON.parse(r.json.value)), r.text);
		r = await api('s1', 'Streams|raw', { id: one.id });
		check('a student reads the raw data without the code of the components', r.json && !('components' in r.json), r.text);
		r = await api('s1', 'Streams|import', { data: JSON.stringify({ id: 'x', name: 'Imported', group: 'g1', design: {}, components: {} }) });
		check('a student cannot import a FlowStream', denied(r), r.text);
		r = await api('s3', 'Streams|import', { data: JSON.stringify({ id: 'x', name: 'Imported', group: 'g1', design: {}, components: {} }) });
		check('a user without permissions cannot import either', denied(r), r.text);
		r = await api('teacher', 'Streams|import', { data: JSON.stringify({ id: 'x', name: 'Imported by the teacher', group: 'g1', design: {}, components: {} }) });
		check('the teacher imports a FlowStream', r.json && r.json.success, r.text);


		// The palette of components of a group
		const PALETTE = '<script total>exports.id = "palettecom"; exports.name = "Palette component"; exports.version = "1.0.0"; exports.icon = "ti ti-code"; exports.group = "Test"; exports.config = {}; exports.inputs = [{ id: "input", name: "Input" }]; exports.outputs = []; exports.make = function(instance) {};</script>';
		await api('teacher', 'Streams|save', { name: 'Library', icon: 'ti ti-microchip' });
		await sleep(1000);
		const library = ((await api('teacher', 'Streams')).json || []).find(m => m.name === 'Library') || {};
		ans = await editorcall('teacher', library.id, { TYPE: 'component_save', id: 'palettecom', data: PALETTE });
		check('the teacher adds a component to a FlowStream of his own', ans && !ans.error, JSON.stringify(ans));
		await sleep(6500);
		r = await api('s1', 'Classroom|palette');
		check('a student cannot read the palettes', denied(r), r.text);
		r = await api('s1', 'Classroom|palette_save', { group: 'g1', items: [{ source: library.id, id: 'palettecom' }] });
		check('a student cannot change a palette', denied(r), r.text);
		r = await api('teacher', 'Classroom|palette');
		const pooled = ((r.json && r.json.pool) || []).find(m => m.id === 'palettecom');
		check('the pool has the components of the teachers with their name and version', pooled && pooled.name === 'Palette component' && pooled.version === '1.0.0', r.text);
		check('the pool does not have the components of the students', !((r.json && r.json.pool) || []).some(m => m.source === one.id), r.text);
		r = await api('teacher', 'Classroom|palette_save', { group: 'g1', items: [{ source: library.id, id: 'palettecom' }] });
		check('the teacher saves the palette of a group', r.json && r.json.success && r.json.components === 1, r.text);
		await sleep(3000);
		r = await api('teacher', 'Streams|raw', { id: one.id });
		check('the FlowStreams of the group get the components of the palette', r.json && r.json.components && r.json.components.palettecom && r.json.components.palettecom.includes('Palette component'), r.text);
		r = await api('s1', 'Streams|save', { name: 'With the palette', group: 'g1', icon: 'ti ti-microchip' });
		await sleep(1500);
		const withpalette = ((await api('s1', 'Streams')).json || []).find(m => m.name === 'With the palette') || {};
		r = await api('teacher', 'Streams|raw', { id: withpalette.id });
		check('a new FlowStream of a student has the palette of his group', r.json && r.json.components && 'palettecom' in r.json.components, r.text);
		check('the memory limit of the environment applies to the new FlowStreams', r.json && r.json.memory === 512, r.text);
		r = await api('s2', 'Streams|save', { name: 'Other group', group: 'g2', icon: 'ti ti-microchip' });
		await sleep(1500);
		const othergroup = ((await api('s2', 'Streams')).json || []).find(m => m.name === 'Other group') || {};
		r = await api('teacher', 'Streams|raw', { id: othergroup.id });
		check('the palette of a group does not reach the other groups', r.json && r.json.components && !('palettecom' in r.json.components), r.text);
		ans = await editorcall('s1', withpalette.id, { TYPE: 'component_save', id: 'palettecom', data: PALETTE.replace('Palette component', 'Changed by a student') });
		check('a student still cannot change the code of a component of the palette', ans && ans.error, JSON.stringify(ans));
		r = await api('teacher', 'Classroom|palette_save', { group: 'g1', items: [] });
		check('the teacher empties the palette', r.json && r.json.success, r.text);
		r = await api('teacher', 'Classroom|palette');
		check('the palette of the group is gone', r.json && !(r.json.palettes && r.json.palettes.g1), r.text);

		r = await api('s1', 'Streams|clone', { id: one.id });
		check('a student duplicates his own FlowStream', r.json && r.json.success, r.text);
		await sleep(1500);
		const mine = ((await api('s1', 'Streams')).json || []).filter(m => m.name === one.name);
		check('the duplicate belongs to the student', mine.length === 2 && mine.every(m => m.ownerid === 's1'), JSON.stringify(mine.map(m => m.ownerid)));
		r = await api('s2', 'Streams|clone', { id: one.id });
		check('a student cannot duplicate the FlowStream of a classmate', denied(r), r.text);
		r = await api('s3', 'Streams|clone', { id: one.id });
		check('a student without the permission create cannot duplicate', denied(r), r.text);

		// Limits for each student
		r = await api('s1', 'Classroom');
		check('a student cannot read the panel to see the limits', denied(r), r.text);
		r = await api('s1', 'Classroom|limits_save', { maxstreams: 1, idledays: 0 });
		check('a student cannot change the limits', denied(r), r.text);
		const owned = ((await api('s1', 'Streams')).json || []).filter(m => m.ownerid === 's1' && !m.templateid).length;
		r = await api('teacher', 'Classroom|limits_save', { maxstreams: owned, idledays: 0 });
		check('the teacher sets the limit of FlowStreams for the students', r.json && r.json.success, r.text);
		r = await api('teacher', 'Classroom');
		check('the panel returns the limits', r.json && r.json.limits && r.json.limits.maxstreams === owned, r.text);
		r = await api('s1', 'Streams|save', { name: 'One more', group: 'g1', icon: 'ti ti-microchip' });
		check('a student at the limit cannot create a FlowStream', denied(r) && /limit/i.test(r.text), r.text);
		r = await api('s1', 'Streams|clone', { id: one.id });
		check('a student at the limit cannot duplicate a FlowStream', denied(r) && /limit/i.test(r.text), r.text);
		r = await api('s2', 'Streams|save', { name: 'Other student under the limit', group: 'g2', icon: 'ti ti-microchip' });
		check('a student under the limit still creates FlowStreams', r.json && r.json.success, r.text);
		r = await api('teacher', 'Streams|save', { name: 'Teacher without limit', icon: 'ti ti-microchip' });
		check('the teacher has no limit', r.json && r.json.success, r.text);
		r = await api('teacher', 'Classroom|limits_save', { maxstreams: 0, idledays: 0 });
		r = await api('s1', 'Streams|save', { name: 'One more', group: 'g1', icon: 'ti ti-microchip' });
		check('without a limit the student creates FlowStreams again', r.json && r.json.success, r.text);

		// The FlowStreams without work are paused
		await sleep(2000);
		const running = async name => ((await api('teacher', 'Streams')).json || []).find(m => m.name === name) || {};
		check('the FlowStream of a student is running before the limit of days', !(await running('With the palette')).stats.paused, 'paused');
		r = await api('teacher', 'Classroom|limits_save', { maxstreams: 0, idledays: 0.00001 });
		check('the teacher sets the days without work', r.json && r.json.success && r.json.paused > 0, r.text);
		await sleep(1500);
		let idle = await running('With the palette');
		check('the FlowStream of a student without work is paused', idle.stats && idle.stats.paused && idle.autopaused, JSON.stringify(idle.stats));
		check('the FlowStreams of the teacher are not paused', !(await running('Library')).stats.paused, 'paused');
		r = await api('s1', 'Streams|pause', { id: withpalette.id, is: false });
		check('the student resumes his FlowStream', r.json && r.json.success, r.text);
		idle = await running('With the palette');
		check('the resumed FlowStream is running and no longer marked as inactive', idle.stats && !idle.stats.paused && !idle.autopaused, JSON.stringify(idle.stats));
		await api('teacher', 'Classroom|limits_save', { maxstreams: 0, idledays: 0 });

		// Deliveries
		r = await api('s1', 'Streams|deliver', { id: one.id });
		check('a student delivers his FlowStream', r.json && r.json.success && r.json.number === 1, r.text);
		r = await api('s2', 'Streams|deliver', { id: one.id });
		check('a student cannot deliver the FlowStream of a classmate', denied(r), r.text);
		r = await api('s1', 'Variables|save', { id: one.id, data: { answer: 7 } });
		await sleep(500);
		r = await api('s1', 'Streams|deliver', { id: one.id });
		check('a second delivery of the same FlowStream is number 2', r.json && r.json.success && r.json.number === 2, r.text);
		r = await api('s1', 'Classroom|deliveries');
		check('a student cannot list the deliveries', denied(r), r.text);
		r = await api('teacher', 'Classroom|deliveries');
		const mine1 = (r.json || []).filter(m => m.streamid === one.id);
		check('the teacher sees both deliveries with their owner and the last one marked', mine1.length === 2 && mine1.every(m => m.ownerid === 's1' && m.ownername === 'Student 1') && mine1.find(m => m.number === 2).latest && !mine1.find(m => m.number === 1).latest, r.text);
		const first = mine1.find(m => m.number === 1);
		const second = mine1.find(m => m.number === 2);
		r = await api('teacher', 'Classroom|delivery_download', { id: first.id });
		const frozen1 = r.json && r.json.value ? JSON.parse(r.json.value) : {};
		r = await api('teacher', 'Classroom|delivery_download', { id: second.id });
		const frozen2 = r.json && r.json.value ? JSON.parse(r.json.value) : {};
		check('a delivery is a frozen copy: the first one does not have the later work', frozen1.id === one.id && JSON.stringify(frozen1.variables || {}).indexOf('7') === -1 && JSON.stringify(frozen2.variables || {}).indexOf('7') !== -1, JSON.stringify([frozen1.variables, frozen2.variables]));
		r = await api('s1', 'Classroom|delivery_download', { id: first.id });
		check('a student cannot download a delivery', denied(r), r.text);
		r = await api('teacher', 'Classroom|delivery_open', { id: second.id });
		check('the teacher opens a delivery as a FlowStream', r.json && r.json.success && r.json.value, r.text);
		await sleep(1500);
		const opened = ((await api('teacher', 'Streams')).json || []).find(m => m.id === (r.json && r.json.value)) || {};
		check('the opened delivery has no group and no owner', opened.id && !opened.group && !opened.ownerid && !opened.templateid, JSON.stringify(opened).slice(0, 160));
		check('the students do not see the opened delivery', !((await api('s1', 'Streams')).json || []).some(m => m.id === opened.id), 'visible');
		r = await api('teacher', 'Classroom|delivery_export', { group: 'g1' });
		const exportedd = r.json && r.json.value ? JSON.parse(r.json.value) : { deliveries: [] };
		check('the teacher exports the last deliveries of a group', exportedd.deliveries.length >= 1 && exportedd.deliveries.every(m => m.delivery.group === 'g1') && exportedd.deliveries.find(m => m.delivery.streamid === one.id).delivery.number === 2, r.text);
		r = await api('s1', 'Classroom|delivery_export', { group: 'g1' });
		check('a student cannot export deliveries', denied(r), r.text);
		r = await api('teacher', 'Classroom|delivery_remove', { id: first.id });
		check('the teacher removes a delivery', r.json && r.json.success, r.text);
		r = await api('teacher', 'Classroom|deliveries');
		check('the other delivery stays', (r.json || []).filter(m => m.streamid === one.id).length === 1, r.text);
		r = await api('teacher', 'Classroom|delivery_download', { id: first.id });
		check('a removed delivery cannot be downloaded', denied(r), r.text);

		// Observer: a teacher follows the editor of a student live, read only
		const obs = '&observer=1';
		ans = await editorcall('teacher', one.id, { TYPE: 'sources' }, obs);
		check('an observer can read', ans && !ans.error, JSON.stringify(ans));
		for (const [name, msg] of [['save the design', { TYPE: 'save', data: {} }], ['save a component', { TYPE: 'component_save', id: 'obs', data: COMPONENT }], ['pause', { TYPE: 'pause', is: 1 }], ['change the variables', { TYPE: 'variables', data: { cheat: 1 } }], ['restart', { TYPE: 'restart' }], ['remove', { TYPE: 'remove' }]]) {
			ans = await editorcall('teacher', one.id, msg, obs);
			check('an observer cannot ' + name, ans && ans.error, JSON.stringify(ans));
		}
		ans = await editorcall('teacher', one.id, { TYPE: 'save', data: {} });
		check('the same teacher without observing can still change', ans && !ans.error, JSON.stringify(ans));
		ans = await editorcall('s1', one.id, { TYPE: 'component_save', id: 'obs2', data: COMPONENT }, obs);
		check('the observer flag gives a student nothing more', ans && ans.error, JSON.stringify(ans));
		let page = await fetch(BASE + '/designer/?socket=x&observer=1&openplatform=' + encodeURIComponent(opurl('teacher'))).then(m => m.text());
		check('the editor of an observer shows the banner and nothing can be changed', page.includes('observerbar') && /design:false/.test(page) && /pause:false/.test(page) && /components:\{create:false/.test(page), 'page');
		page = await fetch(BASE + '/designer/?socket=x&openplatform=' + encodeURIComponent(opurl('teacher'))).then(m => m.text());
		check('the normal editor has no banner and can be changed', !page.includes('observerbar') && /design:true/.test(page), 'page');

		// Forbidden components for a group
		const RISKY = '<script total>exports.id = "riskycom"; exports.name = "Runs a command"; exports.version = "1.0.0"; exports.icon = "ti ti-terminal"; exports.group = "Test"; exports.config = {}; exports.inputs = [{ id: "input", name: "Input" }]; exports.outputs = []; exports.make = function(instance) { const cp = require("child_process"); };</script>';
		const SAFE = '<script total>exports.id = "safecom"; exports.name = "Safe one"; exports.version = "1.0.0"; exports.icon = "ti ti-code"; exports.group = "Test"; exports.config = {}; exports.inputs = [{ id: "input", name: "Input" }]; exports.outputs = []; exports.make = function(instance) {};</script>';
		r = await api('teacher', 'Streams|import', { data: JSON.stringify({ id: 'x', name: 'Risky library', design: {}, components: { riskycom: RISKY, safecom: SAFE } }) });
		check('the teacher imports a FlowStream with a risky component', r.json && r.json.success, r.text);
		await sleep(1500);
		r = await api('s1', 'Classroom|denied');
		check('a student cannot read the forbidden components', denied(r), r.text);
		r = await api('s1', 'Classroom|denied_save', { group: 'g1', ids: ['safecom'], auto: false });
		check('a student cannot forbid components', denied(r), r.text);
		r = await api('teacher', 'Classroom|denied');
		const poolr = (r.json && r.json.pool) || [];
		check('the pool marks the components that look like they reach files or the shell', poolr.find(m => m.id === 'riskycom') && poolr.find(m => m.id === 'riskycom').risky === true && poolr.find(m => m.id === 'safecom') && poolr.find(m => m.id === 'safecom').risky === false, JSON.stringify(poolr.map(m => [m.id, m.risky])));
		const libr = ((await api('teacher', 'Streams')).json || []).find(m => m.name === 'Risky library') || {};
		r = await api('teacher', 'Classroom|palette_save', { group: 'g1', items: [{ source: libr.id, id: 'riskycom' }, { source: libr.id, id: 'safecom' }] });
		await sleep(3000);
		const comps = async id => ((await api('teacher', 'Streams|raw', { id: id })).json || {}).components || {};
		const target = ((await api('s1', 'Streams')).json || []).find(m => m.name === 'With the palette') || {};
		let cc = await comps(target.id);
		check('with the palette the FlowStreams of the group have both components', 'riskycom' in cc && 'safecom' in cc, JSON.stringify(Object.keys(cc)));
		r = await api('teacher', 'Classroom|denied_save', { group: 'g1', ids: ['safecom'], auto: false });
		check('the teacher forbids a component for a group', r.json && r.json.success && r.json.updated > 0, r.text);
		await sleep(3000);
		cc = await comps(target.id);
		check('a forbidden component is taken out of the FlowStreams of the group', !('safecom' in cc) && 'riskycom' in cc, JSON.stringify(Object.keys(cc)));
		r = await api('teacher', 'Classroom|denied_save', { group: 'g1', ids: [], auto: true });
		await sleep(3000);
		cc = await comps(target.id);
		check('the automatic rule takes out the components that look risky, and the ones no longer forbidden come back', !('riskycom' in cc) && 'safecom' in cc, JSON.stringify(Object.keys(cc)));
		r = await api('s1', 'Streams|save', { name: 'After forbidding', group: 'g1', icon: 'ti ti-microchip' });
		await sleep(1500);
		const after = ((await api('s1', 'Streams')).json || []).find(m => m.name === 'After forbidding') || {};
		cc = await comps(after.id);
		check('a new FlowStream of the group is born without the forbidden components', after.id && 'safecom' in cc && !('riskycom' in cc), JSON.stringify(Object.keys(cc)));
		r = await api('s2', 'Streams|save', { name: 'Other group again', group: 'g2', icon: 'ti ti-microchip' });
		await sleep(1500);
		const otherg = ((await api('s2', 'Streams')).json || []).find(m => m.name === 'Other group again') || {};
		check('the rules of a group do not reach the other groups', otherg.id && !('safecom' in (await comps(otherg.id))), 'leak');
		r = await api('teacher', 'Classroom|denied_save', { group: 'g1', ids: [], auto: false });
		r = await api('teacher', 'Classroom|palette_save', { group: 'g1', items: [] });
		r = await api('teacher', 'Classroom|denied');
		check('without rules the group has nothing forbidden', r.json && !(r.json.denied && r.json.denied.g1), r.text);

		// Activity of the students
		r = await api('teacher', 'Classroom|activity_clear');
		check('the teacher clears the activity', r.json && r.json.success, r.text);
		r = await api('s1', 'Classroom|activity', {});
		check('a student cannot read the activity', denied(r), r.text);
		r = await api('s1', 'Classroom|activity_clear');
		check('a student cannot clear the activity', denied(r), r.text);
		r = await api('s1', 'Classroom|activity_download', {});
		check('a student cannot download the activity', denied(r), r.text);
		r = await api('s1', 'Streams|save', { name: 'Activity flow', group: 'g1', icon: 'ti ti-microchip' });
		await sleep(1200);
		const act = ((await api('s1', 'Streams')).json || []).find(m => m.name === 'Activity flow') || {};
		await api('s1', 'Streams|pause', { id: act.id, is: 1 });
		await api('s1', 'Streams|pause', { id: act.id, is: 0 });
		await api('s1', 'Streams|restart', { id: act.id });
		await api('s1', 'Variables|save', { id: act.id, data: { a: 1 } });
		await api('s1', 'Streams|export', { id: act.id });
		await api('s1', 'Streams|deliver', { id: act.id });
		await api('s1', 'Streams|clone', { id: act.id });
		ws = await socket('s1', act.id);
		ws = await socket('teacher', act.id);
		await api('s2', 'Streams|save', { name: 'Other student activity', group: 'g2', icon: 'ti ti-microchip' });
		await sleep(1500);
		r = await api('teacher', 'Classroom|activity', { userid: 's1' });
		const types1 = ((r.json && r.json.events) || []).map(m => m.type);
		check('the activity of a student has what he did, newest first', ['create', 'pause', 'resume', 'restart', 'variables', 'export', 'deliver', 'clone', 'open'].every(t => types1.includes(t)), JSON.stringify(types1));
		const ev1 = (r.json && r.json.events) || [];
		check('every event has the date, the student, the group and the FlowStream', ev1.every(m => m.t && m.userid && m.user) && ev1.find(m => m.type === 'create').group === 'g1' && ev1.find(m => m.type === 'create').stream === 'Activity flow', JSON.stringify(ev1[0]));
		check('the events are newest first', ev1.every((m, i) => i === 0 || m.t <= ev1[i - 1].t), 'order');
		check('the delivery says its number', ev1.find(m => m.type === 'deliver').detail === '#1' || /#/.test(ev1.find(m => m.type === 'deliver').detail), JSON.stringify(ev1.find(m => m.type === 'deliver')));
		check('the teacher opening the editor is registered with his name', ((await api('teacher', 'Classroom|activity', { search: 'Teacher' })).json.events || []).some(m => m.type === 'open' && m.sa), 'teacher');
		r = await api('teacher', 'Classroom|activity', { group: 'g2' });
		check('the activity can be filtered by group', (r.json.events || []).length > 0 && r.json.events.every(m => m.group === 'g2'), r.text);
		check('another group does not have the activity of the first one', !(r.json.events || []).some(m => m.userid === 's1'), 'leak');
		r = await api('teacher', 'Classroom|activity', { userid: 's1', type: 'deliver' });
		check('the activity can be filtered by type', (r.json.events || []).length === 1 && r.json.events[0].type === 'deliver', r.text);
		r = await api('teacher', 'Classroom|activity', { userid: 's1', limit: 2 });
		check('the limit cuts the list but the total is kept', r.json.events.length === 2 && r.json.total > 2, r.text);
		r = await api('teacher', 'Classroom|activity_download', { userid: 's1' });
		const csv = (r.json && r.json.value) || '';
		check('the activity is downloaded as a table with a header', csv.startsWith('date,type,user,teacher,group,flowstream,owner,detail') && csv.split('\n').length > 5 && csv.includes('"deliver"'), csv.slice(0, 120));
		r = await api('teacher', 'Classroom|activity_clear');
		r = await api('teacher', 'Classroom|activity', {});
		check('after clearing there is no activity', r.json && r.json.total === 0, r.text);

		// Exam mode
		const iso = ms => new Date(Date.now() + ms).toISOString();
		const own2 = async () => ((await api('s2', 'Streams')).json || []).filter(m => m.ownerid === 's2');
		const before2 = (await own2()).length;
		check('a student has FlowStreams before the exam', before2 > 0, String(before2));
		r = await api('s2', 'Classroom|exam_save', { group: 'g2', start: iso(1000), end: iso(60000), restrict: true, autodeliver: true });
		check('a student cannot schedule an exam', denied(r), r.text);
		r = await api('teacher', 'Classroom|exam_save', { group: 'g2', start: iso(60000), end: iso(30000), restrict: true, autodeliver: true });
		check('an exam cannot end before it starts', denied(r), r.text);
		r = await api('teacher', 'Classroom|exam_save', { group: 'g2', start: iso(3600000), end: iso(7200000), restrict: true, autodeliver: true });
		check('the teacher schedules an exam for a group', r.json && r.json.success, r.text);
		r = await api('s2', 'Streams|exam');
		check('the student sees that the exam has not started', r.json && r.json[0] && r.json[0].group === 'g2' && r.json[0].state === 'scheduled', r.text);
		check('before the start the students of the group have no access', (await own2()).length === 0, 'visible');
		r = await api('s2', 'Streams|save', { name: 'Before the exam', group: 'g2', icon: 'ti ti-microchip' });
		check('before the start a student cannot create a FlowStream in the group', denied(r) && /exam/i.test(r.text), r.text);
		r = await api('s3', 'Streams');
		check('the exam does not affect other groups (a student of two groups still sees the other one)', (r.json || []).some(m => m.group === 'g1'), r.text);
		r = await api('s1', 'Streams');
		check('the students of other groups are not affected', (r.json || []).length > 0, r.text);
		r = await api('teacher', 'Streams');
		check('the teacher always has access', (r.json || []).some(m => m.group === 'g2'), r.text);
		ws = await socket('s2', two.id);
		check('before the start a student cannot open the editor', !ws.open, JSON.stringify(ws));

		r = await api('teacher', 'Classroom|exam_save', { group: 'g2', start: iso(-5000), end: iso(3600000), restrict: true, autodeliver: true });
		r = await api('s2', 'Streams|exam');
		check('the exam is open', r.json && r.json[0] && r.json[0].state === 'open' && r.json[0].restrict, r.text);
		check('while it is open the students work as usual', (await own2()).length === before2, 'count');
		const exam2 = (await own2())[0];
		r = await api('s2', 'Streams|export', { id: exam2.id });
		check('during the exam a student cannot export a FlowStream', denied(r) && /exam/i.test(r.text), r.text);
		r = await api('s2', 'Streams|raw', { id: exam2.id });
		check('during the exam a student cannot read the raw data', denied(r), r.text);
		r = await api('s2', 'Streams|clone', { id: exam2.id });
		check('during the exam a student cannot duplicate a FlowStream', denied(r), r.text);
		r = await api('teacher', 'Streams|export', { id: exam2.id });
		check('the teacher can still export', r.json && r.json.success, r.text);
		r = await api('s2', 'Streams|deliver', { id: exam2.id });
		check('during the exam a student can deliver', r.json && r.json.success, r.text);
		r = await api('teacher', 'Classroom');
		check('the panel returns the exams with their state', r.json && r.json.exams && r.json.exams.find(m => m.group === 'g2').state === 'open', r.text);

		// It ends: the work is delivered by itself and the access closes
		const delivered2 = async () => ((await api('teacher', 'Classroom|deliveries')).json || []).filter(m => m.group === 'g2' && m.auto);
		check('nothing is delivered by itself while the exam is open', (await delivered2()).length === 0, 'auto');
		r = await api('teacher', 'Classroom|exam_save', { group: 'g2', start: iso(-10000), end: iso(2000), restrict: true, autodeliver: true });
		await sleep(3500);
		await api('teacher', 'Classroom');
		await sleep(2500);
		const auto = await delivered2();
		check('when the exam ends the work of every student is delivered by itself', auto.length >= before2 && auto.every(m => m.ownerid === 's2'), JSON.stringify(auto.map(m => m.name)));
		await api('teacher', 'Classroom');
		await sleep(1500);
		check('the exam is processed only once', (await delivered2()).length === auto.length, 'repeated');
		r = await api('s2', 'Streams|exam');
		check('the student sees that the exam has finished', r.json && r.json[0] && r.json[0].state === 'closed', r.text);
		check('after the end the students of the group have no access', (await own2()).length === 0, 'visible');
		r = await api('s2', 'Streams|read', { id: exam2.id });
		check('after the end a student cannot read his FlowStream', denied(r), r.text);
		ws = await socket('s2', exam2.id);
		check('after the end a student cannot open the editor', !ws.open, JSON.stringify(ws));
		ans = await editorcall('teacher', exam2.id, { TYPE: 'save', data: {} });
		check('the teacher can still use the editor', ans, JSON.stringify(ans));

		r = await api('teacher', 'Classroom|exam_remove', { group: 'g2' });
		check('the teacher ends the exam', r.json && r.json.success, r.text);
		check('the group goes back to normal', (await own2()).length === before2, 'count');
		r = await api('s2', 'Streams|exam');
		check('there is no exam any more', r.json && r.json.length === 0, r.text);
		r = await api('s2', 'Streams|export', { id: exam2.id });
		check('a student can export again', r.json && r.json.success, r.text);

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
