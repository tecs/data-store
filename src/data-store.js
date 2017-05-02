class DataStore
{
    /**
     * Creates a new DataStore object with the specified ID, optionally suplying the original data, configuration object
     * and changes object.
     *
     * @param {String} id
     * @param {Object} [data={}]
     * @param {Object} [config={}]
     * @param {Object} [config.backend=this.backendLocalStorage()]
     * @param {Function(key: String)} config.backend.load
     * @param {Function(key: String, data: Object)} config.backend.save
     * @param {String[]} [config.namespace=[]]
     * @param {Object} [activeData={}]
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

    /**
     * Returns the default localStorage backend.
     *
     * @returns {Object}
     */
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
     * Returns the data keys in the current namespace.
     *
     * @returns String[]
     */
    keys()
    {
        this.resetPointer();
        return Object.getOwnPropertyNames(this.pointer);
    }

    /**
     * Returns the data contained by the supplied key in the current namespace.
     *
     * @param {String} key
     * @returns {*}
     */
    get(key)
    {
        this.resetPointer();
        return this.pointer[key];
    }

    /**
     * Returns whether or not the current namespace contains the supplied key.
     *
     * @param {String} key
     * @returns {Boolean}
     */
    has(key)
    {
        this.resetPointer();
        return key in this.pointer;
    }

    /**
     * Sets or overwrites the data of the supplied key in the current namespace.
     *
     * @param {String} key
     * @param {*} value
     */
    set(key, value)
    {
        this.resetPointer();
        this.pointer[key] = value;
    }

    /**
     * Removes the data with the specified key from the current namespace.
     *
     * @param {String} key
     */
    unset(key)
    {
        this.resetPointer();
        delete this.pointer[key];
    }

    /**
     * Returns a new store object in the specified namespace relative to the current one.
     *
     * @param {String} key
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
     * Applies the changes in the current namespace, optionally saving to the backend.
     *
     * @param {Boolean} [save=true]
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

    /**
     * Resets all changes made to the current namespace.
     */
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
     * Returns whether or not there are changes in the current namespace.
     *
     * @returns {Boolean}
     */
    changed()
    {
        if (!this.activeData) {
            return false;
        }

        const pointers = this.getPointers();

        if (Object.keys(pointers[0]).length !== Object.keys(pointers[1]).length) {
            return true;
        }

        for (const key in pointers[0]) {
            const isObject = pointers[0][key] instanceof Object;
            if (typeof pointers[0][key] !== typeof pointers[1][key]) {
                return true;
            } else if (isObject && this.ns(key).changed()) {
                return true;
            } else if (!isObject && pointers[0][key] !== pointers[1][key]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns an object pointing to the data of the current namespace.
     *
     * @returns {Object}
     */
    getData()
    {
        return this.getPointers()[1];
    }

    /**
     * Returns an array with pointers to the original and the changes data in the current namespace.
     *
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
     * Copies the suplied object recursively, ensuring all references are broken.
     *
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
     * Sets the suplied object as the store's data, optionally clearing all changes.
     *
     * @param {Object} data
     * @param {Boolean} [override=false]
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

    /**
     * Loads the store's data from the backend, clearing all changes.
     */
    load()
    {
        this.data = this.config.backend.load(this.id);
        this.reset();
    }

    /**
     * Regenerates the internal data pointer to the current namespace.
     */
    resetPointer()
    {
        if (!this.activeData) {
            this.reset();
        } else {
            this.pointer = this.getPointers()[1];
        }
    }
}

if (typeof window === 'undefined') {
    module.exports = DataStore;
}