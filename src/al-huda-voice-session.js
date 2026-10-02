export function createAlHudaVoiceSession({
  permission,
  wakeDetector,
  audioPipeline,
  asr,
  reasoning,
  tts,
  onEvent = () => {}
} = {}) {
  for (const [name,fn] of Object.entries({wakeDetector, asr, reasoning, tts})) {
    if (typeof fn !== 'function') throw new TypeError(`${name} function is required`);
  }
  if (!audioPipeline || typeof audioPipeline.process !== 'function') throw new TypeError('audioPipeline is required');
  let active=false;
  let armed=false;
  let questionFrames=[];
  let answerController=null;

  return Object.freeze({
    get active() { return active; },
    async start() {
      const status=typeof permission?.refresh === 'function' ? await permission.refresh() : 'granted';
      if (status !== 'granted') throw new Error('microphone permission is not granted');
      active=true;
      armed=false;
      questionFrames=[];
      onEvent({type:'listening',wakeWord:'الهُدَى'});
      return {active:true};
    },
    async pushFrame(samples) {
      if (!active) throw new Error('voice session is not active');
      const processed=audioPipeline.process(samples);
      if (!active) return {state:'stopped'};
      if (!armed && wakeDetector(processed.samples)) {
        armed=true;
        questionFrames=[];
        onEvent({type:'wake-detected',wakeWord:'الهُدَى'});
        return {state:'wake-detected'};
      }
      if (armed && (questionFrames.length || processed.turn.active)) {
        questionFrames.push(processed.samples);
      }
      if (questionFrames.length && processed.turn.speechEnded) {
        const audio=Float32Array.from(questionFrames.flatMap(frame=>Array.from(frame)));
        questionFrames=[];
        onEvent({type:'transcribing'});
        const transcript=await asr(audio);
        if (!transcript?.text?.trim()) { armed=false; throw new Error('empty transcript'); }
        onEvent({type:'transcript-ready',text:transcript.text,language:transcript.language ?? null});
        onEvent({type:'reasoning'});
        const answer=await reasoning(transcript.text);
        answerController=new AbortController();
        onEvent({type:'speaking'});
        try {
          await tts(answer, answerController.signal);
        } finally {
          answerController=null;
        }
        armed=false;
        onEvent({type:'answer-complete'});
        return {state:'answer-complete',transcript,answer};
      }
      return {state:processed.turn.active ? 'listening' : 'idle'};
    },
    interrupt(reason='user-barge-in') {
      if (answerController && !answerController.signal.aborted) answerController.abort(reason);
      onEvent({type:'barge-in',reason});
      return {interrupted:true,reason};
    },
    stop() {
      active=false;
      questionFrames=[];
      armed=false;
      if (answerController && !answerController.signal.aborted) answerController.abort('session-stopped');
      answerController=null;
      onEvent({type:'stopped'});
    },
    get armed() { return armed; }
  });
}
