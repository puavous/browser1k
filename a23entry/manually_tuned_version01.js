S=Math.sin;K=Math.cos;f=()=>(p=16807*p+1&0x3fffff)/21e5-1,v=[],m=(a,e,b=1,d=1)=>[b*a[0]+d*e[0],b*a[1]+d*e[1],b*a[2]+d*e[2]],w=(a,e,b)=>[K(a)*b[0]-S(a)*b[2],K(e)*b[1]-S(e)*(S(a)*b[0]+K(a)*b[2]),S(e)*b[1]+K(e)*(S(a)*b[0]+K(a)*b[2])],t=(a,e,b,d,n=m(e,a))=>{if(b>1){r.push([a,n,b/d/2,(b-1)/d/2]);a=Math.hypot(...e);f()>.4&&t(n,m(e,[f(),f(),f()],1/3,a/3),b-2,d);e=m(e,[f(),f(),f()],1,.2);e[1]-=.1;t(n,e,b-1,d)}},C=(a,e=c.width=innerWidth,b=c.height=innerHeight,d=c.getContext("2d"),n=13,g,h,x,y,z,l,A,B)=>{d.fillStyle="#ffe";d.fillRect(0,0,e,b);r=[];p=8;for(;n--;)t([25*f(),0,25*f()],[0,4,0,0],25,30);[x,y,z,l]=[[[0,44,-40],0,1-S(a/20),2*b],[[0,100-2*a,2*a-110],0,a/40-1,2*b],[[a-46,9,5],a/6,Math.PI/2,b]][a/20%3|0];for([g,h,A,B]of r){d.fillStyle="#000";g=w(y,z,m(x,g,-1));h=w(y,z,m(x,h,-1));1>g[2]||1>h[2]||(d.lineWidth=l/g[2]*A+l/h[2]*B,d.lineCap="round",d.beginPath(),d.moveTo(e/2+l/g[2]*g[0],b/2-l/g[2]*g[1]),d.lineTo(e/2+l/h[2]*h[0],b/2-l/h[2]*h[1]),d.stroke())}};onclick=()=>{k=new AudioContext;c.style.position="fixed";c.style.left=c.style.top=0;q=k.createScriptProcessor(2048,u=0,1);q.connect(k.destination);q.onaudioprocess=(a,e=a.outputBuffer.getChannelData(0),d)=>{for(a in e){d=u+=1/k.sampleRate;d=v[d*k.sampleRate|0]=(d>60?0:Math.max(S(d),0)*S((7e3-(d+30)**2)*d))/3-.8*(v[(d-.5)*k.sampleRate|0]||0);e[a]=d}C(u)}};document.body.firstChild.data="click!"
