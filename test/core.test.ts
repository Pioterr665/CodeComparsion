import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compare,Cancelled,Reader,FILE,DIRECTORY,SYMLINK,binary} from '../src/core';
function fs(data:Record<string,string|number>, fail?:string):Reader {
 return {list:async p=>Object.keys(data).filter(k=>k.startsWith(p?p+'/':'') && !k.slice(p?p.length+1:0).includes('/')).map(k=>[k.split('/').pop()!,typeof data[k]==='number'?data[k] as number:FILE]),stat:async p=>({type:typeof data[p]==='number'?data[p] as number:FILE,size:typeof data[p]==='string'?Buffer.byteLength(data[p] as string):0}),read:async p=>{if(p===fail)throw Error('denied');return Buffer.from(data[p] as string);}};
}
const options={maxBytes:100,maxEntries:100,cancelled:()=>false};
test('recursive union, content, empty directories and type conflicts',async()=>{
 const rows=await compare(fs({same:'a',changed:'aa',left:'x',sub:DIRECTORY,'sub/deep':'a',empty:DIRECTORY,conflict:FILE}),fs({same:'a',changed:'bb',right:'x',sub:DIRECTORY,'sub/deep':'b',conflict:DIRECTORY}),options);
 assert.deepEqual(Object.fromEntries(rows.map(r=>[r.path,r.status])),{changed:'modified',conflict:'type-conflict',empty:'left-only',left:'left-only',right:'right-only',same:'equal',sub:'equal','sub/deep':'modified'});
});
test('skips links without following them and limits reads',async()=>{
 const rows=await compare(fs({link:SYMLINK|DIRECTORY,large:'a'.repeat(101)}),fs({link:SYMLINK|DIRECTORY,large:'x'}),options);
 assert.equal(rows[0].status,'too-large');assert.equal(rows[1].status,'symlink-skipped');
});
test('reports binary content and read errors',async()=>{
 const rows=await compare(fs({bin:'\0a',bad:'a'},'bad'),fs({bin:'\0b',bad:'b'}),options);
 assert.equal(rows[0].status,'error');assert.equal(rows[1].binary,true);assert.equal(rows[1].status,'modified');assert.equal(binary(Buffer.from('text')),false);
});
test('cancellation propagates',async()=>{await assert.rejects(compare(fs({}),fs({}),{...options,cancelled:()=>true}),Cancelled);});
test('scan errors remain visible',async()=>{
 const broken={...fs({}),list:async()=>{throw Error('denied');}};
 assert.equal((await compare(broken,fs({}),options))[0].status,'error');
});
test('entry budget produces incomplete-results warning',async()=>{
 const rows=await compare(fs({a:'a',b:'b'}),fs({}),{...options,maxEntries:1});
 assert.ok(rows.some(r=>r.status==='error'&&r.detail?.includes('incomplete')));
});
test('cancel after async read discards partial results',async()=>{
 let stop=false;const left={...fs({a:'x'}),read:async()=>{stop=true;return Buffer.from('x');}};
 await assert.rejects(compare(left,fs({a:'x'}),{...options,cancelled:()=>stop}),Cancelled);
});

test('identical empty directories are retained for the two-tree view',async()=>{
 const rows=await compare(fs({empty:DIRECTORY}),fs({empty:DIRECTORY}),options);
 assert.equal(rows.length,1);assert.equal(rows[0].path,'empty');assert.equal(rows[0].status,'equal');
});
