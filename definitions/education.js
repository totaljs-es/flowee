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
	data.templateid = source.id;
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
