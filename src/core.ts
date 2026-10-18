export const FILE = 1, DIRECTORY = 2, SYMLINK = 64;
export interface Entry { type: number; size: number }
export interface Reader {
  list(path: string): Promise<[string, number][]>;
  stat(path: string): Promise<Entry>;
  read(path: string): Promise<Uint8Array>;
}
export interface Options { maxBytes: number; maxEntries: number; cancelled(): boolean }
export type Status = 'equal' | 'modified' | 'left-only' | 'right-only' | 'type-conflict' | 'symlink-skipped' | 'too-large' | 'error';
export interface Row { path: string; status: Status; left?: Entry; right?: Entry; binary?: boolean; detail?: string }
export class Cancelled extends Error {}
function check(o: Options) { if(o.cancelled()) throw new Cancelled('Comparison cancelled'); }
export function binary(bytes: Uint8Array): boolean { return bytes.subarray(0,8192).includes(0); }
export async function compare(left: Reader, right: Reader, o: Options): Promise<Row[]> {
  async function scan(fs: Reader) {
    const entries = new Map<string, Entry>();
    const errors = new Map<string,string>();
    const queue = [''];
    while(queue.length) {
      check(o);
      const dir = queue.pop()!;
      try {
        const children = await fs.list(dir); check(o);
        for(const [name,type] of children) {
          check(o);
          if(!name || name === '.' || name === '..' || name.includes('/')) throw new Error('Invalid provider entry');
          const path = dir ? `${dir}/${name}` : name;
          if(entries.size >= o.maxEntries) throw new Error(`Entry limit (${o.maxEntries}) reached; results incomplete`);
          entries.set(path,{type,size:0});
          if(type & SYMLINK) continue;
          if(type & DIRECTORY) queue.push(path);
          else if(type & FILE) {
            try { const stat = await fs.stat(path); entries.set(path,stat); }
            catch(e) { errors.set(path,String(e)); }
          }
        }
      } catch(e) { if(e instanceof Cancelled) throw e; errors.set(dir,String(e)); if(entries.size >= o.maxEntries) break; }
    }
    return {entries,errors};
  }
  const a = await scan(left), b = await scan(right);
  const paths = [...new Set([...a.entries.keys(),...b.entries.keys(),...a.errors.keys(),...b.errors.keys()])].sort();
  const rows: Row[] = [];
  for(const path of paths) {
    check(o);
    const l=a.entries.get(path),r=b.entries.get(path);
    const row: Row={path,status:'equal',left:l,right:r};
    if(a.errors.has(path)||b.errors.has(path)) {row.status='error';row.detail=[a.errors.get(path),b.errors.get(path)].filter(Boolean).join('; ');}
    else if(((l?.type??0)|(r?.type??0)) & SYMLINK) row.status='symlink-skipped';
    else if(!l) row.status='right-only';
    else if(!r) row.status='left-only';
    else if(l.type!==r.type) row.status='type-conflict';
    else if(l.type & DIRECTORY) row.status='equal';
    else if(!(l.type & FILE)) {row.status='error'; row.detail='Unsupported file type';}
    else if(Math.max(l.size,r.size)>o.maxBytes) row.status='too-large';
    else {
      try {
        const x=await left.read(path);check(o);
        const y=await right.read(path);check(o);
        row.binary=binary(x)||binary(y);
        row.status=x.length===y.length && x.every((v,i)=>v===y[i])?'equal':'modified';
      } catch(e) {if(e instanceof Cancelled) throw e;row.status='error';row.detail=String(e);}
    }
    rows.push(row);
  }
  return rows;
}
