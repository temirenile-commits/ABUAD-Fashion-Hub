/**
 * MasterCart Capability Registry.
 *
 * The Search Engine is the only consumer that turns these entries into
 * role-filtered structured results. The language model never receives a
 * database query or unrestricted route list.
 */
export { FEATURE_REGISTRY, HELP_REGISTRY } from '@/lib/ai/search-engine';
