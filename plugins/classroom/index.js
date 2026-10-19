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
		FUNC.opusers(function(err, op) {

			let groups = op.groups.length ? op.groups : ($.user.platform && $.user.platform.groups instanceof Array ? $.user.platform.groups : []);
			let students = [];

			for (let m of op.users) {
				if (!m.sa && !m.isdisabled && !m.isinactive)
					students.push({ id: m.id, name: m.name, groups: m.groups || [] });
			}

			$.callback({ groups: groups, students: students, hasusers: !err && op.users.length > 0 });
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

		TRANSFORM('flowstream.update', item, function(err, item) {
			Flow.reload(item);
		});

		$.success();
		Flow.emit('save');
	}
});
