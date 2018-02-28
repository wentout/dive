'use strict';

const dive = require('./index');
dive.enableAsyncHooks();

const line = '-'.repeat(75);
console.log('\n\nSTART\n');
console.log('eid : |  context :  | mark :                    | log args :');
console.log(line);

const log = (mark, ...args) => {
	mark = `${mark}`.padEnd(25);
	const eid = `${dive.getExecId()}`.padStart(5);
	const ctx = `${dive.currentContext}`.padStart(10).padEnd(11);
	console.log(`${eid} | ${ctx} | ${mark} |`, ...args);
};

const d = (cb) => {
	log('d 1');
	return (t, y) => {
		log('d 2', t, y);
		setTimeout(() => {
			log('d 3', '-> hook');
			cb('asdf', 'fdsa', () => {
				log('d 4');
			});
		}, 100);
	};
};

const z = (cb) => {
	log('z 1', '-> native');
	process.nextTick(() => {
		log('z 2', '-> hook');
		setImmediate(() => {
			log('z 3', '-> hook');
			setTimeout(() => {
				log('z 4', '-> hook');
				cb('zxcv', 'vcxz');
			}, 100);
		});
	}, 1000);
};

const m = dive.call(d, 'One ( 1 )')(function (a, b, cb) {
	log('m 1', a, b);
	setTimeout(() => {
		log('m 2', a, b);
		setTimeout(() => {
			log('m 3', a, b);
			cb();
		}, 100);
	}, 100);
});

const s = dive.call(z, '( 2 ) Two');

s(m);
d(m)('undef context', 'example');

setTimeout(() => {
	console.log('\n');
	console.log('TOTAL');
	console.log(line);
	log('dive.hashAllHooks', dive.hashAllHooks);
	log('dive.currentContext');
	console.log('\n');
}, 3000);