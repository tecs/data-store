class DataStore
{
    /**
     * @param {String} id 
     * @param {Object} [data] 
     * @param {String[]} [namespace] 
     * @param {Object} [activeData] 
     */
    constructor(id, data, config, activeData) 
    {
        this.id = id;
        this.data = {};
        this.config = config || {};
        this.activeData = activeData;

        this.config.backend = this.config.backend || DataStore.backendLocalStorage();
        this.config.namespace = this.config.namespace || [];
        
        if (data) {
            this.loadData(data);
        } else {
            this.load();
        }
    }

    static backendLocalStorage()
    {
        return {
            save: (name, data) => localStorage.setItem(name, JSON.stringify(data)),
            load: name => JSON.parse(localStorage.getItem(name) || '{}')
        };
    }

    *[Symbol.iterator]()
    {
        for (const key of this.keys()) {
            yield this.pointer[key];
        }
    }

    /**
     * @returns String[]
     */
    keys()
    {
        this.resetPointer();
        return Object.getOwnPropertyNames(this.pointer);
    }

    /**
     * @param {String} name 
     */
    get(name)
    {
        this.resetPointer();
        return this.pointer[name];
    }

    /**
     * @param {String} name
     * @returns {Boolean} 
     */
    has(name)
    {
        this.resetPointer();
        return name in this.pointer;
    }

    /**
     * @param {String} name 
     * @param {*} value 
     */
    set(name, value)
    {
        this.resetPointer();
        this.pointer[name] = value;
    }

    /**
     * @param {String} name 
     */
    unset(name)
    {
        this.resetPointer();
        delete this.pointer[name];
    }

    /**
     * @param {String} name
     * @returns {DataStore} 
     */
    ns(name)
    {
        return new DataStore(this.id, this.data, {
            backend: this.config.backend,
            namespace: this.config.namespace.concat(name)
        }, this.activeData);
    }

    /**
     * @param {Boolean} [save] 
     */
    commit(save)
    {
        save = typeof save === 'boolean' ? save : true;
        const pointers = this.getPointers();
        for (const key in pointers[0]) {
            delete pointers[0][key];
        }
        for (const key in pointers[1]) {
            if (pointers[1][key] instanceof Object) {
                pointers[0][key] = this.deepCopy(pointers[1][key]);
            } else {
                pointers[0][key] = pointers[1][key];
            }
        }
        if (save) {
            this.config.backend.save(this.id, this.data);        
        }
        this.reset();
    }

    reset()
    {
        if (!this.activeData) {
            this.activeData = this.deepCopy(this.data);
            return;
        }

        const pointers = this.getPointers();
        for (const key in pointers[0]) {
            const isObject = pointers[0][key] instanceof Object;
            if (isObject && typeof pointers[1][key] !== 'undefined') {
                this.ns(key).reset();
            } else if (isObject) {
                pointers[1][key] = this.deepCopy(pointers[0][key]);
            } else {
                pointers[1][key] = pointers[0][key];
            }
        }

        for (const key in pointers[1]) {
            if (! (key in pointers[0])) {
                delete pointers[1][key];
            }
        }
    }

    /**
     * @returns {Object}
     */
    getData()
    {
        return this.getPointers()[1];
    }

    /**
     * @returns {Object[]}
     */
    getPointers()
    {
        const pointers = [this.data, this.activeData];
        for (const namespace of this.config.namespace) {
            for (const i in pointers) {
                pointers[i] = pointers[i][namespace];
            }
        }
        return pointers;
    }

    /**
     * @param {Object} obj
     * @returns {Object}
     */
    deepCopy(obj) {
        const newObj = obj instanceof Array ? [] : {};
        for (const key in obj) {
            newObj[key] = obj[key] instanceof Object ? this.deepCopy(obj[key]) : obj[key];
        }
        return newObj;
    }

    /**
     * @param {Object} data
     * @param {Boolean} [override] 
     */
    loadData(data, override)
    {
        this.data = data;
        if (override) {
            this.reset();
        } else {
            this.resetPointer();
        }
    }

    load()
    {
        this.data = this.config.backend.load(this.id);
        this.reset();
    }

    resetPointer()
    {
        if (!this.activeData) {
            this.reset();
        } else {
            this.pointer = this.getPointers()[1];
        }
    }
};

if (typeof window === 'undefined') {
    module.exports = DataStore;
}