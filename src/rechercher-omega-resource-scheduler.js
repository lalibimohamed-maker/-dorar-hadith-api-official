const FIT=(need,have)=>Object.entries(need||{}).every(([k,v])=>have?.[k]===undefined || have[k]>=v);

export function createResourceScheduler(resources=[]) {
  const snapshot=resources.map(r=>({...r}));
  return Object.freeze({
    list(){return snapshot.map(r=>({...r}));},
    select(requirements={}) {
      const candidates=snapshot.filter(r=>r.enabled!==false && FIT(requirements,r.capacity||{}));
      if(!candidates.length) throw new Error("no compatible execution resource");
      return candidates.sort((a,b)=>(a.priority??100)-(b.priority??100))[0];
    }
  });
}

export function detectLocalResources({memoryMB=0,webgpu=false,wasm=true,cuda=false}={}) {
  return [
    {resource_id:"browser-wasm",kind:"browser-wasm",enabled:wasm,priority:40,capacity:{memoryMB}},
    {resource_id:"browser-webgpu",kind:"browser-webgpu",enabled:webgpu,priority:20,capacity:{memoryMB}},
    {resource_id:"local-cpu",kind:"local-cpu",enabled:true,priority:60,capacity:{memoryMB}},
    {resource_id:"local-gpu",kind:"local-gpu",enabled:cuda,priority:10,capacity:{memoryMB}}
  ];
}
