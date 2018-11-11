'use strict';

process._rawDebug('\n\n\n SIMPLE EXAMPLE STARTED \n\n\n');

const dive = require('..');
// comment this on and off to understand the idia
const runHooks = process.argv[2] ? process.argv[2].trim() : true;
if (runHooks !== 'false') {
	dive.enableAsyncHooks();
}


process.on('uncaughtException', (error) => {
	process._rawDebug(`\n\nAnd uncaught exception too ->>> : ${dive.ctx} \n\n`);
	process._rawDebug('******************', dive.adjustErrorStack(error));
	process._rawDebug(`
	YOU CAN run this example passing false,
	then hooks will be disabled,
	to see the difference:
	
	$ node ./example/simple.js false
	`);
});


const padNum = 25;

dive(() => {
	process._rawDebug('1. started : '.padEnd(padNum), dive.ctx);
	setTimeout(() => {
		process._rawDebug('2. setTimeout passed : '.padEnd(padNum), dive.ctx);
		setImmediate(() => {
			process._rawDebug('3. setImmediate passed : '.padEnd(padNum), dive.ctx);
			process.nextTick(() => {
				process._rawDebug('4. nextTick passed : '.padEnd(padNum), dive.ctx);
				throw new Error('Test uncaughtException error');
			});
		});
	}, 100);
}, 'Context For Simple Test')();