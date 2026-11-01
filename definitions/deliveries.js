// Deliveries: a student delivers a FlowStream and the server keeps a frozen copy of it (design, components, variables), with the date.
// The student can go on working; the copy that the teacher sees never changes. The copies are files in databases/deliveries/ and the list is in the preferences of the delivery.

const Fs = require('fs');

const MAXPERSTREAM = 20;

global.DELIVERIES = MEMORIZE('deliveries', 300);

function dir() {
	let path = PATH.databases('deliveries');
	Fs.mkdirSync(path, { recursive: true });
	return path;
}

function file(id) {
	return PATH.join(dir(), id + '.json');
}

FUNC.deliveries = function() {
	return DELIVERIES.items || [];
};

// Delivers a FlowStream. The callback receives the entry of the list.
FUNC.deliver = function(item, user, callback, auto) {

	let items = CLONE(FUNC.deliveries());
	let previous = items.filter(m => m.streamid === item.id);
	let template = item.templateid ? Flow.db[item.templateid] : null;

	let entry = {
		id: 'd' + UID(),
		streamid: item.id,
		name: item.name,
		ownerid: item.ownerid || user.id,
		ownername: item.ownername || user.name,
		group: item.group,
		templateid: item.templateid || '',
		templatename: template ? template.name : '',
		number: previous.reduce((max, m) => Math.max(max, m.number), 0) + 1,
		dtcreated: NOW
	};

	// A delivery that the exam made when it ended
	if (auto)
		entry.auto = true;

	let data = CLONE(item);

	for (let key of ['unixsocket', 'size', 'origin', 'directory', 'variables2', 'worker', 'env'])
		delete data[key];

	Fs.writeFile(file(entry.id), JSON.stringify(data), function(err) {

		if (err) {
			callback(err);
			return;
		}

		items.push(entry);

		// The exam delivers by itself: the activity says whose work it was
		auto && FUNC.activity('autodeliver', { id: entry.ownerid, name: entry.ownername }, item, '#' + entry.number);

		// Only the last deliveries of a FlowStream are kept
		previous.sort((a, b) => a.number - b.number);

		while (previous.length >= MAXPERSTREAM) {
			let old = previous.shift();
			items.splice(items.findIndex(m => m.id === old.id), 1);
			Fs.unlink(file(old.id), NOOP);
		}

		DELIVERIES.set('items', items);
		callback(null, entry);
	});
};

// The frozen copy of a delivery
FUNC.deliveryread = function(id, callback) {

	if (!/^[a-z0-9]+$/i.test(id) || !FUNC.deliveries().find(m => m.id === id)) {
		callback('Not found');
		return;
	}

	Fs.readFile(file(id), 'utf8', function(err, response) {
		callback(err, err ? null : response.parseJSON(true));
	});
};

FUNC.deliveryremove = function(id) {

	let items = CLONE(FUNC.deliveries());
	let index = items.findIndex(m => m.id === id);

	if (index === -1)
		return false;

	items.splice(index, 1);
	DELIVERIES.set('items', items);
	Fs.unlink(file(id), NOOP);
	return true;
};
