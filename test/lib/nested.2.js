'use strict';

const version = process.versions.node.split('.')[0];

const assert = require('assert').strict;

const dive = require('../../src/index');
const fn = require('./fn');

var emergePassed = false;

const smallTest = () => {
	if (version < 10) {
		return true;
	}
	if (!dive.hooksEnabled) {
		return true;
	}
	return false;
};

const shouldHaveContext = () => {
	return !smallTest() && !emergePassed;
};

const test = (done) => {

	const name = 'nested jump test 2';

	if (smallTest()) {
		process._rawDebug('\n    Running SMALL test version!\n');
	} else {
		if (dive.state.experimentalPredictionEnabled) {
			process._rawDebug('\n    Running FULL Experimental test version!\n');
		} else {
			process._rawDebug('\n    Running FULL test version!\n');
		}
	}

	var bfn = fn.bind(null, done, name, smallTest());

	var runStorage = [dive(() => {
		assert(dive.ctx == 'other ctx 2.1', 'context graph failed');
		setTimeout(() => {
			if (shouldHaveContext()) {
				// process._rawDebug('must have "other ctx 2.1": ', dive.ctx);
				assert(dive.ctx == 'other ctx 2.1', 'context graph failed');
			}
		}, 100);
	}, 'other ctx 2.1'), dive(() => {
		assert(dive.ctx == 'other ctx 2.2', 'context graph failed');
		setTimeout(() => {
			if (shouldHaveContext()) {
				// process._rawDebug('must have "other ctx 2.2": ', dive.ctx);
				assert(dive.ctx == 'other ctx 2.2', 'context graph failed');
			}
		}, 100);
	}, 'other ctx 2.2')];

	var count = 0;

	process.on('diveTestJumpEvent', (index) => {
		if (shouldHaveContext()) {
			// because this is a completely
			// the other conext towards wrapped
			// this is just an event jump

			// it called many times,
			// ans mustn't have any context
			assert(dive.ctx == undefined, `context graph failed ${count++}`);
			// process._rawDebug('jump 1 : ', dive.ctx, index);
		}
		if (typeof runStorage[index] === 'function') {
			runStorage[index]();
			runStorage.splice(index, 1);
		}
	});

	var finished = false;
	const intervalPointer = () => {
		if (finished) {
			return;
		}
		runStorage.forEach((run, index) => {
			process.nextTick(() => {
				setTimeout(() => {
					process.emit('diveTestJumpEvent', index);
				}, 50);
			});
		});
		if (runStorage.length && !emergePassed) {
			setTimeout(intervalPointer, 100);
		}
	};
	setTimeout(intervalPointer, 500);

	const eventRunner = () => {
		
		finished = true;
		if (shouldHaveContext()) {
			// process._rawDebug('jump 2: ', dive.ctx);
			assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		}
		bfn();
		// runStorage = [];
	};

	process.once('diveTestEvent', eventRunner);

	const jumpDescriptor = (cb) => {
		process.nextTick(() => {
			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
				// process._rawDebug('straight 1 : ', dive.ctx);
			}
		});
		return () => {
			// all must be false
			// because this code is just a wrapper 
			// it wraps our code, and runs instead of it

			if (shouldHaveContext() && dive.state.experimentalPredictionEnabled) {
				assert((dive.ctx == undefined), `context graph failed ${dive.ctx} !== undefined`);
				// process._rawDebug('straight 2 : ', dive.ctx);
			}

			setTimeout(() => {
				setImmediate(() => {
					// process._rawDebug('straight 3 : ', dive.ctx);
					if (shouldHaveContext() && dive.state.experimentalPredictionEnabled) {
						assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
					}
					cb();
				});
			}, 100);
		};
	};

	dive((cb) => {
		assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		setTimeout(() => {
			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
			}
			runStorage.push(jumpDescriptor(cb));
		}, 100);
	}, name)(() => {
		assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		setTimeout(() => {
			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
				// process._rawDebug('drop2 : ', dive.ctx);
			}
			process.nextTick(() => {

				if (shouldHaveContext()) {
					assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
				}
				// process._rawDebug('pre_jump : ', dive.ctx);
				process.emit('diveTestEvent');
			});
		}, 100);
	});
};

module.exports = test;