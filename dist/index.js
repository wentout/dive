'use strict';

/**
 * 
 * MIT License
 * please use the link below for notice
 * https://github.com/wentout/dive
 * 
 *   ABOUT
 * 
 * Dive utilize the ability of patching function callbacks
 * with other functions, and then, when them are called
 * it uses simple technique of restore and rollback
 * the context, given to the 1st execution funtion
 * 
 */


// itself start
// this module require order is a must!
const dive = require('./dive');

const state = require('./state');
dive.state = state;
const context = state.context;
dive.context = context;
const hooks = require('./hooks');
dive.hooks = hooks;

['eid', 'tid'].forEach(name => {
	Object.defineProperty(dive, name, {
		get() {
			return hooks[name];
		},
		enumerable: true
	});
});

dive.enableAsyncHooks = () => {
	state.cleanup();
	hooks.enable();
	return dive;
};

dive.disableAsyncHooks = () => {
	state.cleanup();
	hooks.disable();
	return dive;
};

Object.defineProperty(dive, 'ctx', context.valueDescriptor);
Object.defineProperty(dive, 'currentContext', context.valueDescriptor);
dive.enableExperimentalPrediction = state.enableExperimentalPrediction;

['valueById', 'lastUnsetValue', 'currentContextStack', 'adjustErrorStack', 'measureById'].forEach(name => {
	Object.defineProperty(dive, name, {
		get() {
			return context[name];
		},
		enumerable: true
	});
});

dive.errors = require('./errors');

dive.promisePointer = hooks.promisePointer;
dive.getPromiseContext = (promise) => {
	const promiseContextId = promise[dive.promisePointer];
	if (!promiseContextId) {
		return undefined;
	}
	return dive.valueById(promiseContextId);
};
dive.getPromiseMeasure = (promise) => {
	const promiseContextId = promise[dive.promisePointer];
	if (!promiseContextId) {
		return undefined;
	}
	return dive.measureById(promiseContextId);
};

dive.measure = () => {
	return dive.context.measure;
};

Object.defineProperty(dive, 'hooksEnabled', {
	get() {
		return hooks.enabled;
	},
	enumerable: true
});


module.exports = dive;
