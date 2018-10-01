'use strict';

const errors = require('./errors');

const promisePointer = Symbol('dive promise pointer');

const async_hooks = require('async_hooks');

const eid = () => {
	return 0 + async_hooks.executionAsyncId();
};

const tid = () => {
	return 0 + async_hooks.triggerAsyncId();
};

const state = require('./state');

const showDebugMark = (mark, it) => {
	const opts = state.context.optsById(it.id);
	if (opts && opts.debugMode) {
		process._rawDebug(mark.padEnd(7), ` : AsyncID : ${it.asyncId} | Context : ${it.id}`);
	}
};

const getIdFromState = () => {
	if (Number.isInteger(state.context.id)) {
		if (!state.hookRunning && !state.baseRunning) {
			throw errors.ContextCorrupted('context leakage detected');
			// throw errors.ContextCorrupted(`context leakage detected ${state.context.id}`);
		}
	} else {
		if (state.hookRunning) {
			process._rawDebug(state.runningHookId);
			throw errors.ContextCorrupted('no context with running hook');
		}
		if (state.baseRunning) {
			throw errors.ContextCorrupted('no context through base function');
		}
		return null;
	}

	return state.context.id;
};

const contextIdTypeCalcs = {

	promise(asyncId, triggerId) {
		// promises are based on triggerId
		const it = state.asyncIdHooks[triggerId];
		if (!it) {
			return null;
		}
		return it.id;
	},

	tickobject(asyncId, triggerId) {
		const prevId = asyncId - 1;
		const it = state.asyncIdHooks[prevId];
		if (!it) {
			return null;
		}

		// may that tick produced by our context ?
		const probe = state.asyncIdHooks[prevId - 1];
		if (!probe) {
			return null;
		}

		// process._rawDebug('\n\n--->TICK', asyncId, triggerId, prevId, it.id, it.triggerId, !!probe);

		if (
			probe.triggerId === it.triggerId ||
			triggerId === it.triggerId ||
			probe.eid === it.tid ||
			state.asyncIdHooks[probe.triggerId]
		) {
			return it.id;
			// // } else {
			// // 	process._rawDebug('\nIT', it);
			// // 	process._rawDebug('\nPROBE', probe);
		}
		return null;
		// return it.id;

	}
};

const getContextId = (type, asyncId, triggerId) => {

	const stateId = getIdFromState();
	if (Number.isInteger(stateId)) {
		return stateId;
	}

	if (!contextIdTypeCalcs[type]) {
		// process._rawDebug('DIG ->>>>>>>>>>>>>>>>', type, asyncId, triggerId);
		return null;
	}

	return contextIdTypeCalcs[type](asyncId, triggerId);

};

/**
 * standard async_hooks init callback
 * 
 * this function tries to memorise currentContext
 * to investigate it from state when it will be necessary
 * 
 * @param {number} asyncId 
 * @param {string} type 
 * @param {number} triggerId 
 * @param {any} resource 
 */
const init = (asyncId, type, triggerId, resource) => {

	if (state.asyncIdHooks[asyncId]) {
		throw errors.ContextCorrupted('called twice');
	}

	type = type.toLowerCase();

	const contextId = getContextId(type, asyncId, triggerId);

	if (!Number.isInteger(contextId)) {
		// cause nothing to track from here
		return;
	}

	//  eid is equal to triggerId here
	const it = {

		// easy, we definetely
		// have to dive deeper
		// with this upon the stage

		// ctx: state.ctx,

		// our tracking IDs
		asyncId,
		triggerId,

		// additional debugging data,
		// may be we need too look on
		type,
		resource,

		eid: eid(),
		tid: tid(),

		id: contextId,

		stage: 'init',
		ctxFail: false

	};

	// if we have some context
	// we will save it to hooks storage
	state.saveHooksContext(it);

	// patching promise for unhandledRejection
	// cause when we will get into it,
	// we will unable to touch the context
	if (
		it.type === 'promise' &&
		it.resource &&
		it.resource.promise
	) {
		it.resource.promise[promisePointer] = it.id;
	}

	showDebugMark('INIT', it);

	state.context.counters(it.id).init++;

};


/**
 * @param {number} asyncId 
 */
