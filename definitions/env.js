// Settings from the environment, so a container is configured from docker-compose.yaml without editing the file "config".
// The name is FLOWEE_ plus the key of the config in upper case: FLOWEE_OP_GROUPS, FLOWEE_SSO, FLOWEE_FLOWSTREAM_MEMORY...
// An empty variable is ignored. The environment wins over the file "config".

const TEXT = ['name', 'op_groups', 'op_url', 'sso', 'openplatform'];
const NUMBER = { flowstream_memory: 'flowstream_memory', proxytimeout: '$proxytimeout' };

// The value of FLOWEE_<KEY> or undefined
FUNC.env = function(key) {
	let value = process.env['FLOWEE_' + key.toUpperCase()];
	return value == null || value === '' ? undefined : value.trim();
};

(function() {

	for (let key of TEXT) {
		let value = FUNC.env(key);
		if (value !== undefined)
			CONF[key] = value;
	}

	// "fork" (default of this edition), "worker" or "false"
	let worker = FUNC.env('flowstream_worker');
	if (worker !== undefined)
		CONF.flowstream_worker = worker === 'false' ? false : worker;

	for (let key in NUMBER) {
		let value = FUNC.env(key);
		if (value !== undefined && !isNaN(+value))
			CONF[NUMBER[key]] = +value;
	}

})();
