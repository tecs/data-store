const expect = require('unexpected');
const DataStore = require('../src/data-store.js');

const dataFactory = () => ({
    foo: 'bar',
    baz: {
        a: {x: 1, y: 2, z: 3},
        b: {x: 5, y: 6, z: 7}
    }
});

const backendFactory = () => {
    const store = {};
    const deepCopy = function deepCopy(obj) {
        const newObj = obj instanceof Array ? [] : {};
        for (const key in obj) {
            newObj[key] = obj[key] instanceof Object ? deepCopy(obj[key]) : obj[key];
        }
        return newObj;
    };
    return {
        load: id => deepCopy(store[id]),
        save: (id, data) => store[id] = deepCopy(data),
        store
    };
};

describe('DataStore', function() {
    let backend,
        store, storeBaz, storeBazA, storeBazB,
        dataProxy, dataProxyBaz, dataProxyBazA, dataProxyBazB;

    beforeEach('creates a fresh backend and data', function() {
        backend = backendFactory();
        backend.save('data', dataFactory());

        store = new DataStore('data', null, {backend});
        storeBaz = store.ns('baz');
        storeBazA = storeBaz.ns('a');
        storeBazB = storeBaz.ns('b');
        dataProxy = store.getData();
        dataProxyBaz = storeBaz.getData();
        dataProxyBazA = storeBazA.getData();
        dataProxyBazB = storeBazB.getData();
    });

    describe('constructor()', function() {
        it('pre-loads data from object', function() {
            const store = new DataStore('data', dataFactory());
            expect(store.data, 'to equal', dataFactory());
        });

        it('loads data from backend', function() {
            expect(store.data, 'to equal', dataFactory());
        });
    });

    describe('[for..of]', function() {
        let values;

        beforeEach('reset values array', function() {
            values = [];
        });

        it('iterates over all original values', function() {
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', [dataFactory().foo, dataFactory().baz]);
        });

        it('does not iterate over deleted values', function() {
            store.unset('baz');
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', [dataFactory().foo]);
        });

        it('iterates over new values', function() {
            store.set('abc', 'xyz');
            for (const value of store) {
                values.push(value);
            }
            expect(values, 'to equal', [dataFactory().foo, dataFactory().baz, 'xyz']);
        });
    });

    describe('keys()', function() {
        it('returns all original keys', function() {
            expect(store.keys(), 'to equal', ['foo', 'baz']);
        });

        it('returns all but the deleted keys', function() {
            store.unset('baz');
            expect(store.keys(), 'to equal', ['foo']);
        });

        it('returns all new keys', function() {
            store.set('abc', 'xyz');
            expect(store.keys(), 'to equal', ['foo', 'baz', 'abc']);
        });
    });

    describe('get()', function() {
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
            store.set('abc', 'xyz');
            expect(store.get('abc'), 'to equal', 'xyz');
        });

        it('does not return deleted new values', function() {
            store.unset('abc');
            expect(store.get('abc'), 'to equal', undefined);
        });

        it('returns overwritten values', function() {
            store.set('baz', 'qwe');
            expect(store.get('baz'), 'to equal', 'qwe');
        });
    });

    describe('has()', function() {
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
            store.set('abc', 'xyz');
            expect(store.has('abc'), 'to equal', true);
        });

        it('does not find deleted new values', function() {
            store.unset('abc');
            expect(store.has('abc'), 'to equal', false);
        });

        it('finds overwritten values', function() {
            store.set('baz', 'qwe');
            expect(store.has('baz'), 'to equal', true);
        });
    });

    describe('set()', function() {
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
        it('unsets existing keys', function() {
            store.unset('foo');
            expect(store.get('foo'), 'to equal', undefined);
            expect(store.has('foo'), 'to equal', false);
        });

        it('unsets new keys', function() {
            store.set('abc', 'qwe');
            store.unset('abc');
            expect(store.get('abc'), 'to equal', undefined);
            expect(store.has('abc'), 'to equal', false);
        });
    });

    describe('reset()', function() {
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
        it('saves data to the backend', function() {
            const store = new DataStore('data2', dataFactory(), {backend});
            store.commit();
            expect(backend.store.data2, 'to equal', dataFactory());
        });

        it('saves changes to the backend', function() {
            store.unset('baz');
            store.set('foo', 'asd');
            store.set('qux', 'qwe');
            store.commit();
            expect(backend.store.data, 'to equal', {foo: 'asd', qux: 'qwe'});
        });

        it('persist changes after reset()', function() {
            store.unset('baz');
            store.set('foo', 'asd');
            store.set('qux', 'qwe');
            store.commit();
            expect(store.get('baz'), 'to equal', undefined);
            expect(store.has('baz'), 'to equal', false);
            expect(store.get('foo'), 'to equal', 'asd');
            expect(store.get('qux'), 'to equal', 'qwe');
            expect(store.has('qux'), 'to equal', true);
        });

        it('allows changes to be loaded again', function() {
            store.unset('baz');
            store.set('foo', 'asd');
            store.set('qux', 'qwe');
            store.commit();

            const store2 = new DataStore('data', null, {backend});
            expect(store2.get('baz'), 'to equal', undefined);
            expect(store2.has('baz'), 'to equal', false);
            expect(store2.get('foo'), 'to equal', 'asd');
            expect(store2.get('qux'), 'to equal', 'qwe');
            expect(store2.has('qux'), 'to equal', true);
        });

        it('does not save changes to the backend if the "save" flag has been set to "false"', function() {
            store.unset('baz');
            store.set('foo', 'asd');
            store.set('qux', 'qwe');
            store.commit(false);
            expect(store.get('baz'), 'to equal', undefined);
            expect(store.has('baz'), 'to equal', false);
            expect(store.get('foo'), 'to equal', 'asd');
            expect(store.get('qux'), 'to equal', 'qwe');
            expect(store.has('qux'), 'to equal', true);

            const store2 = new DataStore('data', null, {backend});
            expect(store2.get('baz'), 'to equal', dataFactory().baz);
            expect(store2.has('baz'), 'to equal', true);
            expect(store2.get('foo'), 'to equal', 'bar');
            expect(store2.get('qux'), 'to equal', undefined);
            expect(store2.has('qux'), 'to equal', false);
        });

        it('persists changes in the instance after reset() if the "save" flag has been set to "false"', function() {
            store.unset('baz');
            store.set('foo', 'asd');
            store.set('qux', 'qwe');
            store.commit(false);
            store.reset();
            expect(store.get('baz'), 'to equal', undefined);
            expect(store.has('baz'), 'to equal', false);
            expect(store.get('foo'), 'to equal', 'asd');
            expect(store.get('qux'), 'to equal', 'qwe');
            expect(store.has('qux'), 'to equal', true);
        });
    });

    describe('ns()', function() {
        it('creates a namespace that can access data within a key of its parent', function() {
            expect(storeBaz.get('a'), 'to equal', dataFactory().baz.a);
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
            expect(storeBazA2.get('x'), 'to equal', 1);

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
            expect(store.get('baz'), 'to equal', dataFactory().baz);
            expect(storeBaz.get('a'), 'to equal', dataFactory().baz.a);
            expect(storeBazA.get('x'), 'to equal', 1);
        });

        it('contains saving the data to the current namespace', function() {
            storeBaz.set('a', 'different');
            storeBazB.set('w', 1);
            storeBazB.set('x', 2);
            storeBazB.unset('z');
            storeBazB.commit();
            expect(storeBaz.get('a'), 'to equal', 'different');
            expect(backend.store.data.baz, 'to equal', {a: dataFactory().baz.a, b: {w: 1, x: 2, y: 6}});
        });
    });

    describe('pointer', function() {
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

            dataProxy.baz.a.u = 'value 1';
            dataProxy.baz.a.x = 'value 2';
            expect(storeBazA.get('u'), 'to equal', 'value 1');
            expect(storeBazA.has('u'), 'to equal', true);
            expect(storeBazA.get('x'), 'to equal', 'value 2');

            delete dataProxy.baz.a.x;
            expect(storeBazA.get('x'), 'to equal', undefined);
            expect(storeBazA.has('x'), 'to equal', false);
        });

        it('proxies underlying keys', function() {
            dataProxyBazA.v = 'value 1';
            dataProxy.baz.a.u = 'value 2';
            delete dataProxyBazA.y;
            delete dataProxy.baz.a.x;
            storeBazA.set('w', 'value 2');
            storeBazA.unset('z');
            expect(Object.keys(dataProxyBazA), 'to equal', ['v', 'u', 'w']);
        });
    });

    describe('changed()', function() {
        it('does not find changes in unchanged stores', function() {
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes when creating new keys', function() {
            store.set('abc', 'qwe');
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when deleting all new keys', function() {
            store.set('abc', 'qwe');
            store.unset('abc');
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes when changing existing keys', function() {
            store.set('foo', 'qwe');
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when reverting existing key changes', function() {
            store.set('foo', 'qwe');
            store.set('foo', 'bar');
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes when deleting existing keys', function() {
            store.unset('foo');
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when re-setting deleted keys', function() {
            store.set('foo', 'bar');
            expect(store.changed(), 'to equal', false);
        });

        it('does not find changes when the data store is reset', function() {
            store.unset('foo');
            store.set('abc', 'qwe');
            store.set('bar', 'asd');
            expect(store.changed(), 'to equal', true);
            store.reset();
            expect(store.changed(), 'to equal', false);
        });

        it('does not find changes when the data store is committed', function() {
            const store = new DataStore('data3', {a: 1, b: 2}, {backend: backend});
            store.unset('foo');
            store.set('abc', 'qwe');
            store.set('bar', 'asd');
            expect(store.changed(), 'to equal', true);
            store.commit();
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes in child namespaces', function() {
            store.ns('baz').ns('a').set('x', 1000);
            expect(store.changed(), 'to equal', true);
            expect(store.ns('baz').changed(), 'to equal', true);
            expect(store.ns('baz').ns('a').changed(), 'to equal', true);
        });

        it('does not find changes from unchanged namespaces', function() {
            expect(store.ns('foo').changed(), 'to equal', false);
        });

        it('does not find changes in parent namespace', function() {
            store.set('xyz', 'qwe');
            expect(store.ns('baz').ns('b').changed(), 'to equal', false);
        });

        it('does not find changes in child namespaces after reset()', function() {
            store.reset();
            expect(store.ns('baz').ns('a').changed(), 'to equal', false);
        });

        it('finds changes when creating new keys via pointers', function() {
            store.getData().abc = 'changed';
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when deleting all new keys via pointers', function() {
            delete store.getData().abc;
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes when changing existing keys via pointers', function() {
            store.getData().foo = 'qwe';
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when reverting existing key changes via pointers', function() {
            store.getData().foo = 'bar';
            expect(store.changed(), 'to equal', false);
        });

        it('finds changes when deleting existing keys via pointers', function() {
            delete store.getData().foo;
            expect(store.changed(), 'to equal', true);
        });

        it('does not find changes when re-setting deleted keys via pointers', function() {
            store.getData().foo = 'bar';
            expect(store.changed(), 'to equal', false);
        });
    });

    describe('findFreeKey()', function() {
        it('finds the next unset key in the store', function() {
            expect(store.findFreeKey('newkey'), 'to equal', 'newkey1');

            store.set('newkey1', '');
            expect(store.findFreeKey('newkey'), 'to equal', 'newkey2');

            store.set('newkey3', '');
            expect(store.findFreeKey('newkey'), 'to equal', 'newkey2');
            store.unset('newkey1', '');
            expect(store.findFreeKey('newkey'), 'to equal', 'newkey1');
        });

        it('finds the next unset key in the store with the specified separator', function() {
            expect(store.findFreeKey('newkey', ' '), 'to equal', 'newkey 1');

            store.set('newkey 1', '');
            expect(store.findFreeKey('newkey', ' '), 'to equal', 'newkey 2');

            store.set('newkey 3', '');
            expect(store.findFreeKey('newkey', ' '), 'to equal', 'newkey 2');
            store.unset('newkey 1', '');
            expect(store.findFreeKey('newkey', ' '), 'to equal', 'newkey 1');
        });

        it('finds the next unset key in the store without adding a suffix to the first match', function() {
            expect(store.findFreeKey('newkey', ' ', true), 'to equal', 'newkey');

            store.set('newkey', '');
            expect(store.findFreeKey('newkey', ' ', true), 'to equal', 'newkey 2');

            store.set('newkey 3', '');
            expect(store.findFreeKey('newkey', ' ', true), 'to equal', 'newkey 2');
            store.unset('newkey', '');
            expect(store.findFreeKey('newkey', ' ', true), 'to equal', 'newkey');
        });
    });
});
