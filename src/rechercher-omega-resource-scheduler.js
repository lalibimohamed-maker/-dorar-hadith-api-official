const FIT=(need,have)=>Object.entries(need||{}).every(([k,v])=>have?.[k]!==undefined && have[k]>=v);

export function createResourceScheduler(resources=[]) {
  const state=resources.map(r=>({...r,activeJobs:0}));
  return {
    list(){return state.map(r=>({...r}));},
    select(requirements={}) {
      const candidates=state.filter(r=>r.enabled!==false && FIT(requirements,r.capacity||{}));
      if(!candidates.length) throw new Error("no compatible execution resource");
      return candidates.slice().sort((a,b)=>
        (a.activeJobs-b.activeJobs) ||
        ((a.priority??100)-(b.priority??100))
      )[0];
    },
    acquire(resource_id){
      const resource=state.find(r=>r.resource_id===resource_id);
      if(!resource || resource.enabled===false) throw new Error("resource unavailable");
      resource.activeJobs+=1;
      return {...resource};
    },
    release(resource_id){
      const resource=state.find(r=>r.resource_id===resource_id);
      if(resource) resource.activeJobs=Math.max(0,resource.activeJobs-1);
    }
  };
}

export function detectLocalResources({memoryMB=0,webgpu=false,wasm=true,cuda=false}={}) {
  return [
    {resource_id:"browser-wasm",kind:"browser-wasm",enabled:wasm,priority:40,capacity:{memoryMB}},
    {resource_id:"browser-webgpu",kind:"browser-webgpu",enabled:webgpu,priority:20,capacity:{memoryMB}},
    {resource_id:"local-cpu",kind:"local-cpu",enabled:true,priority:60,capacity:{memoryMB}},
    {resource_id:"local-gpu",kind:"local-gpu",enabled:cuda,priority:10,capacity:{memoryMB}}
  ];
}
