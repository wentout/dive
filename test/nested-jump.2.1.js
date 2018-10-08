'use strict';

const dive = require('../src/index');
const test = require('./lib/nested.2');

describe('nested jump from other code 2.1', () => {
	before(() => {
		dive.disableAsyncHooks();
	});
	it('shouldn\'t have a context', test);
});
