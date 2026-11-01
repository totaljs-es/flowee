// Education Edition: the panel of the teacher.
// Practice templates: a FlowStream marked as template can be assigned to groups of OpenPlatform, to the whole group or with one copy for each student.

exports.icon = 'ti ti-graduation-cap';
exports.name = '@(Classroom)';
exports.position = 5;
exports.visible = user => !!user.sa;

function groupname(groups, id) {
	let item = groups.findItem('id', id);
	return item ? item.name : id;
}

// Groups and students of OpenPlatform
NEWACTION('Classroom', {
	name: 'Groups and students',
	route: '+API ?',
	sa: true,
	action: function($) {

		// An exam that has ended delivers the work of the students (once)
		FUNC.examtick();

		FUNC.opusers(function(err, op) {

			let groups = op.groups.length ? op.groups : ($.user.platform && $.user.platform.groups instanceof Array ? $.user.platform.groups : []);
			let students = [];

			for (let m of op.users) {
				if (!m.sa && !m.isdisabled && !m.isinactive)
					students.push({ id: m.id, name: m.name, groups: m.groups || [] });
			}

			$.callback({ groups: groups, students: students, hasusers: !err && op.users.length > 0, limits: FUNC.limits(), exams: Object.keys(FUNC.exams()).map(group => Object.assign({ group: group, state: FUNC.examstate(group) }, FUNC.exams()[group])) });
		});
	}
});

NEWACTION('Classroom|template', {
	name: 'Mark a FlowStream as a template',
	route: '+API ?',
	input: '*id:String, is:Boolean',
	sa: true,
	action: function($, model) {
		let item = Flow.db[model.id];
		if (item) {
			item.template = model.is === true;
			Flow.emit('save');
			$.success();
		} else
			$.invalid(404);
	}
});

NEWACTION('Classroom|assign', {
	name: 'Assign a template to groups or students',
	route: '+API ? <300s',
	input: '*id:String, *groups:[String], students:Boolean',
	sa: true,
	action: function($, model) {

		let source = Flow.db[model.id];

		if (!source || model.id === 'variables') {
			$.invalid(404);
			return;
		}

		FUNC.opusers(function(err, op) {

			if (model.students && !op.users.length) {
				$.invalid('@(The users of OpenPlatform are not available. Check the setting "op_groups" in the config.)');
				return;
			}

			let groups = op.groups.length ? op.groups : ($.user.platform && $.user.platform.groups instanceof Array ? $.user.platform.groups : []);
			let jobs = [];
			let skipped = 0;
			let copies = Object.keys(Flow.db).map(key => Flow.db[key]).filter(m => m && m.templateid === source.id);

			for (let groupid of model.groups) {

				let name = groupname(groups, groupid);

				if (model.students) {
					for (let student of FUNC.opstudents(op.users, groupid)) {
						if (copies.find(m => m.group === groupid && m.ownerid === student.id))
							skipped++;
						else
							jobs.push({ name: source.name + ' · ' + student.name, group: groupid, ownerid: student.id, ownername: student.name });
					}
				} else {
					if (copies.find(m => m.group === groupid && !m.ownerid))
						skipped++;
					else
						jobs.push({ name: source.name + ' · ' + name, group: groupid });
				}
			}

			let created = 0;

			jobs.wait(function(job, next) {
				FUNC.streamcopy(source, job, function(err) {
					!err && created++;
					setTimeout(next, 300);
				});
			}, function() {
				Flow.emit('save');
				$.audit('{0}: {1}'.format(source.name, created));
				$.callback({ success: true, created: created, skipped: skipped });
			});

		});
	}
});

