var BLACKLIST = {};

AUTH(function($) {

	// Setup interface
	if (CONF.op_reqtoken && CONF.op_restoken) {
		OpenPlatform.auth($);
		return;
	}

	if (BLACKLIST[$.ip] > 15) {
		$.banned = true;
		$.invalid();
		return;
	}

	var token = $.cookie(CONF.cookie);

	// OpenPlatform cloud: the session is verified there. Education Edition: the user keeps its own groups and "sa" (the teacher), nobody can impersonate groups.
	if (CONF.sso) {

		if (token && TEMP[token]) {
			BLOCKED($, -1);
			$.success(TEMP[token]);
			return;
		}

		if (!token) {
			BLACKLIST[$.ip] = (BLACKLIST[$.ip] || 0) + 1;
			$.invalid();
			return;
		}

		RESTBuilder.POST(CONF.sso, { schema: 'Session', data: { app: 'flow' }}).header('authorization', token).header('user-agent', $.headers['user-agent']).callback(function(err, response) {
			if (response && response.id) {
				response.platform = response.platform || {};
				if (response.platform.modules) {
					response.platform.module = response.platform.modules.findItem('id', response.moduleid);
					if (response.platform.module)
						CONF.name = response.platform.module.name;
				}
				TEMP[token] = response;
				$.success(response);
			} else {
				BLACKLIST[$.ip] = (BLACKLIST[$.ip] || 0) + 1;
				$.invalid();
			}
		});
		return;
	}

	if (token) {
		var session = DECRYPTREQ($, token, CONF.cookie_secret);
		if (session && session.id === PREF.user.id && session.expire > NOW) {
			$.success({ sa: true });
			return;
		} else
			BLACKLIST[$.ip] = (BLACKLIST[$.ip] || 0) + 1;
	}

	$.invalid();
});

ON('start', function() {

	OpenPlatform.permissions.push({ name: 'Create Flows', value: 'create' });
	OpenPlatform.permissions.push({ name: 'Remove Flows', value: 'remove' });

	for (let key in Total.plugins) {
		let item = Total.plugins[key];
		if (item.permissions)
			OpenPlatform.permissions.push.apply(OpenPlatform.permissions, item.permissions);
	}

	if (!PREF.user) {
		let password = GUID(10);
		PREF.set('user', { id: UID(), login: GUID(10), password: password.sha256(CONF.cookie_secret), raw: password });
	}

	CONF.op_cookie = CONF.cookie;
});

ON('service', function(counter) {
	if (counter % 15 === 0)
		BLACKLIST = {};
});