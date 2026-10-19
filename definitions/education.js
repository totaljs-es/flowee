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

	return !!(item.group && user.groups && user.groups.includes(item.group));
};

// Can the user put a FlowStream into the group?
FUNC.streamgroupallowed = function(user, group) {

	if (!user)
		return false;

	if (user.sa)
		return true;

	return !!(group && user.groups && user.groups.includes(group));
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
