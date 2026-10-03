export function createBargeInEngine() {
  let controller=null;
  return Object.freeze({
    start() {
      controller=new AbortController();
      return controller.signal;
    },
    interrupt(reason='user-barge-in') {
      if (controller && !controller.signal.aborted) controller.abort(reason);
      return { interrupted:true, reason };
    },
    get interrupted() { return Boolean(controller?.signal.aborted); }
  });
}
