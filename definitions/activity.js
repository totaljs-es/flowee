// Activity of the students: what they do with their FlowStreams, one line of JSON for each event, in a file for each month (databases/activity/2026-11.jsonl).
// The teachers read it in Classroom. It has personal data, so it is kept only for FLOWEE_ACTIVITY_DAYS days (365 by default, 0 keeps it forever) and the teacher can clear it.

const Fs = require('fs');

const DAY = 86400000;

function dir() {
	let path = PATH.databases('activity');
	Fs.mkdirSync(path, { recursive: true });
	return path;
}

function filename(date) {
	return PATH.join(dir(), date.toISOString().substring(0, 7) + '.jsonl');
}

FUNC.activitydays = function() {
	let value = FUNC.env('activity_days');
	return value !== undefined && !isNaN(+value) ? +value : 365;
};

// Writes an event. "user" is who did it, "item" is the FlowStream (a FlowStream or nothing), "detail" is optional text.
// The editor of a student can send many "save" messages: only one every minute for the same user and FlowStream is written.
const LAST = {};

FUNC.activity = function(type, user, item, detail) {

	if (!user)
		return;

	if (type === 'save') {
		let key = user.id + '|' + (item && item.id);
		if (LAST[key] && Date.now() - LAST[key] < 60000)
			return;
		LAST[key] = Date.now();
	}

	let event = {
		t: new Date().toISOString(),
		type: type,
		userid: user.id,
		user: user.name,
		sa: !!user.sa,
		group: item ? (item.group || '') : '',
		streamid: item ? item.id : '',
		stream: item ? item.name : '',
		ownerid: item && item.ownerid ? item.ownerid : '',
		owner: item && item.ownername ? item.ownername : ''
	};

	if (detail)
		event.detail = detail;

	Fs.appendFile(filename(new Date()), JSON.stringify(event) + '\n', NOOP);
};

// Reads the events (newest first). Options: group, userid, type, search (text), days, limit. The callback receives { events, total }.
FUNC.activityread = function(opt, callback) {

	let from = opt.days ? Date.now() - opt.days * DAY : 0;
	let search = (opt.search || '').toLowerCase();
	let limit = Math.min(Math.max(+opt.limit || 300, 1), 5000);
	let output = { events: [], total: 0 };

	Fs.readdir(dir(), function(err, files) {

		files = (files || []).filter(m => m.endsWith('.jsonl')).sort().reverse();

		files.wait(function(name, next) {
			Fs.readFile(PATH.join(dir(), name), 'utf8', function(err, text) {

				let lines = (text || '').split('\n');

				for (let i = lines.length - 1; i >= 0; i--) {

					if (!lines[i])
						continue;

					let event = lines[i].parseJSON(true);

					if (!event || (from && +new Date(event.t) < from))
						continue;

					if (opt.group && event.group !== opt.group)
						continue;

					if (opt.userid && event.userid !== opt.userid && event.ownerid !== opt.userid)
						continue;

					if (opt.type && event.type !== opt.type)
						continue;

					if (search && (event.user + ' ' + event.owner + ' ' + event.stream).toLowerCase().indexOf(search) === -1)
						continue;

					output.total++;

					if (output.events.length < limit)
						output.events.push(event);
				}

				next();
			});
		}, () => callback(null, output));
	});
};

// Deletes the files of the months that are older than the days of retention (all of them with "all")
FUNC.activityclear = function(all, callback) {

	let days = FUNC.activitydays();

	Fs.readdir(dir(), function(err, files) {

		let removed = 0;
		let limit = Date.now() - days * DAY;

		for (let name of (files || [])) {

			if (!name.endsWith('.jsonl'))
				continue;

			// The month ends on the first day of the next month
			let month = new Date(name.substring(0, 7) + '-01T00:00:00.000Z');
			month.setUTCMonth(month.getUTCMonth() + 1);

			if (all || (days && +month < limit)) {
				Fs.unlinkSync(PATH.join(dir(), name));
				removed++;
			}
		}

		callback && callback(removed);
	});
};

// Once a day the months that are older than the retention are deleted
ON('service', function(counter) {
	if (counter % 1440 === 0 && FUNC.activitydays())
		FUNC.activityclear(false);
});
