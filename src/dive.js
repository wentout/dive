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

// basic functionality
/**
 * syncronous function call carrator
 * with function arguments recursion
 * @param {function} fn what we are diving into
 * @param {function} if this is a function, then it is fn
 * @param {string} value stuff to put to currentContext
 * @param {object} opts some possible options for diving:
 * @param {boolean} opts.skipCbArg
 *                   -- break patching of incoming cb functoins
 * @param {boolean} opts.skipAnswer
 *                   -- break patching of function, returned by fn itself
 * @param {boolean} opts.debugMode
 *                   -- run everything with verbose debugging
 * @param {array} _args other arguments for wrapped function call
 */

const dive = function (fn, value, opts = optsDefaults) {

	opts = Object.assign({}, optsDefaults, opts);

	// get rid of dive while diving
	// cause we can't handle go deeper
	if (context.value && !state.baseRunning) {
		throw errors.ContextAlreadyExists();
	}

	if (state.hookRunning) {
		throw errors.ContextCorrupted();
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
			throw errors.ContextAlreadyExists('same context is already started');
		}
		// ! creation itself
		contextId = context.create(value, fn, opts);
	}

	contextValue = context.select(contextId);

	const base = function (...args) {

		if (!context.basePassed) {
			context.basePassed = true;
		}

		state.baseRunning = true;

		const prevContext = context.id;
		context.select(contextId);

		if (!opts.skipCbArg) {
			patchingInProgress = true;
			// appying dive to all incoming functions;
			args = args.map(arg => {
				if (typeof arg == 'function') {
					arg = dive(arg, contextValue, opts);
				}
				return arg;
			});
			patchingInProgress = false;
		}

		const run = fn.bind(this, ...args);
		var answer = run();
		
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

	!patchingInProgress && context.unset();
	return base;

};

// /**
//  * enable Function.prototype.dive patch
//  */
// dive.enableFunctions = () => {
// 	if (Function.prototype.dive) {
// 		return;
// 	}
// 	Function.prototype.dive = dive;
// };

// /**
//  * disable Function.prototype.dive patch
//  */
// dive.disableFunctions = () => {
// 	delete Function.prototype.dive;
// };


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
	
	lastContext = context.destroy(id);
	state.cleanup(id);
	
	const counters = state.context.counters();
	const duration = context.measureById(id);
	
	return {
		duration,
		counters,
		lastContext
	};
};

dive.emerge = emerge;
dive.uncaughtExceptionListener = () => {
	// Let sync error code runs with context
	// we will destroy it immediately after
	if (!state.hookRunning) {
		return;
	}
	// in situation of uncaughtException
	// we will never reach "after" hook
	const emergeId = context.id;
	process.nextTick(() => {
		emerge(emergeId);
		state.hookRunning = false;
	});
};

process.on('uncaughtException', dive.uncaughtExceptionListener);

module.exports = dive;

