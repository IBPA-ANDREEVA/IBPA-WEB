import { Router, type RequestHandler } from 'express';
import { requireDb } from '../lib/db';
import { adminClerkMiddleware,requireAdminAccess } from '../services/admin';
import { getAuth } from '../services/clerk';
import { requireDashboardAccess } from './dashboard';
import { getSale,listSales,saveSale,saleStats,listSaleOrders } from '../features/sales/server/sale.service';
import { createSaleCheckout,findOrder,cancelSaleCheckout,reconcileExpiredSales,reconcileOrder } from '../features/sales/server/sale-checkout.service';
import { SaleError,requireUuid } from '../features/sales/server/sale-validation';
import { coreSales } from '../lib/schema';
import { eq } from 'drizzle-orm';

export const adminSalesRouter=Router();
export const dashboardSalesRouter=Router();
const endpoint=(handler:RequestHandler):RequestHandler=>async(req,res,next)=>{
  try {res.set('Cache-Control','private, no-store');await handler(req,res,next);} catch(error) {
    if(error instanceof SaleError) {res.status(error.status).json({error:error.code,code:error.code,field:error.field});return;}
    console.error('[Sales]',error);res.status(500).json({error:'SALES_ERROR',code:'SALES_ERROR'});
  }
};
const page=(value:unknown)=>Math.max(1,Math.min(100000,Math.floor(Number(value)||1)));
adminSalesRouter.use(adminClerkMiddleware,requireAdminAccess);
adminSalesRouter.get('/',endpoint(async(req,res)=>{res.json({...await listSales(requireDb(),{q:String(req.query.q||''),status:String(req.query.status||''),page:page(req.query.page)},undefined,true),stats:await saleStats(requireDb())});}));
adminSalesRouter.get('/orders',endpoint(async(req,res)=>{res.json(await listSaleOrders(requireDb(),undefined,page(req.query.page),String(req.query.status||'')||undefined));}));
adminSalesRouter.post('/reconcile',endpoint(async(_req,res)=>{await reconcileExpiredSales(requireDb());res.json({success:true});}));
adminSalesRouter.get('/:id',endpoint(async(req,res)=>{res.json({item:await getSale(requireDb(),String(req.params.id),undefined,true)});}));
adminSalesRouter.post('/',endpoint(async(req,res)=>{res.status(201).json({item:await saveSale(requireDb(),req.body||{})});}));
adminSalesRouter.patch('/:id',endpoint(async(req,res)=>{res.json({item:await saveSale(requireDb(),req.body||{},String(req.params.id))});}));
adminSalesRouter.post('/:id/duplicate',endpoint(async(req,res)=>{
  const db=requireDb();const id=requireUuid(req.params.id);
  const [sale]=await db.select().from(coreSales).where(eq(coreSales.id,id)).limit(1);
  if(!sale) throw new SaleError('SALE_NOT_FOUND',404);
  res.status(201).json({item:await saveSale(db,{...sale,status:'DRAFT',title:sale.title,startsAt:null,expiresAt:null})});
}));
dashboardSalesRouter.use(adminClerkMiddleware,endpoint(async(req,res,next)=>{
  const auth=getAuth(req);if(!auth.userId) {res.status(401).json({code:'UNAUTHORIZED'});return;}
  const access=await requireDashboardAccess(auth.userId,auth.sessionClaims);
  if(!access?.canonicalUser || access.canonicalUser.status!=='ACTIVE') {res.status(403).json({code:'ACCESS_DENIED'});return;}
  res.locals.saleUser=access.canonicalUser;next();
}));
dashboardSalesRouter.get('/',endpoint(async(req,res)=>{res.json(await listSales(requireDb(),{q:String(req.query.q||''),category:String(req.query.category||''),page:page(req.query.page)},res.locals.saleUser.id));}));
dashboardSalesRouter.get('/orders',endpoint(async(req,res)=>{res.json(await listSaleOrders(requireDb(),res.locals.saleUser.id,page(req.query.page)));}));
dashboardSalesRouter.get('/orders/:id',endpoint(async(req,res)=>{
  const db=requireDb();const order=await reconcileOrder(db,await findOrder(db,String(req.params.id),res.locals.saleUser.id));
  res.json({order:{...order,requestKey:undefined,checkoutUrl:undefined}});
}));
dashboardSalesRouter.post('/orders/:id/cancel',endpoint(async(req,res)=>{const order=await cancelSaleCheckout(requireDb(),String(req.params.id),res.locals.saleUser.id);res.json({order:{...order,requestKey:undefined,checkoutUrl:undefined}});}));
dashboardSalesRouter.get('/:id',endpoint(async(req,res)=>{res.json({item:await getSale(requireDb(),String(req.params.id),res.locals.saleUser.id)});}));
dashboardSalesRouter.post('/:id/checkout',endpoint(async(req,res)=>{
  const user=res.locals.saleUser;
  res.json(await createSaleCheckout(requireDb(),{saleId:String(req.params.id),userId:user.id,email:user.email,requestKey:req.body?.requestKey,returnPath:req.body?.returnPath,locale:req.body?.locale}));
}));
