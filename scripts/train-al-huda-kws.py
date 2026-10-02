#!/usr/bin/env python3
# Training pipeline: regenerate deterministic Al-Huda KWS evidence on demand.
import argparse, json, math, random, subprocess, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, stft
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType

SR=16000
WINDOW_SAMPLES=SR
N_MELS=40
N_FFT=512
HOP=160

POSITIVE_TEXTS=["الهُدَى","الهدى","الهُدى"]
NEGATIVE_TEXTS=[
    "الحمد لله","سبحان الله","لا إله إلا الله","محمد رسول الله",
    "السلام عليكم","بسم الله","رب اغفر لي","اللهم صل وسلم"
]

def synth(text, out):
    subprocess.run(["espeak-ng","-v","ar","-s","165","-p","50","-a","140","-w",str(out),text],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    audio,src_sr=sf.read(out,dtype="float32")
    if audio.ndim>1: audio=audio.mean(axis=1)
    if len(audio) and src_sr != SR:
        audio=resample_poly(audio,SR,int(src_sr)).astype(np.float32)
    return audio

def augment(audio, rng):
    x=audio.astype(np.float32)
    speed=rng.choice([0.88,0.94,1.0,1.06,1.12])
    n=max(1,int(len(x)/speed))
    idx=np.linspace(0,len(x)-1,n).astype(np.int64)
    x=x[idx]
    shift=int(rng.uniform(-0.08,0.08)*SR)
    if shift:
        x=np.roll(x,shift)
    noise=rng.normal(0, rng.uniform(0.001,0.02), size=len(x)).astype(np.float32)
    x=x+noise
    gain=rng.uniform(0.55,1.15)
    x=np.clip(x*gain,-1,1)
    return x

def fixed_window(audio):
    if len(audio)>=WINDOW_SAMPLES:
        start=(len(audio)-WINDOW_SAMPLES)//2
        return audio[start:start+WINDOW_SAMPLES]
    out=np.zeros(WINDOW_SAMPLES,dtype=np.float32)
    start=(WINDOW_SAMPLES-len(audio))//2
    out[start:start+len(audio)]=audio
    return out

def mel_filterbank():
    fmin,fmax=50,7600
    mels=np.linspace(1127*np.log1p(fmin/700),1127*np.log1p(fmax/700),N_MELS+2)
    hz=700*np.expm1(mels/1127)
    bins=np.floor((N_FFT+1)*hz/SR).astype(int)
    fb=np.zeros((N_MELS,N_FFT//2+1),dtype=np.float32)
    for m in range(1,N_MELS+1):
        l,c,r=bins[m-1],bins[m],bins[m+1]
        if c>l:
            fb[m-1,l:c]=np.linspace(0,1,c-l,endpoint=False)
        if r>c:
            fb[m-1,c:r]=np.linspace(1,0,r-c,endpoint=False)
    return fb

FB=mel_filterbank()

def features(audio):
    x=fixed_window(audio)
    _,_,z=stft(x,fs=SR,nperseg=N_FFT,noverlap=N_FFT-HOP,nfft=N_FFT,window="hann",boundary=None)
    power=(np.abs(z)**2).astype(np.float32)
    mel=np.maximum(FB @ power,1e-8)
    logmel=np.log(mel).astype(np.float32)
    logmel-=logmel.mean(axis=1,keepdims=True)
    logmel/=np.maximum(logmel.std(axis=1,keepdims=True),1e-4)
    return logmel.reshape(1,-1)[0].astype(np.float32)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out-dir",required=True)
    ap.add_argument("--samples",type=int,default=720)
    args=ap.parse_args()
    out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    rng=random.Random(20261002)
    X=[]; y=[]
    with tempfile.TemporaryDirectory() as td:
        td=Path(td)
        base=[]
        for text in POSITIVE_TEXTS:
            p=td/f"p-{len(base)}.wav"; base.append((1,text,synth(text,p)))
        for text in NEGATIVE_TEXTS:
            p=td/f"n-{len(base)}.wav"; base.append((0,text,synth(text,p)))
        per=args.samples//len(base)
        for label,text,audio in base:
            for _ in range(per):
                x=augment(audio,rng)
                X.append(features(x)); y.append(label)
    X=np.asarray(X,dtype=np.float32); y=np.asarray(y,dtype=np.int64)
    Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=.25,stratify=y,random_state=20261002)
    clf=LogisticRegression(max_iter=1000,class_weight="balanced",solver="liblinear",random_state=20261002)
    clf.fit(Xtr,ytr)
    pred=clf.predict(Xte)
    acc=float(accuracy_score(yte,pred))
    cm=confusion_matrix(yte,pred).tolist()
    if acc < 0.92:
        raise SystemExit(f"synthetic KWS validation accuracy too low: {acc:.4f}")
    model_path=out/"al-huda-kws.onnx"
    onx=to_onnx(clf,Xtr[:1].astype(np.float32),target_opset=17)
    model_path.write_bytes(onx.SerializeToString())
    meta={
        "assistant":"Al-Huda","wakeWord":"الهُدَى","model":"dinullah-al-huda-kws-v1",
        "input":{"sampleRate":SR,"windowMs":1000,"nMels":N_MELS,"nFft":N_FFT,"hop":HOP},
        "training":{"positiveTexts":POSITIVE_TEXTS,"negativeTexts":NEGATIVE_TEXTS,
                    "syntheticSamples":int(len(X)),"seed":20261002,
                    "validationAccuracy":acc,"confusionMatrix":cm},
        "evidence":"synthetic-train-and-heldout-onnx-validation",
        "deviceRuntimeStillRequired":True
    }
    (out/"al-huda-kws-metadata.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(meta,ensure_ascii=False))

if __name__=="__main__":
    main()
