/** Dependency-free local development server. The browser loads pinned Three.js from jsDelivr. */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export function createLocalServer(root=ROOT){
  return http.createServer(async(req,res)=>{
    const send=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(text);};
    if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(405,'Method not allowed');return;}
    try{
      const parsed=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(parsed.pathname);
      if(pathname.includes('\0')||pathname.includes('\\')){send(400,'Invalid path');return;}
      if(pathname==='/')pathname='/index.html';
      const base=await fs.realpath(root),candidate=path.resolve(base,'.'+pathname);
      if(!candidate.startsWith(base+path.sep)){send(403,'Forbidden');return;}
      const actual=await fs.realpath(candidate);
      if(!actual.startsWith(base+path.sep)){send(403,'Forbidden');return;}
      const info=await fs.stat(actual);if(!info.isFile()){send(404,'Not found');return;}
      res.writeHead(200,{'Content-Type':TYPES[path.extname(actual)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      if(req.method==='HEAD'){res.end();return;}res.end(await fs.readFile(actual));
    }catch(error){if(!res.headersSent)send(error instanceof URIError?400:404,'Not found');else res.end();}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||5173);
  if(!Number.isInteger(port)||port<1||port>65535){console.error('PORT must be an integer from 1 to 65535.');process.exit(1);}
  const host=process.env.HOST||'127.0.0.1';
  const server=createLocalServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Stop the other server or set PORT to a different port.`:error.message);process.exitCode=1;});
  server.listen(port,host,()=>{console.log(`\nLUDO STUDIO · Group 1 · Project 7\nOpen http://localhost:${port}\nKeep this terminal open. Internet access is required for the pinned Three.js CDN file. Press Ctrl+C to stop.\n`);});
}
