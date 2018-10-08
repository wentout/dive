'use strict';

const dive = require('../../src/index');
const assert = require('assert').strict;

module.exports = (done, name, expectNoContext) => {
	const ctx = dive.ctx;
	if (expectNoContext) {
		assert(ctx === undefined, 'context somehow found');
	} else {
		assert(ctx !== undefined, 'context not found');
	}
	dive.emerge();
	assert(dive.ctx === undefined, 'context exists after emerge');
	if (!expectNoContext && name) {
		assert(name === ctx, 'context line graph failed');
	}
	done();
};