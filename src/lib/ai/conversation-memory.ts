export type MilesMemoryCard = {
  type: 'product' | 'vendor';
  id: string;
  title: string;
  subtitle?: string;
  price?: number;
  available?: boolean;
  verified?: boolean;
  destination?: string;
};

export type MilesConversationMemory = {
  topic?: string;
  currentTask?: string;
  previousQuestion?: string;
  firstQuestion?: string;
  selectedProduct?: MilesMemoryCard;
  selectedVendor?: MilesMemoryCard;
  recentCards: MilesMemoryCard[];
  lastIntent?: string;
};

const MAX_CARDS = 10;
const MAX_TEXT = 240;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : undefined;
}

function safeCard(value: unknown): MilesMemoryCard | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const card = value as Record<string, unknown>;
  if ((card.type !== 'product' && card.type !== 'vendor') || typeof card.id !== 'string' || typeof card.title !== 'string') return undefined;
  return {
    type: card.type,
    id: card.id,
    title: card.title.slice(0, 160),
    subtitle: cleanText(card.subtitle),
    price: typeof card.price === 'number' && Number.isFinite(card.price) ? card.price : undefined,
    available: typeof card.available === 'boolean' ? card.available : undefined,
    verified: typeof card.verified === 'boolean' ? card.verified : undefined,
    destination: typeof card.destination === 'string' && card.destination.startsWith('/') ? card.destination.slice(0, 240) : undefined,
  };
}

export function normalizeMilesMemory(value: unknown): MilesConversationMemory {
  if (!value || typeof value !== 'object') return { recentCards: [] };
  const memory = value as Record<string, unknown>;
  const recentCards = Array.isArray(memory.recentCards) ? memory.recentCards.map(safeCard).filter((card): card is MilesMemoryCard => Boolean(card)).slice(0, MAX_CARDS) : [];
  return {
    topic: cleanText(memory.topic),
    currentTask: cleanText(memory.currentTask),
    previousQuestion: cleanText(memory.previousQuestion),
    firstQuestion: cleanText(memory.firstQuestion),
    selectedProduct: safeCard(memory.selectedProduct),
    selectedVendor: safeCard(memory.selectedVendor),
    recentCards,
    lastIntent: cleanText(memory.lastIntent),
  };
}

export function updateMilesMemory(previous: unknown, input: { question: string; intent: string; cards?: unknown[]; selectedIndex?: number }) {
  const memory = normalizeMilesMemory(previous);
  const cards = (input.cards || []).map(safeCard).filter((card): card is MilesMemoryCard => Boolean(card)).slice(0, MAX_CARDS);
  const selected = typeof input.selectedIndex === 'number' ? cards[input.selectedIndex - 1] : undefined;
  const product = selected?.type === 'product' ? selected : cards.find((card) => card.type === 'product');
  const vendor = selected?.type === 'vendor' ? selected : cards.find((card) => card.type === 'vendor');
  const question = input.question.trim().slice(0, MAX_TEXT);
  return {
    topic: product?.title || vendor?.title || memory.topic,
    currentTask: input.intent,
    previousQuestion: question,
    firstQuestion: memory.firstQuestion || question,
    selectedProduct: product || memory.selectedProduct,
    selectedVendor: vendor || memory.selectedVendor,
    recentCards: cards.length ? cards : memory.recentCards,
    lastIntent: input.intent,
  } satisfies MilesConversationMemory;
}

export function resolveMilesReference(question: string, memory: MilesConversationMemory) {
  const normalized = question.toLowerCase();
  const cards = memory.recentCards;
  const ordinal = normalized.match(/\b(first|1st|one|second|2nd|two|third|3rd|three|fourth|4th|four)\b/);
  const ordinalIndex = ordinal ? ({ first: 0, '1st': 0, one: 0, second: 1, '2nd': 1, two: 1, third: 2, '3rd': 2, three: 2, fourth: 3, '4th': 3, four: 3 }[ordinal[1]] ?? -1) : -1;
  const referenced = ordinalIndex >= 0 ? cards[ordinalIndex] : undefined;
  const asksComparison = /\b(cheapest|lowest|least expensive|most expensive|best|which one|compare)\b/i.test(question);
  const asksVendor = /\b(vendor|seller|store|brand)\b/i.test(question) || /\bwho sells\b/i.test(question);
  const asksOrder = /\b(that thing|what i bought|purchase|bought|order|delivery|delivered|shipping|where is it)\b/i.test(question);
  return { referenced, asksComparison, asksVendor, asksOrder, hasAmbiguousPronoun: /\b(this|that|it|one|they|them|second|first)\b/i.test(question) && cards.length === 0 };
}

export function memoryPrompt(memory: MilesConversationMemory) {
  return JSON.stringify({ topic: memory.topic, currentTask: memory.currentTask, previousQuestion: memory.previousQuestion, firstQuestion: memory.firstQuestion, selectedProduct: memory.selectedProduct, selectedVendor: memory.selectedVendor, recentCards: memory.recentCards });
}
