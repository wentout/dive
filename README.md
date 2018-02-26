# dive
dive to callback with context


**example^**

```
const d = (cb) => {
	return (t, y) => {
		console.log(t, y);
		setTimeout(() => {
			cb('asdf', 'fdsa');
		}, 100);
	};
};

const z = (cb) => {
	console.log('_currentContext', global._currentContext);
	setTimeout(() => {
		cb('zxcv', 'vcxz');
	}, 1000);
};

const m = dive.call(d, 'qwer')(function (a, b) {
	console.log(_currentContext, a, b);
});

const s = dive.call(z, 'lkjh');

s(m);

```



will output



```
_currentContext lkjh
zxcv vcxz
qwer asdf fdsa
```
