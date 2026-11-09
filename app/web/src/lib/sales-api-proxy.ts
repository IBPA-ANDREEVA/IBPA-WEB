import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from './admin-api-auth';
import { getServerBackendUrl } from './backend-url';
export async function salesApiProxy(req:NextRequest,path:string,admin=false) {
  let base:string,headers:Record<string,string>;
  if(admin) {
    const access=await requireAdminApi(req);if(!access.ok)return access.response;
    base=access.backendUrl;headers=access.authHeaders;
  } else {
    const session=await auth();if(!session.userId)return NextResponse.json({code:'UNAUTHORIZED'},{status:401});
    const token=await session.getToken();if(!token)return NextResponse.json({code:'UNAUTHORIZED'},{status:401});
    base=getServerBackendUrl()||'';headers={Authorization:`Bearer ${token}`};
  }
  if(!base)return NextResponse.json({code:'SALES_ERROR'},{status:503});
  try {
    const response=await fetch(`${base}/api/${admin?'admin':'dashboard'}/sales${path}${req.nextUrl.search}`,{
      method:req.method,headers:{...headers,'Content-Type':'application/json'},cache:'no-store',
      body:['GET','HEAD'].includes(req.method)?undefined:await req.text(),signal:AbortSignal.timeout(30000),
    });
    const data=await response.json().catch(()=>({code:'SALES_ERROR'}));
    return NextResponse.json(data,{status:response.status,headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({code:'SALES_ERROR'},{status:502});}
}
