const FIT=(need,have)=>Object.entries(need||{}).every(([k,v])=>have?.[k]!==undefined && have[k]>=v);

export function createResourceScheduler(resources=[]) {
  const state=resources.map(r=>({...r,activeJobs:0,maxConcurrent:r.maxConcurrent ?? Infinity}));
  const waiters=[];

  const candidatesFor=(requirements={}) =>
    state.filter(r=>r.enabled!==false && FIT(requirements,r.capacity||{}));

  const availableFor=(requirements={}) =>
    candidatesFor(requirements).filter(r=>r.activeJobs < r.maxConcurrent);

  const choose=(requirements={}) => availableFor(requirements).slice().sort((a,b)=>
    (a.activeJobs-b.activeJobs) || ((a.priority??100)-(b.priority??100))
  )[0];

  function removeWaiter(waiter) {
    const i=waiters.indexOf(waiter);
    if(i>=0) waiters.splice(i,1);
  }

  function pump() {
    for (const waiter of [...waiters]) {
      if (waiter.signal?.aborted) {
        removeWaiter(waiter);
        waiter.reject(Object.assign(new Error("execution cancelled while queued"),{code:"ABORT_ERR"}));
        continue;
      }
      const resource=choose(waiter.requirements);
      if (!resource) continue;
      removeWaiter(waiter);
      resource.activeJobs+=1;
      waiter.resolve({...resource});
    }
  }

  return {
    list(){return state.map(r=>({...r}));},

    select(requirements={}) {
      const resource=choose(requirements);
      if(!resource) {
        if(candidatesFor(requirements).length) throw new Error("compatible execution resources are busy; acquire() will queue");
        throw new Error("no compatible execution resource");
      }
      return {...resource};
    },

    async acquire(requirements={}, {signal}={}) {
      if(signal?.aborted) throw Object.assign(new Error("execution cancelled"),{code:"ABORT_ERR"});
      const resource=choose(requirements);
      if(resource) {
        resource.activeJobs+=1;
        return {...resource};
      }
      if(!candidatesFor(requirements).length) throw new Error("no compatible execution resource");
      return await new Promise((resolve,reject)=>{
        const waiter={requirements,signal,resolve,reject};
        waiters.push(waiter);
        if(signal) {
          const onAbort=()=>{
            removeWaiter(waiter);
            reject(Object.assign(new Error("execution cancelled while queued"),{code:"ABORT_ERR"}));
          };
          waiter.onAbort=onAbort;
          signal.addEventListener("abort",onAbort,{once:true});
        }
      });
    },

    release(resource_id){
      const resource=state.find(r=>r.resource_id===resource_id);
      if(resource) resource.activeJobs=Math.max(0,resource.activeJobs-1);
      pump();
    }
  };
}

export function detectLocalResources({memoryMB=0,webgpu=false,wasm=true,cuda=false}={}) {
  return [
    {resource_id:"browser-wasm",kind:"browser-wasm",enabled:wasm,priority:40,capacity:{memoryMB}},
    {resource_id:"browser-webgpu",kind:"browser-webgpu",enabled:webgpu,priority:20,capacity:{memoryMB}},
    {resource_id:"local-cpu",kind:"local-cpu",enabled:true,priority:30,capacity:{memoryMB}},
    {resource_id:"local-gpu",kind:"local-gpu",enabled:cuda,priority:10,capacity:{memoryMB}},
  ];
}
