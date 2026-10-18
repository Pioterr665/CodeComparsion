import * as v from 'vscode';
import {folderHtml, canDiff} from './folderView';
import {compare, Cancelled, Row, Reader, FILE, DIRECTORY, SYMLINK} from './core';
const join=(root:v.Uri,path:string)=>path?v.Uri.joinPath(root,...path.split('/')):root;
function reader(root:v.Uri):Reader {
  return {
    list:async path=>{
      const uri=join(root,path), stat=await v.workspace.fs.stat(uri);
      if(stat.type & SYMLINK) throw new Error('Symbolic link skipped');
      return v.workspace.fs.readDirectory(uri);
    },
    stat:async path=>v.workspace.fs.stat(join(root,path)),
    read:async path=>{
      const uri=join(root,path), stat=await v.workspace.fs.stat(uri);
      if(stat.type & SYMLINK) throw new Error('Symbolic link skipped');
      if(stat.size>v.workspace.getConfiguration('codecomparsion').get<number>('maxFileBytes',16777216)) throw new Error('File exceeds read limit');
      return v.workspace.fs.readFile(uri);
    }
  };
}
class Results implements v.TreeDataProvider<Row> {
  private event=new v.EventEmitter<void>();
  onDidChangeTreeData=this.event.event;
  rows:Row[]=[];
  roots?:[v.Uri,v.Uri];
  update(rows:Row[],roots:[v.Uri,v.Uri]) {this.rows=rows;this.roots=roots;this.event.fire();}
  getChildren(row?:Row) {return row?[]:this.rows;}
  getTreeItem(row:Row) {
    const item=new v.TreeItem(row.path||'(root)',v.TreeItemCollapsibleState.None);
    item.description=row.status+(row.binary?' · binary':'');
    item.tooltip=`${row.path}\n${item.description}${row.detail?'\n'+row.detail:''}`;
    item.accessibilityInformation={label:`${row.path||'Root'}: ${item.description}`};
    item.iconPath=new v.ThemeIcon(row.status==='equal'?'check':row.status==='error'?'warning':'diff');
    if(row.left?.type===FILE && row.right?.type===FILE && ['equal','modified'].includes(row.status)) {
      item.command={command:'codecomparsion.open',title:'Open File Comparison',arguments:[row]};
    }
    return item;
  }
  dispose(){this.event.dispose();}
}
export function activate(context:v.ExtensionContext) {
  const results=new Results();
  const view=v.window.createTreeView('codecomparsion.results',{treeDataProvider:results,showCollapseAll:false});
  view.message='Select a file or folder, then choose Compare with Selected on another item.';
  let panel:v.WebviewPanel|undefined;
  let panelMessages:v.Disposable|undefined;
  let selected:v.Uri|undefined;
  let running:v.CancellationTokenSource|undefined;
  let generation=0;
  const source=(uri?:v.Uri)=>uri??v.window.activeTextEditor?.document.uri;
  async function run(a:v.Uri,b:v.Uri) {
    running?.cancel(); const current=++generation;
    const cancel=new v.CancellationTokenSource();running=cancel;
    try {
      const [l,r]=await Promise.all([v.workspace.fs.stat(a),v.workspace.fs.stat(b)]);
      if((l.type|r.type)&SYMLINK) throw new Error('Symbolic links are skipped. Select the original file or folder.');
      if(l.type===FILE && r.type===FILE) {
        await v.commands.executeCommand('vscode.diff',a,b,`${v.workspace.asRelativePath(a)} ↔ ${v.workspace.asRelativePath(b)}`);return;
      }
      if(l.type!==DIRECTORY || r.type!==DIRECTORY) throw new Error('Select two files or two folders of the same type.');
      await v.window.withProgress({location:v.ProgressLocation.Notification,title:'CodeComparsion: comparing folders',cancellable:true},async(_,token)=>{
        const sub=token.onCancellationRequested(()=>cancel.cancel());
        try {
          const config=v.workspace.getConfiguration('codecomparsion');
          const rows=await compare(reader(a),reader(b),{maxBytes:config.get('maxFileBytes',16777216),maxEntries:config.get('maxEntries',50000),cancelled:()=>cancel.token.isCancellationRequested});
          if(current!==generation || cancel.token.isCancellationRequested) return;
          results.update(rows,[a,b]);
          const different=rows.filter(x=>x.status!=='equal').length;
          view.message=`Left: ${a.toString(true)}\nRight: ${b.toString(true)}\n${different} differences / ${rows.length} entries. Refresh to rescan.`;
          view.description=different?'Differences found':'No differences found';
          if(!panel) {
            panel=v.window.createWebviewPanel('codecomparsion.folderCompare','Compare Results',v.ViewColumn.Active,{enableScripts:true,localResourceRoots:[],retainContextWhenHidden:true});
            const created=panel;
            context.subscriptions.push(created,created.onDidDispose(()=>{if(panel===created){panel=undefined;panelMessages?.dispose();panelMessages=undefined;}}));
          }
          panelMessages?.dispose();
          const snapshot=new Map(rows.map(row=>[row.path,row]));
          panelMessages=panel.webview.onDidReceiveMessage(async(message:unknown)=>{
            if(!message || typeof message!=='object') return;
            const msg=message as {type?:unknown;path?:unknown};
            if(msg.type==='refresh') {await run(a,b);return;}
            if(msg.type==='open' && typeof msg.path==='string') {
              const row=snapshot.get(msg.path);
              if(row && canDiff(row)) await run(join(a,row.path),join(b,row.path));
            }
          });
          panel.webview.html=folderHtml(rows,a.toString(true),b.toString(true));
          panel.reveal(v.ViewColumn.Active);
        } finally {sub.dispose();}
      });
    } catch(e) {if(!(e instanceof Cancelled)) void v.window.showErrorMessage(`CodeComparsion: ${e instanceof Error?e.message:String(e)}`);}
    finally {if(running===cancel) running=undefined;cancel.dispose();}
  }
  context.subscriptions.push(results,view,{dispose:()=>{running?.cancel();running?.dispose();panelMessages?.dispose();}},
    v.commands.registerCommand('codecomparsion.select',async(uri?:v.Uri)=>{
      selected=source(uri);if(!selected) {void v.window.showInformationMessage('Select a file or folder in Explorer first.');return;}
      await v.commands.executeCommand('setContext','codecomparsion.hasSelection',true);
      v.window.setStatusBarMessage(`CodeComparsion selected: ${selected.toString(true)}`,5000);
    }),
    v.commands.registerCommand('codecomparsion.compare',async(uri?:v.Uri)=>{
      const target=source(uri);if(!selected||!target) {void v.window.showInformationMessage('Use Select for Compare on the first file or folder.');return;}
      await run(selected,target);
    }),
    v.commands.registerCommand('codecomparsion.refresh',async()=>{if(results.roots) await run(...results.roots);}),
    v.commands.registerCommand('codecomparsion.open',async(row:Row)=>{
      if(!row || !results.roots || row.left?.type!==FILE || row.right?.type!==FILE) return;
      await run(join(results.roots[0],row.path),join(results.roots[1],row.path));
    })
  );
}
