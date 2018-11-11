'use strict';

const dive = require('..');
dive.enableAsyncHooks();

const fn = require('./lib/fn');

describe('dive simple test', () => {
	it('should have a context', function (done) {
		const name = 'simple test';
		const bfn = fn.bind(null, done, name);
		dive(bfn, name)();
	});
});

describe('dive timeouts test', () => {
	it('should have a context', function (done) {
		const name = 'timeouts test';
		const bfn = fn.bind(null, done, name);
		dive(() => {
			setTimeout(() => {
				setImmediate(() => {
					process.nextTick(() => {
						bfn();
					});
				});
			}, 100);
		}, name)();
	});
});

describe('dive events test', () => {
	it('should have a context', function (done) {
		const name = 'events test';
		const bfn = fn.bind(null, done, name);
		const eventRunner = dive(bfn, name);
		process.once('diveTestEvent', eventRunner);
		setTimeout(() => {
			process.emit('diveTestEvent');
		}, 100);
	});
});

describe('dive callback test', () => {
	it('should have a context', function (done) {
		const name = 'callback test';
		const bfn = fn.bind(null, done, name);
		dive((cb) => {
			setTimeout(() => {
				cb();
			}, 100);
		}, name)(bfn);
	});
});

describe('dive uncaughtException test', () => {
	it('should have a context', function (done) {
		const assert = require('assert').strict;

		const name = 'uncaughtException test';

		const bfn = fn.bind(null, () => {
			done();
		}, name);

		var listeners = process.listeners('uncaughtException');
		process.removeAllListeners('uncaughtException');

		const testUncExListener = (err) => {
			assert.equal(err instanceof Error, true);
			bfn();
			listeners.forEach(function (listener) {
				process.on('uncaughtException', listener);
			});
		};

		// process.prependOnceListener('uncaughtException', testUncExListener);
		process.once('uncaughtException', testUncExListener);

		const throwException = () => {
			throw new Error('test error');
		};
		dive(() => {
			try {
				throwException();
			} catch (err) {
				// only nextTick on err to get out of
				// the event loop and avoid state corruption.
				process.nextTick(() => {
					throw err;
				});
			}
		}, name)();
	});
});

describe('dive unhandledRejection test', () => {
	it('should have a context & cleanup it', (done) => {
		const assert = require('assert').strict;

		const name = 'unhandledRejection test';

		process.on('unhandledRejection', (error, promise) => {
			const ctx1 = dive.getPromiseContext(promise);
			assert(ctx1 === name, 'wrong promise context');
			// process._rawDebug('--->>>', ctx1);
			dive.emerge(promise[dive.promisePointer]);
			const ctx2 = dive.getPromiseContext(promise);
			// process._rawDebug('--->>>', ctx2);
			assert(ctx2 === undefined, 'wrong promise context after emerge');
			done();
		});

		dive(() => {
			Promise
				.resolve(true)
				.then(() => {
					throw new Error('unhandled rejection test');
				});
		}, name)();
	});

});

describe('dive multi context test', () => {
	it('should have a context', function (done) {

		var failed1, failed2;
		const name1 = 'multi test 1';
		const name2 = 'multi test 2';
		const bfn1 = fn.bind(null, (failed) => {
			failed1 = failed;
		}, name1);
		const bfn2 = fn.bind(null, (failed) => {
			failed2 = failed;
		}, name2);

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
		}, name1)();
		dive(() => {
			setTimeout(() => {
				bfn2();
			}, 150);
		}, name2)();

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
			(await resolveAfter100ms(cb))();
		}, 'await test')(bfn);
	});
});

describe('nested jump from other code 1', () => {
	it('should have a context', function (done) {
		const name = 'nested jump test 1';
		var bfn = fn.bind(null, done, name);

		var runStorage = [dive(() => {
			// process._rawDebug('must have no dive : ', dive.ctx);
		}, 'other')];
		const intervalPointer = setInterval(() => {
			runStorage.forEach((run, i) => {
				process.nextTick(() => {
					setTimeout(() => {
						process.emit('diveTestJumpEvent', i);
					}, 50);
				});
			});
			// runStorage = [];
		}, 1000);

		process.on('diveTestJumpEvent', (index) => {
			// process._rawDebug('event 1 : ', dive.ctx);
			runStorage[index]();
		});

		const eventRunner = () => {
			// process._rawDebug('jump : ', dive.ctx);
			bfn();
			bfn = () => { };
			clearInterval(intervalPointer);
		};

		process.on('diveTestEvent', eventRunner);

		const jumpDescriptor = (cb) => {
			process.nextTick(() => {
				// process._rawDebug('direct 1 : ', dive.ctx);
			});
			return () => {
				// process._rawDebug('direct 2 : ', dive.ctx);
				setTimeout(() => {
					setImmediate(() => {
						cb();
					});
				}, 100);
			};
		};

		dive((cb) => {
			setTimeout(() => {
				runStorage.push(jumpDescriptor(cb));
			}, 100);
		}, name)(() => {
			setTimeout(() => {
				process.nextTick(() => {
					process.emit('diveTestEvent');
				});
			}, 100);
		});

		// reall context mess example
		for (let i = 0; i < 100; i++) {
			((idx) => {
				const name = `njt ${idx}`;
				dive((cb) => {
					setTimeout(() => {
						runStorage.push(jumpDescriptor(cb));
					}, 100);
				}, name)(() => {
					setTimeout(() => {
						process.nextTick(() => {
							process.emit('diveTestEvent');
							// process._rawDebug('load : ', dive.ctx == name);
						});
					}, 100);
				});
			})(i);
		}
	});
});



