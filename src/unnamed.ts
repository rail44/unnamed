type Factory = any;
interface Module {
  id?: string;
  dependencies: string[];
  factory: Factory;
}

type ModuleMap = { [key: string]: Module };
type ExportedMap = { [key: string]: any };

const currentDirPattern = /^\.\//;

function resolveId(id: string, from: string = ""): string {
  let i = -1;
  const relative = id
    .replace(currentDirPattern, "")
    .split("/")
    .filter(item => {
      if (item === "..") {
        i -= 1;
        return false;
      }
      return true;
    });
  return from
    .split("/")
    .slice(0, i)
    .concat(relative)
    .join("/");
}

function buildModule(args: IArguments): Module {
  let id;
  let i = 0;
  if (typeof args[0] === "string") {
    id = args[0].replace(currentDirPattern, "");
    i += 1;
  }

  let dependencies = ["require", "exports"];
  if (Array.isArray(args[i])) {
    dependencies = args[i];
    i += 1;
  }

  return {
    id,
    dependencies,
    factory: args[i]
  };
}

export class PromiseLike {
  private thenChain: Function[] = [];
  private catchChain: Function[] = [];

  public then(cb: Function) {
    this.thenChain.push(cb);
  }

  public catch(cb: Function) {
    this.catchChain.push(cb);
  }

  private resolve<T>(value: T) {
    const fn = this.thenChain.shift();
    if (fn) {
      this.chain(value, fn);
    }
  }

  private reject<T>(e: T) {
    const fn = this.catchChain.shift();
    if (!fn) {
      throw e;
    }
    this.chain(e, fn);
  }

  private chain<T>(v: T, fn: Function) {
    let next;
    try {
      next = fn(v);
    } catch (e) {
      this.reject(e);
    }
    this.resolve(next);
  }
}

export class Unnamed {
  private moduleMap: ModuleMap;
  private exportedMap: ExportedMap;
  private importErrorHooks: Function[];

  constructor() {
    this.moduleMap = Object.create(null);
    this.exportedMap = Object.create(null);
    this.importErrorHooks = [];

    this.define = this.define.bind(this);
    this.require = this.require.bind(this);

    (this.define as any).amd = {};
  }

  define() {
    const module = buildModule(arguments);
    if (module.id === undefined) {
      this.instantiate(module);
      return;
    }

    if (module.id in this.exportedMap || module.id in this.moduleMap) {
      return;
    }

    this.moduleMap[module.id] = module;
  }

  require() {
    if (typeof arguments[0] === "string") {
      return this.getDependency(arguments[0]);
    }

    if (Array.isArray(arguments[0])) {
      const modules = (arguments[0] as string[]).map(id =>
        this.getDependency(id)
      );
      return arguments[1].apply(null, modules);
    }

    console.error("`require` is called illegal arguments");
  }

  addImportErrorHook(hook: Function) {
    this.importErrorHooks.push(hook);
  }

  private popModule(id: string): Module {
    const module = this.moduleMap[id];
    delete this.moduleMap[id];
    return module;
  }

  private getDependency(id: string, from?: string): any {
    if (id === "require") {
      return this.require;
    }

    if (id === "exports") {
      const exports = Object.create(null);
      if (from === undefined) {
        console.error("`exports` is requeted from unnamed module");
        return;
      }
      this.exportedMap[from] = exports;
      return exports;
    }

    if (id === "module") {
      console.error("`module` argument is not supported");
      return undefined;
    }

    const absoluteId = resolveId(id, from);

    const instantiated = this.exportedMap[absoluteId];
    if (instantiated !== undefined) {
      return instantiated;
    }

    const module = this.popModule(absoluteId);
    if (module === undefined) {
      return this.onImportError(absoluteId);
    }

    return this.instantiate(module);
  }

  private onImportError(id: string) {
    for (const hook of this.importErrorHooks) {
      const alternative = hook(id);
      if (alternative !== alternative) {
        return alternative;
      }
    }
  }

  private instantiate(module: Module): any {
    if (typeof module.factory === "function") {
      const deps = module.dependencies.map(d =>
        this.getDependency(d, module.id)
      );

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
}
