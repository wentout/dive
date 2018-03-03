'use strict';

const util = require('util');
const dive = require('./index');


var count = 0;

const line = '-'.repeat(75);
const makeReportHead = (mark) => {
	process.stdout.write(`\n\nSTART ${mark}\n\n`);
	process.stdout.write('tid -> eid : |  context :  | mark  -> [ trace.step ] : | log args :\n');
	process.stdout.write(`${line}\n`);
};

const log = (mark, ...args) => {
	mark = `${mark}`.padEnd(25);
	const eid = `${dive.tid} -> ${dive.eid}`.padStart(12);
	const ctx = `${dive.currentContext}`.padStart(10).padEnd(11);
	process.stdout.write(`\n${eid} | ${ctx} | ${mark} | ${args.join(' ')}`);
};

const d = (cb, trace = ++count) => {
	trace = `${trace}`.padStart(2);
	log(`d -> [ ${trace} . 1 ]`);
	return (t, y) => {
		log(`d -> [ ${trace} . 2 ]`, t, y);
		setTimeout(() => {
			log(`d -> [ ${trace} . 3 ]`, '-> hook');
			cb('d-a1', 'd-a2', (look) => {
				// this will never run in d context
				// cause it will run in cb context
				log(`d -> [ ${trace} . 4 ]`, look);
			});
		}, 100);
	};
};

const z = (cb, trace = ++count) => {
	trace = `${trace}`.padStart(2);
	log(`z -> [ ${trace} . 1 ]`, '-> native');
	process.nextTick(() => {
		log(`z -> [ ${trace} . 2 ]`, '-> hook 1');
		setImmediate(() => {
			log(`z -> [ ${trace} . 3 ]`, '-> hook 2');
			const tpcall = () => {
				log(`z -> [ ${trace} . 4 ]`, '-> hook 3');
				cb('z-a1', 'z-a2');
			};
			setTimeout(tpcall, 100);
			setTimeout(() => {
				log(`z -> [ ${trace} . 5 ]`, '-> hook 4');
				cb('z-a3', 'z-a4');
			}, 200);
		});
	}, 1000);
};

const w = function (a, b, cb, trace = ++count) {
	trace = `${trace}`.padStart(2);
	log(`w -> [ ${trace} . 1 ]`, a, b);
	setTimeout(() => {
		log(`w -> [ ${trace} . 2 ]`, a, b);
		setTimeout(() => {
			log(`w -> [ ${trace} . 3 ]`, a, b);
			cb('aw4m');
		}, 100);
	}, 100);
};

const test = (mark, cb) => {
	
	makeReportHead(mark);
	
	const m = dive.call(d, 'One ( 1 )')(w);
	
	const s = dive.call(z, '( 2 ) Two');
	
	// no context
	d((n1, n2, cb) => {
		log('w \\ o', n1, n2);
		cb('w \\ o');
	})('w \\ o', 'context');
	
	// dive -> context
	s(m);
	
	// binded context without dive
	d(m)('binded', 'context');
	
	setTimeout(() => {
		console.log('\n');
		console.log(`TOTAL ${mark}`);
		console.log(line);
		log('dive.asyncIdHooks', util.inspect(dive.asyncIdHooks), '\n');
		log('dive.triggerHooks', util.inspect(dive.triggerHooks), '\n');
		log('dive.currentContext', dive.currentContext);
		console.log('\n');
		if (typeof cb == 'function') cb();
	}, 3000);
	
};

test('no async_hooks', () => {
	dive.enableAsyncHooks();
	test('async_hooks enabled');
});

	

