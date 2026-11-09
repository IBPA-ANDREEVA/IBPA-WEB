import { NextRequest } from 'next/server';
import { salesApiProxy } from '@/lib/sales-api-proxy';
async function handle(req:NextRequest,context:{params:Promise<{path?:string[]}>}) {
 const {path=[]}=await context.params;
 return salesApiProxy(req,path.length?'/'+path.map(encodeURIComponent).join('/'):'',true);
}
export {handle as GET,handle as POST,handle as PATCH};
