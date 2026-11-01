// Education Edition
// A FlowStream belongs to a group of OpenPlatform (the property "group" keeps its id).
// The teachers (the users with "sa") work with all FlowStreams, the students only with the FlowStreams of their groups.

// Can the user work with the FlowStream? "item" is a FlowStream (or its id)
FUNC.streamaccess = function(user, item) {

	if (!user)
		return false;

	if (typeof(item) === 'string')
		item = Flow.db[item];

	if (!item)
		return false;

	if (user.sa)
		return true;

	// A template is only for the teachers, even when it belongs to a group
	if (item.template)
		return false;

	if (!item.group || !user.groups || !user.groups.includes(item.group))
		return false;

	// An exam closes the group before it starts and after it ends
	if (FUNC.examblock(user, item.group))
		return false;

	// A FlowStream with an owner (created by a student or assigned to a student) is private to the owner
	return !item.ownerid || item.ownerid === user.id;
};

// Can the user put a FlowStream into the group?
FUNC.streamgroupallowed = function(user, group) {

	if (!user)
		return false;

	if (user.sa)
		return true;

	return !!(group && user.groups && user.groups.includes(group));
};

// The data of a FlowStream for the user: the students do not get the code of the components (the teachers do)
FUNC.streamdata = function(user, item) {

	if (user && user.sa)
		return item;

	let data = Object.assign({}, item);
	delete data.components;
	return data;
};

// The groups that the user can choose: [{ id, name }]
// The OpenPlatform sends the list of the groups with the session of the user. The teachers can also use the address "op_groups" of the config.
FUNC.streamgroups = function($, callback) {

	let user = $.user;
	let all = user.platform && user.platform.groups instanceof Array ? user.platform.groups : [];

	let done = function(arr) {

		if (!user.sa) {
			let ids = user.groups || [];
			let output = [];
			for (let id of ids)
				output.push(arr.findItem('id', id) || { id: id, name: id });
			arr = output;
		}

		callback(arr);
	};

	if (user.sa && CONF.op_groups) {
		RESTBuilder.GET(CONF.op_groups).callback(function(err, response) {
			done(!err && response && response.groups instanceof Array ? response.groups : all);
		});
	} else
		done(all);
};

// The users and the groups of OpenPlatform (the public API of the users, it needs the address "op_groups" in the config)
FUNC.opusers = function(callback) {

	if (!CONF.op_groups) {
		callback(null, { groups: [], users: [] });
		return;
	}

	RESTBuilder.GET(CONF.op_groups).callback(function(err, response) {
		if (err || !response || !(response.users instanceof Array))
			callback(err || 'Invalid response', { groups: [], users: [] });
		else
			callback(null, response);
	});
};

// The students of a group: the users who are not teachers, disabled or inactive
FUNC.opstudents = function(users, groupid) {
	return users.filter(m => !m.sa && !m.isdisabled && !m.isinactive && m.groups && m.groups.includes(groupid));
};

// The palette of components of a group: { componentid: { name, version, icon, code } }. The students cannot add or edit components,
// they get the ones that the teacher chose for their group (the code is kept on the server, so it cannot be changed by the client).
FUNC.palettes = function() {
	return PREF.palettes || {};
};

// name, version and icon of a component (the first literal strings of its code; the code is never executed)
FUNC.componentmeta = function(code) {

	let meta = {};

	if (typeof(code) !== 'string')
		return meta;

	for (let key of ['id', 'name', 'version', 'icon']) {
		let m = code.match(new RegExp('exports\\.' + key + '\\s*=\\s*([\'"`])(.*?)\\1\\s*;'));
		if (m)
			meta[key] = m[2];
	}

	return meta;
};

// Puts the components of the palette of the group into the FlowStream. It returns true if the FlowStream changed.
FUNC.paletteapply = function(item) {

	let palette = item && item.group ? FUNC.palettes()[item.group] : null;

	if (!palette)
		return false;

	let changed = false;

	if (!item.components)
		item.components = {};

	for (let id in palette) {
		if (item.components[id] !== palette[id].code) {
			item.components[id] = palette[id].code;
			changed = true;
		}
	}

	return changed;
};

// Limits for each student: the number of FlowStreams that he can have and the days without work before his FlowStreams are paused.
// The teachers set them in Classroom; FLOWEE_MAX_STREAMS and FLOWEE_IDLE_DAYS are the defaults. 0 means without limit.
FUNC.limits = function() {

	let saved = PREF.limits || {};
	let number = (value, name) => value != null && !isNaN(+value) ? +value : (+FUNC.env(name) || 0);

	return { maxstreams: number(saved.maxstreams, 'max_streams'), idledays: number(saved.idledays, 'idle_days') };
};

// The FlowStreams that a student has created (the copies of the templates are not counted)
FUNC.studentstreams = function(userid) {

	let count = 0;

	for (let key in Flow.db) {
		let item = Flow.db[key];
		if (key !== 'variables' && item && item.ownerid === userid && !item.templateid && !item.template)
			count++;
	}

	return count;
};

// Can the student create one more FlowStream? The teachers have no limit.
FUNC.streamlimit = function(user) {

	if (!user || user.sa)
		return true;

	let max = FUNC.limits().maxstreams;
	return !max || FUNC.studentstreams(user.id) < max;
};

// Pauses the running FlowStreams of the students that have not been worked on for the days of the limit. It returns how many were paused.
FUNC.idlepause = function() {

	let days = FUNC.limits().idledays;

	if (!days)
		return 0;

	let limit = days * 86400000;
	let paused = 0;

	for (let key in Flow.db) {

		let item = Flow.db[key];
		let instance = Flow.instances[key];

		if (key === 'variables' || !item || !item.ownerid || item.template || !instance || !instance.flow || !instance.flow.stats || instance.flow.stats.paused)
			continue;

		let last = Math.max(item.dtupdated ? +new Date(item.dtupdated) : 0, item.dtresumed ? +new Date(item.dtresumed) : 0, item.dtcreated ? +new Date(item.dtcreated) : 0);

		if (NOW - last > limit) {
			instance.flow.stats.paused = true;
			instance.pause(true);
			item.autopaused = NOW;
			paused++;
		}
	}

	paused && Flow.emit('save');

	return paused;
};

// Every minute, the FlowStreams without work of the students are paused
ON('service', function() {
	FUNC.idlepause();
});

// Makes a copy of a FlowStream for a group and, optionally, for one student
FUNC.streamcopy = function(source, opt, callback) {

	let data = CLONE(source);

	delete data.unixsocket;
	delete data.size;
	delete data.origin;
	delete data.dtupdated;
	delete data.template;

	data.id = 'f' + UID();
	data.name = opt.name || source.name;
	data.group = opt.group;
	data.ownerid = opt.ownerid || undefined;
	data.ownername = opt.ownername || undefined;
	data.templateid = opt.plain ? undefined : source.id;
	data.proxypath = '';
	data.dtcreated = NOW;
	data.env = PREF.env || 'dev';
	data.directory = CONF.directory || PATH.root('/flowstream/');
	data.variables2 = Flow.db.variables || {};

	FUNC.paletteapply(data);

	TRANSFORM('flowstream.create', data, function(err, data) {
		Flow.db[data.id] = data;
		Flow.load(data, function(err) {
			callback(err, data);
		});
	});
};