const before = (asyncId) => {

	const it = state.asyncIdHooks[asyncId];
	if (!it) {
		// if (state.hookRunning) {
			// TODO: perf_hook failed throw errors.ContextCorrupted();
		// }
		return;
	}

	showDebugMark('BEFORE', it);

	if (it.stage !== 'init' && state.trace.length) {
		it.ctxFail = true;
	}

	state.trace.push(asyncId);

	if (it.ctxFail) {
		throw errors.ContextCorrupted();
	}

	// ... MEANINGFULL NOTE ...
	// there can be the following situation

	// state.hookRunning &&
	// state.context.id !== it.id
	// and we must not throw, because it BEFORE inside of BEFORE
	// or BEFORE after AFTER Re-Select context to state.trace[-1]
	// throw throw errors.ContextCorrupted('context split');
	// caused by implementation of async_hooks
	// but, for sure, it is not a problem
	// just bit overloaded, that's it
	// nothing to care of

	it.stage = 'before';

	state.runningHookId = asyncId;

	// here we have context
	// and able to apply it
	state.context.select(it.id);
	state.context.counters(it.id).before++;
};


/**
* standard async_hooks after callback
 * this function patches currentContext
 * @param {number} asyncId 
 */
const after = (asyncId) => {

	const it = state.asyncIdHooks[asyncId];

	if (!it) {
		if (state.hookRunning) {
			if (state.runningHookId === asyncId) {
				// Probably we've got uncaughtException!
				state.hookRunning = false;
			} else {
				// TODO: perf_hook failed throw errors.ContextCorrupted();
			}
		}
		return;
	}

	showDebugMark('AFTER', it);

	const traceId = state.trace.pop();

	it.ctxFail = !['before', 'resolve'].includes(it.stage);
	if (it.ctxFail) {
		throw errors.ContextCorrupted();
	}

	if (traceId !== asyncId) {
		throw errors.ContextCorrupted('after hook out of context');
	} else {
		if (!state.hookRunning) {
			throw errors.ContextCorrupted('after hook without context');
		} else if (state.context.id !== it.id) {
			throw errors.ContextCorrupted('after hook context split');
		}
	}

	it.stage = 'after';
	state.context.counters(it.id).after++;

	state.hookRunning = false;
	state.context.unset();

	if (state.trace.length) {
		const selectAsyncId = state.trace.slice(-1)[0];
		const selectIt = state.asyncIdHooks[selectAsyncId];
		if (!selectIt) {
			throw errors.NoContextAvail('unable to retrive');
		}
		state.context.select(selectIt.id);
		state.runningHookId = selectIt.id;
	}

};

/**
 * cleanup method when no tracking
 * of asyncId is necessary anymore
 * @param {number} asyncId 
 */
const destroy = (asyncId) => {

	if (state.hookRunning) {
		throw errors.ContextCorrupted();
	}

	// 1. rolling back hook running state
	// state.ctx = undefined;
	const it = state.asyncIdHooks[asyncId];
	if (!it) {
		return;
	}

	showDebugMark('DESTROY', it);

	if (state.trace.length) {
		// actually this scenario is bad
		// it can't be implemented at all
		const traceId = state.trace.pop();
		if (traceId !== it.id) {
			throw errors.ContextCorrupted('order failed');
		}
		state.context.unset();
	}

	it.stage = 'destroy';
	// Definetely delete!
	it.resource = undefined;
	delete it.resource;

	state.context.counters(it.id).destroy++;
};

/**
 * standard promise async_hook calback
 * @param {number} asyncId 
 */
const promiseResolve = (asyncId) => {
	// 1. search asyncId trace
	// 2. patch context ?
	const it = state.asyncIdHooks[asyncId];
	if (!it) {
		if (state.hookRunning) {
			throw errors.ContextCorrupted('promise');
		}
		return;
	}

	showDebugMark('RESOLVE', it);

	it.stage = 'resolve';
};

const callbacks = {
	init,
	before,
	after,
	destroy,
	promiseResolve
};

const asyncHook = async_hooks.createHook(callbacks);

const enable = () => {
	return asyncHook.enable();
};

const disable = () => {
	return asyncHook.disable();
};

module.exports = {

	// core itself
	async_hooks,
	asyncHook,

	// under the hood
	callbacks,

	// runtime IDs
	get eid() {
		return eid();
	},
	get tid() {
		return tid();
	},

	// on~off
	enable,
	disable,
	
	promisePointer

};

