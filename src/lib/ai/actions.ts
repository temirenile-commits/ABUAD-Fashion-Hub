import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getVendorAISettings, getVendorProfile } from '@/lib/ai/vendor-tools';

type ActionType = 'create_product' | 'update_product' | 'update_store_profile' | 'update_service';
type JsonRecord = Record<string, unknown>;

type AuditRow = {
  request_id: string;
  user_id: string;
  brand_id: string;
  action_type: ActionType;
  status: 'proposed' | 'confirmed' | 'executed' | 'rejected' | 'expired' | 'failed';
  request_hash: string;
  payload: JsonRecord;
  result_summary: string | null;
  expires_at: string;
};

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const SAFE_STORE_FIELDS = ['name', 'description', 'logo_url', 'banner_url', 'cover_url', 'whatsapp_number', 'instagram_link', 'return_policy', 'shipping_policy', 'social_links'] as const;
const PRODUCT_FIELDS = ['title', 'description', 'price', 'original_price', 'category', 'stock_count', 'media_urls', 'image_url', 'video_url', 'variants', 'is_draft', 'is_preorder', 'preorder_arrival_date', 'location_availability', 'delivery_rate', 'cafeteria_ids'] as const;
const SERVICE_FIELDS = ['title', 'description', 'price', 'portfolio_urls', 'is_featured'] as const;

export class MilesActionError extends Error {
  constructor(public readonly code: 'INVALID_ACTION' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED' | 'CONFIRMATION_REQUIRED' | 'ACTION_FAILED', message: string) {
    super(message);
    this.name = 'MilesActionError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hashRequest(actionType: ActionType, payload: JsonRecord): string {
  return crypto.createHash('sha256').update(canonicalize({ actionType, payload })).digest('hex');
}

function scrubPayload(actionType: ActionType, input: unknown): JsonRecord {
  if (!isRecord(input)) throw new MilesActionError('INVALID_ACTION', 'The requested action details are incomplete.');
  const allowed = actionType === 'update_store_profile' ? SAFE_STORE_FIELDS : actionType === 'update_service' ? SERVICE_FIELDS : PRODUCT_FIELDS;
  const payload: JsonRecord = {};
  for (const field of allowed) {
    if (!(field in input)) continue;
    const value = input[field];
    if (field === 'price' || field === 'original_price' || field === 'delivery_rate') {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue) || numberValue < 0) throw new MilesActionError('INVALID_ACTION', `The ${field.replaceAll('_', ' ')} is invalid.`);
      payload[field] = numberValue;
    } else if (field === 'stock_count') {
      const numberValue = Number(value);
      if (!Number.isInteger(numberValue) || numberValue < 0) throw new MilesActionError('INVALID_ACTION', 'Stock must be a non-negative whole number.');
      payload[field] = numberValue;
    } else if (field === 'title' || field === 'name') {
      const text = String(value).trim();
      if (!text || text.length > 160) throw new MilesActionError('INVALID_ACTION', `The ${field} is invalid.`);
      payload[field] = text;
    } else if (field === 'description' || field === 'category' || field === 'location_availability' || field === 'instagram_link' || field === 'whatsapp_number' || field === 'return_policy' || field === 'shipping_policy' || field === 'image_url' || field === 'video_url') {
      const text = String(value).trim();
      if (text.length > 5000) throw new MilesActionError('INVALID_ACTION', `The ${field.replaceAll('_', ' ')} is too long.`);
      payload[field] = text || null;
    } else if (field === 'is_draft' || field === 'is_preorder') {
      payload[field] = Boolean(value);
    } else if (field === 'media_urls' || field === 'variants' || field === 'cafeteria_ids' || field === 'social_links' || field === 'portfolio_urls') {
      if (typeof value !== 'object') throw new MilesActionError('INVALID_ACTION', `The ${field.replaceAll('_', ' ')} value is invalid.`);
      payload[field] = value;
    } else if (field === 'preorder_arrival_date' || field === 'logo_url' || field === 'banner_url' || field === 'cover_url') {
      payload[field] = value == null || value === '' ? null : String(value);
    } else {
      payload[field] = value;
    }
  }
  if (!Object.keys(payload).length) throw new MilesActionError('INVALID_ACTION', 'There are no changes to apply.');
  return payload;
}

function actionSummary(actionType: ActionType, payload: JsonRecord, brandName: string): string {
  if (actionType === 'create_product') return `Create a new product in ${brandName}: ${String(payload.title || 'untitled product')}.`;
  if (actionType === 'update_store_profile') return `Update the store profile for ${brandName}.`;
  if (actionType === 'update_service') return `Update service ${String(payload.service_title || 'selected service')} in ${brandName}.`;
  return `Update product ${String(payload.product_title || 'selected product')} in ${brandName}.`;
}

