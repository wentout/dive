'use strict';

const version = process.versions.node.split('.')[0];

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

		const fixtures = {
			octx1: false,
			octx2: false,
			jump1: false,
			jump2: false,
			line1: false,
			line2: false,
			line3: false,
			drop1: false,
			drop2: false,
			pre_jump: false,
		};

		var bfn = fn.bind(null, (testFailed) => {
			Object.entries(fixtures).forEach(entry => {
				const [key, value] = entry;
				if (value === false) {
					process._rawDebug(key, value);
					testFailed = true;
				}
			});
			done(testFailed);
		}, name);

		var runStorage = [dive(() => {
			setTimeout(() => {
				if (version < 10) {
					fixtures.octx1 = true;
				} else {
					fixtures.octx1 = (dive.ctx == 'other ctx 1');
				}
				// process._rawDebug('must have another dive : ', dive.ctx);
			}, 100);
		}, 'other ctx 1'), dive(() => {
			setTimeout(() => {
				if (version < 10) {
					fixtures.octx2 = true;
				} else {
					fixtures.octx2 = (dive.ctx == 'other ctx 2');
				}
				// process._rawDebug('must have another dive : ', dive.ctx);
			}, 100);
		}, 'other ctx 2')];


		process.on('diveTestJumpEvent', (index) => {
			if (version < 10) {
				fixtures.jump1 = true;
			} else {
				// because this is a completely
				// the other conext towards wrapped
				// this is just an event jump
				fixtures.jump1 = (dive.ctx == undefined);
				// process._rawDebug('jump 1 : ', dive.ctx, index);
			}
			runStorage[index]();
		});

		const intervalPointer = setInterval(() => {
			runStorage.forEach((run, index) => {
				process.nextTick(() => {
					setTimeout(() => {
						process.emit('diveTestJumpEvent', index);
					}, 50);
				});
			});
			// runStorage = [];
		}, 100);

		const eventRunner = () => {
			if (version < 10) {
				fixtures.jump2 = true;
			} else {
				fixtures.jump2 = (dive.ctx == name);
				// process._rawDebug('jump 2: ', dive.ctx);
			}
			bfn();
			clearInterval(intervalPointer);
		};

		process.once('diveTestEvent', eventRunner);

		const jumpDescriptor = (cb) => {
			process.nextTick(() => {
				if (version < 10) {
					fixtures.line1 = true;
				} else {
					fixtures.line1 = (dive.ctx == name);
				}
				// process._rawDebug('line 1 : ', dive.ctx);
			});
			return () => {
				// all must be false
				// because this code is just a wrapper 
				// it wraps our code, and runs instead of it

				if (version < 10) {
					fixtures.line2 = true;
				} else {
					fixtures.line2 = (dive.ctx == undefined);
				}
				
				// process._rawDebug('line 2 : ', dive.ctx);
				setTimeout(() => {
					setImmediate(() => {
						if (version < 10) {
							fixtures.line3 = true;
						} else {
							fixtures.line3 = (dive.ctx == undefined);
						}
						cb();
					});
				}, 100);
			};
		};

		dive((cb) => {
			setTimeout(() => {
				if (version < 10) {
					fixtures.drop1 = true;
				} else {
					fixtures.drop1 = (dive.ctx == name);
				}
				runStorage.push(jumpDescriptor(cb));
			}, 100);
		}, name)(() => {
			setTimeout(() => {
				if (version < 10) {
					fixtures.drop2 = true;
				} else {
					fixtures.drop2 = (dive.ctx == name);
				}
				process.nextTick(() => {
					if (version < 10) {
						fixtures.pre_jump = true;
					} else {
						fixtures.pre_jump = (dive.ctx == name);
					}
					// process._rawDebug('pre_jump : ', dive.ctx);
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
			(await resolveAfter100ms(cb))();
		}, 'await test')(bfn);
	});
});

