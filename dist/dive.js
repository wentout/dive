'use strict';

const errors = require('./errors');
const state = require('./state');

const context = state.context;

/**
 * describes the situation
 * when we are patching nested callbacks
 * of our previous tracking function
 */
var patchingInProgress = false;

const optsDefaults = {
	skipCbArg: false,
	skipAnswer: false,
	debugMode: false,
	onPerfomance: undefined
};

const isDiveBindedFunctionPointer = Symbol('dive binded fnunction boolean sign');

// forever young, forever drunk
const bind = Function.prototype.bind;

// basic functionality
/**
 * syncronous function call carrator
 * with function arguments recursion
 * @param {function} fn what we are diving into
 * @param {string} value stuff to put to currentContext
 * @param {object} opts some possible options for diving:
 * @param {boolean} opts.skipCbArg
 *                   -- break patching of incoming cb functoins
 * @param {boolean} opts.skipAnswer
 *                   -- break patching of function, returned by fn itself
 * @param {boolean} opts.debugMode
 *                   -- run everything with verbose debugging
 */

// const v8 = require('v8');

const diveFunctionWrapper = function (fn, value, opts = optsDefaults) {

	opts = Object.assign({}, optsDefaults, opts);

	if (!patchingInProgress) {
		// get rid of dive while diving
		// cause we can't handle go deeper
		if (context.value && !state.baseRunning) {
			throw errors.ContextAlreadyExists();
		}

		if (state.hookRunning) {
			throw errors.ContextCorrupted();
		}
	}
	if (typeof fn !== 'function') {
		throw errors.NoStartupScope();
	}

	var contextId, contextValue;

	// Probably Patching is In Progress if values are equal!
	if (context.value === value) {
		if (patchingInProgress) {
			contextId = context.id;
			contextValue = context.value;
		} else {
			throw errors.ContextCorrupted('patching while running');
		}
	} else {
		if (context.values.has(value)) {
			throw errors.ContextAlreadyExists('same context is already started', value);
		}
		// ! creation itself
		contextId = context.create(value, fn, opts);
	}

	contextValue = context.select(contextId);

	const base = function (...args) {

		// cause we can emerge from previous base
		if (!context.hasId(contextId)) {
			return fn.call(this, ...args);
		}

		state.baseRunning = true;

		const prevContext = context.id;
		context.select(contextId);

		if (!context.basePassed) {
			context.basePassed = true;
		}

		if (!opts.skipCbArg) {
			patchingInProgress = true;
			// appying dive to all incoming functions;
			args = args.map(arg => {
				if (typeof arg == 'function') {
					arg = dive(arg, contextValue, opts);
				}
				return arg;
			});
			args.unshift(this);
			patchingInProgress = false;
		}

		const run = bind.call(fn, ...args);
		run[isDiveBindedFunctionPointer] = true;

		var answer;

		const self = context.self(contextId);
		const asyncResource = self.asyncResource;
		if (!asyncResource) {
			throw errors.ContextCorrupted('no context async resource');
		}
		if (typeof asyncResource.runInAsyncScope === 'function') {
			asyncResource.runInAsyncScope(() => {
				// const flag = 'trace_concurrent_recompilation';
				// v8.setFlagsFromString(`--${flag}`);
				answer = run();
				// v8.setFlagsFromString(`--no${flag}`);
			});
		} else {
			if (typeof asyncResource.emitBefore === 'function') {
				asyncResource.emitBefore();
			}
			answer = run();
			if (typeof asyncResource.emitAfter === 'function') {
				asyncResource.emitAfter();
			}
		}
		// asyncResource.emitDestroy();

		if (!opts.skipAnswer && typeof answer == 'function') {
			patchingInProgress = true;
			answer = dive(answer, contextValue, opts);
			patchingInProgress = false;
		}

		state.baseRunning = false;

		context.unset();
		context.select(prevContext);

		return answer;

	};

	Object.defineProperty(base, 'name', {
		value: `contextDiveBinded : ${fn.name}`
	});

	base[isDiveBindedFunctionPointer] = true;

	!patchingInProgress && context.unset();
	return base;

};

