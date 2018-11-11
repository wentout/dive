'use strict';

const version = process.versions.node.split('.')[0];

const assert = require('assert').strict;

const dive = require('../..');
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

const runStorage = [dive(() => {
	assert(dive.ctx == 'other ctx 2.1', 'context graph failed');
	// process._rawDebug('OTHER 00000 other ctx 2.1 : ', dive.ctx, dive.eid, dive.tid);
	setTimeout(() => {
		// process._rawDebug('OTHER 11111 other ctx 2.1 : ', dive.ctx, dive.eid, dive.tid);
		if (shouldHaveContext()) {
			// process._rawDebug('must have "other ctx 2.1": ', dive.ctx);
			assert(dive.ctx == 'other ctx 2.1', 'context graph failed');
		}
	}, 100);
}, 'other ctx 2.1'), dive(() => {
	assert(dive.ctx == 'other ctx 2.2', 'context graph failed');
	// process._rawDebug('OTHER 00000 other ctx 2.2 : ', dive.ctx, dive.eid, dive.tid);
	setTimeout(() => {
		// process._rawDebug('OTHER 11111 other ctx 2.2 : ', dive.ctx, dive.eid, dive.tid);
		if (shouldHaveContext()) {
			// process._rawDebug('must have "other ctx 2.2": ', dive.ctx);
			assert(dive.ctx == 'other ctx 2.2', 'context graph failed');
		}
	}, 100);
}, 'other ctx 2.2')];

var finished = false;
const intervalPointer = () => {
	if (finished) {
		return;
	}
	// process._rawDebug('jump xxx 1 : ', dive.ctx, dive.eid, dive.tid);
	runStorage.forEach((run, index) => {
		process.nextTick(() => {
			// process._rawDebug('jump xxx 2 : ', dive.ctx, dive.eid, dive.tid);
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


const test = (done) => {
	
	const name = 'nested jump test 2';

	if (smallTest()) {
		process._rawDebug('\n    Running SMALL test version!\n');
	} else {
		process._rawDebug('\n    Running FULL test version!\n');
	}

	var bfn = fn.bind(null, done, name, smallTest());

	var count = 0;

	process.on('diveTestJumpEvent', (index) => {
		// process._rawDebug('jump ZZZZZZZZ : ', dive.ctx, dive.eid, dive.tid);
		if (shouldHaveContext()) {
			// because this is a completely
			// the other conext towards wrapped
			// this is just an event jump

			// it called many times,
			// ans mustn't have any context
			// process._rawDebug('jump 1 : ', dive.ctx, index);
			assert(dive.ctx == undefined, `context graph failed ${count++}`);
		}
		if (typeof runStorage[index] === 'function') {
			const runPointer = runStorage[index];
			runPointer();
			runStorage.splice(index, 1);
		}
	});



	const eventRunner = () => {
		// process._rawDebug('eventRunner : ', dive.ctx, dive.eid, dive.tid);
		finished = true;
		if (shouldHaveContext()) {
			// process._rawDebug('jump 2: ', dive.ctx);
			assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		}
		bfn();
		// runStorage = [];
	};

	process.once('diveTestEvent', eventRunner);

	const jumpDescriptor = dive.hopAutoWrap((cb) => {
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

			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
				// process._rawDebug('straight 2 : ', dive.ctx);
			}

			// process._rawDebug('STRAIGHT 000 : ', dive.ctx, dive.eid, dive.tid);
			setTimeout(() => {
				// process._rawDebug('STRAIGHT 111 : ', dive.ctx, dive.eid, dive.tid);
				setImmediate(() => {
					// process._rawDebug('\nSTRAIGHT 222 : ', dive.ctx, dive.eid, dive.tid, '\n');
					if (shouldHaveContext()) {
						assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
					}
					cb();
				});
			}, 100);
		};
	});
	
	
	// process._rawDebug('DIVE INIT CONTEXT START! : ', dive.eid, dive.tid);
	dive((cb) => {
		assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		// process._rawDebug('dive cb 0 : ', dive.ctx, dive.eid, dive.tid);
		setTimeout(() => {
			// process._rawDebug('dive cb 1 : ', dive.ctx, dive.eid, dive.tid);
			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
			}
			runStorage.push(jumpDescriptor(cb));
		}, 100);
	}, name, { debugMode: false })(() => {
		assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
		// process._rawDebug('dive pre cb 1 : ', dive.ctx, dive.eid, dive.tid);
		setTimeout(() => {
			// process._rawDebug('dive pre cb 2 : ', dive.ctx, dive.eid, dive.tid);
			if (shouldHaveContext()) {
				assert((dive.ctx == name), `context graph failed ${dive.ctx} !== ${name}`);
				// process._rawDebug('drop2 : ', dive.ctx);
			}
			process.nextTick(() => {
				// process._rawDebug('dive pre cb 3 : ', dive.ctx, dive.eid, dive.tid);
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