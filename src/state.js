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

	trace: getNewArray,

	tickObjectsToCheck: getNewOject

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
	enumerable: true
});

Object.defineProperty(module.exports, 'cleanup', {
	get() {
		return cleanup;
	},
	enumerable: true
});

const context = require('./context');

Object.defineProperty(module.exports, 'context', {
	get() {
		return context;
	},
	enumerable: false
});


// var inspector, session;

// /**
//  * @param {object} nextTickHookResource pointer of async_hooks.init hook resource
//  * 
//  * all code is synchronous
//  * if it will fall to async mode, it will fail
//  * therefore it is Experimental!
//  * 
//  * many many thanks to Alexey Kozyatinskiy
//  * ak239 - Aleksei Koziatinskii <ak239spb@gmail.com>
//  */
// const tickCheckDiveInternalScope = (nextTickHookResource) => {
// 	var internalScope = {
// 		listenerWorks: false,
// 		scopeFound: false,
// 	};
// 	const listener = ({ params }) => {
// 		internalScope.listenerWorks = true;
// 		if (params.args && params.args[0] && params.args[0].type == 'function') {
// 			const objectId = params.args[0].objectId;
// 			session.post('Runtime.getProperties', {
// 				objectId,
// 				generatePreview: true
// 			}, (err, data) => {
// 				if (err) { return; }
// 				var scopes = null;
// 				data.internalProperties.forEach(it => {
// 					if (it.name === '[[Scopes]]' && it.value) {
// 						scopes = it.value;
// 					}
// 				});
// 				if (!scopes || !scopes.objectId) {
// 					return;
// 				}
// 				const objectId = scopes.objectId;
// 				session.post('Runtime.getProperties', {
// 					objectId,
// 					generatePreview: true
// 				}, (err, data) => {
// 					if (err) { return; }
// 					data.result.forEach((it) => {
// 						const objectId = it.value.objectId;
// 						if (it.value.description === 'Global') {
// 							return;
// 						}
// 						if (internalScope.scopeFound) {
// 							return;
// 						}
// 						session.post('Runtime.getProperties', { objectId }, (err, { result }) => {
// 							if (err) { return; }
// 							const it = result[0];
// 							if (!(it && it.name === 'dive') || !it.value || !it.value.description) {
// 								return;
// 							}
// 							if (it.value.description.indexOf('return diveFunctionWrapper') > 0) {
// 								internalScope.scopeFound = true;
// 							}
// 						});
// 					});
// 				});
// 			});
// 		}
// 	};
// 	session.once('Runtime.consoleAPICalled', listener);
// 	if (inspector.console) {
// 		inspector.console.log(nextTickHookResource.callback);
// 	} else {
// 		// twice to be sure!
// 		// eslint-disable-next-line no-console
// 		console.context('dive').log(nextTickHookResource.callback);
// 		// eslint-disable-next-line no-console
// 		console.context('dive').log(nextTickHookResource.callback);
// 	}
// 	return internalScope;
// };

// const version = process.versions.node.split('.')[0];
// var experimentalPredictionEnabled = false;

// Object.defineProperty(module.exports, '_experimentalPredictionEnabled', {
// 	get() {
// 		return !!experimentalPredictionEnabled;
// 	},
// 	enumerable: true
// });
// Object.defineProperty(module.exports, '_enableExperimentalPrediction', {
// 	get() {
// 		return () => {
// 			if (version < 10) {
// 				process._rawDebug(`

// 	For [ enableExperimentalPrediction ] usage
// 	node verion must be greater than 10

// 				`);
// 			}
// 			if (!context.hooksEnabled) {
// 				process._rawDebug(`

// 	For [ enableExperimentalPrediction ] usage
// 	you need to '.enableAsyncHooks()' at first

// 				`);
// 			}

// 			inspector = require('inspector');
// 			session = new inspector.Session();
// 			session.connect();
			
// 			// session.once('HeapProfiler.heapStatsUpdate', (statusUpdate) => {
// 			// 	process._rawDebug(statusUpdate);
// 			// });

// 			// session.once('Runtime.executionContextCreated', ({ params }) => {
// 			// 	process._rawDebug(params);
// 			// });
// 			// session.once('Runtime.bindingCalled', ({ params }) => {
// 			// 	process._rawDebug(params);
// 			// });

// 			session.post('Runtime.enable', () => { });

// 			Object.defineProperty(module.exports, 'tickCheckDiveInternalScope', {
// 				get() {
// 					return tickCheckDiveInternalScope;
// 				}
// 			});
// 			experimentalPredictionEnabled = true;
// 		};
// 	},
// 	enumerable: false
// });