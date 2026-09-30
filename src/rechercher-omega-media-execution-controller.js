import { taskToCapability } from "./rechercher-omega-ai-router.js";

export function createMediaExecutionController({execution,mediaAdapters={}}={}) {
  if(!execution) throw new Error("media controller requires execution service");
  return Object.freeze({
    async submit(mediaJob) {
      const capability=taskToCapability(mediaJob);
      return execution.execute({
        ...mediaJob,
        capability,
        input:{brief:mediaJob.brief,input:mediaJob.input,media:mediaJob.media},
        preferEngines:mediaJob.preferEngines,
        resourceRequirements:mediaJob.resourceRequirements
      });
    },
    async render(renderJob) {
      return this.submit({...renderJob,type:"render",capability:"media-render"});
    },
    async generateVideo(videoJob) {
      return this.submit({...videoJob,type:"video",capability:"video-generation"});
    }
  });
}
