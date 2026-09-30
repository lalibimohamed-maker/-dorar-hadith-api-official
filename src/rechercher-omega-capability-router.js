const aliases=new Map([
  ["chat","reasoning"],["question","reasoning"],["pdf","document-analysis"],
  ["document","document-analysis"],["image","vision"],["photo","vision"],
  ["speech-to-text","asr"],["voice","asr"],["text-to-speech","tts"],
  ["video","video-generation"],["render","media-render"]
]);

export function normalizeCapability(value) {
  const key=String(value||"").trim().toLowerCase();
  return aliases.get(key) || key;
}

export function createCapabilityRouter({registry=[]}={}) {
  const entries=registry.map(e=>({...e,capabilities:new Set((e.capabilities||[]).map(normalizeCapability))}));
  return Object.freeze({
    list(capability) {
      const c=normalizeCapability(capability);
      return entries.filter(e=>e.enabled!==false && e.capabilities.has(c));
    },
    resolve(capability,{prefer=[]}={}) {
      const candidates=this.list(capability);
      for(const preferred of prefer){const hit=candidates.find(e=>e.engine_id===preferred);if(hit)return hit;}
      if(!candidates.length) throw new Error(`no active engine for capability: ${normalizeCapability(capability)}`);
      return candidates[0];
    }
  });
}
