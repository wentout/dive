'use strict';

var baseRunning = false;
var hookRunning = false;
var runningHookId = null;

const getNewOject = () => {
	return Object.create(null);
};

const getNewArray = () => {
	return [];
};

const defaultState = {

	// [asyncId] == ctx
	asyncIdHooks: getNewOject,

	// [triggerId][asyncId] == ctx
	triggerHooks: getNewOject,
	promiseHooks: getNewOject,

	trace: getNewArray

};


/**
 * our current state
 * all hooks, all contexts
 */

const state = Object.create(null);
const trace = Object.create(null);

Object.entries(defaultState).forEach(entry => {
	const [name, cstr] = entry;
	state[name] = cstr();
	Object.defineProperty(module.exports, name, {
		get() {
			return state[name];
		}
	});

});

Object.defineProperty(module.exports, 'baseRunning', {
	get() {
		return baseRunning;
	},
	set(value) {
		baseRunning = !!value;
		return baseRunning;
	},
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'hookRunning', {
	get() {
		return hookRunning;
	},
	set(value) {
		hookRunning = !!value;
		if (!hookRunning) {
			runningHookId = null;
		}
		return hookRunning;
	},
	configurable: false,
	enumerable: true
});
Object.defineProperty(module.exports, 'runningHookId', {
	get() {
		return runningHookId;
	},
	set(value) {
		if (Number.isInteger(value)) {
			runningHookId = value;
			hookRunning = true;
			return;
		}
		runningHookId = null;
		hookRunning = false;
		return runningHookId;
	},
	configurable: false,
	enumerable: true
});

/**
 * place current situation to state
 * @param {any} ctx state context
 */
const saveHooksContext = (ctx) => {

	const { id, type, asyncId, triggerId } = ctx;

	// track.set(asyncId, { id, type, triggerId });

	if (!state.asyncIdHooks[asyncId]) {
		state.asyncIdHooks[asyncId] = ctx;
	}

	if (!state.triggerHooks[triggerId]) {
		state.triggerHooks[triggerId] = {};
	}

	if (!state.triggerHooks[triggerId][asyncId]) {
		state.triggerHooks[triggerId][asyncId] = ctx;
	}

	if (type === 'promise') {
		state.promiseHooks[asyncId] = ctx;
	}

	if (!trace[id]) {
		trace[id] = [];
	}

	// to store all saved references 4 fast cleanup
	trace[id].push({
		asyncId, triggerId
	});

};

const cleanup = (id) => {

	if (baseRunning) {
		module.exports.baseRunning = false;
	}

	if (!trace[id]) {
		return;
	}

	trace[id].forEach(it => {
		const { asyncId, triggerId } = it;

		state.asyncIdHooks[asyncId] = undefined;
		delete state.asyncIdHooks[asyncId];

		if (state.triggerHooks[triggerId]) {
			state.triggerHooks[triggerId][asyncId] = undefined;
			delete state.triggerHooks[triggerId][asyncId];
			if (!Object.keys(state.triggerHooks[triggerId]).length) {
				delete state.triggerHooks[triggerId];
			}
		}

		state.promiseHooks[asyncId] = undefined;
		delete state.promiseHooks[asyncId];
	});

	trace[id] = undefined;
	delete trace[id];

	state.trace = [];

	module.exports.hookRunning = false;

};

Object.defineProperty(module.exports, 'saveHooksContext', {
	get() {
		return saveHooksContext;
	},
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'cleanup', {
	get() {
		return cleanup;
	},
	configurable: false,
	enumerable: true
});

const context = require('./context');

Object.defineProperty(module.exports, 'context', {
	get() {
		return context;
	},
	configurable: false,
	enumerable: false
});
