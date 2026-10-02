#!/usr/bin/env python3
import json,sys
from pathlib import Path
import numpy as np
import onnxruntime as ort
import soundfile as sf
from scipy.signal import resample_poly, stft

SR=16000; N_MELS=40; N_FFT=512; HOP=160
def fb():
    fmin,fmax=50,7600
    mels=np.linspace(1127*np.log1p(fmin/700),1127*np.log1p(fmax/700),N_MELS+2)
    hz=700*np.expm1(mels/1127); bins=np.floor((N_FFT+1)*hz/SR).astype(int)
    out=np.zeros((N_MELS,N_FFT//2+1),np.float32)
    for m in range(1,N_MELS+1):
        l,c,r=bins[m-1],bins[m],bins[m+1]
        if c>l: out[m-1,l:c]=np.linspace(0,1,c-l,endpoint=False)
        if r>c: out[m-1,c:r]=np.linspace(1,0,r-c,endpoint=False)
    return out
FB=fb()
def features(audio):
    if audio.ndim>1: audio=audio.mean(axis=1)
    if len(audio) and SR!=16000: audio=resample_poly(audio,SR,16000).astype(np.float32)
    if len(audio)>=SR: x=audio[:SR]
    else:
        x=np.zeros(SR,np.float32); start=(SR-len(audio))//2; x[start:start+len(audio)]=audio
    _,_,z=stft(x,fs=SR,nperseg=N_FFT,noverlap=N_FFT-HOP,nfft=N_FFT,window='hann',boundary=None)
    mel=np.maximum(FB@(np.abs(z)**2),1e-8); log=np.log(mel).astype(np.float32)
    log-=log.mean(axis=1,keepdims=True); log/=np.maximum(log.std(axis=1,keepdims=True),1e-4)
    return log.reshape(1,-1).astype(np.float32)
def main():
    for line in sys.stdin:
        if not line.strip(): continue
        try:
            req=json.loads(line); audio,_=sf.read(req["audio"],dtype="float32")
            sess=ort.InferenceSession(req["model"],providers=["CPUExecutionProvider"])
            inp=sess.get_inputs()[0].name; out=sess.run(None,{inp:features(audio)})[1]
            prob=float(out[0][1] if out.ndim==2 else out.reshape(-1)[-1])
            print(json.dumps({"ok":True,"wakeWord":"الهُدَى","detected":prob>=req.get("threshold",.8),"probability":prob},ensure_ascii=False),flush=True)
        except Exception as exc:
            print(json.dumps({"ok":False,"error":str(exc)},ensure_ascii=False),flush=True)
if __name__=="__main__": main()
