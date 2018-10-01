
const dive = require('../src/index');
dive.enableAsyncHooks();

const fn = (done) => {
	const ctx = dive.ctx;
	dive.emerge();
	// process._rawDebug(ctx, ctx === undefined, dive.ctx === undefined, dive.ctx);
	let testFailed = false;
	if (ctx === undefined) {
		testFailed = true;
	}
	if (dive.ctx !== undefined) {
		testFailed = true;
	}
	// process._rawDebug(ctx, dive.ctx, testFailed);
	done(testFailed);
};

describe('dive simple test', () => {
	it('should have a context', function (done) {
		const bfn = fn.bind(null, done);
		dive(bfn, 'simple test')();
	});
});

describe('dive timeouts test', () => {
	it('should have a context', function (done) {
		const bfn = fn.bind(null, done);
		dive(() => {
			setTimeout(() => {
				setImmediate(() => {
					process.nextTick(() => {
						bfn();
					});
				});
			}, 100);
		}, 'timeouts test')();
	});
});

describe('dive events test', () => {
	it('should have a context', function (done) {
		const bfn = fn.bind(null, done);
		const eventRunner = dive(bfn, 'events test');
		process.once('diveTestEvent', eventRunner);
		setTimeout(() => {
			process.emit('diveTestEvent');
		}, 100);
	});
});

describe('dive callback test', () => {
	it('should have a context', function (done) {
		const bfn = fn.bind(null, done);
		dive((cb) => {
			setTimeout(() => {
				cb();
			}, 100);
		}, 'callback test')(bfn);
	});
});

describe('dive uncaughtException test', () => {
	it('should have a context', function (done) {
		var listeners = process.listeners('uncaughtException');
		process.removeAllListeners('uncaughtException');

		process.on('uncaughtException', dive.uncaughtExceptionListener);

		const testUncExListener = fn.bind(null, (failed) => {
			done(failed);
			process.removeAllListeners('uncaughtException');
			listeners.forEach(function (listener) {
				process.on('uncaughtException', listener);
			});
		});
		process.on('uncaughtException', testUncExListener);

		dive(() => {
			throw new Error('test error');
		}, 'uncaughtException test')();
	});
});

describe('dive unhandledRejection test', () => {
	it('should have a context', function (done) {
		process.once('unhandledRejection', (error, promise) => {
			const id = promise[dive.promisePointer];
			const ctx = dive.valueById(id);
			dive.emerge();
			const testFailed = !ctx && !!dive.ctx;
			done(testFailed);
		});

		dive(() => {
			Promise
				.resolve(true)
				.then(() => {
					throw new Error('unhandled rejection test');
				});
		}, 'unhandledRejection test')();
	});
});

describe('dive multi context test', () => {
	it('should have a context', function (done) {

		var failed1, failed2;
		const bfn1 = fn.bind(null, (failed) => {
			failed1 = failed;
		});
		const bfn2 = fn.bind(null, (failed) => {
			failed2 = failed;
		});

		const passDone = () => {
			done(failed1 || failed2);
		};

		// we will simply wait
		// will not directly track
		// when everything is passed
		setTimeout(() => {
			passDone();
		}, 1000);

		dive(() => {
			setTimeout(() => {
				setTimeout(() => {
					bfn1();
				}, 100);
			}, 100);
		}, 'multi test 1')();
		dive(() => {
			setTimeout(() => {
				bfn2();
			}, 150);
		}, 'multi test 2')();

	});
});

describe('nested jump from other code', () => {
	it('should have a context', function (done) {
		const bfn = fn.bind(null, done);
		var runStorage = [];

		const intervalPointer = setInterval(() => {
			runStorage.forEach(run => {
				process.nextTick(() => {
					run();
				});
			});
			runStorage = [];
		}, 100);

		const eventRunner = () => {
			bfn();
			clearInterval(intervalPointer);
		};

		process.once('diveTestEvent', eventRunner);

		dive((cb) => {
			setTimeout(() => {
				runStorage.push(() => {
					setTimeout(() => {
						setImmediate(() => {
							cb();
						});
					}, 100);
				});
			}, 100);
		}, 'nested jump test')(() => {
			setTimeout(() => {
				process.nextTick(() => {
					process.emit('diveTestEvent');
				});
			}, 100);
		});
	});
});

describe('dive await test', () => {
	it('should have a context', function (done) {
		var noContextChecker;
		const bfn = fn.bind(null, (failed) => {
			done(failed || noContextChecker);
		});
		
		const resolveAfter100ms = function (cb) {
			return new Promise(resolve => {
				setTimeout(function () {
					resolve(cb);
				}, 200);
			});
		};
		setTimeout(function () {
			noContextChecker = dive.ctx;
		}, 100);
		
		dive(async (cb) => {
			(await resolveAfter100ms (cb))();
		}, 'await test')(bfn);
	});
});

