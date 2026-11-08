import keyboard
import random
import string

chars=string.ascii_letters + string.digits + string.punctuation
bullets=0
magazine=0
seq=[]
while True:
    for i in range(0,10):
        seq.append(random.choice(chars))
    while len(seq)>0:
        if keyboard.read_key()==seq[0]:
            bullets+=1
        elif bullets!=0:
            bullets-=1
        if bullets>=5:
            magazine+=1
            bullets-=5
        seq.remove(0)
    print("sequence complete, next")