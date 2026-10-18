import {test} from 'node:test';
import assert from 'node:assert/strict';
import {folderNodes,folderHtml,canDiff} from '../src/folderView';
import {Row} from '../src/core';
const file={type:1,size:1},dir={type:2,size:0};
test('aligned pre-order tree, ancestors, one-sided files and aggregate changes',()=>{
 const rows:Row[]=[{path:'src/a',status:'modified',left:file,right:file},{path:'src/only',status:'left-only',left:file},{path:'empty',status:'equal',left:dir,right:dir}];
 const nodes=folderNodes(rows);
 assert.deepEqual(nodes.map(n=>n.path),['empty','src','src/a','src/only']);
 assert.equal(nodes[1].status,'modified');assert.equal(nodes[2].depth,1);assert.equal(nodes[2].parent,'src');assert.equal(nodes[3].right,undefined);
 assert.equal(canDiff(rows[0]),true);assert.equal(canDiff(rows[1]),false);
});
test('type conflict keeps folder children and symlinks are not folders',()=>{
 const nodes=folderNodes([{path:'conflict',status:'type-conflict',left:file,right:dir},{path:'conflict/child',status:'right-only',right:file},{path:'link',status:'symlink-skipped',left:{type:66,size:0}}]);
 assert.equal(nodes[0].folder,true);assert.equal(nodes[1].path,'conflict/child');assert.equal(nodes[2].folder,false);
});
test('HTML safely embeds filenames, blocks arbitrary resources and includes empty state',()=>{
 const html=folderHtml([{path:'</script><img src=x>',status:'left-only',left:file}],'<left>','right');
 assert.ok(!html.includes('</script><img'));assert.ok(html.includes('\\u003c/script>'));assert.ok(html.includes("default-src 'none'"));assert.ok(!html.includes("'unsafe-inline'"));assert.ok(html.includes('Both folders are empty.'));
});
