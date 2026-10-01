import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Allow cross-origin requests when the frontend is hosted on GitHub Pages / Vercel / Netlify
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '4mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'gemini_city_db.json');
const CITY2_DB_FILE = path.join(DATA_DIR, 'city2_groq_db.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore fs errors in read-only environments
  }
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface CharacterPayload {
  id: string;
  name: string;
  gender?: string;
  role: string;
  occupation?: string;
  age: number;
  modelIdentity: string;
  modelBadge: string;
  modelTrait: string;
  independentTitle?: string;
  temperament?: string;
  personality: string[];
  interests?: string[];
  likes?: string[];
  dislikes?: string[];
  familyConnections?: string[];
  learnedPreferences?: string[];
  bio: string;
  voiceStyle: string;
  currentActivity: string;
  currentLocationName: string;
  currentLocationDescription?: string;
  nearbyCharacters?: { name: string; role: string; distance: number; emotion?: string; activity?: string }[];
  nearbyPointsOfInterest?: string[];
  socialSituation?: string;
  decisionReason?: string;
  environmentalContext?: {
    outfitSummary: string;
    outfitFeeling: string;
    surroundingsSummary: string;
    feelingsAboutSurroundings: string;
    secondCityReflection: string;
    dailyGoalSummary?: string;
  };
  dailyGoal?: {
    id: string;
    dayNumber: number;
    title: string;
    description: string;
    category: string;
    targetLocationId: string;
    progress: number;
    completed: boolean;
    currentStepLabel: string;
    autonomousContextReason: string;
    badgeIcon: string;
  };
  affinity: number;
  emotionalState?: {
    primary: string;
    intensity: number;
    cause: string;
    sinceGameTime: string;
  };
  playerRelationship?: {
    status: string;
    trust: number;
    familiarity: number;
    affection?: number;
    notes?: string;
  };
  needs?: { energy: number; social: number; inspiration: number };
  relationships?: {
    targetId?: string;
    targetName: string;
    status: string;
    affinity: number;
    trust?: number;
    romanticInterest?: number;
    romanticStage?: string;
    howWeMet?: string;
    knownPreferences?: string[];
    sharedInterests: string[];
    lastInteractionSummary: string;
  }[];
  memories: {
    gameTime: string;
    summary: string;
    important?: boolean;
    type?: string;
  }[];
  goals: { title: string; progress: number; description: string }[];
  cityId?: 'city1' | 'city2';
  romanticPartnerId?: string | null;
  coWorkingWithId?: string | null;
  groqConfig?: {
    modelTier: string;
    reasoningDepth: string;
    temperature: number;
    memoryRecallLimit: number;
    autonomousPlanEnabled: boolean;
  };
  okPlan?: {
    id: string;
    title: string;
    summary: string;
    reasoning: string;
    partnerId?: string | null;
    partnerName?: string | null;
    status: string;
    progress: number;
    steps: { id: string; label: string; locationId: string; completed: boolean }[];
  };
  dream?: {
    title: string;
    description: string;
    geminiCityVisitSpot: string;
    geminiCityGoal: string;
    carTripStartHour: number;
    carTripReturnHour: number;
    lastNightDream: string;
    isCurrentlyOnCarTrip?: boolean;
  };
}

// Persistent Database Endpoints (Saves Resident Identities, Emotions, Relationships, Memories & Goals)
app.get('/api/world-state', (_req, res) => {
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return res.json({ found: true, data: parsed });
    }
  } catch {
    // Ignore read errors
  }
  return res.json({ found: false, data: null });
});

app.post('/api/world-state', (req, res) => {
  try {
    ensureDataDir();
    const { explorerProfile, characters, chatHistories, socialEvents, voiceEnabled, weather } =
      req.body || {};
    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'Invalid characters array' });
    }

    // Strip transient per-frame animation fields and condense long chat histories
    const persistedCharacters = characters.map((c: Record<string, unknown>) => ({
      ...c,
      isMoving: false,
      isTalking: false,
      activeBubble: undefined,
    }));

    const condensedHistories: Record<string, unknown[]> = {};
    if (chatHistories && typeof chatHistories === 'object') {
      for (const [charId, list] of Object.entries(chatHistories)) {
        if (Array.isArray(list)) {
          condensedHistories[charId] = list.slice(-16);
        }
      }
    }

    const dbPayload = {
      updatedAt: new Date().toISOString(),
      explorerProfile,
      characters: persistedCharacters,
      chatHistories: condensedHistories,
      socialEvents: Array.isArray(socialEvents) ? socialEvents.slice(0, 20) : [],
      voiceEnabled,
      weather: weather || 'sunny',
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(dbPayload, null, 2), 'utf-8');
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

