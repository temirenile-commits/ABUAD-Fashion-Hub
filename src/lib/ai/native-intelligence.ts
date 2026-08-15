import { supabaseAdmin } from '@/lib/supabase-admin';
import type { MilesConversationMemory } from '@/lib/ai/conversation-memory';

export type NativeKnowledgeStatus = 'proposed' | 'validating' | 'verified' | 'active' | 'deprecated';

const PRIVATE_PATTERNS: Array<[RegExp, string]> = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]'],
  [/(?<!\d)(?:\+?\d[\d\s().-]{8,}\d)(?!\d)/g, '[phone removed]'],
  [/\b(?:sk|pk|rk|api|token|secret|key)[_-]?[a-z0-9-]{12,}\b/gi, '[credential removed]'],
  [/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[identifier removed]'],
  [/\b(?:password|passwd|authorization|bearer|session|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1: [private value removed]'],
  [/\b(?:account|wallet|card|bank|payment|address)\s*(?:number|id|details)?\s*[:=]\s*[^\n,;]+/gi, '$1: [private value removed]'],
];

const PRIVATE_WORDS = /\b(?:email|phone|address|payment|password|credential|token|authorization|private account|session|api key)\b/gi;

export function sanitizeNativeText(value: unknown, maxLength = 2_000) {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of PRIVATE_PATTERNS) text = text.replace(pattern, replacement);
  return text.replace(PRIVATE_WORDS, (word) => word.toLowerCase() === 'email' ? '[email removed]' : word).slice(0, maxLength);
}

export function generalizeNativeLearning(input: { question: unknown; answer: unknown; intent?: unknown; outcome?: unknown }) {
  const question = sanitizeNativeText(input.question, 600).replace(/\b(?:my|our|the)\s+[\w-]+(?:'s)?\b/gi, 'the user\'s account');
  const answer = sanitizeNativeText(input.answer, 1_200);
  const intent = sanitizeNativeText(input.intent, 80);
  const outcome = sanitizeNativeText(input.outcome, 80);
  const lower = `${question} ${answer}`.toLowerCase();
  let generalizedSummary = `For ${intent || 'a MasterCart request'}, use validated backend data and role-scoped permissions before responding.`;
  if (lower.includes('reel') && (lower.includes('permission') || lower.includes('publish'))) generalizedSummary = 'Reel publishing requires an authenticated vendor with the appropriate publishing permission and a valid Reel entity state.';
  else if (lower.includes('order') || lower.includes('delivery')) generalizedSummary = 'Order and delivery questions require current authenticated customer or vendor records; learned memory cannot replace live status.';
  else if (lower.includes('wallet') || lower.includes('payment') || lower.includes('balance')) generalizedSummary = 'Financial and wallet questions require current deterministic backend calculations and must not be answered from stale learned memory.';
  return { sanitizedInput: question, sanitizedOutput: answer, generalizedSummary, intent, outcome };
}

function queryTerms(query: string) {
  return sanitizeNativeText(query, 180).toLowerCase().split(/\s+/).filter((term) => term.length > 2).slice(0, 8);
}

export async function retrieveNativeKnowledge(query: string, domain?: string, limit = 6) {
  const terms = queryTerms(query);
  let request = supabaseAdmin.from('miles_native_knowledge').select('id,domain,title,statement,source,status,confidence,version,last_verified_at,expires_at').eq('status', 'active').order('confidence', { ascending: false }).limit(Math.min(limit, 10));
  if (domain) request = request.eq('domain', domain);
  if (terms.length) request = request.or(terms.map((term) => `title.ilike.%${term}%,statement.ilike.%${term}%`).join(','));
  const { data, error } = await request;
  if (error) {
    console.error('[MNIE_KNOWLEDGE_READ_FAILED]', { message: error.message });
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function retrieveNativePatterns(problemType?: string, limit = 4) {
  let request = supabaseAdmin.from('miles_reasoning_patterns').select('id,problem_type,pattern,required_checks,confidence,version').eq('status', 'active').order('confidence', { ascending: false }).limit(Math.min(limit, 8));
  if (problemType) request = request.eq('problem_type', problemType);
  const { data, error } = await request;
  if (error) {
    console.error('[MNIE_PATTERN_READ_FAILED]', { message: error.message });
    return [];
  }
  return Array.isArray(data) ? data : [];
}

function money(value: unknown) { return `₦${Number(value || 0).toLocaleString('en-NG')}`; }

function questionAwareFallback(question: string, intent: string, pageContext: string, knowledgeStatement?: string) {
  const safeQuestion = sanitizeNativeText(question, 320);
  const normalized = safeQuestion.toLowerCase();
  if (knowledgeStatement) return `${knowledgeStatement} Your question was: “${safeQuestion}”`;
  if (/\b(who are you|what is your name|what are you)\b/i.test(normalized)) return `I’m Miles, MasterCart’s role-aware assistant. I can help you find products and vendors, understand orders, navigate your account, and explain the part of MasterCart you’re viewing.`;
  if (/\b(what is mastercart|tell me about mastercart)\b/i.test(normalized)) return `MasterCart is a campus marketplace for discovering products, vendors, services, and campus delivery options. I can guide you through the marketplace and your authorized account features.`;
  if (/\b(where|how do i get|take me)\b/i.test(normalized)) return `You are currently on ${pageContext.replace(/^The user is /, '').replace(/\.$/, '')}. Tell me the destination or feature you want, and I’ll guide you there.`;
  if (intent === 'review_query') return `I can help you inspect product or vendor reviews, but I need a specific product, vendor, or review topic to look up from the current MasterCart records.`;
  if (intent === 'account_query') return `I can guide you through account settings, profile details, university information, and password workflows. Tell me which account area you want to open or understand.`;
  if (intent === 'reel_query') return `I can help with MasterCart Reels, including finding videos, understanding Reel actions, and explaining publishing or interaction workflows. Tell me which Reel or action you mean.`;
  if (intent === 'support_request') return `I can help structure the issue for MasterCart support. Tell me what happened, which page or order is affected, and what result you expected.`;
  if (intent === 'admin_query' || intent === 'operational_request') return `I can explain the authorized MasterCart administration workflow for “${safeQuestion}”. Tell me the specific module or record you want to inspect.`;
  if (intent === 'image_analysis') return `I received the image request, but I need the picture to be available in the current message before I can analyze it. You can upload it with a short description of what you want checked.`;
  return `I received your ${intent.replace(/_/g, ' ')} question: “${safeQuestion}”. I can help with MasterCart navigation, products, vendors, orders, account workflows, and troubleshooting. Tell me the outcome you want, and I’ll narrow it down.`;
}

export async function nativeBrainRespond(input: { question: string; intent: string; roleData: Record<string, any>; memory: MilesConversationMemory; pageContext: string }) {
  const question = sanitizeNativeText(input.question, 400);
  const domain = input.intent.includes('order') || input.intent.includes('delivery') ? 'orders' : input.intent.includes('financial') ? 'financials' : input.intent.includes('reel') ? 'reels' : undefined;
  const [knowledge, patterns] = await Promise.all([retrieveNativeKnowledge(question, domain), retrieveNativePatterns(input.intent)]);
  const customer = input.roleData.customer as any;
  const vendor = input.roleData.vendor as any;
  const analytics = (input.roleData.admin as any)?.analytics;
  let text = questionAwareFallback(question, input.intent, input.pageContext, knowledge[0]?.statement);
  if (input.intent === 'order_query' || input.intent === 'delivery_query') {
    const orders = Array.isArray(customer?.orders) ? customer.orders : Array.isArray(customer?.recentOrders) ? customer.recentOrders : [];
    text = orders.length ? `I found ${orders.length} current order record${orders.length === 1 ? '' : 's'} in your authorized account context. Check the order card or Orders area for the latest status.` : `I couldn't verify a current order or delivery record in your authorized MasterCart context.`;
  } else if (input.intent === 'analytics_query' && analytics) {
    text = `I can explain the current authorized analytics, but the backend remains the source of truth. ${sanitizeNativeText(JSON.stringify(analytics), 500)}`;
  } else if (input.intent === 'financial_query') {
    const wallet = vendor?.wallet;
    text = wallet ? `Your current vendor wallet context shows an available balance of ${money(wallet.availableBalance)} and a pending balance of ${money(wallet.pendingBalance)}. These figures come from the current backend context.` : `I need the current authorized wallet or payment record to answer that accurately; I won't guess from learned memory.`;
  } else if (input.intent === 'troubleshooting') {
    text = `Let's troubleshoot this systematically: verify authentication, your role, ownership, permission, the entity state, the current database state, and any recent system error. ${knowledge[0]?.statement || 'If the issue continues, use the relevant MasterCart support workflow.'}`;
  } else if (input.intent === 'mastercart_assistance' || input.intent === 'navigation_request') {
    text = knowledge[0]?.statement || `I can guide you through ${input.pageContext.replace(/^The user is /, '').replace(/\.$/, '')}. Tell me the exact section or action you want to understand.`;
  } else if (knowledge[0]?.statement) {
    text = knowledge[0].statement;
  }
  return { text: sanitizeNativeText(text, 2_000), provider: 'native' as const, model: 'mnie-rule-reasoner', knowledgeIds: knowledge.map((item) => item.id), patternIds: patterns.map((item) => item.id), fallback: true };
}

export async function recordNativeLearning(input: { question: unknown; answer: unknown; intent?: unknown; outcome?: unknown; provider?: unknown; model?: unknown; toolNames?: string[] }) {
  const generalized = generalizeNativeLearning(input);
  const { error } = await supabaseAdmin.from('miles_learning_events').insert({
    event_type: 'interaction',
    intent: generalized.intent || null,
    domain: generalized.intent?.split('_')[0] || null,
    sanitized_input: generalized.sanitizedInput,
    sanitized_output: generalized.sanitizedOutput,
    generalized_summary: generalized.generalizedSummary,
    provider_name: input.provider === 'native' ? null : sanitizeNativeText(input.provider, 80) || null,
    provider_model: sanitizeNativeText(input.model, 120) || null,
    outcome: generalized.outcome || 'completed',
    tool_names: Array.isArray(input.toolNames) ? input.toolNames.slice(0, 12).map((tool) => sanitizeNativeText(tool, 80)) : [],
  });
  if (error) console.error('[MNIE_LEARNING_WRITE_FAILED]', { message: error.message });
}

export async function recordNativeToolUsage(input: { intent: unknown; toolNames: string[]; outcome: unknown }) {
  const tools = input.toolNames.slice(0, 12).map((tool) => sanitizeNativeText(tool, 80));
  const { error } = await supabaseAdmin.from('miles_learning_events').insert({ event_type: 'tool_usage', intent: sanitizeNativeText(input.intent, 80) || null, generalized_summary: `Validated tool selection for ${sanitizeNativeText(input.intent, 80) || 'unknown intent'}.`, outcome: sanitizeNativeText(input.outcome, 80) || 'completed', tool_names: tools });
  if (error) console.error('[MNIE_TOOL_USAGE_WRITE_FAILED]', { message: error.message });
}

export async function recordProviderComparison(input: { comparisonKey: unknown; intent: unknown; problem: unknown; outputs: Array<{ provider: unknown; model?: unknown; summary: unknown }>; selectedProvider?: unknown; validationResult?: unknown }) {
  const providerOutputs = input.outputs.slice(0, 5).map((output) => ({ provider: sanitizeNativeText(output.provider, 80), model: sanitizeNativeText(output.model, 120), summary: sanitizeNativeText(output.summary, 1_000) }));
  const { error } = await supabaseAdmin.from('miles_provider_comparisons').insert({ comparison_key: sanitizeNativeText(input.comparisonKey, 120), intent: sanitizeNativeText(input.intent, 80) || null, sanitized_problem: sanitizeNativeText(input.problem, 800), provider_outputs: providerOutputs, validation_result: input.validationResult || {}, selected_provider: sanitizeNativeText(input.selectedProvider, 80) || null, selected_summary: providerOutputs.find((output) => output.provider === sanitizeNativeText(input.selectedProvider, 80))?.summary || null, status: 'proposed' });
  if (error) console.error('[MNIE_PROVIDER_COMPARISON_WRITE_FAILED]', { message: error.message });
}

export async function evaluateNativeEvolution() {
  const [{ data: knowledge }, { data: recentEvents }, { data: feedback }] = await Promise.all([
    supabaseAdmin.from('miles_native_knowledge').select('id,domain,title,statement,status,confidence,version,last_verified_at,expires_at').limit(200),
    supabaseAdmin.from('miles_learning_events').select('event_type,intent,domain,generalized_summary,created_at').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('miles_feedback').select('feedback_type,intent,status,created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  const active = (knowledge || []).filter((item: any) => item.status === 'active');
  const duplicateCandidates = active.filter((item: any, index: number, items: any[]) => items.some((other, otherIndex) => otherIndex < index && other.domain === item.domain && other.statement === item.statement)).length;
  const staleCandidates = active.filter((item: any) => item.expires_at && new Date(item.expires_at).getTime() < Date.now()).length;
  const repeatedProblems = (recentEvents || []).reduce<Record<string, number>>((counts, event: any) => {
    const key = `${event.intent || 'unknown'}:${event.generalized_summary || ''}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const repeated = Object.entries(repeatedProblems).filter(([, count]) => count >= 3).length;
  const summary = `Evolution scan found ${duplicateCandidates} duplicate candidate(s), ${staleCandidates} stale active record(s), ${repeated} repeated pattern candidate(s), and ${(feedback || []).filter((item: any) => item.feedback_type === 'correction').length} correction signal(s). No authoritative rule was modified.`;
  await supabaseAdmin.from('miles_learning_events').insert({ event_type: 'knowledge_candidate', generalized_summary: sanitizeNativeText(summary, 1_000), outcome: 'proposed_only', metadata: { duplicateCandidates, staleCandidates, repeatedPatternCandidates: repeated, feedbackSignals: (feedback || []).length, knowledgeCount: (knowledge || []).length } });
  return { summary, duplicateCandidates, staleCandidates, repeatedPatternCandidates: repeated, feedbackSignals: (feedback || []).length, knowledgeCount: (knowledge || []).length };
}

export async function recordNativeFeedback(input: { feedbackType: string; rating?: number; message?: unknown; correction?: unknown; intent?: unknown }) {
  const allowed = new Set(['rating', 'correction', 'success', 'failure', 'admin_correction', 'tool_failure', 'workflow_success']);
  const feedbackType = allowed.has(input.feedbackType) ? input.feedbackType : 'failure';
  const { error } = await supabaseAdmin.from('miles_feedback').insert({
    feedback_type: feedbackType,
    rating: typeof input.rating === 'number' && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null,
    sanitized_message: sanitizeNativeText(input.message, 800) || null,
    sanitized_correction: sanitizeNativeText(input.correction, 800) || null,
    intent: sanitizeNativeText(input.intent, 80) || null,
  });
  if (error) console.error('[MNIE_FEEDBACK_WRITE_FAILED]', { message: error.message });
}
