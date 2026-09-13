/** Resolve bundled assets under either a domain root or a GitHub Pages subpath. */
export function publicAssetPath(path:string, base?:string):string {
  const root=base??(typeof document==='undefined'?'https://app.local/':document.baseURI);
  return new URL(path.replace(/^\/+/,''),root).pathname;
}
