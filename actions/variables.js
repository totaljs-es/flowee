// Global variables

NEWACTION('Variables|read', {
	name: 'Read variables',
	route: '+API ?',
	input: 'id:String',
	user: true,
	action: function($, model) {
		let id = model.id;
		if (id) {
			let fs = Flow.db[id];
			if (fs && FUNC.streamaccess($.user, fs))
				$.callback(fs.variables);
			else
				$.invalid(404);
		} else if ($.user.sa)
			$.callback(Flow.db.variables);
		else
			$.invalid(401);
	}
});

NEWACTION('Variables|save', {
	name: 'Save variables',
	route: '+API ?',
	input: 'id:String, data:Object',
	user: true,
	action: function($, model) {

		if (!model.data)
			model.data = {};

		if (model.id) {

			let id = model.id;
			let fs = Flow.db[id];

			if (fs && FUNC.streamaccess($.user, fs)) {
				fs.variables = model.data;
				Flow.emit('save');
				Flow.instances[id].variables(fs.variables);
			} else {
				$.invalid(404);
				return;
			}

		} else {

			// The global variables are for the teachers
			if (!$.user.sa) {
				$.invalid(401);
				return;
			}

			Flow.db.variables = model.data;
			Flow.emit('save');

			for (let key in Flow.instances) {
				let instance = Flow.instances[key];
				instance.variables2(model.data);
			}
		}

		$.success();
	}
});