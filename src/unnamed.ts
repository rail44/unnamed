type Factory = any;
interface Module {
    id?: string;
    dependencies: string[];
    factory: Factory;
}

type ModuleMap = {[key: string]: Module};
type ExportedMap = {[key: string]: any};

export class Unnamed {
    private moduleMap: ModuleMap;
    private exportedMap: ExportedMap;

    constructor() {
        this.moduleMap = Object.create(null);
        this.exportedMap = Object.create(null);

        this.define = this.define.bind(this);
        this.require = this.require.bind(this);

        (this.define as any).amd = {};
    }

    define() {
        const module = this.buildModule(arguments);
        if (module.id !== undefined) {
            this.moduleMap[module.id] = module;
            return;
        }

        this.instantiate(module)
    }

    require() {
        if (typeof arguments[0] === 'string') {
            return this.getDependency(arguments[0]);
        }

        if (Array.isArray(arguments[0])) {
            const modules = (arguments[0] as string[]).map((id) => this.getDependency(id));
            return arguments[1].apply(null, modules);
        }

        console.error('`require` is called illegal arguments');
    }

    private popModule(id: string): Module {
        const module = this.moduleMap[id];
        delete this.moduleMap[id];
        return module;
    }

    private getDependency(id: string, from?: string): any {
        if (id === 'require') {
            return this.require;
        }

        if (id === 'exports') {
            const exports = Object.create(null);
            if (from === undefined) {
                console.error('`exports` is requeted from unnamed module');
                return;
            }
            this.exportedMap[from] = exports
            return exports;
        }

        if (id === 'module') {
            console.error('`module` argument is not supported');
            return {}
        }

        const instantiated = this.exportedMap[id];
        if (instantiated !== undefined) {
            return instantiated;
        }

        const module = this.popModule(id);
        if (module === undefined) {
            console.error('Could not find module with id `'+id+'`');
            return {}
        }

        return this.instantiate(module);
    }

    private instantiate(module: Module): any {
        if (typeof module.factory === 'function') {
            const deps = module.dependencies.map((d) => this.getDependency(d, module.id));

            const returned = module.factory.apply(null, deps);

            if (module.id === undefined) {
                return;
            }

            if (returned !== undefined) {
                this.exportedMap[module.id] = returned;
            }
            return this.exportedMap[module.id];
        }

        return module.factory;
    }

    private buildModule(args: IArguments): Module {
        let id;
        let i = 0;
        if (typeof args[0] === 'string') {
            id = args[0];
            i += 1;
        }

        let dependencies = ['require', 'exports'];
        if (Array.isArray(args[i])) {
            dependencies = args[i];
            i += 1;
        }

        return {
            id,
            dependencies,
            factory: args[i],
        }
    }
}