NEWACTION('Classroom|reset', {
	name: 'Restore a copy from its template',
	route: '+API ?',
	input: '*id:String',
	sa: true,
	audit: true,
	action: function($, model) {

		let item = Flow.db[model.id];
		let template = item && item.templateid ? Flow.db[item.templateid] : null;

		if (!item) {
			$.invalid(404);
			return;
		}

		if (!template) {
			$.invalid('@(The template does not exist)');
			return;
		}

		item = CLONE(item);
		item.design = CLONE(template.design || {});
		item.components = CLONE(template.components || {});
		item.variables = CLONE(template.variables || {});
		item.sources = CLONE(template.sources || {});
		item.dtupdated = NOW;

		// The palette and the forbidden components of the group apply to the restored copy
		FUNC.paletteapply(item);

		TRANSFORM('flowstream.update', item, function(err, item) {
			Flow.reload(item);
		});

		$.success();
		Flow.emit('save');
	}
});


// The palette of components of each group: the students cannot add or edit components, they get the ones that the teacher chooses here
NEWACTION('Classroom|palette', {
	name: 'Components that can go into the palettes',
	route: '+API ?',
	sa: true,
	action: function($) {

		let pool = [];
		let seen = {};

		for (let key in Flow.db) {

			let item = Flow.db[key];

			// The FlowStreams of the teachers are the source of the components
			if (key === 'variables' || !item || item.ownerid || !item.components)
				continue;

			for (let id in item.components) {
				let code = item.components[id];
				let meta = FUNC.componentmeta(code);
				let hash = id + '|' + HASH(code || '');
				if (!seen[hash]) {
					seen[hash] = 1;
					pool.push({ source: key, sourcename: item.name, id: id, name: meta.name || id, version: meta.version || '', icon: meta.icon || '' });
				}
			}
		}

		pool.quicksort('name');

		let palettes = {};
		let all = FUNC.palettes();

		for (let group in all) {
			palettes[group] = [];
			for (let id in all[group])
				palettes[group].push({ id: id, name: all[group][id].name, version: all[group][id].version, icon: all[group][id].icon });
		}

		$.callback({ pool: pool, palettes: palettes });
	}
});

NEWACTION('Classroom|palette_save', {
	name: 'Save the palette of components of a group',
	route: '+API ? <300s',
	input: '*group:String, items:[*source:String, *id:String]',
	sa: true,
	audit: true,
	action: function($, model) {

		let palette = {};
		let count = 0;

		for (let m of (model.items || [])) {
			let source = Flow.db[m.source];
			let code = source && source.components ? source.components[m.id] : null;
			if (code) {
				let meta = FUNC.componentmeta(code);
				palette[m.id] = { name: meta.name || m.id, version: meta.version || '', icon: meta.icon || '', code: code };
				count++;
			}
		}

		let all = CLONE(FUNC.palettes());

		if (count)
			all[model.group] = palette;
		else
			delete all[model.group];

		PREF.set('palettes', all);

		// The FlowStreams of the group (not the templates) get the new components
		let jobs = [];

		for (let key in Flow.db) {
			let item = Flow.db[key];
			if (key !== 'variables' && item && item.group === model.group && !item.template) {
				let copy = CLONE(item);
				if (FUNC.paletteapply(copy))
					jobs.push(copy);
			}
		}

		jobs.wait(function(item, next) {
			item.dtupdated = NOW;
			TRANSFORM('flowstream.update', item, function(err, item) {
				Flow.reload(item);
				setTimeout(next, 300);
			});
		}, function() {
			Flow.emit('save');
			$.callback({ success: true, components: count, updated: jobs.length });
		});
	}
});


// Limits for each student: how many FlowStreams he can create and the days without work before they are paused (0 is without limit)
NEWACTION('Classroom|limits_save', {
	name: 'Save the limits for the students',
	route: '+API ?',
	input: 'maxstreams:Number, idledays:Number',
	sa: true,
	audit: true,
	action: function($, model) {
		PREF.set('limits', { maxstreams: Math.max(0, Math.floor(model.maxstreams || 0)), idledays: Math.max(0, model.idledays || 0) });
		$.callback({ success: true, paused: FUNC.idlepause() });
	}
});