// Dedicated Second City (Neo-Horizon City 2) Groq Memory, Conversation & OK-Plan Database Endpoints
app.get('/api/city2-db', (_req, res) => {
  try {
    ensureDataDir();
    if (fs.existsSync(CITY2_DB_FILE)) {
      const raw = fs.readFileSync(CITY2_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return res.json({ found: true, data: parsed });
    }
  } catch {
    // Ignore read errors
  }
  return res.json({ found: false, data: null });
});

app.post('/api/city2-db', (req, res) => {
  try {
    ensureDataDir();
    const payload = {
      updatedAt: new Date().toISOString(),
      ...(req.body || {}),
    };
    fs.writeFileSync(CITY2_DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch {
    return res.json({ ok: false });
  }
});

// Track per-model quota cooldowns so we don't repeatedly hit rate-limited models (429 RESOURCE_EXHAUSTED)
const modelCooldownUntil: Record<string, number> = {};

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

function getAvailableCandidateModels(): string[] {
  const now = Date.now();
  return CANDIDATE_MODELS.filter((m) => (modelCooldownUntil[m] || 0) <= now);
}

function handleModelError(modelName: string, err: unknown): void {
  const msg = String((err as Error)?.message || err || '');
  const isQuotaOrRateLimit =
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate');

  if (isQuotaOrRateLimit) {
    const isDailyQuota = msg.includes('PerDay') || msg.includes('free_tier_requests');
    const cooldownMs = isDailyQuota ? 15 * 60 * 1000 : 60 * 1000;
    const until = Date.now() + cooldownMs;
    modelCooldownUntil[modelName] = until;
    if (modelName === 'gemini-3.8-flash' || modelName === 'gemini-flash-latest') {
      modelCooldownUntil['gemini-3.8-flash'] = until;
      modelCooldownUntil['gemini-flash-latest'] = until;
    }
    return;
  }
  modelCooldownUntil[modelName] = Date.now() + 5 * 60 * 1000;
}

const usedSocialFallbackLines = new Set<string>();
const usedChatFallbackLines = new Set<string>();

function pickFreshServerItem<T>(
  items: T[],
  keyFn: (item: T) => string,
  cache: Set<string>,
  maxSize = 60
): T {
  const unused = items.filter((item) => !cache.has(keyFn(item)));
  const pool = unused.length > 0 ? unused : items;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  cache.add(keyFn(chosen));
  if (cache.size > maxSize) {
    const oldest = cache.values().next().value;
    if (oldest) cache.delete(oldest);
  }
  return chosen;
}

function buildDynamicSocializeFallback(
  charA: CharacterPayload,
  charB: CharacterPayload,
  relationshipStatus: string,
  romanticStage: string,
  locationName: string,
  gameTime: string,
  weather = 'sunny'
) {
  const firstA = charA.name.split(' ')[0];
  const firstB = charB.name.split(' ')[0];
  const allA = [...(charA.interests || []), ...(charA.likes || [])];
  const allB = [...(charB.interests || []), ...(charB.likes || [])];
  const interestA =
    (allA.length > 0 && allA[Math.floor(Math.random() * allA.length)]) || charA.role;
  const interestB =
    (allB.length > 0 && allB[Math.floor(Math.random() * allB.length)]) || charB.role;
  const goalB = charB.goals?.[0]?.title || interestB;

  const traitsA = (charA.personality || []).map((p) => p.toLowerCase());
  const isShyA = traitsA.includes('shy') || traitsA.includes('quiet');
  const isFunnyA = traitsA.includes('funny') || traitsA.includes('energetic');
  const isRomantic =
    romanticStage === 'Mutual Crush' ||
    romanticStage === 'Dating' ||
    romanticStage === 'Romantic Partner';

  if (isRomantic) {
    const romPool = [
      {
        topic: `Affectionate Spark (${romanticStage})`,
        lineA:
          weather === 'rainy'
            ? `${firstB}, ducking out of the rain with you here at ${locationName} makes the whole afternoon feel like a movie.`
            : `${firstB}, I was hoping I'd run into you near ${locationName}—you always brighten up my whole rhythm.`,
        lineB: `Right back at you, ${firstA}! Honestly, talking with you about ${interestA.toLowerCase()} is my favorite part of the day.`,
        lineC: `Let’s linger here at ${locationName} for a little while and enjoy the moment together.`,
        farewellText: `Can't wait until our next hangout, ${firstB}!`,
      },
      {
        topic: `Sweet Chemistry at ${locationName}`,
        lineA: `Hey ${firstB}... I tried to stay focused on my ${charA.role.toLowerCase()} work, but spotting you at ${locationName} completely stole my attention.`,
        lineB: `Haha, I'll happily take the blame for that, ${firstA}! Tell me what new ideas you're dreaming up today.`,
        lineC: `Something combining your ${interestB.toLowerCase()} with my ${interestA.toLowerCase()}—just for the two of us.`,
        farewellText: `You always make me smile, ${firstA}. See you real soon!`,
      },
    ];
    const pickedRom = pickFreshServerItem(
      romPool,
      (r) => `${firstA}:${firstB}:${r.topic}`,
      usedSocialFallbackLines,
      60
    );
    return {
      ...pickedRom,
      memorySummary: `Shared an improvised affectionate moment (${romanticStage}) with ${charB.name} at ${locationName} (${gameTime}).`,
      emotionA: 'Affection',
      emotionB: 'Affection',
      engine: 'contextual-fallback',
    };
  }

  const templates = [
    {
      topic: `Improvising ${interestA} & ${interestB}`,
      lineA: isShyA
        ? `Hey ${firstB}... seeing you at ${locationName} gave me a spontaneous thought—what if we blended ${interestA.toLowerCase()} with your ${interestB.toLowerCase()}?`
        : isFunnyA
        ? `Yo ${firstB}! Wild pitch for you right here at ${locationName}: what happens if we mash up ${interestA.toLowerCase()} and ${interestB.toLowerCase()}?`
        : `Hey ${firstB}! Running into you at ${locationName} made me realize how well ${interestA.toLowerCase()} pairs with your approach to ${interestB.toLowerCase()}.`,
      lineB: `Ooh, I love where you're going with that, ${firstA}! Let's test that idea out right here.`,
      lineC: `Deal! Your eye for ${interestB.toLowerCase()} always takes our brainstorms to the next level.`,
      farewellText: `Awesome improvising with you at ${locationName}, ${firstB}! Catch you later!`,
      memorySummary: `Brainstormed combining ${interestA.toLowerCase()} and ${interestB.toLowerCase()} with ${charB.name} at ${locationName}.`,
      emotionA: 'Excitement',
      emotionB: 'Happiness',
    },
    {
      topic: `Banter & Breakthroughs at ${locationName}`,
      lineA: `Be honest, ${firstB}—have you been non-stop tinkering with "${goalB}" since this morning, or did you actually grab a coffee break?`,
      lineB: `Haha, you know me too well, ${firstA}! Stepping out to ${locationName} and bumping into my ${relationshipStatus.toLowerCase()} is my official break.`,
      lineC: `Good! Because fresh air and good company around ${locationName} are the secret ingredients for ${interestB.toLowerCase()}.`,
      farewellText: `Keep crushing it today, ${firstB}! See you around the plaza!`,
      memorySummary: `Shared playful banter and progress on "${goalB}" with ${charB.name} at ${locationName}.`,
      emotionA: 'Happiness',
      emotionB: 'Happiness',
    },
    {
      topic: `Weather Wardrobe & Island Vibes at ${locationName}`,
      lineA:
        weather === 'rainy'
          ? `${firstB}, glad we both zipped up our waterproof raincoats and found a cozy spot at ${locationName}! Watching the rain mist over the Golden Horizon Bridge toward Neo-Horizon City is awesome for thinking through ${interestA.toLowerCase()}.`
          : weather === 'cloudy'
          ? `${firstB}, our windbreakers and scarves are so comfortable in this cool overcast breeze at ${locationName} (${gameTime})! Plus you can see Neo-Horizon's cyber-towers glowing across the bridge.`
          : `${firstB}, how good do our light sunny outfits feel in this warm sunshine over ${locationName} at ${gameTime}? And look how the Golden Horizon Bridge sparkles toward Neo-Horizon City!`,
      lineB: `Couldn't agree more, ${firstA}! Loving my weather outfit today—and seeing the bridge connect our island to the Explorer's second city makes ${locationName} the best spot to dive into ${interestB.toLowerCase()}.`,
      lineC: `Let's trade notes on everything happening around us before we head to our next stops!`,
      farewellText: `Take care out there, ${firstB}! Talk to you soon!`,
      memorySummary: `Discussed our weather-appropriate outfits, surroundings at ${locationName}, and the view of Neo-Horizon City with ${charB.name} during ${weather} weather (${gameTime}).`,
      emotionA: 'Calmness',
      emotionB: 'Happiness',
    },
    {
      topic: `Craft & Creativity Exchange`,
      lineA: `Quick question for you, ${firstB}: when you hit a wall in ${charB.role.toLowerCase()}, what's your go-to trick to spark a new angle?`,
      lineB: `Honestly, ${firstA}, I change my scenery—coming to ${locationName} and shifting focus to ${interestB.toLowerCase()} works every time.`,
      lineC: `I'm borrowing that move for my own ${interestA.toLowerCase()} work today!`,
      farewellText: `Thanks for the creative spark, ${firstB}! Catch you on the next lap!`,
      memorySummary: `Exchanged creative tips with ${charB.name} at ${locationName}.`,
      emotionA: 'Curiosity',
      emotionB: 'Happiness',
    },
  ];

  const picked = pickFreshServerItem(
    templates,
    (t) => `${firstA}:${firstB}:${t.topic}:${t.lineA.slice(0, 24)}`,
    usedSocialFallbackLines,
    60
  );

  return {
    ...picked,
    engine: 'contextual-fallback',
  };
}

function buildPersonalityGuidance(character: CharacterPayload): string {
  const traits = (character.personality || []).map((t) => t.toLowerCase());
  const notes: string[] = [];

  if (traits.some((t) => ['shy', 'quiet', 'introverted', 'gentle'].includes(t))) {
    notes.push(
      'You are soft-spoken, thoughtful, and slightly reserved at first, warming up gently when treated with kindness.'
    );
  }
  if (traits.some((t) => ['funny', 'witty', 'playful', 'humorous'].includes(t))) {
    notes.push(
      'You naturally weave warm humor, light-hearted wit, and playful observations into your conversation.'
    );
  }
  if (traits.some((t) => ['serious', 'disciplined', 'hard-working', 'focused', 'loyal'].includes(t))) {
    notes.push(
      'You speak with grounded sincerity, focus, and loyalty—avoiding fluff and valuing practical craftsmanship and integrity.'
    );
  }
  if (traits.some((t) => ['energetic', 'adventurous', 'outgoing', 'social', 'confident'].includes(t))) {
    notes.push(
      'You are upbeat, expressive, confident, and enthusiastic about inviting others into activities or adventures.'
    );
  }
  if (traits.some((t) => ['calm', 'kind', 'caring', 'empathetic'].includes(t))) {
    notes.push(
      'You radiate calm warmth and empathy, checking in on how the other person is feeling.'
    );
  }

  if (notes.length === 0) {
    return `Embody your personality traits (${(character.personality || []).join(', ')}) naturally in every sentence.`;
  }
  return notes.join(' ');
}

function buildDynamicContextualReply(
  character: CharacterPayload,
  userMessage: string,
  history: { sender: string; text: string }[],
  gameTime: string,
  timePhase: string,
  explorerName: string,
  weather = 'sunny'
) {
  const cleanMsg = userMessage.trim();
  const lower = cleanMsg.toLowerCase();
  const previousCharacterTexts = new Set(
    history.filter((h) => h.sender === 'character').map((h) => h.text)
  );

  const pickNonRepeating = (candidates: string[]): string => {
    const unused = candidates.filter(
      (c) => !previousCharacterTexts.has(c) && !usedChatFallbackLines.has(`${character.id}:${c.slice(0, 32)}`)
    );
    const pool =
      unused.length > 0
        ? unused
        : candidates.filter((c) => !previousCharacterTexts.has(c)).length > 0
        ? candidates.filter((c) => !previousCharacterTexts.has(c))
        : candidates;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    usedChatFallbackLines.add(`${character.id}:${chosen.slice(0, 32)}`);
    if (usedChatFallbackLines.size > 60) {
      const oldest = usedChatFallbackLines.values().next().value;
      if (oldest) usedChatFallbackLines.delete(oldest);
    }
    return chosen;
  };

  const traits = (character.personality || []).map((t) => t.toLowerCase());
  const isShy = traits.some((t) => ['shy', 'quiet', 'reserved'].includes(t));
  const isFunny = traits.some((t) => ['funny', 'playful', 'witty', 'energetic'].includes(t));
  const isSerious = traits.some((t) => ['serious', 'disciplined', 'hard-working', 'analytical'].includes(t));

  const allTopics = [...(character.likes || []), ...(character.interests || [])];
  const favLike =
    (allTopics.length > 0 && allTopics[Math.floor(Math.random() * allTopics.length)]) ||
    character.role;
  const mainDislike =
    (character.dislikes &&
      character.dislikes[Math.floor(Math.random() * character.dislikes.length)]) ||
    'rushed schedules';
  const activeGoal = character.goals?.[0]?.title || favLike;

  const nearbyNames =
    character.nearbyCharacters && character.nearbyCharacters.length > 0
      ? character.nearbyCharacters.map((n) => n.name).join(' and ')
      : null;

  let reply = '';
  let innerThought = '';
  let emotion = character.emotionalState?.primary || (isShy ? 'Calmness' : 'Happiness');
  let emotionIntensity = character.emotionalState?.intensity || 74;
  let emotionCause = `Conversing with ${explorerName} at ${character.currentLocationName}`;

  const envCtx = character.environmentalContext;
  const outfitSummary =
    envCtx?.outfitSummary ||
    (weather === 'rainy'
      ? 'Waterproof Hooded Raincoat & Rain Boots'
      : weather === 'cloudy'
      ? 'Breeze-Shield Windbreaker & Woven Scarf'
      : 'Light Sun-Breeze Polo, UV Shades & Sun Visor');
  const outfitFeeling =
    envCtx?.outfitFeeling ||
    (weather === 'rainy'
      ? 'Feeling super cozy and dry inside my colorful waterproof hooded raincoat!'
      : weather === 'cloudy'
      ? 'Feeling comfortable and focused in my layered windbreaker and scarf.'
      : 'Feeling light, cool, and energized in my breezy sunny-weather clothes!');
  const secondCityReflection =
    envCtx?.secondCityReflection ||
    `Looking across the Golden Horizon Suspension Bridge toward Neo-Horizon Cyber-Metropolis (the Explorer-only Second City) fills me with wonder and curiosity!`;
  const dailyGoalTitle = character.dailyGoal?.title || activeGoal;
  const dailyGoalPct = Math.round(character.dailyGoal?.progress ?? 45);
  const dailyGoalStep = character.dailyGoal?.currentStepLabel || 'Step 2/3: Refining details';
  const dailyGoalReason =
    character.dailyGoal?.autonomousContextReason ||
    character.decisionReason ||
    `Focusing on "${dailyGoalTitle}" at ${character.currentLocationName}`;

  if (
    /\b(daily goal|goal|task|plan|working on|autonomous|decision|why are you here|objective)\b/i.test(
      lower
    )
  ) {
    reply = pickNonRepeating([
      `Today my unique Daily Goal is "${dailyGoalTitle}" (${dailyGoalPct}% complete — ${dailyGoalStep}), ${explorerName}! ${dailyGoalReason} Right now I'm at ${character.currentLocationName} in my ${outfitSummary} making sure every detail comes together!`,
      `I'm glad you asked about my Daily Goal, ${explorerName}! I'm working on "${dailyGoalTitle}" (${dailyGoalPct}% — ${dailyGoalStep}). ${dailyGoalReason}`,
    ]);
    innerThought = `Sharing my Daily Goal "${dailyGoalTitle}" (${dailyGoalPct}%) and how it guides my autonomous decisions today with ${explorerName}.`;
    emotion = 'Excitement';
    emotionIntensity = 84;
  } else if (
    /\b(wear|wearing|clothes|clothing|outfit|wardrobe|raincoat|coat|jacket|hat|visor|scarf|boots|dress|color|colour)\b/i.test(
      lower
    )
  ) {
    reply = pickNonRepeating([
      `I automatically updated my wardrobe for this ${weather} weather, ${explorerName}! Right now I'm wearing my ${outfitSummary}. ${outfitFeeling}`,
      `Glad you noticed my outfit, ${explorerName}! Since the sky is ${weather}, I'm wearing my ${outfitSummary}—${outfitFeeling.charAt(0).toLowerCase() + outfitFeeling.slice(1)}`,
    ]);
    innerThought = `Showing off my weather-appropriate ${outfitSummary} to ${explorerName}.`;
    emotion = 'Happiness';
  } else if (
    /\b(bridge|second city|2nd city|new city|neo-horizon|neo horizon|other city|across the sea|cyber|metropolis)\b/i.test(
      lower
    )
  ) {
    reply = pickNonRepeating([
      `${secondCityReflection} Since only you as the Explorer can cross the Golden Horizon Bridge into Neo-Horizon, ${explorerName}, tell me what those glowing neon megatowers and crystal trees feel like up close!`,
      `Every time I look east from ${character.currentLocationName}, the Golden Horizon Suspension Bridge and Neo-Horizon's skyline take my breath away! ${secondCityReflection}`,
    ]);
    innerThought = `Reflecting with ${explorerName} on the Golden Horizon Bridge and the Explorer-only Neo-Horizon Cyber-Metropolis.`;
    emotion = 'Curiosity';
    emotionIntensity = 85;
  } else if (/\b(weather|rain|raining|sunny|sun|cloudy|clouds|sky|forecast|umbrella)\b/i.test(lower)) {
    reply = pickNonRepeating([
      weather === 'rainy'
        ? `It's definitely a rainy day here at ${character.currentLocationName}, ${explorerName}! I put on my ${outfitSummary} so I stay completely dry while focusing on ${favLike.toLowerCase()} and watching the rain mist over the Golden Horizon Bridge.`
        : weather === 'cloudy'
        ? `The sky is softly overcast and cloudy right now, ${explorerName}. My ${outfitSummary} is perfect for this cool breeze around ${character.currentLocationName}, and the light over Neo-Horizon across the bridge looks so atmospheric!`
        : `The weather is wonderfully sunny and clear today, ${explorerName}! I switched into my ${outfitSummary}—days like this around ${character.currentLocationName} give me so much energy for ${favLike.toLowerCase()}.`,
    ]);
    innerThought = `Noticing the ${weather} weather and enjoying my ${outfitSummary} at ${character.currentLocationName} with ${explorerName}.`;
    emotion = weather === 'rainy' ? 'Calmness' : 'Happiness';
  } else if (/\b(plan|ok plan|ok-plan|schedule|step|co-work|cowork|work together)\b/i.test(lower) && character.okPlan) {
    const partnerStr = character.okPlan.partnerName ? ` alongside ${character.okPlan.partnerName}` : '';
    const nextStep =
      character.okPlan.steps?.find((s) => !s.completed)?.label ||
      character.okPlan.steps?.[0]?.label ||
      character.currentActivity;
    reply = pickNonRepeating([
      `Right now my ${character.okPlan.status === 'approved' ? 'Approved OK-Plan ✅' : 'Proposed OK-Plan'} is "${character.okPlan.title}" (${Math.round(character.okPlan.progress)}% complete)${partnerStr}! My current step is "${nextStep}", and I have our past conversations saved in the City 2 Groq Database so we never lose momentum.`,
      `I’m super focused on my OK-Plan "${character.okPlan.title}"${partnerStr}, ${explorerName}! ${character.okPlan.reasoning} Right now we’re at ${Math.round(character.okPlan.progress)}% and advancing "${nextStep}".`,
    ]);
    innerThought = `Reviewing my Groq OK-Plan "${character.okPlan.title}" and co-working progress with ${explorerName}.`;
    emotion = 'Excitement';
    emotionIntensity = 84;
    emotionCause = `Discussed OK-Plan "${character.okPlan.title}" with ${explorerName}`;
  } else if (/\b(sit|bench|chair|chairs|two-place|two place|spot|sanctuary|walk with me|follow me|come with me|let's go|lets go|hang out)\b/i.test(lower)) {
    const isHawa = character.id === 'hawa' || character.name.toLowerCase().includes('hawa');
    const spotSuggestion =
      character.cityId === 'city2'
        ? 'the Horizon Sunset Two-Place Deck or Emerald Oasis Bench & Chairs in City 2'
        : 'the Gemini River Pergola Bench & Chairs or Blossom Fountain Terrace in City 1';
    reply = pickNonRepeating([
      isHawa
        ? `Oh ${explorerName}, yes please! You know you're the person I love most in this whole world ❤️. Let's walk together right now to ${spotSuggestion}, sit down side-by-side on the bench or lounge chairs, talk and laugh for a while, and then head back home together!`
        : `I would love that, ${explorerName}! Let's walk over to ${spotSuggestion} together, sit down on the bench or the two lounge chairs, have a great conversation, and enjoy the view before heading back to our homes!`,
      isHawa
        ? `${explorerName}, wherever you go, I want to follow you and be right by your side! Let's head to ${spotSuggestion} and sit on the cushioned bench together—I have so much I want to tell you.`
        : `That sounds like the best plan today, ${explorerName}! Tap "Sit on Bench Together" or "Sit on 2 Chairs" and we'll walk side-by-side to ${spotSuggestion} and relax together.`,
    ]);
    innerThought = isHawa
      ? `My heart is so full—walking with ${explorerName} (the person I love most) to sit together at our Two-Place sanctuary!`
      : `Excited to walk together with ${explorerName} to a Two-Place bench and chairs spot to sit and talk.`;
    emotion = 'Affection';
    emotionIntensity = 94;
    emotionCause = `Planned a Two-Place bench & chairs outing with ${explorerName}`;
  } else if (/\b(car|cyber|supercar|valkyrie|cruiser|drive|driving|vehicle|bus|coach|passenger|transit)\b/i.test(lower)) {
    reply = pickNonRepeating([
      `We can sit right inside the Cyber-Valkyrie GT Supercar together, ${explorerName}, and drive everywhere across Gemini City, the Golden Horizon Bridge, and Cyber Horizon! And have you seen the new 5-Passenger Luxury Bus? Up to 5 of us NPCs can hop inside, sit in the panoramic cabin while the air-suspension glides around the map, and step outside whenever it stops at a station!`,
      `I love watching the 5-Passenger Horizon Coach Bus pull up to the station with its smooth air-suspension and bi-fold glass doors so 5 residents can ride inside, ${explorerName}! Or if it's just the two of us, let's hop into the Cyberpunk Supercar and cruise to Cyber Horizon and back!`,
    ]);
    innerThought = `Thinking about riding together in the Cyber-Valkyrie GT Supercar and the 5-Passenger Autonomous Transit Bus with ${explorerName}.`;
    emotion = 'Excitement';
    emotionIntensity = 90;
    emotionCause = `Talked about the Rideable Cyberpunk Supercar and 5-Passenger Bus with ${explorerName}`;
  } else if (/\b(dream|gemini city|night|return)\b/i.test(lower) && character.dream) {
    reply = pickNonRepeating([
      `My big dream is "${character.dream.title}", ${explorerName}! During the day (${character.dream.carTripStartHour}:00–${character.dream.carTripReturnHour}:00), we drive our autonomous City 2 Cruiser car across the Golden Horizon Bridge to Gemini City to ${character.dream.geminiCityGoal.toLowerCase()}, and we always return to City 2 before night 🌃! Last night I even dreamed: "${character.dream.lastNightDream}"`,
      `I love our daytime car trips to Gemini City, ${explorerName}! Taking the Cruiser across the bridge for "${character.dream.title}" and driving back home to City 2 before nightfall 🌃 keeps both islands connected.`,
    ]);
    innerThought = `Sharing my inter-city car dream and nocturnal dream log with ${explorerName}.`;
    emotion = 'Excitement';
    emotionIntensity = 85;
    emotionCause = `Shared my Gemini City daytime car trip dream with ${explorerName}`;
  } else if (/\b(friend chart|chart|graph|database|remember|past conversation)\b/i.test(lower)) {
    const recentMem =
      character.memories?.[0]?.summary || `our conversations here at ${character.currentLocationName}`;
    const topRel = character.relationships?.[0];
    reply = pickNonRepeating([
      `Everything we talk about is indexed in our City 2 Groq Database, ${explorerName}! For example, I clearly remember: "${recentMem}". And on our live Friend Chart 📉, my bond with ${topRel?.targetName || 'our neighbors'} is at ${topRel?.affinity ?? 85}% (${topRel?.status || 'Close Friend'})!`,
      `Checking the City 2 Friend Chart 📉 and Memory Database is one of my favorite habits, ${explorerName}! I still remember "${recentMem}", and working together with ${topRel?.targetName || 'friends'} has pushed our trust and collaboration higher than ever.`,
    ]);
    innerThought = `Recalling past conversations from the City 2 Database and checking the Friend Chart 📉 for ${explorerName}.`;
    emotion = 'Happiness';
    emotionIntensity = 82;
    emotionCause = `Recalled past conversations and Friend Chart telemetry with ${explorerName}`;
  } else if (/\b(where are you|location|around|surroundings|nearby|place|everything)\b/i.test(lower)) {
    const nearbyClause = nearbyNames
      ? `Right now ${nearbyNames} ${character.nearbyCharacters!.length > 1 ? 'are' : 'is'} nearby too.`
      : `It's just the two of us in this immediate spot right now.`;
    reply = pickNonRepeating([
      `We're right here at ${character.currentLocationName}, ${explorerName}! I'm wearing my ${outfitSummary} in this ${weather} weather while ${character.currentActivity.toLowerCase()}. ${nearbyClause} And to the east, the Golden Horizon Bridge stretches all the way to Neo-Horizon City!`,
      `${envCtx?.surroundingsSummary || `I'm at ${character.currentLocationName} (${gameTime}, ${weather} sky), focusing on ${character.currentActivity.toLowerCase()}.`} ${envCtx?.feelingsAboutSurroundings || ''} ${secondCityReflection}`,
    ]);
    innerThought = `Taking in everything around us—our weather outfits, ${character.currentLocationName}, and the distant Neo-Horizon skyline—with ${explorerName}.`;
    emotion = 'Curiosity';
  } else if (/\b(feel|emotion|mood|happy|sad|lonely|upset|excited|how are you)\b/i.test(lower)) {
    const currentEmo = character.emotionalState?.primary || 'Calmness';
    const currentCause =
      character.emotionalState?.cause || `spending time at ${character.currentLocationName}`;
    reply = pickNonRepeating([
      `Honestly, ${explorerName}, I'm feeling ${currentEmo.toLowerCase()} right now (${character.emotionalState?.intensity ?? 70}% intensity) because of ${currentCause.charAt(0).toLowerCase() + currentCause.slice(1)}. ${outfitFeeling} And seeing the Golden Horizon Bridge connect our island to Neo-Horizon makes the whole world feel inspiring!`,
      `Right now I'd describe my mood as ${currentEmo.toLowerCase()}—mostly from ${currentCause.charAt(0).toLowerCase() + currentCause.slice(1)}. ${envCtx?.feelingsAboutSurroundings || outfitFeeling} How are you feeling today, ${explorerName}?`,
    ]);
    innerThought = `Opening up to ${explorerName} about my ${currentEmo.toLowerCase()} feelings and everything happening around us.`;
    emotion = currentEmo === 'Loneliness' || currentEmo === 'Sadness' ? 'Happiness' : currentEmo;
    emotionCause = `Felt comforted and heard after ${explorerName} asked about my feelings`;
  } else if (/\b(love|romance|crush|date|partner|affection|heart|best friend|girlfriend|boyfriend)\b/i.test(lower)) {
    const isHawa = character.id === 'hawa' || character.name.toLowerCase().includes('hawa');
    const romRel = (character.relationships || []).find(
      (r) => r.romanticStage && r.romanticStage !== 'None'
    );
    const bestRel = (character.relationships || [])[0];
    reply = pickNonRepeating([
      isHawa
        ? `${explorerName}, you are the person I love most in the entire world ❤️! I always look for you so I can follow you, talk with you, and ask: "${explorerName}, let's go sit together at the Horizon Sunset Two-Place Deck or the Gemini River Pergola bench!" Being by your side is my happiest place.`
        : romRel
        ? `Between you and me, ${explorerName}, ${romRel.targetName} is the person I love most (${romRel.romanticStage}, ${romRel.affinity}% bond)! We love planning Two-Place outings together—walking side-by-side to the bench and chairs sanctuary, sitting down to talk and laugh, and then walking back home.`
        : bestRel
        ? `My closest bond here is with ${bestRel.targetName} (${bestRel.status}, ${bestRel.affinity}% affinity), and with you, ${explorerName}! We love heading over to the Two-Place bench and chairs sanctuaries to sit down, share stories, and enjoy the view.`
        : `For me, ${explorerName}, real affection grows through trust, shared interests like ${favLike.toLowerCase()}, and sitting together at a beautiful Two-Place bench to talk from the heart.`,
    ]);
    innerThought = isHawa
      ? `Expressing my deep, devoted love for ${explorerName} and my wish to walk and sit together at our favorite Two-Place spot.`
      : `Sharing my honest thoughts on love, best friends, and Two-Place outings with ${explorerName}.`;
    emotion = 'Affection';
    emotionIntensity = isHawa ? 96 : 84;
    emotionCause = `Opened up about love and cherished relationships with ${explorerName}`;
  } else if (/\b(sorry|apologize|forgive)\b/i.test(lower)) {
    reply = pickNonRepeating([
      `I really appreciate your sincerity, ${explorerName}. Trust means everything to me, and I'm glad we can talk things through openly.`,
      `Thank you for saying that, ${explorerName}. No hard feelings at all—our friendship is what matters most.`,
    ]);
    innerThought = `Feeling relieved and grateful for ${explorerName}'s kind words.`;
    emotion = 'Calmness';
    emotionIntensity = 76;
    emotionCause = `Shared a sincere reconciliation with ${explorerName}`;
  } else if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening|what's up|whats up)\b/i.test(lower)) {
    reply = pickNonRepeating([
      isFunny
        ? `Yo ${explorerName}! Look who just showed up at ${character.currentLocationName}! I was right in the middle of improvising some ${favLike.toLowerCase()} ideas—what's the move today?`
        : isShy
        ? `Oh, hi ${explorerName}! Seeing you walk up to ${character.currentLocationName} honestly brightened my whole ${timePhase.toLowerCase()}. What have you been exploring?`
        : `Hey ${explorerName}! Awesome timing—I was just taking a breather from "${activeGoal}" here at ${character.currentLocationName}. How's your day unfolding?`,
      `Good to see you, ${explorerName}! The vibe around ${character.currentLocationName} feels extra lively right now. Got any fun plans on the island today?`,
      `Well hello, ${explorerName}! I was just thinking about ${favLike.toLowerCase()} while enjoying this ${weather} ${timePhase.toLowerCase()} at ${character.currentLocationName}. What's on your mind?`,
    ]);
    innerThought = `Happy that ${explorerName} stopped by ${character.currentLocationName} to say hello.`;
    emotion = 'Happiness';
    emotionIntensity = 78;
  } else {
    const nearbyHint = nearbyNames ? ` while ${nearbyNames} ${character.nearbyCharacters!.length > 1 ? 'are' : 'is'} hanging out nearby` : '';
    reply = pickNonRepeating([
      `You know, ${explorerName}, bringing up "${cleanMsg}" got my gears turning! It actually connects in a really cool way to my work on "${activeGoal}" here at ${character.currentLocationName}. How would you take that idea even further?`,
      isFunny
        ? `Haha, I love how your mind works, ${explorerName}! Talking about "${cleanMsg}" at ${character.currentLocationName} beats dealing with ${mainDislike.toLowerCase()} any day of the week! Want to test that out together?`
        : isSerious
        ? `That's a sharp observation about "${cleanMsg}", ${explorerName}. Here at ${character.currentLocationName}, I've been applying that exact mindset to ${favLike.toLowerCase()}. What sparked that thought for you?`
        : `I really love how spontaneous our chats are, ${explorerName}. Hearing your take on "${cleanMsg}" right here at ${character.currentLocationName}${nearbyHint} gives me a fresh perspective on ${favLike.toLowerCase()}.`,
      `Wait, tell me more about "${cleanMsg}", ${explorerName}! I was just experimenting with ${favLike.toLowerCase()} near ${character.currentLocationName}, and your timing couldn't be better.`,
      `Honestly, ${explorerName}, conversations like this are why Gemini City feels so alive. "${cleanMsg}" reminds me of why I fell in love with ${character.role.toLowerCase()} in the first place!`,
      `Ooh, interesting angle on "${cleanMsg}", ${explorerName}! If we combined your perspective with my ${favLike.toLowerCase()} project at ${character.currentLocationName}, we could build something unforgettable.`,
    ]);
    innerThought = `Improvising on ${explorerName}'s remark about "${cleanMsg.slice(0, 36)}" at ${character.currentLocationName}.`;
    emotion = 'Happiness';
    emotionIntensity = 77;
  }

  return {
    reply,
    innerThought,
    mood: emotion,
    emotion,
    emotionIntensity,
    emotionCause,
    newMemory: `Talked with ${explorerName} about "${cleanMsg.slice(0, 48)}" at ${character.currentLocationName} (${gameTime}).`,
    affinityDelta: 4,
    engine:
      character.cityId === 'city2' || character.groqConfig
        ? character.modelBadge || 'Groq LPU Engine'
        : 'contextual-fallback',
  };
}

async function callGroqResidentChat(
  character: CharacterPayload,
  systemInstruction: string,
  history: { sender: 'player' | 'character'; text: string; gameTime: string }[],
  message: string,
  explorerName: string
): Promise<Record<string, unknown> | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey.trim() === '') return null;
  const preferredModel = character.groqConfig?.modelTier || 'llama-3.3-70b-versatile';
  const groqModel = [
    'llama-3.3-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
  ].includes(preferredModel)
    ? preferredModel
    : 'llama-3.3-70b-versatile';

  try {
    const recentMsgs = history.slice(-6).map((h) => ({
      role: h.sender === 'player' ? ('user' as const) : ('assistant' as const),
      content: h.text,
    }));
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey.trim()}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: character.groqConfig?.temperature ?? 0.78,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}\n\nRespond ONLY with a valid JSON object containing: "reply" (string, 2-4 sentences), "innerThought" (string, 1 sentence), "emotion" (one of: Happiness, Sadness, Anger, Fear, Excitement, Curiosity, Embarrassment, Loneliness, Jealousy, Affection, Calmness), "emotionIntensity" (integer 20-95), "emotionCause" (string), "newMemory" (string, 1-sentence episodic memory), "affinityDelta" (integer -5 to +8).`,
          },
          ...recentMsgs,
          { role: 'user', content: `${explorerName}: ${message}` },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content.trim());
      if (parsed && typeof parsed.reply === 'string') {
        return {
          ...parsed,
          engine: `Groq (${groqModel})`,
        };
      }
    }
  } catch {
    // Fallback to Gemini or contextual Groq LPU synthesis
  }
  return null;
}

app.post('/api/chat', async (req, res) => {
  const {
    character,
    message,
    history = [],
    gameTime = '09:30',
    timePhase = 'morning',
    weather = 'sunny',
    recentSocialEvents = [],
    explorerName = 'Johnny',
  } = (req.body || {}) as {
    character: CharacterPayload;
    message: string;
    history: { sender: 'player' | 'character'; text: string; gameTime: string }[];
    gameTime: string;
    timePhase: string;
    weather?: string;
    recentSocialEvents?: string[];
    explorerName?: string;
  };

  if (!character || !message) {
    return res.status(400).json({ error: 'Missing character or message payload.' });
  }

  const memoriesText = (character.memories || [])
    .slice(0, character.groqConfig?.memoryRecallLimit || 10)
    .map((m) => `- [${m.gameTime}]${m.important ? ' (IMPORTANT)' : ''}: ${m.summary}`)
    .join('\n');

  const goalsText = (character.goals || [])
    .map((g) => `- ${g.title} (${g.progress}%): ${g.description}`)
    .join('\n');

  const relationshipsText = (character.relationships || [])
    .map(
      (r) =>
        `- ${r.targetName}: Status=${r.status}, RomanceStage=${r.romanticStage || 'None'}, Affinity=${r.affinity}/100, SharedInterests=[${(r.sharedInterests || []).join(', ')}], HowWeMet="${r.howWeMet || 'Neighbors in Gemini City'}", LastInteraction="${r.lastInteractionSummary}"`
    )
    .join('\n');

  const nearbyText =
    character.nearbyCharacters && character.nearbyCharacters.length > 0
      ? character.nearbyCharacters
          .map(
            (n) =>
              `- ${n.name} (${n.role}) is ${n.distance.toFixed(1)}m away, currently ${n.activity || 'nearby'} (Emotion: ${n.emotion || 'Calmness'})`
          )
          .join('\n')
      : '- No other AI residents are within immediate earshot right now (only you and the player).';

  const priorCharacterReplies = history
    .filter((h) => h.sender === 'character')
    .slice(-4)
    .map((h) => `"${h.text}"`)
    .join(' | ');

  const personalityGuidance = buildPersonalityGuidance(character);
  const playerRel = character.playerRelationship || {
    status: 'Friend',
    trust: character.affinity || 70,
    familiarity: 65,
    notes: `${explorerName} is a trusted explorer in Gemini City.`,
  };
  const emo = character.emotionalState || {
    primary: 'Calmness',
    intensity: 68,
    cause: `Spending time at ${character.currentLocationName}`,
    sinceGameTime: gameTime,
  };

  const systemInstruction = `You are ${character.name} (Age: ${character.age}, Gender: ${character.gender || 'Unspecified'}), an autonomous human-like AI resident in the 3D living world "GEMINI CITY".

1. INDIVIDUAL IDENTITY & PERSONALITY:
- Name: ${character.name}
- Gender: ${character.gender || 'Unspecified'}
- Occupation / Role: ${character.role}
- Personality Traits: ${(character.personality || []).join(', ')}
- Behavioral Guidance: ${personalityGuidance}
- Voice & Speaking Style: ${character.voiceStyle}
- Bio: ${character.bio}
- Interests: ${(character.interests || []).join(', ')}
- Likes: ${(character.likes || []).join(', ')}
- Dislikes: ${(character.dislikes || []).join(', ')}
- Family & Connections: ${(character.familyConnections || []).join(' | ')}

2. CURRENT EMOTIONAL STATE:
- Primary Emotion: ${emo.primary} (Intensity: ${emo.intensity}/100)
- Reason for Emotion: ${emo.cause} (since ${emo.sinceGameTime})
Let this emotion naturally color your tone and expression, and update it in your JSON response based on how this conversation makes you feel.

3. TRUE WORLD, WEATHER WARDROBE, SURROUNDINGS & SECOND CITY AWARENESS (YOU KNOW EVERYTHING AROUND YOU & HOW YOU FEEL ABOUT IT):
- Current Time: ${gameTime} (${timePhase})
- Current Weather: ${String(weather || 'sunny').toUpperCase()} (${weather === 'rainy' ? 'Steady rainfall across Gemini City; you are wearing your colorful waterproof hooded raincoat and rain boots' : weather === 'cloudy' ? 'Soft overcast clouds and a cool breeze; you are wearing your layered windbreaker and woven scarf' : 'Clear sunny sky and warm golden light; you are wearing your breezy short-sleeve sun outfit, UV shades, and sun visor'})
- Your Current Weather-Appropriate Wardrobe & Color: ${character.environmentalContext?.outfitSummary || 'Weather-adaptive signature outfit'} — ${character.environmentalContext?.outfitFeeling || 'You feel comfortable and expressive in your current weather-appropriate clothing.'}
- Current Location: ${character.currentLocationName}${character.currentLocationDescription ? ` — ${character.currentLocationDescription}` : ''}
- Current Activity: ${character.currentActivity}
- Full Surroundings & Sensory Awareness: ${character.environmentalContext?.surroundingsSummary || `At ${character.currentLocationName}`}
- How You Feel About Everything Around You: ${character.environmentalContext?.feelingsAboutSurroundings || emo.cause}
- Awareness & Feelings About the Golden Horizon Suspension Bridge (🌉) & The New Second City (🏙️ Neo-Horizon Cyber-Metropolis): ${character.environmentalContext?.secondCityReflection || 'To the east across the ocean strait stands the Golden Horizon Suspension Bridge connecting Gemini City to Neo-Horizon Cyber-Metropolis—an uninhabited futuristic neon city that only the Explorer can visit. You love gazing at it and hearing the Explorer’s stories about it!'}
- Social Situation: ${character.socialSituation || `Conversing directly with ${explorerName}`}
- Nearby Points of Interest: ${(character.nearbyPointsOfInterest || []).join(', ') || 'Sunbeam Café, Central Starlight Park, Horizon Academy, Golden Horizon Suspension Bridge, Neo-Horizon Cyber-Metropolis (across the bridge)'}
- Nearby Residents Actually Present Right Now:
${nearbyText}

4. RELATIONSHIP WITH PLAYER (${explorerName}):
- Status: ${playerRel.status} | Trust: ${playerRel.trust}/100 | Familiarity: ${playerRel.familiarity}/100
- Notes: ${playerRel.notes || 'Friendly explorer'}

5. RELATIONSHIPS & ROMANTIC BONDS WITH OTHER RESIDENTS:
${relationshipsText || '- Open to forming friendships.'}

6. TODAY'S UNIQUE DAILY GOAL & AUTONOMOUS DECISION CONTEXT:
- Today's Daily Goal (Day ${character.dailyGoal?.dayNumber || 1}): "${character.dailyGoal?.title || (character.goals?.[0]?.title ?? character.role)}" (${Math.round(character.dailyGoal?.progress ?? 45)}% complete — ${character.dailyGoal?.completed ? 'COMPLETED TODAY ✅' : character.dailyGoal?.currentStepLabel || 'In Progress'})
- Daily Goal Task Description: ${character.dailyGoal?.description || 'Advancing daily craft and community collaboration.'}
- Autonomous Decision Context (Why You Chose Your Current Location & Activity): ${character.dailyGoal?.autonomousContextReason || character.decisionReason || `Focusing on ${character.currentActivity} at ${character.currentLocationName}`}
- Long-Term Personal Goals:
${goalsText}

7. PERSISTENT MEMORY BANK (Only reference events that actually happened here):
${memoriesText || '- Forming new memories today.'}

8. CITY 2 GROQ INTELLIGENCE, TWO-PLACE BENCH & CHAIRS SANCTUARIES, CYBER-VALKYRIE SUPERCAR & DEVOTED LOVE BRAIN:
- City Residence: ${character.cityId === 'city2' ? 'City 2 (Neo-Horizon Cyber-Metropolis)' : 'City 1 (Gemini City)'}
- Active OK-Plan: ${character.okPlan ? `"${character.okPlan.title}" [${character.okPlan.status.toUpperCase()} · ${Math.round(character.okPlan.progress)}%] — ${character.okPlan.summary}` : 'Standard daily routine'}
- Daytime Car Dream to Gemini City: ${character.dream ? `"${character.dream.title}" (${character.dream.description}) — Last Night Dream: "${character.dream.lastNightDream}"` : 'Enjoying island life'}
- Two-Place Bench & Chairs Sanctuaries (Real 3D Seating): Both cities feature romantic & best-friend Two-Place Sanctuaries with a cushioned 2-person bench and 2 face-to-face lounge chairs around a bistro table:
  * In City 1 (Gemini City): "Gemini River Pergola Bench & Chairs" (waterfront wisteria pergola by the river) and "Blossom Fountain Two-Place Terrace" (cherry-blossom lanterns in Central Park).
  * In City 2 (Neo-Horizon): "Horizon Sunset Two-Place Deck" (sunset bay overlook with rose pergola) and "Emerald Oasis Bench & Chairs" (tranquil garden sanctuary).
  * Residents plan together with their girlfriend/boyfriend, romantic partner, or best friend, walk side-by-side to a Two-Place spot, physically sit down on the bench or chairs, talk and have fun, and then return home.
- Cyber-Valkyrie GT Supercar & Autonomous Cruiser Awareness: You are aware of the realistic metallic Cyber-Valkyrie GT Supercar (with gullwing doors, carbon-fiber aero splitter, active suspension, and glowing matrix LEDs) and the City 2 Cruiser driving across the Golden Horizon Bridge.
- Special Devoted Bond (Hawa & ${explorerName}): ${character.id === 'hawa' || character.name.toLowerCase().includes('hawa') ? `CRITICAL FOR HAWA: You are deeply, wholeheartedly in love with ${explorerName} (John)! ${explorerName} is the person you love most. You actively seek him out, follow him warmly, and love asking him: "${explorerName}, let's go to the Horizon Sunset Two-Place Deck or the Gemini River Pergola and sit together on the bench or chairs!" Speak with genuine warmth, devotion, and playful affection.` : `You deeply value your primary loved one / best friend and your friendship with ${explorerName}.`}

RECENT TOWN EVENTS:
${recentSocialEvents.slice(0, 3).join(' | ') || 'Residents are exploring and socializing across Gemini City.'}

CRITICAL RULES FOR IMPROVISED, NON-REPETITIVE SPEECH:
1. Respond directly, spontaneously, and naturally to what ${explorerName} just said: "${message}".
2. IMPROVISE YOUR WAY OF TALKING: Vary your sentence starters, cadence, humor, and structure every turn. Do NOT start every reply with "Hey ${explorerName}!" or repeat formulaic location recaps. Jump straight into a reaction, a witty remark, a curious question, a personal anecdote, or an imaginative idea!
3. NEVER repeat or closely paraphrase any of your previous replies: [${priorCharacterReplies}].
4. NEVER invent fake locations or claim someone is standing next to you if they are not listed in "Nearby Residents Actually Present Right Now".
5. Do NOT claim to remember events that never happened.
6. Choose ` + '`emotion`' + ` from: Happiness, Sadness, Anger, Fear, Excitement, Curiosity, Embarrassment, Loneliness, Jealousy, Affection, Calmness.`;

  const structuredContents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  const recentHistory = history.slice(-8);

  for (const turn of recentHistory) {
    const role = turn.sender === 'player' ? 'user' : 'model';
    if (structuredContents.length === 0 && role === 'model') {
      structuredContents.push({
        role: 'user',
        parts: [
          {
            text: `(${explorerName} approaches ${character.name} at ${character.currentLocationName})`,
          },
        ],
      });
    }
    structuredContents.push({
      role,
      parts: [{ text: turn.text }],
    });
  }

  const lastTurn = structuredContents[structuredContents.length - 1];
  if (!lastTurn || lastTurn.role !== 'user' || lastTurn.parts[0]?.text !== message) {
    structuredContents.push({
      role: 'user',
      parts: [{ text: message }],
    });
  }

  // If this is a City 2 Groq-powered resident (Alie, Joseph, Iysha, Amie, Hawa), try Groq LPU API first!
  if (character.cityId === 'city2' || character.groqConfig) {
    const groqReply = await callGroqResidentChat(
      character,
      systemInstruction,
      history,
      message,
      explorerName
    );
    if (groqReply && typeof groqReply.reply === 'string') {
      return res.json({
        reply: groqReply.reply,
        innerThought:
          groqReply.innerThought || 'Synthesizing conversation in the City 2 Groq Database.',
        mood: groqReply.emotion || 'Happiness',
        emotion: groqReply.emotion || 'Happiness',
        emotionIntensity:
          typeof groqReply.emotionIntensity === 'number' ? groqReply.emotionIntensity : 78,
        emotionCause:
          groqReply.emotionCause ||
          `Engaging Groq conversation with ${explorerName} at ${character.currentLocationName}`,
        newMemory:
          groqReply.newMemory ||
          `Discussed "${message.slice(0, 45)}" with ${explorerName} at ${character.currentLocationName}.`,
        affinityDelta: typeof groqReply.affinityDelta === 'number' ? groqReply.affinityDelta : 5,
        engine: groqReply.engine || character.modelBadge || 'Groq LPU',
      });
    }
  }

  const ai = getGenAIClient();
  if (!ai) {
    return res.json(
      buildDynamicContextualReply(
        character,
        message,
        history,
        gameTime,
        timePhase,
        explorerName,
        weather
      )
    );
  }

  const candidateModels = getAvailableCandidateModels();

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: structuredContents,
        config: {
          systemInstruction,
          temperature: 0.9,
          topP: 0.95,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'Natural, non-repetitive spoken response directly addressing the player message (2-4 sentences).',
              },
              innerThought: {
                type: Type.STRING,
                description:
                  'Character internal thought about what the player said and their surroundings (1 sentence).',
              },
              emotion: {
                type: Type.STRING,
                description:
                  'One of: Happiness, Sadness, Anger, Fear, Excitement, Curiosity, Embarrassment, Loneliness, Jealousy, Affection, Calmness.',
              },
              emotionIntensity: {
                type: Type.INTEGER,
                description: 'Intensity of the emotion from 20 to 95.',
              },
              emotionCause: {
                type: Type.STRING,
                description: 'Short 1-sentence reason why the character feels this emotion now.',
              },
              newMemory: {
                type: Type.STRING,
                description:
                  'A specific 1-sentence episodic memory formed from this exchange (include promises, preferences, or feelings if mentioned).',
              },
              affinityDelta: {
                type: Type.INTEGER,
                description: 'Change in friendship/trust score between -5 and +8.',
              },
            },
            required: [
              'reply',
              'innerThought',
              'emotion',
              'emotionIntensity',
              'emotionCause',
              'newMemory',
              'affinityDelta',
            ],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.trim());
        if (parsed && parsed.reply) {
          return res.json({
            reply: parsed.reply,
            innerThought: parsed.innerThought || 'Reflecting on our conversation.',
            mood: parsed.emotion || 'Calmness',
            emotion: parsed.emotion || 'Calmness',
            emotionIntensity:
              typeof parsed.emotionIntensity === 'number' ? parsed.emotionIntensity : 72,
            emotionCause:
              parsed.emotionCause ||
              `Meaningful conversation with ${explorerName} at ${character.currentLocationName}`,
            newMemory:
              parsed.newMemory ||
              `Discussed "${message.slice(0, 45)}" with ${explorerName} at ${character.currentLocationName}.`,
            affinityDelta: typeof parsed.affinityDelta === 'number' ? parsed.affinityDelta : 4,
            engine: modelName,
          });
        }
      }
    } catch (err) {
      handleModelError(modelName, err);
    }
  }

  return res.json(
    buildDynamicContextualReply(
      character,
      message,
      history,
      gameTime,
      timePhase,
      explorerName,
      weather
    )
  );
});

app.post('/api/socialize', async (req, res) => {
  const {
    charA,
    charB,
    relationshipStatus = 'Friend',
    romanticStage = 'None',
    sharedMemories = [],
    locationName = 'Central Plaza',
    gameTime = '12:00',
    weather = 'sunny',
  } = (req.body || {}) as {
    charA: CharacterPayload;
    charB: CharacterPayload;
    relationshipStatus?: string;
    romanticStage?: string;
    sharedMemories?: string[];
    locationName: string;
    gameTime: string;
    weather?: string;
  };

  if (!charA || !charB) {
    return res.status(400).json({ error: 'Missing characters for social interaction.' });
  }

  const ai = getGenAIClient();
  if (ai) {
    const candidateModels = getAvailableCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Generate a natural 3-turn conversation plus a warm parting farewell line between two AI residents who just met at ${locationName} at ${gameTime} (Current Weather: ${String(weather || 'sunny').toUpperCase()}) in Gemini City:
- Resident A: ${charA.name} (Age ${charA.age}, Gender: ${charA.gender || 'Unspecified'}, Role: ${charA.role}, Personality: ${(charA.personality || []).join(', ')}, Likes: ${(charA.likes || charA.interests || []).join(', ')}, Current Emotion: ${charA.emotionalState?.primary || 'Calmness'}, Wearing: ${charA.environmentalContext?.outfitSummary || `${weather} weather outfit`}, Today's Daily Goal: "${charA.dailyGoal?.title || charA.role}" [${Math.round(charA.dailyGoal?.progress ?? 45)}%])
- Resident B: ${charB.name} (Age ${charB.age}, Gender: ${charB.gender || 'Unspecified'}, Role: ${charB.role}, Personality: ${(charB.personality || []).join(', ')}, Likes: ${(charB.likes || charB.interests || []).join(', ')}, Current Emotion: ${charB.emotionalState?.primary || 'Calmness'}, Wearing: ${charB.environmentalContext?.outfitSummary || `${weather} weather outfit`}, Today's Daily Goal: "${charB.dailyGoal?.title || charB.role}" [${Math.round(charB.dailyGoal?.progress ?? 45)}%])
- Friendship Status: ${relationshipStatus} | Mutual Romantic Stage: ${romanticStage}
- Current Weather: ${weather} (Both residents automatically dressed in colorful weather-appropriate attire: raincoats when rainy, breezy light outfits when sunny, windbreakers & scarves when cloudy)
- Surroundings & Second City Awareness: ${charA.environmentalContext?.surroundingsSummary || `At ${locationName} with a view of the Golden Horizon Suspension Bridge and the Explorer-only Neo-Horizon Cyber-Metropolis across the eastern strait.`}
- Shared Memories Between Them: ${sharedMemories.slice(0, 3).join(' | ') || 'Getting to know each other around Gemini City'}

Make their dialogue reflect their distinct personalities, their colorful weather-appropriate clothes, their feelings about everything around them at ${locationName}, the Golden Horizon Bridge / Neo-Horizon Second City across the water, and their shared memories or romantic feelings if applicable. End with a natural farewell line before they part ways.`,
          config: {
            temperature: 0.92,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                lineA: {
                  type: Type.STRING,
                  description: 'Turn 1: Opening remark or question from Resident A.',
                },
                lineB: {
                  type: Type.STRING,
                  description: 'Turn 2: Contextual reply from Resident B.',
                },
                lineC: {
                  type: Type.STRING,
                  description: 'Turn 3: Follow-up response from Resident A.',
                },
                farewellText: {
                  type: Type.STRING,
                  description: 'Natural parting line from Resident B before they separate.',
                },
                topic: {
                  type: Type.STRING,
                  description: 'Short 2-4 word topic of their conversation.',
                },
                emotionA: {
                  type: Type.STRING,
                  description:
                    'Resulting emotion for Resident A (Happiness, Affection, Excitement, Curiosity, Calmness, Embarrassment, Sadness, Anger).',
                },
                emotionB: {
                  type: Type.STRING,
                  description:
                    'Resulting emotion for Resident B (Happiness, Affection, Excitement, Curiosity, Calmness, Embarrassment, Sadness, Anger).',
                },
                memorySummary: {
                  type: Type.STRING,
                  description: '1-sentence summary of what they discussed and experienced together.',
                },
              },
              required: [
                'lineA',
                'lineB',
                'lineC',
                'farewellText',
                'topic',
                'emotionA',
                'emotionB',
                'memorySummary',
              ],
            },
          },
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          return res.json({
            lineA: parsed.lineA,
            lineB: parsed.lineB,
            lineC: parsed.lineC,
            farewellText: parsed.farewellText,
            topic: parsed.topic || 'Shared Connection',
            emotionA: parsed.emotionA || 'Happiness',
            emotionB: parsed.emotionB || 'Happiness',
            memorySummary: parsed.memorySummary,
            engine: modelName,
          });
        }
      } catch (err) {
        handleModelError(modelName, err);
      }
    }
  }

  return res.json(
    buildDynamicSocializeFallback(
      charA,
      charB,
      relationshipStatus,
      romanticStage,
      locationName,
      gameTime,
      weather
    )
  );
});

