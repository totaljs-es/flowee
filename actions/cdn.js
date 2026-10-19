NEWACTION('CDN|clear', {
	name: 'Clear CDN cache',
	route: '+API ?',
	sa: true,
	action: function($) {
		MODS.cdn.clear($.done());
	}
});