// Deliveries of the students: the frozen copies that they have handed in
NEWACTION('Classroom|deliveries', {
	name: 'Deliveries of the students',
	route: '+API ?',
	sa: true,
	action: function($) {

		let items = CLONE(FUNC.deliveries());
		let latest = {};

		for (let m of items)
			latest[m.streamid] = Math.max(latest[m.streamid] || 0, m.number);

		for (let m of items)
			m.latest = m.number === latest[m.streamid];

		items.quicksort('dtcreated_desc');
		$.callback(items);
	}
});

// Opens a delivery as a FlowStream of the teacher (without a group, so no student sees it)
NEWACTION('Classroom|delivery_open', {
	name: 'Open a delivery as a FlowStream',
	route: '+API ? <300s',
	input: '*id:String',
	sa: true,
	audit: true,
	action: function($, model) {

		let entry = FUNC.deliveries().findItem('id', model.id);

		FUNC.deliveryread(model.id, function(err, data) {

			if (err || !data) {
				$.invalid(404);
				return;
			}

			let name = entry.ownername + ' · ' + entry.name + ' (#' + entry.number + ')';

			FUNC.streamcopy(data, { name: name, group: '', plain: true }, function(err, copy) {
				Flow.emit('save');
				$.callback({ success: !err, value: copy && copy.id, error: err ? err.toString() : null });
			});
		});
	}
});

NEWACTION('Classroom|delivery_download', {
	name: 'Download a delivery',
	route: '+API ? <300s',
	input: '*id:String',
	sa: true,
	action: function($, model) {
		FUNC.deliveryread(model.id, function(err, data) {
			if (err || !data)
				$.invalid(404);
			else
				$.success(JSON.stringify(data, null, '\t'));
		});
	}
});

// The last delivery of each FlowStream of a group (and, optionally, of a template), in one file for grading
NEWACTION('Classroom|delivery_export', {
	name: 'Export the deliveries of a group',
	route: '+API ? <300s',
	input: 'group:String, templateid:String',
	sa: true,
	audit: true,
	action: function($, model) {

		let latest = {};

		for (let m of FUNC.deliveries()) {
			if (model.group && m.group !== model.group)
				continue;
			if (model.templateid && m.templateid !== model.templateid)
				continue;
			if (!latest[m.streamid] || latest[m.streamid].number < m.number)
				latest[m.streamid] = m;
		}

		let output = { exported: NOW, group: model.group || null, deliveries: [] };

		Object.keys(latest).wait(function(key, next) {
			FUNC.deliveryread(latest[key].id, function(err, data) {
				!err && data && output.deliveries.push({ delivery: latest[key], flowstream: data });
				next();
			});
		}, function() {
			$.success(JSON.stringify(output, null, '\t'));
		});
	}
});

NEWACTION('Classroom|delivery_remove', {
	name: 'Remove a delivery',
	route: '+API ?',
	input: '*id:String',
	sa: true,
	audit: true,
	action: function($, model) {
		if (FUNC.deliveryremove(model.id))
			$.success();
		else
			$.invalid(404);
	}
});


// Exam mode: the students of a group can work only between two dates
NEWACTION('Classroom|exam_save', {
	name: 'Schedule the exam of a group',
	route: '+API ?',
	input: '*group:String, *start:String, *end:String, restrict:Boolean, autodeliver:Boolean',
	sa: true,
	audit: true,
	action: function($, model) {

		let start = Date.parse(model.start);
		let end = Date.parse(model.end);

		if (isNaN(start) || isNaN(end)) {
			$.invalid('@(Invalid date)');
			return;
		}

		if (end <= start || end <= Date.now()) {
			$.invalid('@(The end must be after the start and in the future)');
			return;
		}

		let exams = CLONE(FUNC.exams());
		exams[model.group] = { start: new Date(start).toISOString(), end: new Date(end).toISOString(), restrict: !!model.restrict, autodeliver: !!model.autodeliver };
		PREF.set('exams', exams);
		$.success();
	}
});

