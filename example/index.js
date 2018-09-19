'use strict';

const dive = require('../src/index').enableAsyncHooks();
// dive.enableFunctions();

const debugMode = false;

process.on('uncaughtException', (error) => {
	process._rawDebug('******************', dive.adjustErrorStack(error));
	process._rawDebug(dive.ctx);
	process._rawDebug(dive.state.runningHookId, dive.eid, dive.tid);
	process._rawDebug(dive.state.context.counters());
	if (dive.context.currentOpts.perfomanceOn) {
		dive.context.measure((error, duration) => {
			process._rawDebug('Error Duration: ', duration);
		});
	}
	process._rawDebug(require('util').inspect(process.memoryUsage()));
	// process.exit(1);
});

setTimeout(() => {
	dive;
	process._rawDebug(Object.keys(dive.state.asyncIdHooks).length);
	process._rawDebug('finished');
}, 3000);

const showMark = (/* mark */) => {
	// process._rawDebug(mark, dive.context.id, dive.ctx, dive.eid, dive.tid, dive.state.hookRunning, dive.state.runningHookId);
};

for (var i = 1; i < 2; i++) {
	((n) => {

		var fn = function (cb) {
			showMark('dive.ctx1');
			setTimeout(() => {
				showMark('dive.ctx2');
				if (['ctx_1_1', 'ctx_3_1'].includes(dive.ctx)) {
					showMark('dive.ctx3');
					setTimeout(() => {
						showMark('dive.ctx4');
						cb();
					}, 950);
				}
				setTimeout(() => {
					showMark('dive.ctx5');
					setTimeout(() => {
						showMark('dive.ctx6');
						setTimeout(() => {
							showMark('dive.ctx7');
							process._rawDebug('>>>>>>>>>>>>>>>>>>>>>>>>>', dive.ctx);
						}, 207);
					}, 101);
				}, 175);
			}, 1111);
		};

		dive(fn, `ctx_1_${n}`, { debugMode, onPerfomance : true })(() => {
			setTimeout(() => {
				showMark('dive.ctx_8_1');
				throw new Error('<<<<<<<<<<<<<<<<<<<<<<<< uncaught ctx_1_1');
			}, 299);
		});
		dive(fn, `ctx_3_${n}`, { debugMode })(() => {
			setTimeout(() => {
				showMark('dive.ctx_8_2');
				throw new Error('<<<<<<<<<<<<<<<<<<<<<<<< uncaught ctx_3_1');
			}, 99);
		});

		var zfn = function () {
			return (cb) => {
				setTimeout(() => {
					setTimeout(() => {
						setTimeout(() => {
							setTimeout(() => {
								cb();
							}, 999);
						}, 197);
					}, 98);
				}, 198);
			};
		};

		var zdfn = (data) => {
			setTimeout(() => {
				process._rawDebug(dive.ctx);
				process._rawDebug(require('util').inspect(data.keywords));
				const lastContext = dive.emerge();
				process._rawDebug('lastContext', lastContext);
			}, 189);
		};

		dive(zfn, `ctx_2_${n}`, {
			debugMode,
			// debugMode : true,
			onPerfomance (error, duration) {
				process._rawDebug(`Final Duration: ${duration}`);
			}
		})()(() => {
			setImmediate(() => {
				dive.context.measure((error, duration) => {
					process._rawDebug('Measured Duration: ', duration);
				});
				require('fs').readFile('./package.json', (err, data) => {
					process.nextTick(() => {
						zdfn(JSON.parse(data.toString()));
					});
				});
			});
		});

	})(i);

}
