# Независимая реализация (другой стиль кода) для сверки движка
import json
def red(n):
    while n>22: n=sum(int(c) for c in str(n))
    return n
def matrix(d,m,y):
    a=red(d); b=red(m); v=red(sum(int(c) for c in str(y)))
    g=red(a+b+v); dd=red(a+b+v+g)
    e,zh,z,i=red(a+b),red(b+v),red(v+g),red(g+a)
    out=dict(A=a,B=b,V=v,G=g,D=dd,E=e,Zh=zh,Z=z,I=i)
    for key,(o,c) in dict(K=("A","D"),M=("B","D"),O=("V","D"),R=("G","D"),Kh=("E","D"),Ch=("Zh","D"),Shch=("Z","D"),Eh=("I","D")).items():
        out[key]=red(out[o]+out[c])
    out["L"]=red(a+out["K"]); out["N"]=red(b+out["M"]); out["P"]=red(v+out["O"]); out["S"]=red(g+out["R"])
    out["T"]=red(out["R"]+out["O"]); out["U"]=red(out["R"]+out["T"]); out["F"]=red(out["O"]+out["T"])
    out["Ts"]=red(e+out["Kh"]); out["Sh"]=red(zh+out["Ch"]); out["Y"]=red(z+out["Shch"]); out["Yu"]=red(i+out["Eh"])
    sky=red(b+g); earth=red(a+v); pers=red(sky+earth); male=red(e+z); fem=red(zh+i); soc=red(male+fem); gen=red(pers+soc); pl=red(soc+gen)
    kin=red(e+zh+z+i); inner=red(kin+dd)
    # круг лет
    anc=[a,e,b,zh,v,z,g,i,a]; circle=[]
    for s in range(8):
        P,Q=anc[s],anc[s+1]; mid=red(P+Q); m1=red(P+mid); m2=red(mid+Q)
        circle+= [P,red(P+m1),m1,red(m1+mid),mid,red(mid+m2),m2,red(m2+Q)]
    return dict(pts=out,purposes=dict(sky=sky,earth=earth,personal=pers,male=male,female=fem,social=soc,general=gen,planetary=pl),kin=kin,inner=inner,circle=circle)
dates=[(1,1,1980),(8,3,1960),(26,8,1989),(29,2,2000),(31,12,1999),(15,6,1995),(22,22 if False else 11,1975),(23,4,1988),(7,9,2004),(18,10,1972),(4,5,2010),(30,7,1966)]
res={f"{d:02d}.{m:02d}.{y}":matrix(d,m,y) for d,m,y in dates}
json.dump(res,open('../tests/fixtures/matrix-indep.json','w'),ensure_ascii=False)
print(len(res))
