export const commandsMap=new Map<string,Function>();
export const executed:any[][]=[];
export const nodes=new Map<string,{type:number,content?:string}>();
export class Uri {
 constructor(public path:string){}
 static joinPath(root:Uri,...parts:string[]){return new Uri(root.path+'/'+parts.join('/'));}
 toString(){return this.path;}
}
export class EventEmitter<T>{event=()=>({dispose(){}});fire(){}dispose(){}}
export class TreeItem {constructor(public label:string,public collapsibleState:number){}}
export class ThemeIcon {constructor(public id:string){}}
export const TreeItemCollapsibleState={None:0};
export const ProgressLocation={Notification:1};
export class CancellationTokenSource {
 token={isCancellationRequested:false};cancel(){this.token.isCancellationRequested=true;}dispose(){}
}
export const commands={registerCommand:(id:string,fn:Function)=>{commandsMap.set(id,fn);return {dispose(){}};},executeCommand:async(...args:any[])=>{executed.push(args);}};
export const errors:string[]=[];
export let provider:any;
export const ViewColumn={Active:-1};
export const panels:any[]=[];
export const window={
 createWebviewPanel:()=>{
   const panel:any={message:async()=>{},webview:{html:'',onDidReceiveMessage:(fn:Function)=>{panel.message=fn;return {dispose(){panel.message=async()=>{};}};}},reveal(){},onDidDispose:()=>({dispose(){}}),dispose(){}};
   panels.push(panel);return panel;
 },
 activeTextEditor:undefined,
 createTreeView:(_:string,opts:any)=>{provider=opts.treeDataProvider;return {message:'',description:'',dispose(){}};},
 showErrorMessage:async(s:string)=>errors.push(s),showInformationMessage:async()=>{},setStatusBarMessage:()=>{},
 withProgress:async(_:any,fn:Function)=>fn({}, {onCancellationRequested:()=>({dispose(){}})})
};
export const workspace={
 asRelativePath:(u:Uri)=>u.path,
 getConfiguration:()=>({get:(_:string,fallback:any)=>fallback}),
 fs:{stat:async(u:Uri)=>{const n=nodes.get(u.path);if(!n)throw Error('Missing');return {type:n.type,size:n.content?.length??0};},
 readFile:async(u:Uri)=>Buffer.from(nodes.get(u.path)?.content??''),
 readDirectory:async(u:Uri)=>[...nodes].filter(([p])=>p.startsWith(u.path+'/')&&!p.slice(u.path.length+1).includes('/')).map(([p,n])=>[p.slice(u.path.length+1),n.type])}
};
