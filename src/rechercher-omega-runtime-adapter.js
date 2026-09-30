export function createRuntimeAdapter({runtime, load, execute, health=async()=>({ready:true})}) {
  if (!runtime || typeof load!=="function" || typeof execute!=="function") throw new Error("runtime adapter requires runtime, load and execute");
  return Object.freeze({
    runtime,
    async health(ctx={}) { return health(ctx); },
    async load(ctx={}) { return load(ctx); },
    async execute(task,ctx={}) { return execute(task,ctx); }
  });
}

export async function preflightRuntime(adapter, ctx={}) {
  const result=await adapter.health(ctx);
  if (!result || result.ready !== true) throw new Error(`runtime not ready: ${adapter.runtime}`);
  return result;
}
