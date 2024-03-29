// -----------------------------------------------------------------------------
// Moetkoe, 2019.
// Original hand-optimized obfuscation that was shown at Assembly Summer 2019.
// The code is re-wrapped here to contain at most 80 characters per line
// to illustrate the 1k size limitation. Without the newlines that are
// unnecessary and added for clarity, this code contains 1342 characters:
// -----------------------------------------------------------------------------
with(Math){q=(a,b,e=255*a|0)=>"rgb("+e+","+e+","+e+","+b+")";r=(a,b,e,d,f,k,h=0
)=>{for(;h<d.length;){k=d[h++];0<k[2]+e&&g.push([k[0]+a+sin(3*f-3*k[2])/8,k[1]+b
,k[2]+e,k[3],k[4]])}};t=(a,b=h.width=innerWidth,e=h.height=innerHeight,d=0,f)=>{
c.fillStyle="#045";c.fillRect(0,0,b,e);for(g=[];8>d;d++){f=1+d%3;r(3*sin(8*d+25)
,2*sin(3*d),18-2*m*f/3%20,d?n:n.concat([[0,0,0,1,1]]),m*(2+f)/8+d)}r(0,4-m,9,u,m
);g.sort((a,b)=>b[2]-a[2]);for(d=0;d<g.length;d++)f=g[d],f=[3*f[0]/f[2],3*f[1]/f
[2],f[2]],c.fillStyle=q(g[d][3],1-f[2]/17),g[d][4]?(c.fillStyle=q(g[d][3],m/17-
2.4),c.font=e/2/f[2]+"px arial",c.fillText("Yhen kilon siika",b/2+f[0]*e/2,e/2+f
[1]*e/2)):(c.beginPath(),c.ellipse(b/2+f[0]*e/2,e/2+f[1]*e/2,e/2/f[2]/5,e/2/f[2]
/5,0,0,7),c.fill());59.8>m&&requestAnimationFrame(t)};h=document.getElementById(
"c");c=h.style;c.position="fixed";c.left=c.top=a=m=v=0;c=h.getContext("2d"),n=[]
,u=[],g=[];for(;333>a;){b=[random()-.5,random()-.5,random()],e=sin(3*(sin(3*b[2]
)*sin(8+3*b[2])+b[2])/2)/5,e=9*b[0]*b[0]+b[1]*b[1]-e*e;1e-5>e*e&&(b[3]=1-b[2],b[
4]=0,u[a]=[20*random()-9,50*random(),9*random(),1,0],n[a++]=b)}l=new 
AudioContext;p=l.createScriptProcessor(1024,0,1);p.connect(l.destination);p.
onaudioprocess=(a,b,e,d)=>{for(a=a.outputBuffer.getChannelData(b=0);1024>b;a[e=
b++]=v=60<(d=m+=1/l.sampleRate)?0:(.6-.4*sin(8+d/3))*(.9*v-random()/99));};t()}
// -----------------------------------------------------------------------------
