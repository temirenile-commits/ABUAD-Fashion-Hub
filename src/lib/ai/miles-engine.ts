import type { MilesContext } from '@/lib/ai/role-context';
import { searchMiles, type MilesSearchRequest, type MilesSearchResponse } from '@/lib/ai/search-engine';
import { analyzeMiles, type MilesAnalysisResponse, type MilesAnalysisType } from '@/lib/ai/analytics-engine';
import { proposeMilesAction, confirmMilesAction, MILES_ACTION_DEFINITIONS } from '@/lib/ai/actions';

export type MilesPipelineMode = 'retrieve' | 'analyze' | 'act';
export type MilesPipelineResult = { mode: MilesPipelineMode; source: 'search_engine' | 'analytics_engine' | 'action_engine'; result: MilesSearchResponse | MilesAnalysisResponse | unknown };

export async function retrieveMiles(context: MilesContext, request: MilesSearchRequest): Promise<MilesPipelineResult> {
  return { mode: 'retrieve', source: 'search_engine', result: await searchMiles(context, request) };
}

export async function analyzeMilesRequest(context: MilesContext, type: MilesAnalysisType, options?: { period?: 'month' | 'last_month' | 'all'; universityId?: string | null }): Promise<MilesPipelineResult> {
  return { mode: 'analyze', source: 'analytics_engine', result: await analyzeMiles(context, type, options) };
}

export async function proposeMilesAct(userId: string, actionType: keyof typeof MILES_ACTION_DEFINITIONS, payload: unknown): Promise<MilesPipelineResult> {
  return { mode: 'act', source: 'action_engine', result: await proposeMilesAction(userId, actionType, payload) };
}

export async function confirmMilesAct(userId: string, actionId: string, confirmation: string): Promise<MilesPipelineResult> {
  return { mode: 'act', source: 'action_engine', result: await confirmMilesAction(userId, actionId, confirmation) };
}