const dive = function (...args) {
	return diveFunctionWrapper.call(this, ...args);
};

dive.isDiveBindedFunctionPointer = isDiveBindedFunctionPointer;

/**
 * for currentContext:
 * stops all tracing
 * and remove context itself
 */
const emerge = (id = context.id) => {
	var lastContext;

	if (!context.hasId(id)) {
		return errors.NoContextAvail();
	}

	const counters = state.context.counters();
	const duration = context.measureById(id);

	lastContext = context.destroy(id);
	state.cleanup(id);

	return {
		duration,
		counters,
		lastContext
	};
};
const emergeAll = () => {
	return [...context.runningContextsIDs].reduce((allContexts, id) => {
		allContexts[`${id}`] = emerge(id);
		return allContexts;
	}, {});
};
Object.defineProperty(dive, 'emerge', {
	value: emerge
});

Object.defineProperty(dive, 'emergeAll', {
	value: emergeAll
});

dive.uncaughtExceptionHandler = () => {
	// in situation of uncaughtException
	// we will may not reach "after" hook
	if (state.hookRunning) {
		state.hookRunning = false;
	}
	
	// Let sync error code runs with context
	// we will destroy it immediately after
	if (context.id) {
		emerge(context.id);
	}
};

dive.enableUncaughtExceptionListener = () => {
	process.on('uncaughtException', dive.uncaughtExceptionHandler);
};
dive.disableUncaughtExceptionListener = () => {
	process.off('uncaughtException', dive.uncaughtExceptionHandler);
};

Object.defineProperty(dive, 'hopAutoWrap', {
	get() {
		return function (fn2wrap, jumpsOnly) {
			if (state.context.id && !jumpsOnly) {
				if (fn2wrap[isDiveBindedFunctionPointer]) {
					return fn2wrap;
				}
				patchingInProgress = true;
				fn2wrap = dive(fn2wrap, state.context.value, state.context.currentOpts);
				patchingInProgress = false;
				return fn2wrap;
			}
			return function (...args) {
				const contextId = state.context.id;
				if (contextId) {
					patchingInProgress = true;
					args = args.map(arg => {
						if (typeof arg === 'function' && !arg[isDiveBindedFunctionPointer]) {
							arg = dive(arg, state.context.value, state.context.currentOpts);
						}
						return arg;
					});
					patchingInProgress = false;
				}
				var answer = fn2wrap.call(this, ...args);
				if (typeof answer === 'function' && !answer[isDiveBindedFunctionPointer] && contextId) {
					patchingInProgress = true;
					answer = dive(answer, state.context.value, state.context.currentOpts);
					patchingInProgress = false;
				}
				return answer;
			};
		};
	}
});


const EventEmitter = require('events');
const realEmit = EventEmitter.prototype.emit;
Object.defineProperty(dive, 'wrapEventEmitter', {
	get() {
		return () => {
			EventEmitter.prototype.emit = function (...args) {
				if (!state.context.id) {
					return Reflect.apply(realEmit, this, args);
				}

				args = args.map(arg => {
					if (typeof arg == 'function') {
						if (arg[isDiveBindedFunctionPointer]) {
							return arg;
						}
						patchingInProgress = true;
						arg = dive(arg, state.context.value, state.context.currentOpts);
						patchingInProgress = false;
					}
					return arg;
				});

				let result = Reflect.apply(realEmit, this, args);
				if (typeof result == 'function' && !result[isDiveBindedFunctionPointer]) {
					patchingInProgress = true;
					result = dive(result, state.context.value, state.context.currentOpts);
					patchingInProgress = false;
				}

				return result;
			};
		};
	}
});
Object.defineProperty(dive, 'unwrapEventEmitter', {
	get() {
		return () => {
			EventEmitter.prototype.emit = realEmit;
		};
	}
});

module.exports = dive;