// Ends the exam: the group goes back to normal
NEWACTION('Classroom|exam_remove', {
	name: 'End the exam of a group',
	route: '+API ?',
	input: '*group:String',
	sa: true,
	audit: true,
	action: function($, model) {

		let exams = CLONE(FUNC.exams());

		if (exams[model.group]) {
			delete exams[model.group];
			PREF.set('exams', exams);
			$.success();
		} else
			$.invalid(404);
	}
});


// Forbidden components for each group: they are taken out of the FlowStreams of the group (the students work without them)
NEWACTION('Classroom|denied', {
	name: 'Components that can be forbidden',
	route: '+API ?',
	sa: true,
	action: function($) {

		let pool = [];
		let seen = {};

		for (let key in Flow.db) {

			let item = Flow.db[key];

			if (key === 'variables' || !item || !item.components)
				continue;

			for (let id in item.components) {
				let code = item.components[id];
				let hash = id + '|' + HASH(code || '');
				if (!seen[hash]) {
					seen[hash] = 1;
					let meta = FUNC.componentmeta(code);
					pool.push({ id: id, name: meta.name || id, version: meta.version || '', icon: meta.icon || '', risky: FUNC.componentrisk(code) });
				}
			}
		}

		pool.quicksort('name');
		$.callback({ pool: pool, denied: FUNC.denied() });
	}
});

NEWACTION('Classroom|denied_save', {
	name: 'Save the forbidden components of a group',
	route: '+API ? <300s',
	input: '*group:String, ids:[String], auto:Boolean',
	sa: true,
	audit: true,
	action: function($, model) {

		let all = CLONE(FUNC.denied());

		if ((model.ids && model.ids.length) || model.auto)
			all[model.group] = { ids: model.ids || [], auto: !!model.auto };
		else
			delete all[model.group];

		PREF.set('denied', all);

		// The FlowStreams of the group (not the templates) lose the forbidden components
		let jobs = [];

		for (let key in Flow.db) {
			let item = Flow.db[key];
			if (key !== 'variables' && item && item.group === model.group && !item.template) {
				let copy = CLONE(item);
				if (FUNC.paletteapply(copy))
					jobs.push(copy);
			}
		}

		jobs.wait(function(item, next) {
			item.dtupdated = NOW;
			TRANSFORM('flowstream.update', item, function(err, item) {
				Flow.reload(item);
				setTimeout(next, 300);
			});
		}, function() {
			Flow.emit('save');
			$.callback({ success: true, updated: jobs.length });
		});
	}
});


// Activity of the students (what they do with their FlowStreams)
NEWACTION('Classroom|activity', {
	name: 'Activity of the students',
	route: '+API ?',
	input: 'group:String, userid:String, type:String, search:String, days:Number, limit:Number',
	sa: true,
	action: function($, model) {
		FUNC.activityread(model, function(err, output) {
			output.retention = FUNC.activitydays();
			$.callback(output);
		});
	}
});

NEWACTION('Classroom|activity_download', {
	name: 'Download the activity of the students',
	route: '+API ? <300s',
	input: 'group:String, userid:String, type:String, search:String, days:Number',
	sa: true,
	audit: true,
	action: function($, model) {

		model.limit = 5000;

		FUNC.activityread(model, function(err, output) {

			let quote = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
			let lines = ['date,type,user,teacher,group,flowstream,owner,detail'];

			for (let m of output.events)
				lines.push([m.t, m.type, m.user, m.sa ? 'yes' : '', m.group, m.stream, m.owner, m.detail].map(quote).join(','));

			$.success(lines.join('\n'));
		});
	}
});

// Clears the activity (the months older than the retention are cleared by the application every day)
NEWACTION('Classroom|activity_clear', {
	name: 'Clear the activity of the students',
	route: '+API ?',
	sa: true,
	audit: true,
	action: function($) {
		FUNC.activityclear(true, removed => $.callback({ success: true, removed: removed }));
	}
});
