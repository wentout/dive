// This part of code
// is grabbed from
// https://github.com/mvaldesdeleon/long-promise/blob/master/example.js
// Great Thanks to Martín Valdés de León

const util = require('util');
const fs = require('fs');

const dive = require('./index.js');
dive.enableAsyncHooks();
dive.enableFunctions();


// process.on('unhandledRejection', () => {
	// fs.writeSync(1, `>>> unhandledRejection [ ${dive.currentContext} ]\n`);
// });

const promiseTest1 = (cb) => {
	fs.writeSync(1, '\n PROMISE TEST -----------------------\n');
	
	// Simulate some stuff
	const stuff = x => {
		const answer = 2 + x;
		fs.writeSync(1, `>>> ctx [ ${dive.currentContext} ]  | answer ${answer}\n`);
		return answer;
	};
	
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
		fs.writeSync(1, `>>> nestedProblems context [ ${dive.currentContext} ]\n`);
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
				fs.writeSync(1, `>>> promise context [ ${dive.currentContext} ]\n`);
				// dive.stopTracing();
				cb();
			});
	};
	run();
};



const promiseTest2 = () => {
	fs.writeSync(1, '\n AWAIT TEST -----------------------\n');
	function resolveAfter2Seconds() {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve('resolved');
			}, 500);
		});
	};
	
	var asyncCall = async function () {
		fs.writeSync(1, '\async calling\n');
		var result = await resolveAfter2Seconds();
		fs.writeSync(1, `>>> async/await ${result} [ ${dive.currentContext} ]\n`);
		// dive.stopTracing();
	};
	asyncCall();
};

promiseTest1.dive('we have context 1')(() => {
	promiseTest2.dive('another context 1')();
});


setTimeout(() => {
	
	promiseTest1.dive('we have context 2')(() => {
		promiseTest2.dive('another context 2')();
	});
	
	setTimeout(() => {
		fs.writeSync(1, '\nNext must be [ undefined ]\n');
		promiseTest1(() => {
			promiseTest2();
		});
		setTimeout(() => {
			fs.writeSync(1, `dive.currentContext ${dive.currentContext}\n`);
			fs.writeSync(1, `dive.asyncIdHooks ${util.inspect(dive.asyncIdHooks)}\n`);
			// fs.writeSync(1, `dive.eidHooks ${util.inspect(dive.eidHooks)}\n`);
			fs.writeSync(1, `dive.triggerHooks ${util.inspect(dive.triggerHooks)}\n`);
			fs.writeSync(1, `dive.tidHooks ${util.inspect(dive.tidHooks)}\n`);
		}, 1000);
	}, 1000);
}, 1000);