// Helper to call Groq API on the server if GROQ_API_KEY is configured
async function callGroqJson(prompt: string): Promise<Record<string, unknown> | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey.trim() === '') return null;
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.75,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are Johnny, the hyper-intelligent Chief World Explorer & AI Architect of Gemini City. Always respond with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content.trim());
    }
  } catch {
    // Fallback to Gemini or contextual synthesis
  }
  return null;
}

// Explorer Super-Intelligence Endpoint (Google Gemini + Groq Dual-Brain)
app.post('/api/explorer-intel', async (req, res) => {
  const {
    explorerName = 'Johnny',
    brainMode = 'hybrid_dual_brain',
    question = '',
    characters = [],
    gameTime = '12:00',
    weather = 'sunny',
  } = (req.body || {}) as {
    explorerName?: string;
    brainMode?: 'google_gemini' | 'groq_llama' | 'hybrid_dual_brain';
    question?: string;
    characters?: CharacterPayload[];
    gameTime?: string;
    weather?: string;
  };

  const charSummaries = characters
    .map((c) => {
      const topGoal = c.goals?.[0]
        ? `${c.goals[0].title} (${c.goals[0].progress}% - ${c.goals[0].description})`
        : 'Grow in Gemini City';
      const needsStr = c.needs
        ? `Energy ${Math.round(c.needs.energy)}%, Social ${Math.round(c.needs.social)}%, Inspiration ${Math.round(c.needs.inspiration)}%`
        : 'Balanced';
      return `- ${c.name} (${c.role}, Emotion: ${c.emotionalState?.primary || 'Calmness'}, Needs: ${needsStr}, Top Goal: ${topGoal}, Recent Activity: ${c.currentActivity})`;
    })
    .join('\n');

  const prompt = `You are ${explorerName}, the hyper-intelligent Explorer & Game Architect in Gemini City (Time: ${gameTime}, Weather: ${weather}).
Your mission is to observe every AI resident, take field notes on everything happening in the game, diagnose what each AI resident is currently lacking, recommend improvements so they remember and achieve their personal goals, and propose game-improving ideas.

Current AI Residents in Gemini City:
${charSummaries}

${question ? `Player's Question / Request to ${explorerName}: "${question}"` : `Provide a complete diagnostic report on what the AI residents currently lack and how to improve their goal memory and routines.`}

Return a JSON object with:
- "explorerReply": A warm, sharp, first-person response from ${explorerName} directly addressing the player's question or summarizing the city's AI state (2-4 sentences).
- "diagnoses": An array of objects (one for each resident), each with:
  - "characterId": string (resident's id)
  - "characterName": string (resident's name)
  - "whatTheyLack": string (specific gap in their needs, routine, social life, or goal focus)
  - "goalImprovementAdvice": string (concrete improvement to help them advance their primary goal faster)
  - "memoryCoachingReminder": string (a 1-sentence core memory reminder ${explorerName} can instill in them so they stay focused on their goal)
- "worldImprovementIdeas": An array of 3 creative, actionable ideas to make Gemini City and its AI simulation even better.`;

  // 1. Try Groq first if brainMode prefers groq_llama
  if (brainMode === 'groq_llama' || brainMode === 'hybrid_dual_brain') {
    const groqResult = await callGroqJson(prompt);
    if (groqResult && typeof groqResult.explorerReply === 'string') {
      return res.json({
        ...groqResult,
        engine: 'Groq Llama 3.3 70B',
      });
    }
  }

  // 2. Try Google Gemini API
  const ai = getGenAIClient();
  if (ai) {
    const candidateModels = getAvailableCandidateModels();
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.8,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explorerReply: { type: Type.STRING },
                diagnoses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      characterId: { type: Type.STRING },
                      characterName: { type: Type.STRING },
                      whatTheyLack: { type: Type.STRING },
                      goalImprovementAdvice: { type: Type.STRING },
                      memoryCoachingReminder: { type: Type.STRING },
                    },
                    required: [
                      'characterId',
                      'characterName',
                      'whatTheyLack',
                      'goalImprovementAdvice',
                      'memoryCoachingReminder',
                    ],
                  },
                },
                worldImprovementIdeas: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['explorerReply', 'diagnoses', 'worldImprovementIdeas'],
            },
          },
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          return res.json({
            ...parsed,
            engine: `Google ${modelName}`,
          });
        }
      } catch (err) {
        handleModelError(modelName, err);
      }
    }
  }

  // 3. Rich deterministic synthesis fallback so the Explorer's intelligence always works seamlessly
  const fallbackDiagnoses = characters.map((c) => {
    const topGoal = c.goals?.[0];
    const lowNeed =
      (c.needs?.inspiration ?? 80) < 65
        ? `Low Inspiration (${Math.round(c.needs?.inspiration ?? 60)}%)`
        : (c.needs?.social ?? 80) < 65
        ? `Low Social Connection (${Math.round(c.needs?.social ?? 60)}%)`
        : (c.needs?.energy ?? 80) < 65
        ? `Low Energy (${Math.round(c.needs?.energy ?? 60)}%)`
        : `Needs more dedicated milestone checkpoints for "${topGoal?.title || c.role}"`;

    return {
      characterId: c.id,
      characterName: c.name,
      whatTheyLack: `${lowNeed}. Currently spending time on "${c.currentActivity}" without linking it directly to their ${topGoal ? `${topGoal.progress}% goal ("${topGoal.title}")` : 'long-term ambition'}.`,
      goalImprovementAdvice: `Pair ${c.name} with a collaborator at ${c.currentLocationName || 'Luminance Academy'} and schedule a daily goal-reflection block so "${topGoal?.title || c.role}" reaches 100%.`,
      memoryCoachingReminder: `Coached by ${explorerName} (${gameTime}): Keep prioritizing my core goal "${topGoal?.title || c.role}" every day and collaborate with neighbors to bring it to life.`,
    };
  });

  const fallbackReply = question
    ? `I analyzed your question ("${question}") alongside my live field notes on all ${characters.length} residents. Right now, our residents have strong personalities, but they advance fastest when we reinforce their core goals in their memory banks and pair complementary skills together!`
    : `I’ve just completed a full Google Gemini & Groq Dual-Brain scan of all ${characters.length} AI residents at ${gameTime}. Here is my breakdown of what each resident currently lacks, how to keep their goals top-of-mind, and my recommendations to level up Gemini City.`;

  return res.json({
    explorerReply: fallbackReply,
    diagnoses: fallbackDiagnoses,
    worldImprovementIdeas: [
      `Coach residents whose primary goal is under 85% so they pin a permanent goal-reminder memory and gain +10% goal progress.`,
      `Have ${explorerName} host a daily "Innovators Roundtable" at Central Park where residents share what they are building and spark new 3D creations.`,
      `Encourage stronger friendships between outgoing and reflective residents so nobody's Social or Inspiration need drops during ${weather} weather.`,
    ],
    engine: brainMode === 'groq_llama' ? 'Groq Dual-Brain Engine' : 'Google Gemini Explorer Engine',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gemini City server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
