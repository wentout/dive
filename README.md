# context-dive 

**Dive to async code with Context (v2)**

Using this module you are able to acheive the following functionality:

1. CLS/TLS : Continuation/Thread Local Storage ([wikipedia link](https://en.wikipedia.org/wiki/Thread-local_storage)).
2. Perfomance measuring, based on the top of **Dived Context** we are runningn in.
3. Meaningfull UncaughtException and UnhandledRejection extras, based on CLS.

... also there is plan to develop bit more rich functionality ...


So this module allows you to wrap some execution context context via **[async_hooks](https://nodejs.org/api/async_hooks.html)**. The main Idea is the wrapped **execution context** must be a function, cause otherwise we will be unable to handle everything through callbacks. Core concept is about that if we have some attributes of wrapped function as callbacks, so we will wrap them too, and therefore we will be able to track the context back through that callbacks too.


### Installation is Simple

```
npm i context-dive
```



## basic usage

the stuff you will get from pointer to dive wrapped function

```javascript
const dive = require('context-dive');

const fn = (cb) => {
	setTimeout ...
	nextTick...
	Promise
		cb
};

dive(fn, 'MyContext')(() => {
	// here we passed a lot of
	const LinkToContext = dive.ctx // MyContext
	// and you are able to fill it
	// through all that nested fn code and so far
});
```

So that anonymous function that reads `LinkToContext` as `dive.ctx` seems must have no way to read `'MyContext'` string pointer from nowhere except of dive storage closure. Moreover, you are able to use nested event, timers, nextTick and so on to handle running code graph untill the moment you will don't need it anymore.


## Promise Note
Unfortunately there is no way to dive CLS inside of UnhandledRejection, so untill this moment the API for that is bit tricky or flaky. However, if it works, at least it definetely Works (instead of 1.1.8). But, starting from Node 12 all that API is made only for `unhandledRejection`.

## v 2 CAVEATES (e.g. Warning) !

You can found much more data about it at [**Issue 249**](https://github.com/nodejs/diagnostics/issues/249)

As though Async Hooks cover almost all Asynchronous Functionality, **Still** all your code runs in a **! SYNCHRONOUS** route. This means there are black holes of code that can't be covered by hooks at all! So, I strictly warn you of getting high hopes on this technology. It doesn't mean it is broken in general. It means it mostly works perfect in all ways, but you need to get known how everything will blew up when you dig into black hole off synchronous code. So let's describe the folloing situation. You have Queue of Tasks: an **`Array`** for task (`functions`) and Task Runner -- a simple Interval, which runs tasks from that Array. So, then when inside of your synchronous **dive wrapped** code you'll `.push` a task in that array, there is no way to jump with dive.context inside of Task Runner, if this runner was build outside of the dive-wrapped context. Let me show you code example:

```javascript

const dive = require('context-dive');

const queueArray = [];

setInterval(() => {
	queueArray.forEach(task => {
		task();
	});
}, 1000);

const fn2wrap = () => {
	// Here we will have dive context
	console.log(' w  context : ', dive.ctx); // 'some context'
	// And now we create function
	// And push it to queue
	queueArray.push(() => {
		// that function will not be able to get any context
		console.log(' no context : ', dive.ctx); // undefined
	});
};

dive(fn2wrap, 'some context')();
```

Far to so, we can give you a solution, but, unfortunately it is not so easy as  just asking a context. It requires to wrap you functions, which will be called in in other function's context. For our example this will keep following changes:
```javascript
	// ...
	queueArray.push(dive.hopAutoWrap(() => {
		// ...
```



# API

## dive.currentContext || dive.ctx
Pointer to current context if execution thread is wrapped.


## dive.enableAsyncHooks()
You need to switch async hooks trace to wrap any async code.
You need to make this before you will make any wrapping.
This is a global change, all your wrapped contexts become async wrapped after. The way to switch this on for one context and do not switch for another is not yet implemented in the library. If you really need this -- make an Issue.
So, I'm using the following code to instantiate dive itself:

```javascript
const dive = require('context-dive');
dive.enableAsyncHooks()
```

## dive.disableAsyncHooks()
About to disable previously enabled async hooks thread wrappings.

## dive.emerge()
Stop tracing of `dive.currentContext` and rid of any pointers to it in memory. You need to run this code when you don't need current context anymore. **YOU NEED** to run this code when there are no meaning to track that context, overwise your memory will leak and everything become bad. Simple example is the following:

```javascript
const fn = () => {
	const ctx = dive.ctx;
	console.log(ctx); // 'simple test'
	dive.emerge(); // !!! EMERGE ITSELF
};

dive((cb) => {
	setTimeout(() => {
		cb();
	}, 1000);
}, 'simple test')(fn);
```

And when there are `uncaughtException` currentContext will be emerged automatically.

## dive.hopAutoWrap ( fn2wrap, wrapOnlyJumps )

`fn2wrap` -- function, which must be wrapped 4 context passthrough.
`
`wrapOnlyJumps` -- boolean. If you need to wrap only the callback for `fn2wrap`, but not the `fn2wrap` itself.

You can call `hopAutoWrap` from function which is already wrapped. And then when that wrapped function runs with context as in the from **Caveates** part above, there might be situation, when there are no context: obviously most of your code will not be covered with `dive(...)`. And if you just need to pass `dive.ctx` to callbacks -- you can use this `wrapOnlyJumps`. Moreover, if there will be no context when you use `.hopAutoWrap` -- it will fall to the same condition. And backwards, if you have context inside of running code, but don't need to wrap `fn2wrap`, and need it simply allows `dive.ctx` pass through it to it callbacks -- use `wrapOnlyJumps == true`.

I use this method with (mongoose.js)[https://mongoosejs.com/], and in the starter part of my App, I do the following with `dive.hopAutoWrap(...)` to make sure all my code will work as I expect.

```javascript
['find', 'findOne', 
	/* ... and others ... */,
'update', 'save'].forEach(methodName => {
	mongoose.Model[methodName] =
		dive.hopAutoWrap(
			mongoose.Model[methodName]
		);
});
```
So far it allows me to insist: when my code with context will dive to any wrapped mongoose method, it will not loose context for callback, when they will be called from the db. response polling queue. All this because there are that Caveate Queue situation inside of Mongoose, please read [Issue 249](https://github.com/nodejs/diagnostics/issues/249).


## dive.wrapEventEmitter && dive.unwrapEventEmitter
If your EventEmitters will pass functions as attributes and theese functinos have to be wrapped -- this might help.

## dive.uncaughtExceptionHandler
There is no way to handle `uncaughtException` without instantiating a listener to it. But you **MUST** make `dive.emerge()` on uncaught exception. If not, you app will fail from `unemerged` dive code. Please feel free to investigate you established listeners using this code:

```javascript
process.listeners('uncaughtException').forEach((listener) => {
	process._rawDebug(listener.toString());
});
```

So, if you did `process.on('uncaughtException', ...)` in your own code before, you will definetely need to add there the following part for emerging dive :

```javascript
process.on('uncaughtException', (error) => {
	
	/*
		your own code here
	*/
	
	// add this to last line of your
	// process.on('uncaughtException', ...)
	// it is sync, so, nothing to care of

	dive.uncaughtExceptionHandler();
	
});
```
So it will help dive emerge all necessary parts if there will be any exception in your code.

### dive.enableUncaughtExceptionListener

But if there were no `uncaughtException` listeners in your code at all, feel free to add dive own listener.

```javascript
dive.enableUncaughtExceptionListener();
```

However, be carefull, cause it will change the behaviour of your code: dive will prevent your process to exit if this listener is enabled, and there is no your own listeners. And suppose you need to make  your own listener initialisation instead. But, again, it is on you own way.

### dive.disableUncaughtExceptionListener
About to disable previously installed `dive.enableUncaughtExceptionListener`


## Promises
All the code you run inside of wrapped promises runs with currentContext. But `unhandledRejection` will not, cause it runs out of execution scope of async_hoos related wrappings. Promises are implemented on [ECMAScript 2015 Job Queue](https://www.ecma-international.org/ecma-262/6.0/#sec-jobs-and-job-queues). So them are bit ounside of Node, and inside of V8 core itself. And though they are wrapped with async_hooks too, there is no way to jump inside of unhandledRejection yet. But we have solution for it. I just desided to make a symbol sign in an every promise that runs out of my wrapped function. The implementation is hidden, I made helpers. Just pass promise there, and everything will work:

```javascript
process.once('unhandledRejection', (error, promise) => {
	const ctx = dive.getPromiseContext(promise);
	const duration = dive.getPromiseMeasure(promise);
	console.log(ctx, duration);
	dive.emerge();
});
```

# tests
And yes, now it have tests.
Simply run: 
```bash
$ npm test
```

# examples
the following npm command:
```bash
$ npm run examples
```

and the following direct execution
```bash
$ node example/simple
$ node example/promise
$ node example/hard
```

# duration
Next code allows you to count how much time your context is running:

```javascript
dive.measure();
```
It uses `perfomance.now()` so it is hight prescision timer based.


# v 1.1.8 Post Mortem note

Inspite that V 2 utilise the Core Concept of v 1.1.8, the way old version was made is odd. I rid of all that old code with complete new bundle. The API is about 50% the same, and concept is 100% the same. You can find old documentation [**here**](https://github.com/wentout/dive/wiki/v-1.1.8-documentation)
