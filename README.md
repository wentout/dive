# context-dive 

**Dive to async code with Context (v2)**

Using this module you are able to acheive the following functionality:

1. CLS/TLS : Continuation/Thread Local Storage ([wikipedia link](https://en.wikipedia.org/wiki/Thread-local_storage)).
2. Perfomance measuring, based on the top of **Dived Context** we are runningn in
3. Meaningfull UncaughtException and UnhandledRejection extras, based on CLS.

... also there is plan to develop bit more rich functionality ...


So this module allows you to wrap some execution context context via **[async_hooks](https://nodejs.org/api/async_hooks.html)**. The main Idea is the wrapped **execution context** must be a function, cause otherwise we will be unable to handle everything through callbacks. Core concept is about that if we have some attributes of wrapped function as callbacks, so we will wrap them too, and therefore we will be able to track the context back through that callbacks too.


### Installation is Simple

```
npm i context-dive
```



## basic usage

the stuff you will get from pointer to dive wrapped function

```JS
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
Unfortunately there is no way to dive CLS inside of UnhandledRejection, so untill this moment the API for that is bit tricky, however, at least it definetely Works (instead of 1.1.8).

## v 2 CAVEATES (e.g. Warning) !

As though Async Hooks cover almost all Asynchronous Functionality, **Still** all your code runs in a **! SYNCHRONOUS** route. This means there are black holes of code that can't be covered by hooks at all! So, I strictly warn you of getting high hopes on this technology. It doesn't mean it is broken in general. It means it mostly works perfect in all ways, but you need to get known how everything will blew up when you dig into black hole off synchronous code. So let's describe the folloing situation. You have Queue of Tasks: an **`Array`** for task (`functions`) and Task Runner -- a simple Interval, which runs tasks from that Array. So, then when inside of your synchronous **dive wrapped** code you'll `.push` a task in that array, there is no way to jump with dive.context inside of Task Runner, if this runner was build outside ov dive-wrapped context. Let me show you code example:

```JS

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
```JS
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
This is a global change, all your wrapped context will become async wrapped after, the way to switch this on for one context and do not switch for another is not yet implemented in this library. If you really need this -- make an Issue.
So, I'm using the following code to instantiate dive itself

```JS
const dive = require('context-dive');
dive.enableAsyncHooks()
```

## dive.disableAsyncHooks()
About to disable previously enabled async hooks thread wrappings.

## dive.emerge()
Stop tracing of `dive.currentContext` and rid of any pointers to it in memory. You need to run this code when you don't need current context anymore. **YOU NEED** to run this code when there are no meaning to track that context, overwise your memory will leak and everything become bad. Simple example is the following:

```JS
const fn = () => {
	const ctx = dive.ctx;
	console.log(ctx); // 'simple test'
	dive.emerge();
};

dive((cb) => {
	setTimeout(() => {
		cb();
	}, 1000);
}, 'simple test')(fn);
```

And when there are `uncaughtException` currentContext will be emerged automatically.

## .hopAutoWrap ( fn2wrap, wrapOnlyJumps )

`fn2wrap` -- function, which must be wrapped 4 context passthrough
`wrapOnlyJumps` -- boolean. This variable means the following:

You can call `hopAutoWrap` from function which is already wrapped and, then function you are wrapping will be wrapped, receiving the context (`dive.ctx`), of a function you are running now. This is an example from **Caveates** part above. But there may be situation, when there are no context: obviously most of your code will be not covered with `dive.ctx`. And if you just need to make that `dive.ctx` will pass through that function to callbacks -- you can use this `wrapOnlyJumps`. Moreover, if there will be no context when you use `.hopAutoWrap` -- it will fall to that situation. And backwards, if you have context inside of running code, but don't need to wrap `fn2wrap`, and need it simply allows `dive.ctx` pass through it to it callbacks -- use `wrapOnlyJumps == true`.
For example, I use (mongoose.js)[https://mongoosejs.com/], and in the starter part of my App, I do the following with `.hopAutoWrap` to make sure all my code will work as I expect.

```JS
['find', 'findOne', /* ... and others ... */, 'update', 'save']. forEach(methodName => {
	mongoose.Model[methodName] = dive.hopAutoWrap(mongoose.Model[methodName]);
});
```
So far it allows me to be sure: when my code with context will fall to that method, it will not loose context for callback that method will call on finish. All this because there are that Caveate Queue situation inside of Mongoose.


## Promises
All the code you run inside of wrapped promises runs with currentContext. But `unhandledRejection` will not, cause it runs out of execution scope of async_hoos related wrappings. Promises are implemented on [ECMAScript 2015 Job Queue](https://www.ecma-international.org/ecma-262/6.0/#sec-jobs-and-job-queues). So them are bit inside of V8 core itself. And though they are wrapped with async_hooks too, there is no way to jump inside of unhandledRejection yet. But we have solution for it. I just desided to make a symbol sign in an every promise that runs out of my wrapped function. The implementation is hidden, I made helpers. Just pass promise there, and everything will work:

```JS
process.once('unhandledRejection', (error, promise) => {
	const ctx = dive.getPromiseContext(promise);
	const duration = dive.getPromiseMeasure(promise);
	console.log(ctx, duration);
	dive.emerge();
});
```

# tests
And yes, now it have tests.
Simply run: `npm test`

# examples
the following npm command:
`npm run examples`

and the following direct execution
```
node example/simple
node example/promise
node example/hard
```

# duration
Next code allows you to count how much time your context is running:

```JS
dive.measure()
```
It uses `perfomance.now()` so it is hight prescision timer based.


# v 1.1.8 Post Mortem note

Inspite that V 2 utilise the Core Concept of v 1.1.8, the way old version was made is odd. I rid of all that old code with complete new bundle. The API is about 50% the same, and concept is 100% the same. You can find old documentation [**here**](https://github.com/wentout/dive/wiki/v-1.1.8-documentation)
