import type { SaleTranslations } from '../../../lib/schema';
import { normalizeContentImageMetadata } from '../../content/image-metadata';

export class SaleError extends Error {
  constructor(public code: string, public status = 400, public field?: string) { super(code); }
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireUuid(value: unknown) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new SaleError('INVALID_ID');
  return value;
}
export function safeInternalPath(value: unknown): value is string {
  return typeof value === 'string' && /^\/dashboard(?:[/?#]|$)/.test(value) && !/[\\\u0000-\u0020]/.test(value) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(value);
}
export function safeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || /[\\\u0000-\u0020]/.test(value)) return false;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
export function textField(value: unknown, field: string, max: number, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new SaleError('INVALID_FIELD',400,field);
  return value.trim();
}
function minor(value: unknown, field: string, optional = false) {
  if (optional && value == null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 50 || value > 99999999) throw new SaleError('INVALID_PRICE',400,field);
  return value;
}
export function translations(value: unknown): SaleTranslations {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new SaleError('INVALID_FIELD',400,'translations');
  const result: SaleTranslations = {};
  for (const [locale, content] of Object.entries(value)) {
    if (!['en','ru','uk'].includes(locale) || !content || typeof content !== 'object' || Array.isArray(content)) throw new SaleError('INVALID_FIELD',400,'translations');
    const c = content as Record<string,unknown>;
    result[locale as keyof SaleTranslations] = {
      title:textField(c.title,'translations',255), shortDescription:textField(c.shortDescription,'translations',600),
      description:textField(c.description,'translations',20000), ctaLabel:textField(c.ctaLabel,'translations',80),
    };
  }
  return result;
}
export function validateSale(body: Record<string, unknown>) {
  const price = minor(body.price,'price')!;
  const compareAtPrice = minor(body.compareAtPrice,'compareAtPrice',true);
  if (compareAtPrice != null && compareAtPrice <= price) throw new SaleError('INVALID_PRICE',400,'compareAtPrice');
  const status = body.status ?? 'DRAFT';
  if (!['DRAFT','PUBLISHED','ARCHIVED'].includes(String(status))) throw new SaleError('INVALID_FIELD',400,'status');
  const date = (v: unknown, field: string) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new SaleError('INVALID_FIELD',400,field);
    return new Date(v);
  };
  const startsAt = date(body.startsAt,'startsAt'), expiresAt = date(body.expiresAt,'expiresAt');
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new SaleError('INVALID_DATES',400,'expiresAt');
  const quantityLimit = body.quantityLimit ?? null;
  if (quantityLimit !== null && (typeof quantityLimit !== 'number' || !Number.isSafeInteger(quantityLimit) || quantityLimit < 1 || quantityLimit > 2147483647)) throw new SaleError('INVALID_QUANTITY',400,'quantityLimit');
  if (body.onePerAccount != null && typeof body.onePerAccount !== 'boolean') throw new SaleError('INVALID_FIELD',400,'onePerAccount');
  if (body.currency != null && body.currency !== 'usd') throw new SaleError('INVALID_FIELD',400,'currency');
  let imagePresentation;
  try { imagePresentation = normalizeContentImageMetadata(body.imagePresentation); } catch { throw new SaleError('INVALID_FIELD',400,'imagePresentation'); }
  if (imagePresentation && !safeExternalUrl(imagePresentation.url)) throw new SaleError('INVALID_FIELD',400,'imagePresentation');
  return {
    title:textField(body.title,'title',255,true), shortDescription:textField(body.shortDescription,'shortDescription',600,status==='PUBLISHED'),
    description:textField(body.description,'description',20000,status==='PUBLISHED'), category:textField(body.category ?? 'service','category',80,true),
    price,compareAtPrice,currency:'usd',status:String(status),startsAt,expiresAt,quantityLimit:quantityLimit as number|null,
    onePerAccount:body.onePerAccount === true, ctaLabel:textField(body.ctaLabel,'ctaLabel',80)||null,
    translations:translations(body.translations),imagePresentation,
  };
}