export function detectMilesActionRequest(message: string, products: Array<{ id: string; title?: string | null }>, services: Array<{ id: string; title?: string | null }> = []) {
  const text = message.trim();
  const storeNameMatch = text.match(/(?:change|update|rename)\s+(?:my\s+)?(?:store|shop|brand)\s+name\s+to\s+["']?(.+?)["']?$/i);
  if (storeNameMatch?.[1]) return { actionType: 'update_store_profile' as const, payload: { name: storeNameMatch[1].trim() } };

  const createMatch = text.match(/(?:add|create|list)\s+(?:a\s+)?product\s+(?:called|named)\s+["']?(.+?)["']?\s+(?:for|at)\s+(?:₦|ngn|n)?\s*([0-9][0-9,]*(?:\.\d+)?)(?:\s+(?:with|and)\s+(?:stock|quantity)\s*[:=]?\s*(\d+))?$/i);
  if (createMatch?.[1] && createMatch?.[2]) return { actionType: 'create_product' as const, payload: { title: createMatch[1].trim(), price: Number(createMatch[2].replaceAll(',', '')), stock_count: createMatch[3] ? Number(createMatch[3]) : 0 } };

  const servicePriceMatch = text.match(/(?:set|change|update)\s+(?:the\s+)?price\s+(?:of|for)\s+(?:the\s+)?service\s+["']?(.+?)["']?\s+to\s+(?:₦|ngn|n)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$/i);
  if (servicePriceMatch?.[1] && servicePriceMatch?.[2]) {
    const service = services.find((item) => item.title?.toLowerCase() === servicePriceMatch[1].trim().toLowerCase());
    if (service) return { actionType: 'update_service' as const, payload: { service_id: service.id, price: Number(servicePriceMatch[2].replaceAll(',', '')) } };
  }

  const stockMatch = text.match(/(?:set|change|update)\s+(?:the\s+)?stock\s+(?:of|for)\s+["']?(.+?)["']?\s+to\s+(\d+)\s*$/i);
  if (stockMatch?.[1] && stockMatch?.[2]) {
    const product = products.find((item) => item.title?.toLowerCase() === stockMatch[1].trim().toLowerCase());
    if (product) return { actionType: 'update_product' as const, payload: { product_id: product.id, stock_count: Number(stockMatch[2]) } };
  }

  const priceMatch = text.match(/(?:set|change|update)\s+(?:the\s+)?price\s+(?:of|for)\s+["']?(.+?)["']?\s+to\s+(?:₦|ngn|n)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*$/i);
  if (priceMatch?.[1] && priceMatch?.[2]) {
    const product = products.find((item) => item.title?.toLowerCase() === priceMatch[1].trim().toLowerCase());
    if (product) return { actionType: 'update_product' as const, payload: { product_id: product.id, price: Number(priceMatch[2].replaceAll(',', '')) } };
  }

  return null;
}

export async function proposeMilesAction(userId: string, actionType: ActionType, input: unknown) {
  if (!['create_product', 'update_product', 'update_store_profile', 'update_service'].includes(actionType)) throw new MilesActionError('NOT_ALLOWED', 'Miles cannot perform that type of action.');
  const brand = await getVendorProfile(userId);
  if (!brand) throw new MilesActionError('NOT_FOUND', 'No vendor store is associated with this account.');
  const settings = await getVendorAISettings(brand.id);
  if (!settings.store_access_enabled) throw new MilesActionError('NOT_ALLOWED', 'Store access is not activated for Miles.');
  if (!settings.store_write_enabled) throw new MilesActionError('NOT_ALLOWED', 'Store write access is not activated for Miles.');
  const payload = scrubPayload(actionType, input);
      if (actionType === 'update_service') {
      const serviceId = String(isRecord(input) ? input.service_id || '' : '');
      if (!serviceId) throw new MilesActionError('INVALID_ACTION', 'A service must be selected before updating it.');
      const { data: service } = await supabaseAdmin.from('services').select('id, brand_id, title').eq('id', serviceId).maybeSingle();
      if (!service || service.brand_id !== brand.id) throw new MilesActionError('NOT_FOUND', 'That service is not part of your store.');
      payload.service_id = service.id;
      payload.service_title = service.title;
    }
    if (actionType === 'update_product') {

    const productId = String(isRecord(input) ? input.product_id || '' : '');
    if (!productId) throw new MilesActionError('INVALID_ACTION', 'A product must be selected before updating it.');
    const { data: product } = await supabaseAdmin.from('products').select('id, brand_id, title').eq('id', productId).maybeSingle();
    if (!product || product.brand_id !== brand.id) throw new MilesActionError('NOT_FOUND', 'That product is not part of your store.');
    payload.product_id = product.id;
    payload.product_title = product.title;
  }
  const requestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
  const requestHash = hashRequest(actionType, payload);
  const { error } = await supabaseAdmin.from('miles_action_audit').insert({ request_id: requestId, user_id: userId, brand_id: brand.id, action_type: actionType, status: 'proposed', request_hash: requestHash, payload, expires_at: expiresAt });
  if (error) throw new MilesActionError('ACTION_FAILED', 'Miles could not prepare that change.');
  return { actionId: requestId, actionType, summary: actionSummary(actionType, payload, brand.name), expiresAt, confirmationPhrase: 'CONFIRM' };
}

export async function confirmMilesAction(userId: string, actionId: string, confirmationPhrase: string) {
  if (confirmationPhrase.trim().toUpperCase() !== 'CONFIRM') throw new MilesActionError('CONFIRMATION_REQUIRED', 'Type CONFIRM to approve this exact change.');
  const { data: action, error } = await supabaseAdmin.from('miles_action_audit').select('request_id, user_id, brand_id, action_type, status, request_hash, payload, result_summary, expires_at').eq('request_id', actionId).eq('user_id', userId).maybeSingle();
  if (error || !action) throw new MilesActionError('NOT_FOUND', 'That confirmation request was not found.');
  const row = action as AuditRow;
  if (row.status !== 'proposed') throw new MilesActionError('ALREADY_USED', 'That confirmation request has already been used.');
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin.from('miles_action_audit').update({ status: 'expired' }).eq('request_id', actionId).eq('status', 'proposed');
    throw new MilesActionError('EXPIRED', 'That confirmation request has expired.');
  }
  const { data: claimed } = await supabaseAdmin.from('miles_action_audit').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('request_id', actionId).eq('user_id', userId).eq('status', 'proposed').select('request_id').maybeSingle();
  if (!claimed) throw new MilesActionError('ALREADY_USED', 'That confirmation request has already been used.');
  try {
    const result = await executeMilesAction(userId, row);
    await supabaseAdmin.from('miles_action_audit').update({ status: 'executed', executed_at: new Date().toISOString(), result_summary: result.summary }).eq('request_id', actionId);
    return result;
  } catch (error) {
    await supabaseAdmin.from('miles_action_audit').update({ status: 'failed', result_summary: 'Action execution failed.' }).eq('request_id', actionId);
    if (error instanceof MilesActionError) throw error;
    throw new MilesActionError('ACTION_FAILED', 'Miles could not complete that change.');
  }
}

async function executeMilesAction(userId: string, action: AuditRow): Promise<{ summary: string; actionType: ActionType }> {
  const brand = await getVendorProfile(userId);
  if (!brand || brand.id !== action.brand_id) throw new MilesActionError('NOT_ALLOWED', 'The vendor store could not be verified.');
  const payload = { ...action.payload };
  delete payload.product_title;
  const serviceId = String(payload.service_id || '');
  delete payload.service_id;
  delete payload.service_title;
  if (action.action_type === 'update_store_profile') {
    const { error } = await supabaseAdmin.from('brands').update(payload).eq('id', brand.id).eq('owner_id', userId);
    if (error) throw error;
    return { actionType: action.action_type, summary: 'Your store profile was updated.' };
  }
  if (action.action_type === 'update_service') {
    const { data: service } = await supabaseAdmin.from('services').select('id, brand_id').eq('id', serviceId).maybeSingle();
    if (!service || service.brand_id !== brand.id) throw new MilesActionError('NOT_FOUND', 'That service is not part of your store.');
    const { error } = await supabaseAdmin.from('services').update(payload).eq('id', serviceId).eq('brand_id', brand.id);
    if (error) throw error;
    return { actionType: action.action_type, summary: 'Your service was updated.' };
  }
  if (action.action_type === 'create_product') {
    const product: JsonRecord = { ...payload, brand_id: brand.id, owner_id: userId, product_section: brand.marketplace_type === 'delicacies' ? 'delicacies' : 'fashion', university_id: brand.university_id, visibility_type: 'university' };
    delete product.product_id;
    const { error } = await supabaseAdmin.from('products').insert(product);
    if (error) throw error;
    return { actionType: action.action_type, summary: `Product ${String(payload.title)} was added to your store.` };
  }
  const productId = String(payload.product_id || '');
  delete payload.product_id;
  const { data: product } = await supabaseAdmin.from('products').select('id, brand_id').eq('id', productId).maybeSingle();
  if (!product || product.brand_id !== brand.id) throw new MilesActionError('NOT_FOUND', 'That product is not part of your store.');
  const { error } = await supabaseAdmin.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', productId).eq('brand_id', brand.id);
  if (error) throw error;
  return { actionType: action.action_type, summary: 'Your product was updated.' };
}
