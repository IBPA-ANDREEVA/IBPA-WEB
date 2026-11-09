import { and, eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { requireDb } from '../../../lib/db';
import { coreSaleOrders, type SaleOrder } from '../../../lib/schema';
import { stripe } from '../../../services/stripe';
import { requireUuid, safeInternalPath, SaleError } from './sale-validation';

type Db = ReturnType<typeof requireDb>;
export function checkoutReturnPath(value:unknown) {
  if (!safeInternalPath(value) || value.length>1000) return '/dashboard/sales';
  const url=new URL(value,'https://ibpa.invalid');
  // Remove previous return markers so retries cannot retain a stale success state.
  for(const key of ['order','payment','session_id']) url.searchParams.delete(key);
  return url.pathname+url.search+url.hash;
}
function returnUrl(path:string, orderId:string, state:string) {
  const base=process.env.DASHBOARD_URL||process.env.FRONTEND_URL;
  if(!base) throw new SaleError('CHECKOUT_CONFIGURATION',503);
  const url=new URL(path,base);
  url.searchParams.set('order',orderId);url.searchParams.set('payment',state);
  return url.toString();
}
export function sessionMatchesOrder(session:Stripe.Checkout.Session, order:SaleOrder) {
  return session.metadata?.orderKind==='sale' && session.metadata.saleOrderId===order.id &&
    session.metadata.userId===order.userId && session.metadata.saleId===order.saleId &&
    session.client_reference_id===order.id && session.amount_total===order.amount && session.currency===order.currency &&
    (!order.stripeSessionId || session.id===order.stripeSessionId);
}
export async function findOrder(db:Db,id:string,userId?:string):Promise<SaleOrder> {
  requireUuid(id);
  const [order]:SaleOrder[]=await db.select().from(coreSaleOrders).where(and(eq(coreSaleOrders.id,id),userId?eq(coreSaleOrders.userId,userId):undefined)).limit(1);
  if(!order) throw new SaleError('ORDER_NOT_FOUND',404);
  return order;
}
async function attachSession(db:Db,order:SaleOrder,session:Stripe.Checkout.Session) {
  if(!sessionMatchesOrder(session,order)) throw new SaleError('PAYMENT_MISMATCH',409);
  await db.update(coreSaleOrders).set({stripeSessionId:session.id,checkoutUrl:session.url,stripePaymentIntentId:typeof session.payment_intent==='string'?session.payment_intent:null,updatedAt:new Date()})
    .where(and(eq(coreSaleOrders.id,order.id),sql`(${coreSaleOrders.stripeSessionId} IS NULL OR ${coreSaleOrders.stripeSessionId}=${session.id})`));
}
// Recover a session whose creation succeeded at Stripe but whose response was lost.
// Never discard its reservation merely because the local clock has advanced.
export async function reconcileOrder(db:Db,order:SaleOrder) {
  if(order.status!=='PENDING') return order;
  let session:Stripe.Checkout.Session|null=null;
  if(order.stripeSessionId) session=await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  else if(order.expiresAt.getTime()<Date.now()) {
    for await(const candidate of stripe.checkout.sessions.list({created:{gte:Math.floor(order.createdAt.getTime()/1000)-5,lte:Math.floor(order.expiresAt.getTime()/1000)+5},limit:100})) {
      if(candidate.metadata?.saleOrderId===order.id) {session=candidate;break;}
    }
    if(!session) {
      await db.update(coreSaleOrders).set({status:'CANCELED',failureCode:'EXPIRED',updatedAt:new Date()}).where(and(eq(coreSaleOrders.id,order.id),eq(coreSaleOrders.status,'PENDING'),sql`${coreSaleOrders.stripeSessionId} IS NULL`));
      return findOrder(db,order.id);
    }
  }
  if(!session) return order;
  await attachSession(db,order,session);
  if(session.status==='expired') {
    await db.update(coreSaleOrders).set({status:'CANCELED',failureCode:'EXPIRED',updatedAt:new Date()}).where(and(eq(coreSaleOrders.id,order.id),eq(coreSaleOrders.status,'PENDING')));
  }
  // Paid state is owned by signed webhooks. A return URL/retrieval is not fulfillment.
  return findOrder(db,order.id);
}
export async function reconcileExpiredSales(db:Db,saleId?:string) {
  const rows:SaleOrder[]=await db.select().from(coreSaleOrders).where(and(eq(coreSaleOrders.status,'PENDING'),sql`${coreSaleOrders.expiresAt}<now()`,saleId?eq(coreSaleOrders.saleId,saleId):undefined)).limit(100);
  for(const row of rows) await reconcileOrder(db,row);
}
export async function createSaleCheckout(db:Db,input:{saleId:string;userId:string;email:string;requestKey:unknown;returnPath:unknown;locale:unknown}) {
  requireUuid(input.saleId);const key=requireUuid(input.requestKey);
  if(!process.env.STRIPE_SECRET_KEY || !process.env.DASHBOARD_URL && !process.env.FRONTEND_URL) throw new SaleError('CHECKOUT_CONFIGURATION',503);
  await reconcileExpiredSales(db,input.saleId);
  const locale=['en','ru','uk'].includes(String(input.locale))?String(input.locale):'en';
  let id:string;
  try {
    const result=await db.execute(sql`SELECT ibpa.reserve_sale(${input.saleId}::uuid,${input.userId}::uuid,${input.email},${key}::uuid,${checkoutReturnPath(input.returnPath)},${locale}) AS id`);
    id=result.rows[0].id;
  } catch(error) {
    const message=String((error as {cause?:{message?:string}}).cause?.message|| (error as Error).message);
    const code=['SALE_NOT_FOUND','SALE_UNAVAILABLE','REQUEST_CONFLICT','ALREADY_PURCHASED','SOLD_OUT'].find(c=>message.includes(c));
    if(code) throw new SaleError(code,409);
    throw error;
  }
  let order=await findOrder(db,id,input.userId);
  if(order.status!=='PENDING') throw new SaleError(order.status==='PAID'?'ALREADY_PURCHASED':'CHECKOUT_ENDED',409);
  if(order.stripeSessionId) {
    order=await reconcileOrder(db,order);
    if(order.status!=='PENDING'||!order.checkoutUrl) throw new SaleError('PAYMENT_PROCESSING',409);
    return {orderId:order.id,url:order.checkoutUrl};
  }
  // A fixed expiry makes the entire Stripe payload stable for the order's idempotency key.
  // For an old ambiguous creation, recovery above must resolve it before a new attempt.
  if(order.expiresAt.getTime()-Date.now()<31*60*1000) throw new SaleError('PAYMENT_PROCESSING',409);
  const metadata={orderKind:'sale',saleOrderId:order.id,saleId:order.saleId,userId:order.userId};
  const session=await stripe.checkout.sessions.create({
    mode:'payment',payment_method_types:['card'],customer_email:order.buyerEmail,client_reference_id:order.id,
    metadata,payment_intent_data:{metadata},locale:order.locale==='uk'?'en':order.locale as 'en'|'ru',
    line_items:[{price_data:{currency:order.currency,unit_amount:order.amount,product_data:{name:order.itemTitle}},quantity:1}],
    expires_at:Math.floor(order.expiresAt.getTime()/1000),
    success_url:returnUrl(order.returnPath,order.id,'returned'),cancel_url:returnUrl(order.returnPath,order.id,'canceled'),
  },{idempotencyKey:`sale-order-${order.id}`});
  await attachSession(db,order,session);
  if(!session.url) throw new SaleError('PAYMENT_PROCESSING',409);
  return {orderId:order.id,url:session.url};
}
export async function cancelSaleCheckout(db:Db,id:string,userId:string) {
  let order=await findOrder(db,id,userId);
  if(order.status!=='PENDING') return order;
  if(!order.stripeSessionId) return reconcileOrder(db,order);
  const session=await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  if(!sessionMatchesOrder(session,order)) throw new SaleError('PAYMENT_MISMATCH',409);
  if(session.status==='open') await stripe.checkout.sessions.expire(session.id);
  order=await reconcileOrder(db,order);
  return order;
}
export async function handleSaleStripeEvent(db:Db,event:Stripe.Event):Promise<boolean> {
  if(event.type.startsWith('checkout.session.')) {
    const session=event.data.object as Stripe.Checkout.Session;
    if(session.metadata?.orderKind!=='sale') return false;
    const order=await findOrder(db,requireUuid(session.metadata.saleOrderId));
    if(!sessionMatchesOrder(session,order)) throw new SaleError('PAYMENT_MISMATCH',409);
    await attachSession(db,order,session);
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type) && session.payment_status==='paid') {
      await db.update(coreSaleOrders).set({status:sql`CASE WHEN ${coreSaleOrders.refundedAmount}>=${coreSaleOrders.amount} THEN 'REFUNDED' ELSE 'PAID' END`,paidAt:sql`coalesce(${coreSaleOrders.paidAt},${new Date(event.created*1000).toISOString()}::timestamptz)`,failureCode:null,updatedAt:new Date()})
        .where(and(eq(coreSaleOrders.id,order.id),sql`${coreSaleOrders.status}<>'REFUNDED'`));
    } else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)) {
      await db.update(coreSaleOrders).set({status:event.type.endsWith('expired')?'CANCELED':'FAILED',failureCode:event.type.endsWith('expired')?'EXPIRED':'PAYMENT_FAILED',updatedAt:new Date()})
        .where(and(eq(coreSaleOrders.id,order.id),eq(coreSaleOrders.status,'PENDING')));
    }
    return true;
  }
  if(event.type==='charge.refunded') {
    const charge=event.data.object as Stripe.Charge;
    if(!charge.payment_intent) return false;
    const intent=await stripe.paymentIntents.retrieve(typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent.id);
    if(intent.metadata.orderKind!=='sale') return false;
    const order=await findOrder(db,requireUuid(intent.metadata.saleOrderId));
    if(intent.metadata.userId!==order.userId||intent.metadata.saleId!==order.saleId||charge.amount!==order.amount||charge.currency!==order.currency||charge.amount_refunded>order.amount) throw new SaleError('PAYMENT_MISMATCH',409);
    // Maximum refund amount is monotonic: an older partial refund cannot undo a full refund.
    await db.update(coreSaleOrders).set({stripePaymentIntentId:intent.id,refundedAmount:sql`greatest(${coreSaleOrders.refundedAmount},${charge.amount_refunded})`,status:sql`CASE WHEN greatest(${coreSaleOrders.refundedAmount},${charge.amount_refunded}) >= ${coreSaleOrders.amount} THEN 'REFUNDED' ELSE 'PAID' END`,paidAt:sql`coalesce(${coreSaleOrders.paidAt},${new Date(charge.created*1000).toISOString()}::timestamptz)`,updatedAt:new Date()}).where(eq(coreSaleOrders.id,order.id));
    return true;
  }
  if(event.type==='payment_intent.payment_failed') {
    const intent=event.data.object as Stripe.PaymentIntent;
    if(intent.metadata.orderKind!=='sale') return false;
    // A card decline is retryable in the same Checkout session. Keep its reservation.
    await db.update(coreSaleOrders).set({failureCode:'PAYMENT_FAILED',updatedAt:new Date()}).where(and(eq(coreSaleOrders.id,requireUuid(intent.metadata.saleOrderId)),eq(coreSaleOrders.status,'PENDING')));
    return true;
  }
  return false;
}
