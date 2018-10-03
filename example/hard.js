'use strict';

process._rawDebug('\n\n\n HARD EXAMPLE STARTED \n\n\n');

const util = require('util');
const dive = require('../src/index').enableAsyncHooks();
// dive.enableFunctions();

const debugMode = false;

process.on('uncaughtException', (error) => {
	process._rawDebug('******************', dive.adjustErrorStack(error));
	process._rawDebug(dive.ctx);
	process._rawDebug(dive.state.runningHookId, dive.eid, dive.tid);
	process._rawDebug(dive.state.context.counters());
	process._rawDebug('Error Duration: ', dive.context.measure);
	process._rawDebug(util.inspect(process.memoryUsage()));
	// process.exit(1);
});

setTimeout(() => {
	dive;
	process._rawDebug(Object.keys(dive.state.asyncIdHooks).length);
	process._rawDebug('finished');
}, 10000);

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
		setTimeout(() => {
			dive(fn, `ctx_1_${n}`, { debugMode, onPerfomance: true })(() => {
				setTimeout(() => {
					showMark('dive.ctx_8_1');
					throw new Error('<<<<<<<<<<<<<<<<<<<<<<<< uncaught ctx_1_1');
				}, 299);
			});
		}, 5000);
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
				// const lastContext = dive.emerge();
				const emergeData = dive.emerge();
				process._rawDebug('>>> Emerge Trace :\n');
				Object.entries(emergeData).forEach(entry => {
					const [name, value] = entry;
					process._rawDebug(`* --- ${name.padEnd(11)} : ${util.inspect(value)}`);
				});
				process._rawDebug('\n');
			}, 189);
		};

		dive(zfn, `ctx_2_${n}`, {
			debugMode,
			// debugMode : true,
		})()(() => {
			setImmediate(() => {
				process._rawDebug('Measured Duration: ', dive.measure());
				require('fs').readFile('./package.json', (err, data) => {
					process.nextTick(() => {
						zdfn(JSON.parse(data.toString()));
					});
				});
			});
		});

	})(i);

}
