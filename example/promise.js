// This part of code
// is grabbed from
// https://github.com/mvaldesdeleon/long-promise/blob/master/example.js
// Great Thanks to Martín Valdés de León

process._rawDebug('\n\n\n PROMISE EXAMPLE STARTED \n\n\n');

process.on('unhandledRejection', (error, promise) => {
	process._rawDebug(`>>> unhandledRejection for [ ${dive.ctx} ] : might wrong context nothing here !!!`);
	process._rawDebug(`>>> unhandledRejection for [ ${dive.getPromiseContext(promise)} ] : CORRECT context is this !!!`);
	process._rawDebug(`\t duration [ ${dive.getPromiseMeasure(promise)} ]\n`);
	process._rawDebug('error ::: ', error, '\n\n');
});

process.on('uncaughtException', (error) => {
	process._rawDebug(error.stack);
	process._rawDebug(dive.ctx);
	process._rawDebug(require('util').inspect(process.memoryUsage()));
	process.exit(1);
});

const dive = require('..');
dive.enableAsyncHooks();


const promiseTest1 = (/* cb */) => {
	process._rawDebug(`\n PROMISE TEST ------ ${dive.currentContext} ------ \n`);
	
	// Simulate some stuff
	const stuff = x => {
		const answer = 2 + x;
		process._rawDebug(`>>> ctx [ ${dive.currentContext} ] ${dive.eid} ${dive.tid} | answer ${answer}`);
		return answer;
	};
	
	// Simulate a delay.
	const delay = ms => x => {
		// This function is `buggy` and will throw if the delay is 100ms.
		if (ms === 100) {
			dive;
			/* debugger; */
			throw new Error('boom');
		}
	
		return new Promise(res => {
			setTimeout(() => {
				res(x);
			}, ms);
		});
	};
	
	const nestedProblems = x => () => {
		
		// After the third call, go to an eventual `delay(100)` that throws
		if (x === 3) {
			process._rawDebug(`>>> nestedProblems context [ ${dive.currentContext} ]\n`);
			/* debugger; */
			return Promise.resolve(1).then(delay(100));
		}
	
		// Promise chain with recursion
		return Promise
			.resolve(1)
			.then(delay(10))
			.then(stuff)
			.then(delay(10))
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
			.then(function (...args) {
				// debugger;
				// cb();
				
				dive;
				// debugger;
				stuff.call(this, ...args);
			})
			.then(nestedProblems(1))
			.then(stuff);
			// TODO: check whenever nextTick in ./context.js is a proper way
			// .catch((error) => {
			// 	debugger;
			// 	process._rawDebug(error.stack);
			// 	process._rawDebug(`>>> promise context [ ${dive.currentContext} ]\n`);
			// 	// TODO: 
			// 	// dive.stopTracing();
			// });
	}
	
	run();
};



const promiseTest2 = () => {
	process._rawDebug('\n AWAIT TEST -----------------------\n');
	function resolveAfter2Seconds() {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve('resolved');
			}, 500);
		});
	}
	
	var asyncCall = async function () {
		process._rawDebug('\nasync calling\n');
		var result = await resolveAfter2Seconds();
		process._rawDebug(`>>> async/await ${result} [ ${dive.currentContext} ]\n`);
		// TODO: dive.stopTracing();
	};
	asyncCall();
};

dive(promiseTest1, 'context 1')(() => {
	dive(promiseTest2, 'another context 1')();
});

dive(promiseTest1, 'context 2')();
// dive(promiseTest1, 'context 3')();
// dive(promiseTest1, 'context 4')();
// dive(promiseTest1, 'context 5')();
// dive(promiseTest1, 'context 6')();
// dive(promiseTest1, 'context 7')();

setTimeout(() => {
	
	dive(promiseTest1, 'we have context 2')(() => {
		dive(promiseTest2, 'another context 2')();
	});
	
	// setTimeout(() => {
	// 	process._rawDebug('\n\n\n ***** Next must be [ undefined ]\n');
	// 	promiseTest1(() => {
	// 		promiseTest2();
	// 	});
	// 	// setTimeout(() => {
	// 	// 	process._rawDebug(`dive.currentContext ${dive.state.currentContext}\n`);
	// 	// 	process._rawDebug(`dive.asyncIdHooks ${util.inspect(dive.state.asyncIdHooks)}\n`);
	// 	// 	process._rawDebug(`dive.triggerHooks ${util.inspect(dive.state.triggerHooks)}\n`);
	// 	// }, 1000);
	// }, 1000);
}, 1000);

