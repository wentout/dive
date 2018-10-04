
const dive = require('../src/index');
dive.enableAsyncHooks();
dive.enableExperimentalPrediction();

const fn = (done, name) => {
	const ctx = dive.ctx;
	dive.emerge();
	let testFailed = false;
	if (ctx === undefined) {
		testFailed = true;
	}
	if (dive.ctx !== undefined) {
		testFailed = true;
	}
	if (name) {
		if (name !== ctx) {
			testFailed = true;
		}
	}
	// // process._rawDebug(ctx, dive.ctx, testFailed);
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
		const name = 'uncaughtException test';
		var listeners = process.listeners('uncaughtException');
		process.removeAllListeners('uncaughtException');

		process.on('uncaughtException', dive.uncaughtExceptionListener);

		const testUncExListener = fn.bind(null, (failed) => {
			done(failed);
			process.removeAllListeners('uncaughtException');
			listeners.forEach(function (listener) {
				process.on('uncaughtException', listener);
			});
		}, name);
		process.on('uncaughtException', testUncExListener);

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
	it('should have a context', function (done) {
		process.once('unhandledRejection', (error, promise) => {
			const ctx = dive.getPromiseContext(promise);
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


describe('nested jump from other code 1', () => {
	it('should have a context', function (done) {
		const name = 'nested jump test';
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


describe('nested jump from other code 2', () => {
	it('should have a context', function (done) {
		const name = 'nested jump test';
		var bfn = fn.bind(null, done, name);

		var runStorage = [dive(() => {
			setTimeout(() => {
				// process._rawDebug('must have another dive : ', dive.ctx);
			}, 100);
		}, 'other ctx 1'), dive(() => {
			setTimeout(() => {
				// process._rawDebug('must have another dive : ', dive.ctx);
			}, 100);
		}, 'other ctx 2')];

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
			clearInterval(intervalPointer);
		};

		process.once('diveTestEvent', eventRunner);

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
				// process._rawDebug('ZZZZZZZZZZZ : ', dive.ctx);
				runStorage.push(jumpDescriptor(cb));
			}, 100);
		}, name)(() => {
			setTimeout(() => {
				process.nextTick(() => {
					// process._rawDebug('pre jump : ', dive.ctx);
					process.emit('diveTestEvent');
				});
			}, 100);
		});

		// dive((cb) => {
		// 	setTimeout(() => {
		// 		process._rawDebug('ZZZZZZZZZZZ : ', dive.ctx);
		// 		runStorage.push(() => {
		// 			process._rawDebug('direct 2 : ', dive.ctx);
		// 			setTimeout(() => {
		// 				setImmediate(() => {
		// 					cb();
		// 				});
		// 			}, 100);
		// 		});
		// 	}, 100);
		// }, name)(() => {
		// 	setTimeout(() => {
		// 		process.nextTick(() => {
		// 			process._rawDebug('pre jump : ', dive.ctx);
		// 			process.emit('diveTestEvent');
		// 		});
		// 	}, 100);
		// });

		// dive(((cb) => {
		// 	setTimeout(() => {
		// 		process._rawDebug('ZZZZZZZZZZZ : ', dive.ctx);
		// 		runStorage.push(jumpDescriptor(cb));
		// 	}, 100);
		// }).bind(null, () => {
		// 	setTimeout(() => {
		// 		process.nextTick(() => {
		// 			process._rawDebug('pre jump : ', dive.ctx);
		// 			process.emit('diveTestEvent');
		// 		});
		// 	}, 100);
		// }), name)();
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

