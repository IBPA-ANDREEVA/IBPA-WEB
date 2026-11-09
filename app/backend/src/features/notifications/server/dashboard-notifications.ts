import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireDb } from '../../../lib/db';
import { coreEvents,coreNotifications,coreSales,coreNotificationReceipts } from '../../../lib/schema';
import { requireUuid,SaleError,safeExternalUrl,safeInternalPath,textField,translations } from '../../sales/server/sale-validation';
type Db=ReturnType<typeof requireDb>;
export type NotificationViewer={clerkId:string;userId:string|null;email:string;role:string};
export function notificationVisible(n:{type:string;visibility:string;recipients:Record<string,unknown>},v:NotificationViewer) {
  const strings=(x:unknown)=>Array.isArray(x)?x.filter((s):s is string=>typeof s==='string'):[];
  return n.type==='DASHBOARD' && (['ALL','PUBLIC'].includes(n.visibility)||strings(n.recipients.userIds).includes(v.userId||'')||strings(n.recipients.emails).some(e=>e.toLowerCase()===v.email.toLowerCase())||strings(n.recipients.roles).some(r=>r.toUpperCase()===v.role.toUpperCase()));
}
export function visibleWhere(v:NotificationViewer) {
  return and(eq(coreNotifications.type,'DASHBOARD'),sql`(
    ${coreNotifications.visibility} IN ('ALL','PUBLIC') OR
    ${coreNotifications.recipients}->'userIds' @> ${JSON.stringify(v.userId?[v.userId]:[])}::jsonb AND ${v.userId!==null} OR
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(${coreNotifications.recipients}->'emails','[]')) e WHERE lower(e)=${v.email.toLowerCase()} AND ${v.email!==''}) OR
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(${coreNotifications.recipients}->'roles','[]')) r WHERE upper(r)=${v.role.toUpperCase()})
  )`);
}
export async function listDashboardNotifications(db:Db,v:NotificationViewer,options:{page?:number;id?:string;filter?:string;category?:string}) {
  const page=Math.max(1,Math.min(options.page||1,100000));
  const read=sql`(${coreNotificationReceipts.readAt} IS NOT NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(${coreNotifications.metadata}->'readBy','[]')) e WHERE lower(e)=${v.email.toLowerCase()} AND ${v.email!==''}))`;
  const where=and(visibleWhere(v),options.id?eq(coreNotifications.id,requireUuid(options.id)):undefined,options.category?eq(coreNotifications.category,options.category):undefined,options.filter==='unread'?sql`NOT ${read}`:options.filter==='read'?read:undefined);
  const join=and(eq(coreNotificationReceipts.notificationId,coreNotifications.id),eq(coreNotificationReceipts.clerkUserId,v.clerkId));
  const [rows,[count],[unread]] = await Promise.all([
    db.select({n:coreNotifications,r:coreNotificationReceipts,isRead:read}).from(coreNotifications).leftJoin(coreNotificationReceipts,join).where(where).orderBy(desc(coreNotifications.createdAt),desc(coreNotifications.id)).limit(50).offset((page-1)*50),
    db.select({total:sql<number>`count(*)::int`}).from(coreNotifications).leftJoin(coreNotificationReceipts,join).where(where),
    db.select({count:sql<number>`count(*)::int`}).from(coreNotifications).leftJoin(coreNotificationReceipts,join).where(and(visibleWhere(v),sql`NOT ${read}`)),
  ]);
  return {notifications:rows.map(({n,r,isRead}:{n:typeof coreNotifications.$inferSelect;r:typeof coreNotificationReceipts.$inferSelect|null;isRead:boolean})=>({id:n.id,title:n.title,description:n.message,timestamp:n.createdAt,unread:!isRead,category:n.category,actionType:n.actionType,linkedSaleId:n.linkedSaleId,linkedEventId:n.linkedEventId,translations:n.translations,ctaLabel:n.metadata.ctaLabel||null,ctaUrl:n.metadata.ctaUrl||null,toasted:Boolean(r?.toastedAt)})),total:count.total,unreadCount:unread.count,page,pageSize:50};
}
export async function updateNotificationReceipts(db:Db,v:NotificationViewer,body:Record<string,unknown>) {
  const toast=body.mode==='toast';
  if(body.ids!=null && (!Array.isArray(body.ids)||body.ids.length>500)) throw new SaleError('INVALID_ID');
  const ids=(body.ids as unknown[]|undefined)?.map(requireUuid)||[];
  if(!ids.length && body.all!==true) throw new SaleError('INVALID_ID');
  if(toast&&!ids.length) throw new SaleError('INVALID_ID');
  const where=and(visibleWhere(v),ids.length?sql`${coreNotifications.id} IN (${sql.join(ids.map(id=>sql`${id}::uuid`),sql`,`)})`:undefined);
  const result=await db.execute(sql`
    INSERT INTO ibpa.notification_receipts(notification_id,clerk_user_id,read_at,toasted_at)
    SELECT ${coreNotifications.id},${v.clerkId},${toast?sql`NULL::timestamptz`:sql`now()`},${toast?sql`now()`:sql`NULL::timestamptz`}
    FROM ${coreNotifications} WHERE ${where}
    ON CONFLICT(notification_id,clerk_user_id) DO UPDATE SET
      read_at=coalesce(ibpa.notification_receipts.read_at,excluded.read_at),
      toasted_at=coalesce(ibpa.notification_receipts.toasted_at,excluded.toasted_at)
    ${toast?sql`WHERE ibpa.notification_receipts.toasted_at IS NULL`:sql``}
    RETURNING notification_id
  `);
  return {success:true,updatedIds:result.rows.map((r:{notification_id:string})=>r.notification_id)};
}
export async function sendDashboardNotification(db:Db,body:Record<string,unknown>) {
  const title=textField(body.title,'title',255,true),description=textField(body.description,'description',20000,true);
  if(!Array.isArray(body.emails)||body.emails.length<1||body.emails.length>10000||body.emails.some(e=>typeof e!=='string'||e.length>255||!/^\S+@\S+\.\S+$/.test(e))) throw new SaleError('INVALID_RECIPIENTS');
  const emails=[...new Set((body.emails as string[]).map(e=>e.trim().toLowerCase()))];
  const ctaUrl=textField(body.ctaUrl,'ctaUrl',2000)||null,ctaLabel=textField(body.ctaLabel,'ctaLabel',80)||null;
  const actionType=String(body.actionType??(ctaUrl?(safeInternalPath(ctaUrl)?'INTERNAL':'EXTERNAL'):'NONE'));
  if(!['NONE','INTERNAL','EXTERNAL','SALE','EVENT'].includes(actionType)) throw new SaleError('INVALID_ACTION');
  if(actionType==='INTERNAL'&&!safeInternalPath(ctaUrl)||actionType==='EXTERNAL'&&!safeExternalUrl(ctaUrl)) throw new SaleError('INVALID_URL');
  let linkedSaleId:string|null=null,linkedEventId:string|null=null;
  if(actionType==='SALE') {
    linkedSaleId=requireUuid(body.linkedSaleId);
    const [sale]=await db.select().from(coreSales).where(and(eq(coreSales.id,linkedSaleId),eq(coreSales.status,'PUBLISHED'))).limit(1);
    if(!sale) throw new SaleError('SALE_UNAVAILABLE');
  }
  if(actionType==='EVENT') {
    linkedEventId=requireUuid(body.linkedEventId);
    const [event]=await db.select().from(coreEvents).where(and(eq(coreEvents.id,linkedEventId),eq(coreEvents.publishToDashboard,true))).limit(1);
    if(!event) throw new SaleError('EVENT_UNAVAILABLE');
  }
  const category=String(body.category||'admin');
  if(!['membership','certificate','content','admin','system','sale','event'].includes(category)) throw new SaleError('INVALID_CATEGORY');
  const id=body.requestKey?requireUuid(body.requestKey):crypto.randomUUID();
  const values={id,title,message:description,type:'DASHBOARD',visibility:'TARGETED',recipients:{emails},actionType,linkedSaleId,linkedEventId,category,translations:translations(body.translations),metadata:{ctaLabel,ctaUrl:['INTERNAL','EXTERNAL'].includes(actionType)?ctaUrl:null,readBy:[]}};
  const [created]=await db.insert(coreNotifications).values(values).onConflictDoNothing().returning();
  if(!created) {
    const [existing]=await db.select().from(coreNotifications).where(eq(coreNotifications.id,id));
    if(existing?.title!==title||existing?.message!==description||JSON.stringify(existing?.recipients)!==JSON.stringify({emails})) throw new SaleError('REQUEST_CONFLICT',409);
  }
  return {id,count:emails.length,success:true};
}
