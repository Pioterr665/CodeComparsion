import {randomBytes} from 'node:crypto';
import {Row, DIRECTORY, FILE, SYMLINK} from './core';
export interface FolderNode extends Row { name:string; depth:number; parent:string|null; folder:boolean }
export function folderNodes(rows:Row[]):FolderNode[] {
  const map=new Map(rows.map(row=>[row.path,{...row}]));
  for(const row of rows) {
    let path=row.path;
    while(path.includes('/')) {
      path=path.slice(0,path.lastIndexOf('/'));
      if(!map.has(path)) map.set(path,{path,status:'equal'});
      const parent=map.get(path)!;
      if(row.left && !parent.left) parent.left={type:DIRECTORY,size:0};
      if(row.right && !parent.right) parent.right={type:DIRECTORY,size:0};
    }
  }
  const children=new Map<string|null,FolderNode[]>();
  for(const row of map.values()) {
    const split=row.path.lastIndexOf('/');
    const parent=split<0?null:row.path.slice(0,split);
    const node:FolderNode={...row,name:row.path.slice(split+1)||'(root)',depth:row.path?row.path.split('/').length-1:0,parent,folder:[row.left,row.right].some(e=>!!e && !(e.type & SYMLINK) && !!(e.type & DIRECTORY))};
    const list=children.get(parent)??[];list.push(node);children.set(parent,list);
  }
  const output:FolderNode[]=[];
  const stack=[...(children.get(null)??[])].sort(order).reverse();
  while(stack.length) {
    const node=stack.pop()!;output.push(node);
    stack.push(...[...(children.get(node.path)??[])].sort(order).reverse());
  }
  const byPath=new Map(output.map(n=>[n.path,n]));
  for(let i=output.length-1;i>=0;i--) {
    const node=output[i], parent=node.parent===null?undefined:byPath.get(node.parent);
    if(parent && node.status!=='equal' && parent.status==='equal') parent.status='modified';
  }
  return output;
}
function order(a:FolderNode,b:FolderNode) {return Number(b.folder)-Number(a.folder)||a.name.localeCompare(b.name);}
export function canDiff(row:Row) {return row.left?.type===FILE && row.right?.type===FILE && ['equal','modified'].includes(row.status);}
export function folderHtml(rows:Row[],left:string,right:string):string {
  const nonce=randomBytes(18).toString('base64');
  const data=JSON.stringify({nodes:folderNodes(rows),left,right,differences:rows.filter(row=>row.status!=='equal').length}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<title>Compare Results</title><style nonce="${nonce}">
:root{color-scheme:light dark;--border:var(--vscode-panel-border,#3c3c3c);--muted:var(--vscode-descriptionForeground,#b1b1b1);--changed:var(--vscode-gitDecoration-modifiedResourceForeground,#e2c08d);--added:var(--vscode-gitDecoration-addedResourceForeground,#89d185);--removed:var(--vscode-gitDecoration-deletedResourceForeground,#f48771);--warning:var(--vscode-editorWarning-foreground,#cca700)}
*{box-sizing:border-box}body{margin:0;color:var(--vscode-editor-foreground,#cccccc);background:var(--vscode-editor-background,#1e1e1e);font-family:var(--vscode-font-family,system-ui);font-size:var(--vscode-font-size,13px)}
main{height:100vh;display:flex;flex-direction:column}header{padding:16px 20px 12px;background:var(--vscode-sideBar-background,#252526);border-bottom:1px solid var(--border)}.topline{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:15px;font-weight:600;margin:0;display:flex;align-items:center;gap:9px}.compare-mark{color:var(--vscode-focusBorder,#007fd4);font-size:22px}nav{display:flex;gap:4px;flex-wrap:wrap;align-items:center}button{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:4px;padding:5px 9px;cursor:pointer}nav button:first-child{border-color:var(--border)}button:hover{background:var(--vscode-toolbar-hoverBackground,rgba(127,127,127,.18))}button:focus-visible{outline:2px solid var(--vscode-focusBorder,#007fd4);outline-offset:-2px}button[aria-disabled=true]{cursor:default}#summary{margin:10px 0 0;color:var(--muted);line-height:1.5}#help{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.5}#scroll{overflow:auto;flex:1;min-height:0}table{width:100%;min-width:600px;table-layout:fixed;border-collapse:separate;border-spacing:0}caption{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}th{position:sticky;top:0;z-index:1;background:var(--vscode-editorGroupHeader-tabsBackground,#252526);text-align:left;padding:16px 18px 14px;border-bottom:1px solid var(--border);font-weight:normal}th+th,td+td{border-left:1px solid var(--border)}.root-heading{display:flex;align-items:center;gap:10px;min-width:0}.root-icon{width:26px;height:26px;flex:none;color:var(--changed)}.root-meta{min-width:0}.side-name{font-size:10px;letter-spacing:1.2px;color:var(--muted);font-weight:600}.root-name{display:block;font-size:16px;font-weight:600;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.root-path{display:block;color:var(--muted);font-size:11px;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
td{height:30px;padding:0}.cell{height:30px;display:flex;align-items:center;gap:8px;padding-right:14px;position:relative}.cell button{display:flex;align-items:center;gap:6px;text-align:left;min-width:0;flex:1;border:0;border-radius:0;height:100%;padding:0 0 0 14px}.cell button:hover{background:transparent}.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.folder-name{font-weight:600}.indent{height:100%;display:flex;flex-shrink:0;gap:0;margin-right:-6px}.guide{display:block;width:18px;flex:none;height:100%;border-left:1px solid var(--vscode-tree-indentGuidesStroke,#585858);position:relative}.guide:last-child:after{content:'';position:absolute;width:8px;left:0;top:50%;border-top:1px solid var(--vscode-tree-indentGuidesStroke,#585858)}.chevron{width:12px;flex:none;font-size:14px;text-align:center;color:var(--muted)}.entry-icon{width:17px;height:17px;flex:none;color:var(--muted)}.entry-icon.folder{color:var(--changed)}.entry-icon.source{color:var(--vscode-symbolIcon-classForeground,#75beff)}.entry-icon.config{color:var(--changed)}.entry-icon.link{color:var(--vscode-symbolIcon-interfaceForeground,#b180d7)}
tr.status-modified .cell{background:color-mix(in srgb,var(--changed) 6%,transparent)}tr.status-left-only td:first-child .cell{background:color-mix(in srgb,var(--removed) 7%,transparent)}tr.status-right-only td:last-child .cell{background:color-mix(in srgb,var(--added) 7%,transparent)}.label{font-family:var(--vscode-editor-font-family,monospace);font-size:11px;font-weight:600;flex:none;min-width:20px;height:20px;padding:2px 5px;border-radius:3px;text-align:center;color:var(--vscode-editor-foreground,#cccccc);background:color-mix(in srgb,var(--tone,var(--changed)) 10%,transparent)}tr.status-left-only .label{--tone:var(--removed)}tr.status-right-only .label{--tone:var(--added)}tr.status-error .label,tr.status-type-conflict .label,tr.status-too-large .label{--tone:var(--warning)}tr.status-equal .label{background:transparent;color:var(--muted);font-weight:normal}.missing{background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(127,127,127,.035) 5px,rgba(127,127,127,.035) 6px);padding-left:20px;color:var(--muted)}tr:hover td,tr:focus-within td{background:var(--vscode-list-hoverBackground,#2a2d2e)}tr.selected td{background:var(--vscode-list-inactiveSelectionBackground,#37373d)}tr.selected td:first-child{box-shadow:inset 2px 0 var(--vscode-focusBorder,#007fd4)}tr.folder-row .cell{margin-top:3px}#more{margin:12px;border:1px solid var(--border)}#empty{padding:32px;color:var(--muted)}footer{padding:9px 20px;border-top:1px solid var(--border);color:var(--muted);font-size:11px;background:var(--vscode-sideBar-background,#252526)}@media(max-width:600px){header{padding:12px}.topline{gap:8px}nav{gap:0}nav button{font-size:12px;padding:5px 7px}#help{font-size:11px}th{padding:12px}.root-name{font-size:14px}}
</style></head><body><main><header><div class="topline"><h1><span class="compare-mark" aria-hidden="true">⇄</span>Compare Results</h1><nav aria-label="Comparison actions"><button id="refresh">Refresh comparison</button><button id="expand">Expand all</button><button id="collapse">Collapse all</button></nav></div><p id="summary" role="status"></p><p id="help">Folders expand together. Select a paired file to open its diff. — means absent on that side.</p></header><div id="scroll"><table aria-label="Aligned folder comparison"><caption>Two aligned folder trees. Each row represents the same relative path.</caption><thead><tr><th scope="col"><div class="root-heading"><svg class="root-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 10h18"/></svg><div class="root-meta"><span class="side-name">LEFT</span><strong class="root-name" id="left-name"></strong></div></div><span class="root-path" id="left"></span></th><th scope="col"><div class="root-heading"><svg class="root-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 10h18"/></svg><div class="root-meta"><span class="side-name">RIGHT</span><strong class="root-name" id="right-name"></strong></div></div><span class="root-path" id="right"></span></th></tr></thead><tbody id="rows"></tbody></table><p id="empty" hidden>Both folders are empty.</p><button id="more" hidden>Show more rows</button></div><footer>Read-only comparison · Tab to navigate · Enter to expand or open · Arrow keys to move</footer></main>
<script nonce="${nonce}">const data=${data};(${client.toString()})(data);</script></body></html>`;
}
function client(data:any) {
  const api=(window as any).acquireVsCodeApi();
  const nodes:any[]=data.nodes;
  const expanded=new Set<string>(nodes.filter(n=>n.folder&&n.parent===null).map(n=>n.path));
  const labels:Record<string,string>={'equal':'Identical','modified':'Changed','left-only':'Left only','right-only':'Right only','type-conflict':'Type conflict','symlink-skipped':'Link skipped','too-large':'Too large','error':'Error'};
  const get=(id:string)=>document.getElementById(id)!;
  for(const side of ['left','right']) {
    get(side).textContent=data[side];get(side).title=data[side];
    const name=data[side].replace(/\/+$/,'').split('/').pop()||data[side];
    try {get(side+'-name').textContent=decodeURIComponent(name);} catch {get(side+'-name').textContent=name;}
  }
  const changed=data.differences;
  get('summary').textContent=`${nodes.length} paths · ${changed} differences or skipped entries${nodes.some(n=>n.status==='error')?' · Scan errors: inspect marked rows':''}`;
  const marks:Record<string,string>={'equal':'·','modified':'M','left-only':'L','right-only':'R','type-conflict':'!','symlink-skipped':'↗','too-large':'≥','error':'!'};
  let selected:string|undefined;
  function entryIcon(folder:boolean,type:number,name:string) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    const kind=folder?'folder':type&64?'link':/\.(ts|tsx|js|jsx|py|rs|go|css|html)$/.test(name)?'source':/\.(json|ya?ml|toml)$/.test(name)?'config':'file';
    svg.setAttribute('class','entry-icon '+kind);svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.3');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',folder?'M2 5h6l2 2h8v10H2z M2 9h16':kind==='source'?'M7 5 2 10l5 5m6-10 5 5-5 5m-2-12-2 14':kind==='link'?'M8 12 12 8m-5 2-2 2a3 3 0 0 0 4 4l2-2m-2-8 2-2a3 3 0 0 1 4 4l-2 2':'M4 2h8l4 4v12H4z M12 2v5h4 M7 11h6m-6 3h6');
    svg.append(path);return svg;
  }
  let limit=1000;
  function render(focus?:string,side?:string) {
    const visible=new Set<string>();const list:any[]=[];
    for(const n of nodes) {if(n.parent===null || (visible.has(n.parent)&&expanded.has(n.parent))) {visible.add(n.path);list.push(n);}}
    const body=get('rows');body.replaceChildren();
    for(const n of list.slice(0,limit)) {
      const tr=document.createElement('tr');tr.className='status-'+n.status+(n.folder?' folder-row':'')+(selected===n.path?' selected':'');
      for(const which of ['left','right']) {
        const td=document.createElement('td');
        const cell=document.createElement('div');cell.className='cell';
        const entry=n[which];
        if(!entry) {cell.classList.add('missing');cell.textContent=n.status==='error' ? n.name+' · Error' : '—';cell.title=n.detail||'Absent on '+which;cell.setAttribute('aria-label',n.status==='error' ? n.name+': '+n.detail : 'Absent on '+which);}
        else {
          const button=document.createElement('button');button.dataset.path=n.path;button.dataset.side=which;
          const folder=!(entry.type&64)&&!!(entry.type&2);
          const canOpen=n.left?.type===1&&n.right?.type===1&&['equal','modified'].includes(n.status);
          const indent=document.createElement('span');indent.className='indent';indent.setAttribute('aria-hidden','true');
          for(let i=0;i<n.depth;i++){const guide=document.createElement('span');guide.className='guide';indent.append(guide);}
          const chevron=document.createElement('span');chevron.className='chevron';chevron.textContent=folder?(expanded.has(n.path)?'▾':'▸'):'';chevron.setAttribute('aria-hidden','true');
          const name=document.createElement('span');name.className='name'+(folder?' folder-name':'');name.textContent=n.name;
          button.append(indent,chevron,entryIcon(folder,entry.type,n.name),name);
          button.title=n.path+' · '+(labels[n.status]||n.status)+(n.detail?' · '+n.detail:'');
          button.setAttribute('aria-label',which+': '+n.path+', '+(folder?'folder, ':'file, ')+(labels[n.status]||n.status)+(n.binary?', binary':'')+(!folder&&!canOpen?', comparison unavailable':''));
          if(folder) button.setAttribute('aria-expanded',String(expanded.has(n.path)));
          else if(!canOpen) button.setAttribute('aria-disabled','true');
          button.onclick=()=>{
            selected=n.path;
            if(folder) {expanded.has(n.path)?expanded.delete(n.path):expanded.add(n.path);render(n.path,which);}
            else if(canOpen) {render(n.path,which);api.postMessage({type:'open',path:n.path});}
          };
          button.onkeydown=(event)=>{
            const buttons=Array.from(body.querySelectorAll<HTMLButtonElement>('button'));
            const index=buttons.indexOf(button);
            if(event.key==='ArrowDown'||event.key==='ArrowUp') {
              event.preventDefault();const step=event.key==='ArrowDown'?1:-1;
              for(let i=index+step;i>=0&&i<buttons.length;i+=step) if(buttons[i].dataset.side===which){buttons[i].focus();break;}
            } else if(event.key==='ArrowRight'&&folder&&!expanded.has(n.path)){event.preventDefault();expanded.add(n.path);render(n.path,which);}
            else if(event.key==='ArrowLeft'&&folder&&expanded.has(n.path)){event.preventDefault();expanded.delete(n.path);render(n.path,which);}
          };
          cell.append(button);
          const badge=document.createElement('span');badge.className='label';badge.textContent=marks[n.status]||'!';badge.title=(labels[n.status]||n.status)+(n.binary?' · binary':'');badge.setAttribute('aria-label',badge.title);cell.append(badge);
        }
        td.append(cell);tr.append(td);
      }
      body.append(tr);
    }
    get('empty').hidden=nodes.length!==0;
    get('more').hidden=list.length<=limit;get('more').textContent=`Show more rows (${Math.min(limit,list.length)} / ${list.length})`;
    if(focus!==undefined) {
      for(const button of body.querySelectorAll<HTMLButtonElement>('button')) if(button.dataset.path===focus&&button.dataset.side===side) {button.focus();break;}
    }
  }
  get('expand').onclick=()=>{for(const n of nodes)if(n.folder)expanded.add(n.path);render();};
  get('collapse').onclick=()=>{expanded.clear();render();};
  get('refresh').onclick=()=>api.postMessage({type:'refresh'});
  get('more').onclick=()=>{limit+=1000;render();};
  render();
}
