# context-dive 2

**Dive to async code with Context**

Using this module you are able to acheive the following functionality:

1. CLS/TLS : Continuation/Thread Local Storage ([wikipedia link](https://en.wikipedia.org/wiki/Thread-local_storage)).
2. Perfomance measuring, based on the top of **Dived Context** we are runningn in
3. Meaningfull UncaughtException and UnhandledRejection extras, based on CLS.

... also there is plan to develop bit more rich functionality ...

## v 1.1.8 Post Mortem note

Inspite that V 2 utilise the Core Concept of v 1.1.8, the way old version was made is odd. I rid of all that old code with complete new bundle. The API is about 50% the same, and concept is 100% the same. You can find old documentation [**here**](https://github.com/wentout/dive/wiki/v-1.1.8-documentation)


## v 2 Documentation 

This module allows you to wrap some execution context context via **[async_hooks](https://nodejs.org/api/async_hooks.html)**. The main Idea is the wrapped **execution context** must be a function, cause otherwise we will be unable to handle everything through callbacks. Core concept is about that if we have some attributes of wrapped function as callbacks, so we will wrap them too, and therefore we will be able to track the context back through that callbacks too.


### Installation is Simple

```
npm i context-dive
```

### Promise Note
Unfortunately there is no way to dive CLS inside of UnhandledRejection, so untill this moment the API for that is bit tricky, however, at least it definetely Works (instead of 1.1.8).


# API

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

## dive.currentContext || dive.ctx
Pointer to current context if execution thread is wrapped.


## dive.enableAsyncHooks()
You need to switch async hooks trace to wrap any async code.
You need to make this before you will make any wrapping.
This is a global change, all your wrapped context will become async wrapped after, the way to switch this on for one context and do not switch for another is not yet implemented in this library. If you really need this -- make an Issue.
So, I'm using the following code to instantiate dive itself

```
const dive = require('context-dive');
dive.enableAsyncHooks()
```

## dive.disableAsyncHooks()
About to disable previously enabled async hooks trhead wrappings.

## dive.emerge()
Stop tracing of `dive.currentContext` and rid of any pointers to it in memory. You need to run this code when you don't need current context anymore. **YOU NEED** to run this code when there are no meaning to track that context, overwise your memory will leak and everything become bad. Simple example is the following:

```
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


## Promises
All the code you run inside of promises runs with currentContext. But `unhandledRejection` will not. But there are solution for it. I just desided to make a symbol sign in an every promise:

```
process.once('unhandledRejection', (error, promise) => {
	const currentContextId = promise[dive.promisePointer];
	const ctx = dive.valueById(id);
	console.log(ctx);
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

```
dive.measure()
```
It uses `perfomance.now()` so it is hight prescision timer based.

