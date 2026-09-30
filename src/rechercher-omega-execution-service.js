import { preflightRuntime } from "./rechercher-omega-runtime-adapter.js";
import { prepareEngine } from "./rechercher-omega-model-lifecycle.js";

const terminal=new Set(["succeeded","failed","cancelled","blocked"]);

export function createExecutionService({router,scheduler,adapters={},clock=()=>Date.now()}={}) {
  const jobs=new Map();

  async function run(request) {
    const controller=new AbortController();
    const job={job_id:request.job_id||`omega-${clock()}`,state:"queued",created_at:new Date(clock()).toISOString(),capability:request.capability,provenance:request.provenance||null};
    jobs.set(job.job_id,{job,controller,resource_id:null});
    try {
      job.state="preflight";
      const engine=router.resolve(request.capability,{prefer:request.preferEngines});
      const identity=prepareEngine(engine.identity,{artifactVerified:engine.artifactVerified,licenseVerified:engine.licenseVerified});
      const resource=scheduler.select(request.resourceRequirements||{});
      const adapter=adapters[identity.runtime];
      if(!adapter) throw new Error(`no adapter for runtime: ${identity.runtime}`);
      if(typeof scheduler.acquire==="function") scheduler.acquire(resource.resource_id);
      jobs.get(job.job_id).resource_id=resource.resource_id;
      await preflightRuntime(adapter,{resource,engine:identity,signal:controller.signal});
      if(controller.signal.aborted) throw Object.assign(new Error("execution cancelled"),{code:"ABORT_ERR"});
      await adapter.load({resource,engine:identity,signal:controller.signal});
      job.state="running"; job.engine_id=identity.engine_id; job.resource_id=resource.resource_id;
      const result=await adapter.execute(request.input,{job,resource,engine:identity,signal:controller.signal});
      if(controller.signal.aborted) throw Object.assign(new Error("execution cancelled"),{code:"ABORT_ERR"});
      job.state="succeeded"; job.completed_at=new Date(clock()).toISOString(); job.result=result;
      return Object.freeze({...job});
    } catch(error) {
      job.state=error?.code==="ABORT_ERR" || controller.signal.aborted ? "cancelled" : "failed";
      job.error=String(error?.message||error);
      job.completed_at=new Date(clock()).toISOString();
      throw Object.assign(new Error(job.error),{job});
    } finally {
      const entry=jobs.get(job.job_id);
      if(entry?.resource_id && typeof scheduler.release==="function") scheduler.release(entry.resource_id);
      if(terminal.has(job.state)) jobs.delete(job.job_id);
    }
  }

  return Object.freeze({
    run,
    cancel(job_id){
      const entry=jobs.get(job_id);
      if(!entry || terminal.has(entry.job.state)) return false;
      entry.job.state="cancelling";
      entry.controller.abort();
      return true;
    },
    status(job_id){
      const entry=jobs.get(job_id);
      return entry?Object.freeze({...entry.job}):null;
    }
  });
}
