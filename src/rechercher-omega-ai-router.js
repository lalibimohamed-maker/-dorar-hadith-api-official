import { createCapabilityRouter } from "./rechercher-omega-capability-router.js";
import { createExecutionService } from "./rechercher-omega-execution-service.js";

export function createAIRouter({registry,resources,adapters,scheduler}={}) {
  const router=createCapabilityRouter({registry});
  const service=createExecutionService({router,scheduler,adapters});
  return Object.freeze({
    capabilities: router,
    execute(request){return service.run(request);},
    status(id){return service.status(id);},
    cancel(id){return service.cancel(id);}
  });
}

export function taskToCapability(task={}) {
  if(task.capability) return task.capability;
  if(task.type==="audio") return "asr";
  if(task.type==="image") return "vision";
  if(task.type==="pdf"||task.mime==="application/pdf") return "document-analysis";
  if(task.type==="video") return "video-generation";
  if(task.type==="speech") return "tts";
  return "reasoning";
}
