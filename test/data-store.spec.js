const expect = require('unexpected');
const DataStore = require('../src/data-store.js');

const data = {
    foo: 'bar',
    baz: {
        a: {x: 1, y: 2, z: 3},
        b: {x: 5, y: 6, z: 7}
    }
};

const backend = (() => {
    const store = {};
    return {
        load: id => store[id] || {},
        save: (id, data) => store[id] = data,
        store
    };
})();

backend.save('data', data);

describe('DataStore', function() {
    describe('constructor()', function() {
        it('pre-loads data from object', function() {
            const store = new DataStore('data', data);
            expect(store.data, 'to equal', {foo: 'bar', baz: {a: {x: 1, y: 2, z: 3}, b: {x: 5, y: 6, z: 7}}});
        });

        it('loads data from backend', function() {
            const store = new DataStore('data', null, {backend: backend});
            expect(store.data, 'to equal', {foo: 'bar', baz: {a: {x: 1, y: 2, z: 3}, b: {x: 5, y: 6, z: 7}}});
        });
    });

    describe('[for..of]', function() {
        const store = new DataStore('data', data);
        let values;

        beforeEach('reset values array', function() {
            values = [];
        });

        it('iterates over all original values', function() {
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', ['bar', {a: {x: 1, y: 2, z: 3}, b: {x: 5, y: 6, z: 7}}]);
        });

        it('does not iterate over deleted values', function() {
            store.unset('baz');
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', ['bar']);
        });

        it('iterates over new values', function() {
            store.set('abc', 'xyz')
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', ['bar', 'xyz']);
        });
    });

    describe('keys()', function() {
        const store = new DataStore('data', data);

        it('returns all original keys', function() {
            expect(store.keys(), 'to equal', ['foo', 'baz']);
        });

        it('returns all but the deleted keys', function() {
            store.unset('baz');
            expect(store.keys(), 'to equal', ['foo']);
        });

        it('returns all new keys', function() {
            store.set('abc', 'xyz');
            expect(store.keys(), 'to equal', ['foo', 'abc']);
        });
    });

    describe('get()', function() {
        const store = new DataStore('data', data);

        it('returns original values', function() {
            expect(store.get('foo'), 'to equal', 'bar');
        });

        it('does not return deleted values', function() {
            store.unset('foo');
            expect(store.get('foo'), 'to equal', undefined);
        });

        it('does not return non-existing values', function() {
            expect(store.get('abc'), 'to equal', undefined);
        });

        it('returns new values', function() {
            store.set('abc', 'xyz')
            expect(store.get('abc'), 'to equal', 'xyz');
        });

        it('does not return deleted new values', function() {
            store.unset('abc')
            expect(store.get('abc'), 'to equal', undefined);
        });

        it('returns overwritten values', function() {
            store.set('baz', 'qwe')
            expect(store.get('baz'), 'to equal', 'qwe');
        });
    });

    describe('has()', function() {
        const store = new DataStore('data', data);

        it('finds original keys', function() {
            expect(store.has('foo'), 'to equal', true);
        });

        it('does not find deleted keys', function() {
            store.unset('foo');
            expect(store.has('foo'), 'to equal', false);
        });

        it('does not find non-existing keys', function() {
            expect(store.has('abc'), 'to equal', false);
        });

        it('finds new values', function() {
            store.set('abc', 'xyz')
            expect(store.has('abc'), 'to equal', true);
        });

        it('does not find deleted new values', function() {
            store.unset('abc')
            expect(store.has('abc'), 'to equal', false);
        });

        it('finds overwritten values', function() {
            store.set('baz', 'qwe')
            expect(store.has('baz'), 'to equal', true);
        });
    });

    describe('set()', function() {
        const store = new DataStore('data', data);

        it('creates new keys', function() {
            store.set('abc', 'qwe');
            expect(store.get('abc'), 'to equal', 'qwe');
        });

        it('overwrites existing keys', function() {
            store.set('foo', 123);
            expect(store.get('foo'), 'to equal', 123);
        });
    });

    describe('unset()', function() {
        const store = new DataStore('data', data);

        it('unsets existing keys', function() {
            store.unset('foo');
            expect(store.get('foo'), 'to equal', undefined);
            expect(store.has('foo'), 'to equal', false);
        });

        it('unsets new keys', function() {
            store.set('abc', 'qwe');
            store.unset('abc');
            expect(store.get('foo'), 'to equal', undefined);
            expect(store.has('foo'), 'to equal', false);
        });
    });

    describe('reset()', function() {
        const store = new DataStore('data', data);

        it('does not modify original data', function() {
            store.reset();
            expect(store.get('foo'), 'to equal', 'bar');
        });

        it('undeletes deleted keys', function() {
            store.unset('foo');
            store.reset();
            expect(store.get('foo'), 'to equal', 'bar');
            expect(store.has('foo'), 'to equal', true);
        });

        it('restores overwritten keys', function() {
            store.set('foo', 'notbar');
            store.reset();
            expect(store.get('foo'), 'to equal', 'bar');
        });

        it('removes new keys', function() {
            store.set('new', 'value');
            store.reset();
            expect(store.get('new'), 'to equal', undefined);
            expect(store.has('new'), 'to equal', false);
        });

    });

    describe('commit()', function() {
        const store = new DataStore('data2', {a: 1, b: 2}, {backend: backend});

        it('saves data to the backend', function() {
            store.commit();
            expect(backend.store.data2, 'to equal', {a: 1, b: 2});
        });

        it('saves changes to the backend', function() {
            store.unset('a');
            store.set('b', 1);
            store.set('c', 2);
            store.commit();
            expect(backend.store.data2, 'to equal', {b: 1, c: 2});
        });

        it('persist changes after reset()', function() {
            store.reset();
            expect(store.get('a'), 'to equal', undefined);
            expect(store.has('a'), 'to equal', false);
            expect(store.get('b'), 'to equal', 1);
            expect(store.get('c'), 'to equal', 2);
            expect(store.has('c'), 'to equal', true);            
        });

        it('allows changes to be loaded again', function() {
            const store2 = new DataStore('data2', undefined, {backend: backend});
            expect(store2.get('a'), 'to equal', undefined);
            expect(store2.has('a'), 'to equal', false);
            expect(store2.get('b'), 'to equal', 1);
            expect(store2.get('c'), 'to equal', 2);
            expect(store2.has('c'), 'to equal', true);      
        });
    });

    describe('ns()', function() {
        const store = new DataStore('data', data, {backend: backend});
        const storeBaz = store.ns('baz');
        const storeBazA = storeBaz.ns('a');
        const storeBazB = storeBaz.ns('b');

        it('creates a namespace that can access data within a key of its parent', function() {
            expect(storeBaz.get('a'), 'to equal', {x: 1, y: 2, z: 3});
        });

        it('can access data through nested namespaces', function() {
            expect(storeBazA.get('x'), 'to equal', 1);
        });

        it('shares data changes between the namespace tree', function() {
            storeBazA.set('x', 1000);
            expect(storeBaz.get('a').x, 'to equal', 1000);

            storeBazA.set('x', 'value');
            expect(storeBaz.get('a').x, 'to equal', 'value');

            storeBazA.set('xx', 'value');
            expect(storeBaz.get('a').xx, 'to equal', 'value');

            storeBazA.unset('xx');
            expect(storeBaz.get('a').xx, 'to equal', undefined);
        });

        it('shares data changes with new namespaces', function() {
            const storeBazA2 = storeBaz.ns('a');
            expect(storeBazA2.get('x'), 'to equal', 'value');

            storeBazA.set('x', 1000);
            expect(storeBazA2.get('x'), 'to equal', 1000);

            storeBazA.set('xx', 'value');
            expect(storeBazA2.get('xx'), 'to equal', 'value');
            expect(storeBazA2.has('xx'), 'to equal', true);
            
            storeBazA.unset('xx');
            expect(storeBazA2.get('xx'), 'to equal', undefined);
            expect(storeBazA2.has('xx'), 'to equal', false);
        });

        it('properly exposes underlying keys', function() {
            expect(storeBaz.keys(), 'to equal', ['a', 'b']);

            storeBaz.set('c', 'value');
            expect(storeBaz.keys(), 'to equal', ['a', 'b', 'c']);

            storeBaz.unset('a');
            expect(storeBaz.keys(), 'to equal', ['b', 'c']);
        });

        it('contains resetting the data and propagates it to other namespaces', function() {
            store.set('foo', 'notbar');
            storeBaz.reset();
            expect(store.get('foo'), 'to equal', 'notbar');
            expect(store.get('baz'), 'to equal', {a: {x: 1, y: 2, z: 3}, b: {x: 5, y: 6, z: 7}});
            expect(storeBaz.get('a'), 'to equal', {x: 1, y: 2, z: 3});
            expect(storeBazA.get('x'), 'to equal', 1);
        });

        it('contains saving the data to the current namespace', function() {
            storeBaz.set('a', 'different');
            storeBazB.set('w', 1);
            storeBazB.set('x', 2);
            storeBazB.unset('z');
            storeBazB.commit();    
            expect(storeBaz.get('a'), 'to equal', 'different');
            expect(backend.store.data.baz, 'to equal', {a: {x: 1, y: 2, z: 3}, b: {w: 1, x: 2, y: 6}});
        });
    });

    describe('pointer', function() {
        const store = new DataStore('data', data);
        const storeBaz = store.ns('baz');
        const storeBazA = storeBaz.ns('a');

        const dataProxy = store.getData();
        const dataProxyBazA = storeBazA.getData();

        it('proxies data changes to the DataStore', function() {
            dataProxyBazA.v = 'value 1';
            storeBazA.set('w', 'value 2');
            delete dataProxyBazA.y;
            storeBazA.unset('z');

            expect(dataProxyBazA.x, 'to equal', 1);
            expect(storeBazA.get('v'), 'to equal', 'value 1');
            expect(storeBazA.has('v'), 'to equal', true);
            expect(dataProxyBazA.w, 'to equal', 'value 2');
            expect(storeBazA.get('y'), 'to equal', undefined);
            expect(storeBazA.has('y'), 'to equal', false);
            expect(dataProxyBazA.z, 'to equal', undefined);
        });

        it('proxies data through nested namespaces', function() {
            expect(dataProxy.baz.a.x, 'to equal', 1);

            dataProxy.baz.a.u = 'value 3';
            dataProxy.baz.a.x = 'value 4';
            expect(storeBazA.get('u'), 'to equal', 'value 3');
            expect(storeBazA.has('u'), 'to equal', true);
            expect(storeBazA.get('x'), 'to equal', 'value 4');

            delete dataProxy.baz.a.x;
            expect(storeBazA.get('x'), 'to equal', undefined);
            expect(storeBazA.has('x'), 'to equal', false);
        });

        it('proxies underlying keys', function() {
            expect(Object.keys(dataProxyBazA), 'to equal', ['v', 'w', 'u']);
        });
    });
});
