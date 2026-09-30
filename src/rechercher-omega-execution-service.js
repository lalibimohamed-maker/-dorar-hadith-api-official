import { preflightRuntime } from "./rechercher-omega-runtime-adapter.js";
import { prepareEngine } from "./rechercher-omega-model-lifecycle.js";

const terminal=new Set(["succeeded","failed","cancelled","blocked"]);

export function createExecutionService({router,scheduler,adapters={},clock=()=>Date.now()}={}) {
  const jobs=new Map();

  async function run(request) {
    const job={job_id:request.job_id||`omega-${clock()}`,state:"queued",created_at:new Date(clock()).toISOString(),capability:request.capability};
    jobs.set(job.job_id,job);
    try {
      job.state="preflight";
      const engine=router.resolve(request.capability,{prefer:request.preferEngines});
      const identity=prepareEngine(engine.identity,{artifactVerified:engine.artifactVerified,licenseVerified:engine.licenseVerified});
      const resource=scheduler.select(request.resourceRequirements||{});
      const adapter=adapters[identity.runtime];
      if(!adapter) throw new Error(`no adapter for runtime: ${identity.runtime}`);
      await preflightRuntime(adapter,{resource,engine:identity});
      await adapter.load({resource,engine:identity});
      job.state="running"; job.engine_id=identity.engine_id; job.resource_id=resource.resource_id;
      const result=await adapter.execute(request.input,{job,resource,engine:identity,signal:request.signal});
      job.state="succeeded"; job.completed_at=new Date(clock()).toISOString(); job.result=result;
      return Object.freeze({...job});
    } catch(error) {
      job.state=error?.code==="ABORT_ERR"?"cancelled":"failed";
      job.error=String(error?.message||error);
      job.completed_at=new Date(clock()).toISOString();
      throw Object.assign(new Error(job.error),{job});
    }
  }

  return Object.freeze({
    run,
    cancel(job_id){const job=jobs.get(job_id);if(!job||terminal.has(job.state))return false;job.state="cancelling";return true;},
    status(job_id){const job=jobs.get(job_id);return job?Object.freeze({...job}):null;}
  });
}
