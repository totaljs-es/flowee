// Exam mode for a group of OpenPlatform: the students can work only between the start and the end that the teacher sets.
// - before the start and after the end the students of the group have no access to their FlowStreams (the teachers always have)
// - while the exam is open, "restrict" blocks exporting, reading the raw data and duplicating (nobody takes the work out)
// - when it ends, the work of every student is delivered by itself ("autodeliver"), so the teacher has a frozen copy
// The teacher ends the exam in Classroom, and then the group goes back to normal.

FUNC.exams = function() {
	return PREF.exams || {};
};

// null (no exam), "scheduled", "open" or "closed"
FUNC.examstate = function(group) {

	let exam = group ? FUNC.exams()[group] : null;

	if (!exam)
		return null;

	let now = Date.now();

	if (now < +new Date(exam.start))
		return 'scheduled';

	return now <= +new Date(exam.end) ? 'open' : 'closed';
};

// A message when the student cannot work with the group now, or '' (the teachers and the groups without exam are never blocked)
FUNC.examblock = function(user, group) {

	if (!user || user.sa || !group)
		return '';

	switch (FUNC.examstate(group)) {
		case 'scheduled':
			return '@(The exam has not started yet)';
		case 'closed':
			return '@(The exam has finished)';
	}

	return '';
};

// Is the student in an open exam that blocks exporting and duplicating?
FUNC.examrestricted = function(user, group) {

	if (!user || user.sa || !group)
		return false;

	let exam = FUNC.exams()[group];
	return !!(exam && exam.restrict && FUNC.examstate(group) === 'open');
};

// Delivers the work of the students of the exams that have ended. It is safe to call it many times: each exam is processed once.
FUNC.examtick = function(callback) {

	let exams = CLONE(FUNC.exams());
	let jobs = [];
	let changed = false;

	for (let group in exams) {

		let exam = exams[group];

		if (exam.processed || FUNC.examstate(group) !== 'closed')
			continue;

		exam.processed = NOW;
		changed = true;

		if (!exam.autodeliver)
			continue;

		for (let key in Flow.db) {
			let item = Flow.db[key];
			if (key !== 'variables' && item && item.group === group && item.ownerid && !item.template)
				jobs.push(item);
		}
	}

	if (!changed) {
		callback && callback(0);
		return;
	}

	PREF.set('exams', exams);

	jobs.wait(function(item, next) {
		FUNC.deliver(item, { id: item.ownerid, name: item.ownername }, () => next(), true);
	}, () => callback && callback(jobs.length));
};

ON('service', () => FUNC.examtick());
