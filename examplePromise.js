// This part of code
// is grabbed from
// https://github.com/mvaldesdeleon/long-promise/blob/master/example.js
// Great Thanks to Martín Valdés de León

const util = require('util');
const dive = require('./index.js');
dive.enableAsyncHooks();
dive.enableFunctions();


const promiseTest1 = () => {
	
	// Simulate some stuff
	const stuff = x => 2 + x;
	
	// Simulate a delay.
	const delay = ms => x => {
		// This function is `buggy` and will throw if the delay is 100ms.
		if (ms === 100) throw new Error('boom');
	
		return new Promise(res => {
			setTimeout(() => {
				res(x);
			}, ms);
		});
	};
	
	const nestedProblems = x => () => {
		// After the third call, go to an eventual `delay(100)` that throws
		if (x === 3) return Promise.resolve(1).then(delay(100));
	
		// Promise chain with recursion
		return Promise.resolve(1)
			.then(delay(10))
			.then(stuff)
			.then(nestedProblems(x + 1));
	};
	
	// Main program
	function run() {
		const p = Promise.resolve(2);
	
		// Do some things. Something along this promise chain will throw.
		p.then(stuff)
			.then(delay(10))
			.then(stuff)
			.then(delay(10))
			.then(stuff)
			.then(nestedProblems(1))
			.then(stuff)
			.then(stuff)
			.catch(() => {
				process.stdout.write(`>>> promise context [ ${dive.currentContext} ]\n`);
				dive.stopTracing();
			});
	};
	run();
};


const promiseTest2 = () => {
	function resolveAfter2Seconds() {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve('resolved');
			}, 500);
		});
	};
	
	async function asyncCall() {
		process.stdout.write('\async calling\n');
		var result = await resolveAfter2Seconds();
		process.stdout.write(`>>> async/await ${result} [ ${dive.currentContext} ]\n`);
		dive.stopTracing();
	};
	asyncCall();
};

promiseTest1.dive('we have context 1')();
promiseTest2.dive('another context 1')();

setTimeout(() => {
	
	process.stdout.write('-----------------------\n');
	
	promiseTest1.dive('we have context 2')();
	promiseTest2.dive('another context 2')();
	
	setTimeout(() => {
		process.stdout.write('\nNext must be [ undefined ]\n');
		promiseTest1();
		promiseTest2();
		setTimeout(() => {
			process.stdout.write(`dive.currentContext ${dive.currentContext}\n`);
			process.stdout.write(`dive.asyncIdHooks ${util.inspect(dive.asyncIdHooks)}\n`);
			process.stdout.write(`dive.eidHooks ${util.inspect(dive.eidHooks)}\n`);
			process.stdout.write(`dive.triggerHooks ${util.inspect(dive.triggerHooks)}\n`);
			process.stdout.write(`dive.tidHooks ${util.inspect(dive.tidHooks)}\n`);
		}, 1000);
	}, 1000);
}, 1000);

