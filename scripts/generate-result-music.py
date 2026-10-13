"""Original Game Boy-inspired result themes, rendered locally without dependencies."""
from pathlib import Path
import math, struct, wave
RATE=22050
OUT=Path(__file__).resolve().parent.parent/'public/assets/audio'

def render(name, melody, bass, beat, tail=1.1):
    duration=sum(length for _,length in melody)*beat+tail
    samples=[0.0]*int(duration*RATE)
    def note(midi,start,length,volume,voice='pulse'):
        if midi is None:return
        freq=440*2**((midi-69)/12);n=int(length*RATE)
        for j in range(n):
            k=int(start*RATE)+j
            if k>=len(samples):break
            t=j/RATE;phase=(t*freq)%1
            if voice=='triangle':value=1-4*abs(phase-.5)
            else:value=.75 if phase<.25 else -.25
            envelope=min(1,t/.008)*min(1,(length-t)/.055)*math.exp(-t*.35)
            samples[k]+=value*volume*envelope
    position=0
    for midi,length in melody:
        note(midi,position*beat,length*beat*.91,.36)
        if midi is not None:note(midi+12,position*beat+.035,length*beat*.8,.06,'triangle')
        position+=length
    for i,midi in enumerate(bass):
        start=i*beat*2
        note(midi,start,beat*1.7,.3,'triangle')
        note(midi+7,start+beat*.5,beat*.7,.12,'triangle')
    # A short quiet tail keeps the resolution soft on headphones.
    end=sum(length for _,length in melody)*beat
    last=bass[-1]
    for midi in [last,last+7,last+12]:note(midi,max(0,end-beat),tail+beat,.07,'triangle')
    with wave.open(str(OUT/name),'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h',round(math.tanh(s)*26000)) for s in samples))

OUT.mkdir(parents=True,exist_ok=True)
render('arena-victory.wav',[(72,.5),(76,.5),(79,.5),(84,1),(83,.5),(79,.5),(76,.5),(81,.5),(84,.5),(88,1),(86,.5),(84,.5),(79,.5),(81,.5),(83,.5),(86,.5),(84,2),(None,.5)],[48,53,57,55,48],.39)
render('arena-defeat.wav',[(74,1),(69,.5),(72,.5),(70,1),(69,1),(65,.5),(67,.5),(69,1),(64,1),(62,2),(None,.5)],[50,46,43,45,50],.46)
