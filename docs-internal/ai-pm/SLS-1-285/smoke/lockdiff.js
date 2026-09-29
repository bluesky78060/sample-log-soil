const [a,b]=process.argv.slice(2).map(f=>require(f).packages);
const keys=new Set([...Object.keys(a),...Object.keys(b)]);
for(const k of keys){const x=a[k],y=b[k];
 if(!x) console.log('ADDED',k,y.version);
 else if(!y) console.log('REMOVED',k,x.version);
 else if(x.version!==y.version||x.integrity!==y.integrity||x.resolved!==y.resolved) console.log('CHANGED',k,x.version,'->',y.version);}
