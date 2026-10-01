import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveConversationSession,
  ActivePairOuting,
  AICharacter,
  BuildingId,
  CharacterMemory,
  ChatMessage,
  CreatedWorldObject,
  EmotionType,
  EmoteType,
  ExplorerFieldNote,
  ExplorerProfile,
  ExplorerResidentDiagnosis,
  GraphicsQuality,
  MemoryToastNotification,
  PlayerApproachInvitation,
  RelationshipStatus,
  ResidentGroqConfig,
  SocialEvent,
  SocialProximityMode,
  TwoPlaceSpotId,
  WeatherType,
} from './types/game';
import {
  advanceResidentDailyGoal,
  applyDailyFriendshipDecay,
  buildMultiTurnSocialExchange,
  buildPairOutingPlanAndDialogue,
  buildPlayerApproachGreeting,
  buildResidentEnvironmentalContext,
  CITY_BUILDINGS,
  createUniqueId,
  decideAutonomousActivity,
  deduplicateCharacterMemories,
  DEFAULT_EXPLORER_PROFILE,
  EMOTE_CATALOG,
  evaluateMutualRomance,
  evolveResidentEmotion,
  findNearestSeatForPosition,
  formatGameClock,
  generateAutonomousCreation,
  generateResidentDailyGoal,
  getActiveCityEvent,
  getLovedOneAndCarBrainSummary,
  getNextPeriodicWeather,
  getOrCreateResidentDailyGoal,
  getPrimaryLovedOneOrBestFriend,
  getRelationshipStatus,
  getResidentWeatherWardrobe,
  getTimePhase,
  getTimePhaseLabel,
  getWeatherLabel,
  INITIAL_CHARACTERS,
  INITIAL_CREATED_OBJECTS,
  isCity2Character,
  pickAutonomousEmote,
  rerollResidentDailyGoal,
  summarizeCharacterMemories,
  TWO_PLACE_SPOTS,
} from './data/cityData';
import {
  BridgeReflectionTheme,
  CityViewport3D,
  getResidentBridgeReflection,
} from './components/CityViewport3D';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CharacterSheet } from './components/CharacterSheet';
import { ExplorerSheet } from './components/ExplorerSheet';
import { WorldGuideModal } from './components/WorldGuideModal';
import { CharacterEditorModal } from './components/CharacterEditorModal';
import { City2GroqHubModal } from './components/City2GroqHubModal';
import {
  requestResidentChatWithFallback,
  resolveApiUrl,
  safeApiFetchJson,
} from './utils/apiClient';
import { speakCharacterLine, stopCharacterSpeech } from './utils/voiceSynthesis';
import {
  BookOpen,
  Calendar,
  Cloud,
  CloudRain,
  Compass,
  Edit3,
  EyeOff,
  FastForward,
  Gamepad2,
  Hand,
  Heart,
  Home,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Pause,
  Play,
  Settings,
  SkipForward,
  Sliders,
  Smartphone,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  UserCheck,
  UserPlus,
  Users,
  Wand2,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'gemini_city_living_world_v3';
const CITY2_STORAGE_KEY = 'neo_horizon_city2_groq_db_v1';

const DISTINCT_OPENING_LINES: Record<string, string> = {
  aria: 'Good morning, Johnny! I was just checking how the morning light hits the Horizon Academy clock tower. How are you feeling today?',
  kaelen: 'Hey Johnny! Welcome to Sunbeam Café’s corner of town—I just pulled a fresh batch of cardamom espresso for you and the guys. How’s your day going?',
  leo: 'Whoa, hey Johnny!! Watch your step—I’m calibrating the solar wings on my autonomous rover Pip v2! Wanna test it with me and Ibrahim?',
  elena: 'Peaceful greetings, Johnny. Listen to how the breeze carries the sound of the park fountain across the plaza... How have your travels been?',
  maya: 'Hey Johnny! You’re just in time—Sana and I were just talking, and I’m gathering neighborhood stories for Gemini City Chronicles! Got a minute to chat?',
  alie: 'Welcome to Neo-Horizon City, Johnny! I’m Alie—my Groq Llama-3.3 70B solar brain is online at Alie’s Cyber-Solar Villa, and Iysha and I are co-working on our OK-Plan today!',
  joseph: 'Yo Johnny! Joseph here at my Synth-Wave Loft in City 2! My DeepSeek-R1 reasoning core just mapped a new bridge melody—check out our Friend Chart or OK-Plan anytime!',
  iysha: 'Warm blessings, Johnny! I’m Iysha—Alie and I are linked in love and working together between my Bioluminescent Bungalow and his Cyber-Solar Villa!',
  amie: 'Darling Johnny! Amie welcoming you to Holo-Couture Manor in City 2! My Qwen-2.5 72B design studio is ready—want to review my OK-Plan or launch our Dream Car trip to Gemini City?',
  hawa: 'Greetings under the Neo-Horizon stars, Johnny. I’m Hawa at Starlight Sanctuary—I’ve been recording everyone’s overnight dreams before our daytime car excursion to Gemini City!',
};

function sanitizeCharactersList(chars: AICharacter[]): AICharacter[] {
  // Automatically merge any newly introduced INITIAL_CHARACTERS (such as the 5 Second City Groq NPCs: Alie, Joseph, Iysha, Amie, Hawa)
  const existingIds = new Set(chars.map((c) => c.id));
  const mergedChars = [
    ...chars,
    ...INITIAL_CHARACTERS.filter((initChar) => !existingIds.has(initChar.id)),
  ];

  return mergedChars.map((c) => {
    const template = INITIAL_CHARACTERS.find((initC) => initC.id === c.id);
    const seenRelTargets = new Set<string>();
    const rawFilteredRels = (c.relationships || template?.relationships || []).filter((r) => {
      if (!r || !r.targetId || seenRelTargets.has(r.targetId)) return false;
      seenRelTargets.add(r.targetId);
      return true;
    });
    const hasAnyStampedDecay = rawFilteredRels.some(
      (r) => typeof r.daysSinceLastInteraction === 'number' || typeof r.lastMetDay === 'number'
    );
    let seededOneCooling = false;
    const cleanRels = rawFilteredRels.map((r, rIdx) => {
      if (hasAnyStampedDecay) {
        const dApart = r.daysSinceLastInteraction ?? 0;
        return {
          ...r,
          daysSinceLastInteraction: dApart,
          lastDecayAmount: r.lastDecayAmount ?? (dApart >= 2 ? 1 : 0),
          needsAttention: r.needsAttention ?? dApart >= 2,
        };
      }
      const isYesterday = Boolean(r.lastMetTime?.toLowerCase().includes('yesterday'));
      if (
        !seededOneCooling &&
        (isYesterday || rIdx === rawFilteredRels.length - 1) &&
        r.status !== 'Romantic Partner'
      ) {
        seededOneCooling = true;
        return {
          ...r,
          lastMetDay: -1,
          daysSinceLastInteraction: 2,
          lastDecayAmount: 1,
          needsAttention: true,
        };
      }
      return {
        ...r,
        lastMetDay: isYesterday ? 0 : 1,
        daysSinceLastInteraction: isYesterday ? 1 : 0,
        lastDecayAmount: 0,
        needsAttention: false,
      };
    });
    const seenGoalIds = new Set<string>();
    const cleanGoals = (c.goals || template?.goals || []).map((g) => {
      let gid = g.id || createUniqueId('goal');
      if (seenGoalIds.has(gid)) {
        gid = createUniqueId(gid);
      }
      seenGoalIds.add(gid);
      return gid === g.id ? g : { ...g, id: gid };
    });
    const rawPlan = c.okPlan || template?.okPlan;
    const normalizedPlan = rawPlan
      ? (() => {
          const normalizedSteps = (rawPlan.steps || []).map((s, idx) => {
            if (typeof s === 'string') {
              return {
                id: `s${idx + 1}`,
                label: s,
                locationId: (idx === 0
                  ? c.homeId
                  : idx === 1
                  ? 'neo_plaza'
                  : 'park') as BuildingId,
                completed: idx < (rawPlan.currentStepIndex ?? 0),
              };
            }
            return {
              id: s.id || `s${idx + 1}`,
              label: String(s.label || ''),
              locationId: (s.locationId || c.homeId) as BuildingId,
              completed: Boolean(s.completed),
            };
          });
          const firstIncomplete = normalizedSteps.findIndex((s) => !s.completed);
          const stepIndex =
            typeof rawPlan.currentStepIndex === 'number'
              ? rawPlan.currentStepIndex
              : firstIncomplete !== -1
              ? firstIncomplete
              : 0;
          const titleStr = rawPlan.title || rawPlan.planTitle || `${c.name}'s Neo-Horizon Plan`;
          const summaryStr =
            rawPlan.summary ||
            rawPlan.objective ||
            `Collaborate across Neo-Horizon City and Gemini City.`;
          return {
            ...rawPlan,
            id: rawPlan.id || rawPlan.planId || createUniqueId(`okplan_${c.id}`),
            planId: rawPlan.planId || rawPlan.id || createUniqueId(`okplan_${c.id}`),
            title: titleStr,
            planTitle: titleStr,
            summary: summaryStr,
            objective: summaryStr,
            reasoning:
              rawPlan.reasoning ||
              `Groq LPU reasoning aligned with ${c.name}'s daily goals and relationships.`,
            steps: normalizedSteps,
            currentStepIndex: stepIndex,
            approvedByPlayer:
              rawPlan.approvedByPlayer ??
              (rawPlan.status === 'approved' || rawPlan.status === 'active'),
            progress: typeof rawPlan.progress === 'number' ? rawPlan.progress : 45,
          };
        })()
      : undefined;

    const rawDream = c.dream || c.dreamState || template?.dream || template?.dreamState;
    const normalizedDream = rawDream
      ? {
          ...rawDream,
          title: rawDream.title || rawDream.dreamTheme || 'Inter-City Dream Excursion',
          dreamTheme: rawDream.dreamTheme || rawDream.title || 'Inter-City Dream Excursion',
          description:
            rawDream.description ||
            rawDream.lastDreamSummary ||
            rawDream.lastNightDream ||
            'Daytime car trip across the Golden Horizon Bridge to Gemini City, returning before nightfall.',
          geminiCityVisitSpot: (rawDream.geminiCityVisitSpot ||
            rawDream.dreamTargetGeminiBuildingId ||
            'park') as BuildingId,
          dreamTargetGeminiBuildingId: (rawDream.dreamTargetGeminiBuildingId ||
            rawDream.geminiCityVisitSpot ||
            'park') as BuildingId,
          geminiCityGoal:
            rawDream.geminiCityGoal ||
            rawDream.title ||
            'Visit Gemini City during the day and return before nightfall',
          carTripStartHour: rawDream.carTripStartHour ?? 11.0,
          carTripReturnHour: rawDream.carTripReturnHour ?? 18.0,
          lastNightDream:
            rawDream.lastNightDream ||
            rawDream.lastDreamSummary ||
            rawDream.description ||
            'Dreamed of crossing the Golden Horizon Bridge at sunrise.',
          lastDreamSummary:
            rawDream.lastDreamSummary ||
            rawDream.lastNightDream ||
            rawDream.description ||
            'Dreamed of crossing the Golden Horizon Bridge at sunrise.',
          carTripStatus:
            rawDream.carTripStatus ||
            (rawDream.carTripPhase === 'visiting_gemini' ? 'visiting_gemini' : 'home_in_city2'),
        }
      : undefined;

    return {
      ...c,
      cityId: c.cityId || template?.cityId || (isCity2Character(c.id) ? 'city2' : 'city1'),
      groqConfig: c.groqConfig || template?.groqConfig,
      okPlan: normalizedPlan,
      dream: normalizedDream,
      dreamState: normalizedDream,
      coWorkingWithId:
        c.coWorkingWithId ?? c.coWorkingPartnerId ?? template?.coWorkingWithId ?? null,
      coWorkingPartnerId:
        c.coWorkingPartnerId ?? c.coWorkingWithId ?? template?.coWorkingWithId ?? null,
      relationships: cleanRels,
      goals: cleanGoals,
      dailyGoal: getOrCreateResidentDailyGoal(c, c.dailyGoal?.dayNumber || 1, 'sunny'),
      memories: deduplicateCharacterMemories(c.memories || []),
    };
  });
}

function createDefaultChatHistories(chars: AICharacter[]): Record<string, ChatMessage[]> {
  const initial: Record<string, ChatMessage[]> = {};
  chars.forEach((c) => {
    initial[c.id] = [
      {
        id: `welcome_${c.id}`,
        sender: 'character',
        text:
          DISTINCT_OPENING_LINES[c.id] ||
          `Hi Johnny! Lovely seeing you around ${CITY_BUILDINGS[c.currentLocationId]?.name}.`,
        gameTime: '09:00',
        thought: c.currentThought,
        mood: c.currentMood,
      },
    ];
  });
  return initial;
}

const DEFAULT_SOCIAL_EVENTS: SocialEvent[] = [
  {
    id: 'init_soc_1',
    gameTime: '08:30',
    speakerAId: 'aria',
    speakerAName: 'Sana',
    speakerBId: 'maya',
    speakerBName: 'Maya',
    locationName: 'Sunbeam Espresso Café',
    topic: 'Patio Sketches & Sisterhood',
    lines: [
      {
        speakerName: 'Maya',
        text: 'Morning, Sana! Your architectural sketches for the conservatory walkway look incredible in this sunlight.',
      },
      {
        speakerName: 'Sana',
        text: 'Thank you, Maya—having tea with you before my lecture always makes my morning feel peaceful.',
      },
    ],
  },
  {
    id: 'init_soc_2',
    gameTime: '08:45',
    speakerAId: 'kaelen',
    speakerAName: 'Ibrahim',
    speakerBId: 'leo',
    speakerBName: 'Ephraim',
    locationName: 'Central Starlight Park',
    topic: 'Solar Rover & Espresso Fuel',
    lines: [
      {
        speakerName: 'Ibrahim',
        text: 'Ephraim, my brother! I brought fresh espresso out to the park—how is Pip v2 running alongside Abdullah’s acoustic sensors?',
      },
      {
        speakerName: 'Ephraim',
        text: 'Ibrahim!! Best timing ever—watch the solar wings lock onto the sun angle as soon as Johnny walks over!',
      },
    ],
  },
];

export default function App() {
  // 1. In-Game Clock, Day/Night, Day Number, Weather & Graphics Quality State
  const [gameHour, setGameHour] = useState<number>(9.0);
  const [dayNumber, setDayNumber] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.dayNumber === 'number' && parsed.dayNumber >= 1) {
          return parsed.dayNumber;
        }
      }
    } catch {
      // ignore
    }
    return 1;
  });
  const [timeSpeed, setTimeSpeed] = useState<0 | 1 | 3>(1);
  const [weather, setWeather] = useState<WeatherType>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.weather === 'sunny' ||
          parsed.weather === 'cloudy' ||
          parsed.weather === 'rainy'
        ) {
          return parsed.weather;
        }
      }
    } catch {
      // ignore
    }
    return 'sunny';
  });
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'medium' : 'high'
  );
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.voiceEnabled === 'boolean') return parsed.voiceEnabled;
      }
    } catch {
      // ignore
    }
    return true;
  });

  // 2. Explorer Profile (Johnny) & Independent AI Residents State (with localStorage persistence)
  const [explorerProfile, setExplorerProfile] = useState<ExplorerProfile>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.explorerProfile && parsed.explorerProfile.name) {
          return parsed.explorerProfile;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_EXPLORER_PROFILE;
  });

  const [characters, setCharacters] = useState<AICharacter[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
          return sanitizeCharactersList(parsed.characters);
        }
      }
    } catch {
      // ignore
    }
    return sanitizeCharactersList(INITIAL_CHARACTERS);
  });

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<BuildingId | null>(null);
  const [selectedCreatedObject, setSelectedCreatedObject] = useState<CreatedWorldObject | null>(
    null
  );
  const [insideHouseMode, setInsideHouseMode] = useState<boolean>(false);
  const [isUiHidden, setIsUiHidden] = useState<boolean>(false);
  const [isGamepadMode, setIsGamepadMode] = useState<boolean>(false);
  const [gamepadScreenRotation, setGamepadScreenRotation] = useState<0 | 90 | -90>(0);
  const [isControlsDrawerOpen, setIsControlsDrawerOpen] = useState<boolean>(false);
  const [isExplorerSheetOpen, setIsExplorerSheetOpen] = useState<boolean>(false);
  const [isAnalyzingExplorer, setIsAnalyzingExplorer] = useState<boolean>(false);
  const [lastAdvisorReply, setLastAdvisorReply] = useState<string | null>(null);
  const [lastEngineUsed, setLastEngineUsed] = useState<string | null>(null);
  const [socialProximityMode, setSocialProximityMode] = useState<SocialProximityMode>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.socialProximityMode === 'respectful_distance' ||
          parsed.socialProximityMode === 'emotional_closeness'
        ) {
          return parsed.socialProximityMode;
        }
      }
    } catch {
      // ignore
    }
    return 'emotional_closeness';
  });
  const [playerEmote, setPlayerEmote] = useState<EmoteType>('none');
  const [playerActiveBubble, setPlayerActiveBubble] = useState<string | null>(null);
  const [memoryToasts, setMemoryToasts] = useState<MemoryToastNotification[]>([]);

  // Auto-Move to Explore State (Johnny walks around & interacts with all residents)
  const [autoExploreEnabled, setAutoExploreEnabled] = useState<boolean>(false);
  const [autoExploreTargetCharId, setAutoExploreTargetCharId] = useState<string | null>(null);
  const [autoExploreVisitedIds, setAutoExploreVisitedIds] = useState<string[]>([]);
  const [autoExplorePhase, setAutoExplorePhase] = useState<'walking' | 'interacting'>('walking');
  const [createdObjects, setCreatedObjects] = useState<CreatedWorldObject[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.createdObjects) && parsed.createdObjects.length > 0) {
          return parsed.createdObjects;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_CREATED_OBJECTS;
  });
  const [cameraTargetOverride, setCameraTargetOverride] = useState<{ x: number; z: number } | null>(
    null
  );

  // 3. Player Position, Proximity & Resident-Initiated Approach State
  const [joystickVector] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickInputRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const handleJoystickMove = useCallback((vec: { x: number; y: number }) => {
    joystickInputRef.current = vec;
  }, []);
  const [nearbyCharacterId, setNearbyCharacterId] = useState<string | null>(null);
  const [approachInvite, setApproachInvite] = useState<PlayerApproachInvitation | null>(null);
  const [followingCharId, setFollowingCharId] = useState<string | null>('hawa');
  const [playerSittingSpot, setPlayerSittingSpot] = useState<{
    x: number;
    z: number;
    rotationY: number;
    spotId?: TwoPlaceSpotId;
    seatType?: 'bench' | 'chair';
    partnerId?: string;
    partnerName?: string;
  } | null>(null);

  // 4. Conversations & Town Social Chronicle State
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>(() => {
    const defaults = createDefaultChatHistories(INITIAL_CHARACTERS);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.chatHistories && typeof parsed.chatHistories === 'object') {
          const merged: Record<string, ChatMessage[]> = { ...defaults };
          for (const [k, v] of Object.entries(parsed.chatHistories)) {
            if (Array.isArray(v) && v.length > 0) {
              merged[k] = v as ChatMessage[];
            }
          }
          return merged;
        }
      }
    } catch {
      // ignore
    }
    return defaults;
  });
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  const [socialEvents, setSocialEvents] = useState<SocialEvent[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.socialEvents) && parsed.socialEvents.length > 0) {
          return parsed.socialEvents;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SOCIAL_EVENTS;
  });

  // 5. Almanac & Character Profile Editor Modal States
  const [guideModal, setGuideModal] = useState<{
    open: boolean;
    tab: 'directory' | 'heatmap' | 'social' | 'landmarks' | 'architecture';
  }>({ open: false, tab: 'directory' });

  const [editorModal, setEditorModal] = useState<{
    open: boolean;
    mode: 'edit' | 'create' | 'explorer';
    characterId: string | null;
  }>({
    open: false,
    mode: 'edit',
    characterId: null,
  });

  const [isCity2HubOpen, setIsCity2HubOpen] = useState<boolean>(false);
  const [city2DbLastSynced, setCity2DbLastSynced] = useState<string | null>(null);
  const [isInviteCollapsed, setIsInviteCollapsed] = useState<boolean>(true);
  const [isSittingBarCollapsed, setIsSittingBarCollapsed] = useState<boolean>(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);
  const [isAutoExploreBarCollapsed, setIsAutoExploreBarCollapsed] = useState<boolean>(false);

  // Hydrate from server persistent database on startup if localStorage was empty
  useEffect(() => {
    const existingLocal = localStorage.getItem(STORAGE_KEY);
    if (existingLocal) return;
    safeApiFetchJson<{
      found?: boolean;
      data?: {
        explorerProfile?: ExplorerProfile;
        characters?: AICharacter[];
        chatHistories?: Record<string, ChatMessage[]>;
        socialEvents?: SocialEvent[];
        voiceEnabled?: boolean;
        weather?: WeatherType;
      };
    }>('/api/world-state')
      .then((res) => {
        if (res?.found && res?.data) {
          if (res.data.explorerProfile?.name) {
            setExplorerProfile(res.data.explorerProfile);
          }
          if (Array.isArray(res.data.characters) && res.data.characters.length > 0) {
            setCharacters(sanitizeCharactersList(res.data.characters));
          }
          if (res.data.chatHistories && typeof res.data.chatHistories === 'object') {
            const defaults = createDefaultChatHistories(INITIAL_CHARACTERS);
            const merged: Record<string, ChatMessage[]> = { ...defaults };
            for (const [k, v] of Object.entries(res.data.chatHistories)) {
              if (Array.isArray(v) && v.length > 0) {
                merged[k] = v as ChatMessage[];
              }
            }
            setChatHistories(merged);
          }
          if (Array.isArray(res.data.socialEvents) && res.data.socialEvents.length > 0) {
            setSocialEvents(res.data.socialEvents);
          }
          if (typeof res.data.voiceEnabled === 'boolean') {
            setVoiceEnabled(res.data.voiceEnabled);
          }
          if (
            res.data.weather === 'sunny' ||
            res.data.weather === 'cloudy' ||
            res.data.weather === 'rainy'
          ) {
            setWeather(res.data.weather);
          }
        }
      })
      .catch(() => {
        // Ignore offline errors
      });
  }, []);

  const dayNumberRef = useRef<number>(dayNumber);
  dayNumberRef.current = dayNumber;

  const createdObjectsRef = useRef<CreatedWorldObject[]>(createdObjects);
  createdObjectsRef.current = createdObjects;
  const lastAutonomousCreateMsRef = useRef<number>(Date.now() - 18000);
  const lastAutonomousEmoteMsRef = useRef<Record<string, number>>({});
  const forcedHomeUntilMsRef = useRef<Record<string, number>>({});

  const gameHourRef = useRef(gameHour);
  gameHourRef.current = gameHour;

  const weatherRef = useRef<WeatherType>(weather);
  weatherRef.current = weather;

  const selectedCharIdRef = useRef(selectedCharacterId);
  selectedCharIdRef.current = selectedCharacterId;

  const explorerProfileRef = useRef(explorerProfile);
  explorerProfileRef.current = explorerProfile;

  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;

  const socialProximityModeRef = useRef<SocialProximityMode>(socialProximityMode);
  socialProximityModeRef.current = socialProximityMode;

  const playerPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 6.2 });
  const lastSocialPairTimeRef = useRef<Record<string, number>>({});
  const activeSessionsRef = useRef<ActiveConversationSession[]>([]);
  const activePairOutingsRef = useRef<ActivePairOuting[]>([]);
  const lastPairOutingEndMsRef = useRef<Record<string, number>>({});
  const followingCharIdRef = useRef<string | null>(followingCharId);
  followingCharIdRef.current = followingCharId;
  const playerSittingSpotRef = useRef(playerSittingSpot);
  playerSittingSpotRef.current = playerSittingSpot;
  const lastHawaInviteMsRef = useRef<number>(Date.now() - 28000);
  const lastGlobalPlayerApproachRef = useRef<number>(Date.now() - 22000);
  const lastCharApproachRef = useRef<Record<string, number>>({});
  const isTriggeringSocialRef = useRef<boolean>(false);
  const approachInviteRef = useRef<PlayerApproachInvitation | null>(null);
  approachInviteRef.current = approachInvite;

  const charactersRef = useRef<AICharacter[]>(characters);
  charactersRef.current = characters;

  const chatHistoriesRef = useRef<Record<string, ChatMessage[]>>(chatHistories);
  chatHistoriesRef.current = chatHistories;

  const socialEventsRef = useRef<SocialEvent[]>(socialEvents);
  socialEventsRef.current = socialEvents;

  const autoExploreEnabledRef = useRef<boolean>(autoExploreEnabled);
  autoExploreEnabledRef.current = autoExploreEnabled;

  const autoExploreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist world data to localStorage and debounced backend database (/api/world-state) without blocking simulation or 60fps rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      const compactChars = charactersRef.current.map((c) => ({
        ...c,
        memories: (c.memories || []).slice(0, 16),
      }));
      const compactHistories: Record<string, ChatMessage[]> = {};
      for (const [k, v] of Object.entries(chatHistoriesRef.current)) {
        if (Array.isArray(v)) {
          compactHistories[k] = v.slice(-30);
        }
      }
      const payload = {
        explorerProfile: explorerProfileRef.current,
        characters: compactChars,
        createdObjects: createdObjectsRef.current,
        chatHistories: compactHistories,
        socialEvents: socialEventsRef.current.slice(0, 16),
        voiceEnabled: voiceEnabledRef.current,
        weather: weatherRef.current,
        dayNumber: dayNumberRef.current,
        socialProximityMode: socialProximityModeRef.current,
      };
      const serializedPayload = JSON.stringify(payload);
      try {
        localStorage.setItem(STORAGE_KEY, serializedPayload);
      } catch {
        // ignore storage quota errors
      }
      fetch(resolveApiUrl('/api/world-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedPayload,
      }).catch(() => {
        // ignore network errors
      });

      // Also persist dedicated Second City (Neo-Horizon) Groq AI Database (conversations, OK-Plans, Love links, Friend Chart & Dreams)
      const city2Residents = compactChars.filter(
        (c) => isCity2Character(c.id) || c.cityId === 'city2'
      );
      const city2Conversations: Record<string, ChatMessage[]> = {};
      city2Residents.forEach((c) => {
        city2Conversations[c.id] = compactHistories[c.id] || [];
      });
      const city2Payload = {
        version: 1,
        lastSavedAt: new Date().toISOString(),
        residents: city2Residents,
        conversationLogs: city2Conversations,
        okPlans: Object.fromEntries(city2Residents.map((c) => [c.id, c.okPlan])),
        loveAndCoWorkLinks: city2Residents
          .filter((c) => c.romanticPartnerId)
          .map((c) => ({
            charAId: c.id,
            charBId: c.romanticPartnerId,
            workLocationId: c.currentLocationId,
          })),
        dreamArchives: city2Residents.map((c) => ({
          characterId: c.id,
          characterName: c.name,
          dreamSummary: c.dreamState?.lastDreamSummary || '',
          dreamTheme: c.dreamState?.dreamTheme || '',
          carTripStatus: c.dreamState?.carTripStatus || 'home_in_city2',
        })),
      };
      const serializedCity2 = JSON.stringify(city2Payload);
      try {
        localStorage.setItem(CITY2_STORAGE_KEY, serializedCity2);
      } catch {
        // ignore quota errors
      }
      fetch(resolveApiUrl('/api/city2-db'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedCity2,
      })
        .then(() => {
          setCity2DbLastSynced(formatGameClock(gameHourRef.current));
        })
        .catch(() => {
          setCity2DbLastSynced(`${formatGameClock(gameHourRef.current)} (Local DB)`);
        });
    }, 2200);

    return () => clearTimeout(timer);
  }, [
    explorerProfile,
    createdObjects,
    chatHistories,
    socialEvents,
    voiceEnabled,
    weather,
    dayNumber,
    socialProximityMode,
  ]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      const compactChars = charactersRef.current.map((c) => ({
        ...c,
        memories: (c.memories || []).slice(0, 16),
      }));
      const payload = {
        explorerProfile: explorerProfileRef.current,
        characters: compactChars,
        createdObjects: createdObjectsRef.current,
        chatHistories: chatHistoriesRef.current,
        socialEvents: socialEventsRef.current.slice(0, 16),
        voiceEnabled: voiceEnabledRef.current,
        weather: weatherRef.current,
        dayNumber: dayNumberRef.current,
        socialProximityMode: socialProximityModeRef.current,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage quota errors
      }
    }, 12000);
    return () => clearInterval(syncInterval);
  }, []);

  // Push a small toast notification when a resident learns a new important memory
  const pushMemoryNotification = useCallback(
    (
      char: Pick<AICharacter, 'id' | 'name' | 'avatarColor'>,
      memorySummary: string,
      memoryType: CharacterMemory['type'],
      gameTimeStr: string
    ) => {
      const nowMs = Date.now();
      const cleanSummary = memorySummary.trim();
      if (!cleanSummary) return;

      setMemoryToasts((prev) => {
        // Avoid duplicate toast for exact same character & summary
        if (prev.some((t) => t.characterId === char.id && t.memorySummary === cleanSummary)) {
          return prev;
        }
        const nextToast: MemoryToastNotification = {
          id: createUniqueId(`toast_${char.id}`),
          characterId: char.id,
          characterName: char.name,
          avatarColor: char.avatarColor,
          memorySummary: cleanSummary,
          memoryType,
          gameTime: gameTimeStr,
          expiresAt: nowMs + 8500,
        };
        return [nextToast, ...prev].slice(0, 3);
      });
    },
    []
  );

  const handleDismissMemoryToast = useCallback((toastId: string) => {
    setMemoryToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Helper to apply relationship, mutual romance, emotional state & memory updates between two conversing residents
  const applyResidentSocialUpdate = useCallback(
    (
      charList: AICharacter[],
      idA: string,
      idB: string,
      lineA: string,
      lineB: string,
      _topic: string,
      memorySummary: string,
      formattedClock: string,
      nowMs: number,
      emotionA?: EmotionType,
      emotionB?: EmotionType
    ): AICharacter[] => {
      if (idA === idB) return charList;
      const charAObj = charList.find((c) => c.id === idA);
      const charBObj = charList.find((c) => c.id === idB);
      if (!charAObj || !charBObj) return charList;

      const safeLineA =
        typeof lineA === 'string' && lineA.trim().length > 0
          ? lineA
          : `Hey ${charBObj.name}, great catching up with you here!`;
      const safeLineB =
        typeof lineB === 'string' && lineB.trim().length > 0
          ? lineB
          : `Always a pleasure talking with you, ${charAObj.name}!`;

      const angleAToB = Math.atan2(
        charBObj.currentPosition.x - charAObj.currentPosition.x,
        charBObj.currentPosition.z - charAObj.currentPosition.z
      );

      const romanceEval = evaluateMutualRomance(charAObj, charBObj, formattedClock);
      const importantSummaryForToast = romanceEval.milestoneSummary || memorySummary;
      const memoryTypeForToast: CharacterMemory['type'] = romanceEval.milestoneSummary
        ? 'romance'
        : 'social';

      return charList.map((c) => {
        if (c.id === idA) {
          const updatedRels = c.relationships.map((rel) => {
            if (rel.targetId !== idB) return rel;
            const wasCooling = Boolean(rel.needsAttention || (rel.daysSinceLastInteraction ?? 0) >= 2);
            const affinityBoost = wasCooling ? 5 : 3;
            const nextAffinity = Math.min(100, rel.affinity + affinityBoost);
            const nextStatus: RelationshipStatus =
              romanceEval.nextStage === 'Romantic Partner'
                ? 'Romantic Partner'
                : rel.status === 'Family' || rel.status === 'Best Friend'
                ? rel.status
                : getRelationshipStatus(nextAffinity);
            return {
              ...rel,
              targetName: charBObj.name,
              affinity: nextAffinity,
              trust: Math.min(100, (rel.trust ?? rel.affinity) + (wasCooling ? 4 : 3)),
              romanticInterest: romanceEval.romanticInterestA,
              romanticStage: romanceEval.nextStage,
              howWeMet:
                rel.howWeMet ||
                `First bonded over ${charAObj.interests[0] || 'city life'} in Gemini City`,
              knownPreferences:
                rel.knownPreferences && rel.knownPreferences.length > 0
                  ? rel.knownPreferences
                  : (charBObj.likes || charBObj.interests).slice(0, 2),
              status: nextStatus,
              interactionCount: (rel.interactionCount || 1) + 1,
              lastInteractionSummary: memorySummary,
              lastMetTime: formattedClock,
              lastMetDay: dayNumberRef.current,
              daysSinceLastInteraction: 0,
              lastDecayAmount: 0,
              needsAttention: false,
            };
          });

          const newMemEntry: CharacterMemory = {
            id: createUniqueId(`mem_${c.id}`),
            gameTime: formattedClock,
            summary: `${memorySummary} ("${safeLineB.slice(0, 60)}")`,
            type: romanceEval.milestoneSummary ? 'romance' : 'social',
            important: true,
            involvedNames: [charBObj.name],
            emotionAtTime: emotionA || 'Happiness',
          };

          const rawMemories = romanceEval.milestoneSummary
            ? [
                {
                  id: createUniqueId(`mem_rom_${c.id}`),
                  gameTime: formattedClock,
                  summary: romanceEval.milestoneSummary,
                  type: 'romance' as const,
                  important: true,
                  involvedNames: [charBObj.name],
                  emotionAtTime: 'Affection' as EmotionType,
                },
                newMemEntry,
                ...(c.memories || []),
              ]
            : [newMemEntry, ...(c.memories || [])];

          const nextEmotion: EmotionType =
            emotionA ||
            (romanceEval.nextStage === 'Dating' || romanceEval.nextStage === 'Romantic Partner'
              ? 'Affection'
              : 'Happiness');

          return {
            ...c,
            rotationY: angleAToB,
            isTalking: true,
            isSitting: false,
            conversingWithId: idB,
            lastTalkedPartnerId: idB,
            romanticPartnerId:
              romanceEval.nextStage === 'Romantic Partner' ? idB : c.romanticPartnerId,
            currentMood: nextEmotion === 'Affection' ? 'Affectionate' : 'Happy',
            emotionalState: {
              primary: nextEmotion,
              intensity: 82,
              cause: `Enjoying a meaningful conversation with ${charBObj.name}`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            needs: {
              ...c.needs,
              social: Math.min(100, c.needs.social + 18),
              inspiration: Math.min(100, c.needs.inspiration + 7),
            },
            relationships: updatedRels,
            activeBubble: {
              text: safeLineA,
              expiresAt: nowMs + 5500,
            },
            activeMemoryPop: {
              id: newMemEntry.id,
              summary: importantSummaryForToast,
              type: memoryTypeForToast,
              expiresAt: nowMs + 8500,
            },
            memories: summarizeCharacterMemories(rawMemories, c.name, formattedClock),
          };
        }
        if (c.id === idB) {
          const updatedRels = c.relationships.map((rel) => {
            if (rel.targetId !== idA) return rel;
            const wasCooling = Boolean(rel.needsAttention || (rel.daysSinceLastInteraction ?? 0) >= 2);
            const affinityBoost = wasCooling ? 5 : 3;
            const nextAffinity = Math.min(100, rel.affinity + affinityBoost);
            const nextStatus: RelationshipStatus =
              romanceEval.nextStage === 'Romantic Partner'
                ? 'Romantic Partner'
                : rel.status === 'Family' || rel.status === 'Best Friend'
                ? rel.status
                : getRelationshipStatus(nextAffinity);
            return {
              ...rel,
              targetName: charAObj.name,
              affinity: nextAffinity,
              trust: Math.min(100, (rel.trust ?? rel.affinity) + (wasCooling ? 4 : 3)),
              romanticInterest: romanceEval.romanticInterestB,
              romanticStage: romanceEval.nextStage,
              howWeMet:
                rel.howWeMet ||
                `First bonded over ${charBObj.interests[0] || 'city life'} in Gemini City`,
              knownPreferences:
                rel.knownPreferences && rel.knownPreferences.length > 0
                  ? rel.knownPreferences
                  : (charAObj.likes || charAObj.interests).slice(0, 2),
              status: nextStatus,
              interactionCount: (rel.interactionCount || 1) + 1,
              lastInteractionSummary: memorySummary,
              lastMetTime: formattedClock,
              lastMetDay: dayNumberRef.current,
              daysSinceLastInteraction: 0,
              lastDecayAmount: 0,
              needsAttention: false,
            };
          });

          const newMemEntry: CharacterMemory = {
            id: createUniqueId(`mem_${c.id}`),
            gameTime: formattedClock,
            summary: `${memorySummary} ("${safeLineA.slice(0, 60)}")`,
            type: romanceEval.milestoneSummary ? 'romance' : 'social',
            important: true,
            involvedNames: [charAObj.name],
            emotionAtTime: emotionB || 'Happiness',
          };

          const rawMemories = [newMemEntry, ...(c.memories || [])];
          const nextEmotion: EmotionType =
            emotionB ||
            (romanceEval.nextStage === 'Dating' || romanceEval.nextStage === 'Romantic Partner'
              ? 'Affection'
              : 'Happiness');

          return {
            ...c,
            rotationY: angleAToB + Math.PI,
            isTalking: true,
            isSitting: false,
            conversingWithId: idA,
            lastTalkedPartnerId: idA,
            romanticPartnerId:
              romanceEval.nextStage === 'Romantic Partner' ? idA : c.romanticPartnerId,
            currentMood: nextEmotion === 'Affection' ? 'Affectionate' : 'Happy',
            emotionalState: {
              primary: nextEmotion,
              intensity: 80,
              cause: `Sharing a warm conversation with ${charAObj.name}`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            needs: {
              ...c.needs,
              social: Math.min(100, c.needs.social + 18),
              inspiration: Math.min(100, c.needs.inspiration + 7),
            },
            relationships: updatedRels,
            activeBubble: {
              text: safeLineB,
              expiresAt: nowMs + 5500,
            },
            activeMemoryPop: {
              id: newMemEntry.id,
              summary: importantSummaryForToast,
              type: memoryTypeForToast,
              expiresAt: nowMs + 8500,
            },
            memories: summarizeCharacterMemories(rawMemories, c.name, formattedClock),
          };
        }
        return c;
      });
    },
    []
  );

  // Trigger Live AI-to-AI Social Interaction via Backend /api/socialize and start a Stay-Together Session
  const handleTriggerSocialEncounter = useCallback(
    async (charAId?: string, charBId?: string) => {
      if (isTriggeringSocialRef.current) return;
      isTriggeringSocialRef.current = true;

      const a =
        characters.find((c) => c.id === charAId) ||
        characters[Math.floor(Math.random() * characters.length)];
      const others = characters.filter((c) => c.id !== a?.id);
      const b =
        others.find((c) => c.id === charBId) ||
        others[Math.floor(Math.random() * others.length)];

      if (!a || !b) {
        isTriggeringSocialRef.current = false;
        return;
      }
      const locName = CITY_BUILDINGS[a.currentLocationId]?.name || 'Central Starlight Park';
      const formattedClock = formatGameClock(gameHourRef.current);
      const rel = a.relationships.find((r) => r.targetId === b.id);

      try {
        const envContextA = buildResidentEnvironmentalContext(
          a,
          charactersRef.current,
          createdObjectsRef.current,
          weatherRef.current,
          gameHourRef.current,
          explorerProfileRef.current.name || 'Johnny'
        );
        const envContextB = buildResidentEnvironmentalContext(
          b,
          charactersRef.current,
          createdObjectsRef.current,
          weatherRef.current,
          gameHourRef.current,
          explorerProfileRef.current.name || 'Johnny'
        );
        const data = await safeApiFetchJson<{
          lineA?: string;
          lineB?: string;
          lineC?: string;
          farewellText?: string;
          topic?: string;
          emotionA?: string;
          emotionB?: string;
          memorySummary?: string;
        }>('/api/socialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            charA: {
              id: a.id,
              name: a.name,
              gender: a.gender,
              role: a.role,
              modelBadge: a.modelBadge,
              personality: a.personality,
              interests: a.interests,
              likes: a.likes,
              dislikes: a.dislikes,
              emotionalState: a.emotionalState,
              environmentalContext: envContextA,
              memories: (a.memories || []).slice(0, 5),
            },
            charB: {
              id: b.id,
              name: b.name,
              gender: b.gender,
              role: b.role,
              modelBadge: b.modelBadge,
              personality: b.personality,
              interests: b.interests,
              likes: b.likes,
              dislikes: b.dislikes,
              emotionalState: b.emotionalState,
              environmentalContext: envContextB,
              memories: (b.memories || []).slice(0, 5),
            },
            relationshipStatus: rel?.status || 'Friend',
            romanticStage: rel?.romanticStage || 'None',
            sharedMemory: rel?.lastInteractionSummary || '',
            locationName: locName,
            gameTime: formattedClock,
            weather: weatherRef.current,
          }),
        });
        if (!data || typeof data.lineA !== 'string' || typeof data.lineB !== 'string') {
          throw new Error('Invalid socialize payload');
        }
        const lineA: string = data.lineA;
        const lineB: string = data.lineB;
        const lineC: string | undefined = typeof data.lineC === 'string' ? data.lineC : undefined;
        const nowMs = Date.now();
        const summary =
          data.memorySummary ||
          `Discussed ${data.topic || 'town projects'} with ${b.name} at ${locName}.`;

        const midX = (a.currentPosition.x + b.currentPosition.x) / 2;
        const midZ = (a.currentPosition.z + b.currentPosition.z) / 2;

        // Register a multi-turn stay-together session so they face each other, exchange lines, and say goodbye
        activeSessionsRef.current = [
          ...activeSessionsRef.current.filter(
            (s) =>
              s.participantAId !== a.id &&
              s.participantBId !== a.id &&
              s.participantAId !== b.id &&
              s.participantBId !== b.id
          ),
          {
            id: createUniqueId(`sess_${a.id}_${b.id}`),
            participantAId: a.id,
            participantBId: b.id,
            locationId: a.currentLocationId,
            locationName: locName,
            topic: data.topic || 'Shared Interests',
            phase: 'conversing',
            meetingPoint: { x: midX, z: midZ },
            turns: [
              {
                speakerId: a.id,
                speakerName: a.name,
                text: lineA,
                emotion: (data.emotionA as EmotionType) || 'Happiness',
              },
              {
                speakerId: b.id,
                speakerName: b.name,
                text: lineB,
                emotion: (data.emotionB as EmotionType) || 'Happiness',
              },
              ...(lineC
                ? [
                    {
                      speakerId: a.id,
                      speakerName: a.name,
                      text: lineC,
                      emotion: (data.emotionA as EmotionType) || 'Happiness',
                    },
                  ]
                : []),
            ],
            farewellText:
              data.farewellText || `Great catching up with you at ${locName}, ${b.name}!`,
            farewellSpeakerId: a.id,
            currentTurnIndex: 0,
            nextStepAtMs: nowMs + 4200,
            startedAtMs: nowMs,
            memorySummary: summary,
          },
        ];

        setCharacters((prev) =>
          applyResidentSocialUpdate(
            prev,
            a.id,
            b.id,
            lineA,
            lineB,
            data.topic || 'Shared Interests',
            summary,
            formattedClock,
            nowMs,
            (data.emotionA as EmotionType) || 'Happiness',
            (data.emotionB as EmotionType) || 'Happiness'
          )
        );
        pushMemoryNotification(a, summary, 'social', formattedClock);

        setSocialEvents((prev) => [
          {
            id: createUniqueId('soc_live'),
            gameTime: formattedClock,
            speakerAId: a.id,
            speakerAName: a.name,
            speakerBId: b.id,
            speakerBName: b.name,
            locationName: locName,
            topic: data.topic || 'Shared Interests',
            lines: [
              { speakerName: a.name, text: lineA },
              { speakerName: b.name, text: lineB },
              ...(lineC ? [{ speakerName: a.name, text: lineC }] : []),
            ],
          },
          ...prev.slice(0, 24),
        ]);
      } catch {
        const exchange = buildMultiTurnSocialExchange(a, b, weatherRef.current);
        const nowMs = Date.now();
        setCharacters((prev) =>
          applyResidentSocialUpdate(
            prev,
            a.id,
            b.id,
            exchange.turns[0].text,
            exchange.turns[1].text,
            exchange.topic,
            exchange.memorySummary,
            formattedClock,
            nowMs,
            exchange.emotionA,
            exchange.emotionB
          )
        );
        pushMemoryNotification(a, exchange.memorySummary, 'social', formattedClock);
      } finally {
        isTriggeringSocialRef.current = false;
      }
    },
    [characters, applyResidentSocialUpdate, pushMemoryNotification]
  );

  // Trigger a new day, apply subtle Friendship Decay to neglected bonds, and assign each resident a fresh unique Daily Goal
  const handleStartNewDay = useCallback(
    (explicitNextDay?: number) => {
      const nextDay = explicitNextDay ?? dayNumberRef.current + 1;
      dayNumberRef.current = nextDay;
      setDayNumber(nextDay);
      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);

      const decayResult = applyDailyFriendshipDecay(
        charactersRef.current,
        nextDay,
        formattedClock
      );

      setCharacters((prev) => {
        const decayedList = applyDailyFriendshipDecay(prev, nextDay, formattedClock).updatedCharacters;
        return decayedList.map((c) => {
          const freshDailyGoal = generateResidentDailyGoal(c, nextDay, weatherRef.current);
          const nextDecision = decideAutonomousActivity(
            { ...c, dailyGoal: freshDailyGoal },
            decayedList,
            gameHourRef.current,
            getActiveCityEvent(gameHourRef.current),
            weatherRef.current
          );
          return {
            ...c,
            dailyGoal: freshDailyGoal,
            currentLocationId: nextDecision.locationId,
            currentActivity: nextDecision.activity,
            currentThought: nextDecision.thought,
            decisionReason: nextDecision.decisionReason,
            activeEmote: {
              type: 'think',
              label: `🎯 Day ${nextDay} Goal!`,
              expiresAt: nowMs + 6500,
            },
            activeBubble: {
              text: `${freshDailyGoal.badgeIcon} New Day ${nextDay} Goal: "${freshDailyGoal.title}" at ${CITY_BUILDINGS[freshDailyGoal.targetLocationId]?.name}!`,
              expiresAt: nowMs + 7000,
            },
          };
        });
      });

      if (charactersRef.current[0]) {
        const decayNote =
          decayResult.coolingBondsCount > 0 && decayResult.highlightedCoolingPair
            ? ` ⏳ ${decayResult.coolingBondsCount} friendship bond(s) cooled slightly (${decayResult.highlightedCoolingPair.charName} & ${decayResult.highlightedCoolingPair.friendName}: -${decayResult.highlightedCoolingPair.decay}% after ${decayResult.highlightedCoolingPair.daysApart}d apart)—residents are prioritizing catching up!`
            : '';
        pushMemoryNotification(
          charactersRef.current[0],
          `Day ${nextDay} began! Fresh Daily Goals set.${decayNote}`,
          'goal',
          formattedClock
        );
      }
    },
    [pushMemoryNotification]
  );

  // Continuous Day/Night Cycle Clock (automatically rolls over to a new Day & fresh Daily Goals at midnight)
  useEffect(() => {
    if (timeSpeed === 0) return;
    const interval = setInterval(() => {
      const nextRaw = gameHourRef.current + 0.071 * timeSpeed;
      if (nextRaw >= 24) {
        const wrapped = nextRaw % 24;
        gameHourRef.current = wrapped;
        setGameHour(wrapped);
        handleStartNewDay();
      } else {
        gameHourRef.current = nextRaw;
        setGameHour(nextRaw);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeSpeed, handleStartNewDay]);

  // Periodic Weather System Update (Cycles naturally between sunny, cloudy, and rainy)
  useEffect(() => {
    if (timeSpeed === 0) return;
    const intervalMs = timeSpeed === 3 ? 22000 : 52000;
    const weatherTimer = setInterval(() => {
      setWeather((prevWeather) => getNextPeriodicWeather(prevWeather));
    }, intervalMs);
    return () => clearInterval(weatherTimer);
  }, [timeSpeed]);

  // Automatic Resident Wardrobe & Environmental Reaction whenever Weather Changes
  const prevWeatherRef = useRef<WeatherType>(weather);
  useEffect(() => {
    if (prevWeatherRef.current === weather) return;
    prevWeatherRef.current = weather;
    const nowMs = Date.now();
    const formattedClock = formatGameClock(gameHourRef.current);

    setCharacters((prev) =>
      prev.map((c) => {
        const ward = getResidentWeatherWardrobe(c, weather);
        const locName = CITY_BUILDINGS[c.currentLocationId]?.name || 'Gemini City';
        const reactionBubble =
          weather === 'rainy'
            ? `🧥 Zipped up my ${ward.outfitLabel}! Watching the rain mist over ${locName} and Neo-Horizon Bridge!`
            : weather === 'cloudy'
            ? `🧣 Put on my ${ward.outfitLabel}—this cool overcast breeze across ${locName} feels so peaceful!`
            : `☀️ Switched into my ${ward.outfitLabel}! Love how the sunshine lights up ${locName} and the Bridge!`;

        return {
          ...c,
          currentThought: `${ward.feeling} Taking in everything around ${locName} and the distant Neo-Horizon skyline.`,
          emotionalState: {
            primary: weather === 'rainy' ? 'Calmness' : 'Happiness',
            intensity: 82,
            cause: `Automatically changed into ${ward.outfitLabel} for the ${weather} weather at ${locName}`,
            sinceGameTime: formattedClock,
            lastUpdatedMs: nowMs,
          },
          activeEmote: {
            type: weather === 'rainy' ? 'wave' : weather === 'sunny' ? 'cheer' : 'clap',
            label: `${ward.badgeIcon} ${ward.colorName} Outfit`,
            expiresAt: nowMs + 6800,
          },
          activeBubble: {
            text: reactionBubble,
            expiresAt: nowMs + 7200,
          },
        };
      })
    );
  }, [weather]);

  // Autonomous AI Society Simulation Tick (Needs, Independent Decisions, Friendships & Player Approach)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const currentHour = gameHourRef.current;
      const currentWeather = weatherRef.current;
      const nowMs = Date.now();
      const formattedClock = formatGameClock(currentHour);
      const currentPhase = getTimePhase(currentHour);
      const activeConvoCharId = selectedCharIdRef.current;
      const activeCityEvent = getActiveCityEvent(currentHour);
      const playerPos = playerPosRef.current;
      const explorerName = explorerProfileRef.current.name || 'Johnny';

      if (approachInviteRef.current) {
        if (nowMs > approachInviteRef.current.expiresAt) {
          setApproachInvite(null);
        }
      }

      setMemoryToasts((prev) =>
        prev.some((t) => nowMs > t.expiresAt) ? prev.filter((t) => nowMs <= t.expiresAt) : prev
      );

      let shouldClearApproach = false;
      const pendingChatAppends: { charId: string; messages: ChatMessage[]; checkText: string }[] = [];
      const pendingNewObjects: CreatedWorldObject[] = [];
      const pendingToasts: {
        char: Pick<AICharacter, 'id' | 'name' | 'avatarColor'>;
        summary: string;
        type: CharacterMemory['type'];
      }[] = [];
      const pendingSocialEvents: SocialEvent[] = [];

      const prevChars = charactersRef.current;
      if (true) {
        // Step 0: Advance any active resident-to-resident conversation sessions
        const nextSessions: ActiveConversationSession[] = [];
        const sessionParticipantMap = new Map<
          string,
          {
            partnerId: string;
            partnerName: string;
            standTarget: { x: number; z: number };
            facePos: { x: number; z: number };
            isSpeakerNow: boolean;
            bubbleText?: string;
            emotion?: EmotionType;
            topic: string;
          }
        >();

        for (const sess of activeSessionsRef.current) {
          const charA = prevChars.find((c) => c.id === sess.participantAId);
          const charB = prevChars.find((c) => c.id === sess.participantBId);
          if (
            !charA ||
            !charB ||
            activeConvoCharId === charA.id ||
            activeConvoCharId === charB.id
          ) {
            continue;
          }

          // If it starts raining while two residents are chatting outdoors at the park, wrap up so they can head indoors to the café or school
          if (currentWeather === 'rainy' && sess.locationId === 'park') {
            continue;
          }

          let updatedSess = { ...sess };
          if (nowMs >= updatedSess.nextStepAtMs) {
            if (updatedSess.phase === 'approaching') {
              updatedSess.phase = 'conversing';
              updatedSess.currentTurnIndex = 0;
              updatedSess.nextStepAtMs = nowMs + 4200;
            } else if (updatedSess.phase === 'conversing') {
              if (updatedSess.currentTurnIndex + 1 < updatedSess.turns.length) {
                updatedSess.currentTurnIndex += 1;
                updatedSess.nextStepAtMs = nowMs + 4200;
              } else {
                updatedSess.phase = 'farewell';
                updatedSess.nextStepAtMs = nowMs + 3200;
              }
            } else {
              // Farewell finished -> conversation ends naturally
              continue;
            }
          }

          nextSessions.push(updatedSess);

          const activeTurn =
            updatedSess.phase === 'farewell'
              ? {
                  speakerId: updatedSess.farewellSpeakerId || charA.id,
                  text: updatedSess.farewellText || `See you soon, ${charB.name}!`,
                  emotion: 'Happiness' as EmotionType,
                }
              : updatedSess.turns[updatedSess.currentTurnIndex];

          // Social Proximity Setting:
          // - 'respectful_distance': Residents maintain personal space (~2.5m apart, halfSep = 1.25) while chatting
          // - 'emotional_closeness': Residents move closer together (~0.9m apart, halfSep = 0.45) during emotional moments
          const turnEmotion =
            activeTurn?.emotion ||
            charA.emotionalState?.primary ||
            charB.emotionalState?.primary ||
            'Happiness';
          const relAB = charA.relationships.find((r) => r.targetId === charB.id);
          const isEmotionalMoment =
            ['Affection', 'Sadness', 'Excitement', 'Embarrassment', 'Loneliness'].includes(
              turnEmotion
            ) ||
            (charA.emotionalState?.intensity ?? 0) >= 75 ||
            (charB.emotionalState?.intensity ?? 0) >= 75 ||
            (relAB?.romanticStage && relAB.romanticStage !== 'None');

          const dxAB = charB.currentPosition.x - charA.currentPosition.x;
          const dzAB = charB.currentPosition.z - charA.currentPosition.z;
          const baseAngle = Math.atan2(dxAB, dzAB) || 0.4;
          const halfSep =
            socialProximityModeRef.current === 'respectful_distance'
              ? 1.25
              : isEmotionalMoment
              ? 0.45
              : 0.68;
          const standA = {
            x: updatedSess.meetingPoint.x - Math.sin(baseAngle) * halfSep,
            z: updatedSess.meetingPoint.z - Math.cos(baseAngle) * halfSep,
          };
          const standB = {
            x: updatedSess.meetingPoint.x + Math.sin(baseAngle) * halfSep,
            z: updatedSess.meetingPoint.z + Math.cos(baseAngle) * halfSep,
          };

          sessionParticipantMap.set(charA.id, {
            partnerId: charB.id,
            partnerName: charB.name,
            standTarget: standA,
            facePos: charB.currentPosition,
            isSpeakerNow: activeTurn?.speakerId === charA.id,
            bubbleText: activeTurn?.speakerId === charA.id ? activeTurn.text : undefined,
            emotion: activeTurn?.emotion,
            topic: updatedSess.topic,
          });

          sessionParticipantMap.set(charB.id, {
            partnerId: charA.id,
            partnerName: charA.name,
            standTarget: standB,
            facePos: charA.currentPosition,
            isSpeakerNow: activeTurn?.speakerId === charB.id,
            bubbleText: activeTurn?.speakerId === charB.id ? activeTurn.text : undefined,
            emotion: activeTurn?.emotion,
            topic: updatedSess.topic,
          });
        }

        activeSessionsRef.current = nextSessions;

        // Step 0B: Advance Active Two-Place Pair Outings (Best Friends, Girlfriends/Boyfriends & Loved Ones
        // plan an outing, walk together to a Two-Place Bench or Chairs, sit down ON the 3D furniture to talk & have fun,
        // and then walk back to their homes!)
        const nextPairOutings: ActivePairOuting[] = [];
        const outingParticipantMap = new Map<
          string,
          {
            partnerId: string;
            partnerName: string;
            spotId: TwoPlaceSpotId;
            spotName: string;
            seatingChoice: 'bench' | 'chairs';
            phase: 'walking_to_spot' | 'walking_together' | 'sitting_and_talking' | 'returning_home';
            seatTarget: { x: number; z: number; rotationY: number };
            isSpeakerNow: boolean;
            bubbleText?: string;
            emotion?: EmotionType;
          }
        >();

        for (const outing of activePairOutingsRef.current) {
          const charA = prevChars.find((c) => c.id === outing.participantAId);
          const isPlayerPartner = outing.participantBId === 'player';
          const charB = isPlayerPartner
            ? null
            : prevChars.find((c) => c.id === outing.participantBId);

          if (!charA || (!isPlayerPartner && !charB)) {
            continue;
          }
          if (
            !isPlayerPartner &&
            (activeConvoCharId === charA.id || (charB && activeConvoCharId === charB.id))
          ) {
            continue;
          }

          const spot = TWO_PLACE_SPOTS[outing.spotId];
          if (!spot) continue;

          const seatA = outing.seatingChoice === 'chairs' ? spot.chairA : spot.seatA;
          const seatB = outing.seatingChoice === 'chairs' ? spot.chairB : spot.seatB;

          const distA = Math.hypot(charA.currentPosition.x - seatA.x, charA.currentPosition.z - seatA.z);
          const distB = isPlayerPartner
            ? Math.hypot(playerPos.x - seatB.x, playerPos.z - seatB.z)
            : charB
            ? Math.hypot(charB.currentPosition.x - seatB.x, charB.currentPosition.z - seatB.z)
            : 0;

          let updatedOuting = { ...outing };

          if (updatedOuting.phase === 'walking_to_spot') {
            if ((distA < 0.65 && distB < 1.35) || nowMs >= updatedOuting.nextStepAtMs) {
              updatedOuting.phase = 'sitting_and_talking';
              updatedOuting.currentTurnIndex = 0;
              updatedOuting.nextStepAtMs = nowMs + 4800;
            }
          } else if (updatedOuting.phase === 'sitting_and_talking') {
            if (isPlayerPartner && !playerSittingSpotRef.current) {
              // Player stood up early -> finish sitting phase
              updatedOuting.phase = 'returning_home';
              updatedOuting.returnHomeUntilMs = nowMs + 10000;
            } else if (nowMs >= updatedOuting.nextStepAtMs) {
              if (updatedOuting.currentTurnIndex + 1 < updatedOuting.turns.length) {
                updatedOuting.currentTurnIndex += 1;
                updatedOuting.nextStepAtMs = nowMs + 4800;
              } else {
                updatedOuting.phase = 'returning_home';
                updatedOuting.returnHomeUntilMs = nowMs + 13500;
                const pairKey = [outing.participantAId, outing.participantBId].sort().join('-');
                lastPairOutingEndMsRef.current[pairKey] = nowMs;

                if (isPlayerPartner) {
                  setPlayerSittingSpot(null);
                  setPlayerActiveBubble(
                    `That was such a wonderful time sitting together at ${spot.name}, ${charA.name}! ❤️`
                  );
                  setTimeout(() => setPlayerActiveBubble(null), 4500);
                }

                pendingToasts.push({
                  char: charA,
                  summary: updatedOuting.memorySummary,
                  type: 'romance',
                });
                pendingSocialEvents.push({
                  id: createUniqueId(`soc_outing_${outing.id}`),
                  gameTime: formattedClock,
                  speakerAId: charA.id,
                  speakerAName: charA.name,
                  speakerBId: isPlayerPartner ? 'player' : charB!.id,
                  speakerBName: isPlayerPartner ? explorerName : charB!.name,
                  locationName: spot.name,
                  topic: `Two-Place ${outing.seatingChoice === 'bench' ? 'Bench' : 'Chairs'} Outing ❤️`,
                  relationshipDelta: 4,
                  lines: updatedOuting.turns.map((t) => ({
                    speakerName: t.speakerName,
                    text: t.text,
                  })),
                });
              }
            }
          } else if (updatedOuting.phase === 'returning_home') {
            const homeA = CITY_BUILDINGS[charA.homeId];
            const distHomeA = homeA
              ? Math.hypot(
                  charA.currentPosition.x - homeA.entrance[0],
                  charA.currentPosition.z - homeA.entrance[2]
                )
              : 0;
            if (nowMs >= updatedOuting.returnHomeUntilMs || distHomeA < 1.8) {
              continue;
            }
          }

          nextPairOutings.push(updatedOuting);

          const activeTurn =
            updatedOuting.phase === 'sitting_and_talking'
              ? updatedOuting.turns[updatedOuting.currentTurnIndex]
              : undefined;

          if (isPlayerPartner && activeTurn?.speakerId === 'player') {
            setPlayerActiveBubble(activeTurn.text);
          }

          const homeBldA = CITY_BUILDINGS[charA.homeId];
          const homeTargetA = {
            x: homeBldA?.interiorSpots?.[0]?.[0] ?? homeBldA?.entrance[0] ?? charA.currentPosition.x,
            z: homeBldA?.interiorSpots?.[0]?.[1] ?? homeBldA?.entrance[2] ?? charA.currentPosition.z,
            rotationY: 0,
          };

          outingParticipantMap.set(charA.id, {
            partnerId: isPlayerPartner ? 'player' : charB!.id,
            partnerName: isPlayerPartner ? explorerName : charB!.name,
            spotId: spot.id,
            spotName: spot.name,
            seatingChoice: updatedOuting.seatingChoice,
            phase: updatedOuting.phase,
            seatTarget: updatedOuting.phase === 'returning_home' ? homeTargetA : seatA,
            isSpeakerNow: activeTurn?.speakerId === charA.id,
            bubbleText:
              updatedOuting.phase === 'walking_to_spot'
                ? `Walking together with ${isPlayerPartner ? explorerName : charB!.name} to sit at ${spot.name}! ❤️`
                : updatedOuting.phase === 'returning_home'
                ? `Heading back home to ${homeBldA?.name} after a wonderful time with ${isPlayerPartner ? explorerName : charB!.name} at ${spot.name}! 🏠❤️`
                : activeTurn?.speakerId === charA.id
                ? activeTurn.text
                : undefined,
            emotion: activeTurn?.emotion || 'Affection',
          });

          if (!isPlayerPartner && charB) {
            const homeBldB = CITY_BUILDINGS[charB.homeId];
            const homeTargetB = {
              x: homeBldB?.interiorSpots?.[0]?.[0] ?? homeBldB?.entrance[0] ?? charB.currentPosition.x,
              z: homeBldB?.interiorSpots?.[0]?.[1] ?? homeBldB?.entrance[2] ?? charB.currentPosition.z,
              rotationY: 0,
            };
            outingParticipantMap.set(charB.id, {
              partnerId: charA.id,
              partnerName: charA.name,
              spotId: spot.id,
              spotName: spot.name,
              seatingChoice: updatedOuting.seatingChoice,
              phase: updatedOuting.phase,
              seatTarget: updatedOuting.phase === 'returning_home' ? homeTargetB : seatB,
              isSpeakerNow: activeTurn?.speakerId === charB.id,
              bubbleText:
                updatedOuting.phase === 'walking_to_spot'
                  ? `Walking with ${charA.name} to our Two-Place ${updatedOuting.seatingChoice} at ${spot.name}! ❤️`
                  : updatedOuting.phase === 'returning_home'
                  ? `Returning home to ${homeBldB?.name} after sitting & talking with ${charA.name}! 🏠`
                  : activeTurn?.speakerId === charB.id
                  ? activeTurn.text
                  : undefined,
              emotion: activeTurn?.emotion || 'Happiness',
            });
          }
        }

        activePairOutingsRef.current = nextPairOutings;

        // 1. Update each character's needs, emotional state, autonomous decision, and movement
        const nextChars: AICharacter[] = prevChars.map((char, idx): AICharacter => {
          const hasActiveBubble = Boolean(char.activeBubble && char.activeBubble.expiresAt > nowMs);
          const evolvedEmotion = evolveResidentEmotion(
            char,
            prevChars,
            formattedClock,
            nowMs,
            currentWeather
          );

          // Pause walking while actively conversing with the player in the drawer
          if (activeConvoCharId === char.id) {
            return {
              ...char,
              emotionalState: evolvedEmotion,
              conversingWithId: null,
              isMoving: false,
              isSitting: false,
              isTalking: true,
              isApproachingPlayer: false,
              activeBubble: hasActiveBubble ? char.activeBubble : undefined,
            };
          }

          // Dynamic Needs Evolution (incorporating current weather state)
          const isAtRestSpot =
            char.currentLocationId === char.homeId ||
            char.currentLocationId === 'cafe' ||
            (currentWeather === 'rainy' && char.currentLocationId === 'school');
          const energyDelta =
            isAtRestSpot && !char.isMoving
              ? 0.14
              : currentWeather === 'rainy' && char.currentLocationId === 'park'
              ? -0.08
              : -0.05;
          const socialDrain =
            char.temperament === 'outgoing'
              ? -0.08
              : char.temperament === 'warm-balanced'
              ? -0.05
              : -0.03;
          const inspirationDelta =
            currentWeather === 'sunny' && char.currentLocationId === 'park'
              ? 0.12
              : currentWeather === 'rainy' &&
                (char.currentLocationId === 'cafe' || char.currentLocationId === 'school')
              ? 0.11
              : char.currentLocationId === 'park' || char.currentLocationId === 'school'
              ? 0.09
              : -0.04;

          const nextNeeds = {
            energy: Math.max(12, Math.min(100, char.needs.energy + energyDelta)),
            social: Math.max(10, Math.min(100, char.needs.social + socialDrain)),
            inspiration: Math.max(15, Math.min(100, char.needs.inspiration + inspirationDelta)),
          };

          // Check if this resident is in an active Two-Place Pair Outing (Walking together -> Sitting on 3D Bench/Chairs & Talking -> Returning Home)
          const activeOutingInfo = outingParticipantMap.get(char.id);
          if (activeOutingInfo) {
            const targetX = activeOutingInfo.seatTarget.x;
            const targetZ = activeOutingInfo.seatTarget.z;
            const crossingToGemini = char.currentPosition.x > 54 && targetX < 52;
            const crossingToCity2 = char.currentPosition.x < 144 && targetX > 146;
            const onBridgeSpan = char.currentPosition.x >= 50 && char.currentPosition.x <= 148;

            let wpX = targetX;
            let wpZ = targetZ;
            if (crossingToGemini) {
              wpX = char.currentPosition.x > 144 ? 142 : 48;
              wpZ = 0;
            } else if (crossingToCity2) {
              wpX = char.currentPosition.x < 54 ? 56 : 150;
              wpZ = 0;
            } else if (onBridgeSpan) {
              wpZ = 0;
            }

            const dxO = wpX - char.currentPosition.x;
            const dzO = wpZ - char.currentPosition.z;
            const dOuting = Math.hypot(dxO, dzO);

            let nextX = char.currentPosition.x;
            let nextZ = char.currentPosition.z;
            let isMoving = false;
            let rotY = char.rotationY;

            if (activeOutingInfo.phase === 'sitting_and_talking' && dOuting < 0.85) {
              nextX = activeOutingInfo.seatTarget.x;
              nextZ = activeOutingInfo.seatTarget.z;
              rotY = activeOutingInfo.seatTarget.rotationY;
              isMoving = false;
            } else if (dOuting > 0.24) {
              const step = Math.min(dOuting, crossingToGemini || crossingToCity2 || onBridgeSpan ? 4.8 : 1.72);
              nextX += (dxO / dOuting) * step;
              nextZ += (dzO / dOuting) * step;
              rotY = Math.atan2(dxO, dzO);
              isMoving = true;
            } else {
              nextX = activeOutingInfo.seatTarget.x;
              nextZ = activeOutingInfo.seatTarget.z;
              rotY = activeOutingInfo.seatTarget.rotationY;
            }

            const isSeatedNow =
              activeOutingInfo.phase === 'sitting_and_talking' && !isMoving;

            const bubble = activeOutingInfo.bubbleText
              ? {
                  text: activeOutingInfo.bubbleText,
                  expiresAt: nowMs + 4500,
                }
              : hasActiveBubble
              ? char.activeBubble
              : undefined;

            return {
              ...char,
              needs: {
                ...nextNeeds,
                social: Math.min(100, nextNeeds.social + 0.55),
                inspiration: Math.min(100, nextNeeds.inspiration + 0.35),
              },
              emotionalState: {
                primary: activeOutingInfo.emotion || 'Affection',
                intensity: 90,
                cause:
                  activeOutingInfo.phase === 'sitting_and_talking'
                    ? `Sitting on the two-place ${activeOutingInfo.seatingChoice} at ${activeOutingInfo.spotName} with ${activeOutingInfo.partnerName}`
                    : activeOutingInfo.phase === 'walking_to_spot'
                    ? `Walking together with ${activeOutingInfo.partnerName} to ${activeOutingInfo.spotName}`
                    : `Returning home after a wonderful outing with ${activeOutingInfo.partnerName}`,
                sinceGameTime: formattedClock,
                lastUpdatedMs: nowMs,
              },
              conversingWithId: isSeatedNow ? activeOutingInfo.partnerId : null,
              sittingSpotId: isSeatedNow ? activeOutingInfo.spotId : null,
              currentLocationId:
                activeOutingInfo.phase === 'returning_home'
                  ? char.homeId
                  : TWO_PLACE_SPOTS[activeOutingInfo.spotId].nearestBuildingId,
              currentActivity:
                activeOutingInfo.phase === 'sitting_and_talking'
                  ? `🪑❤️ Sitting & talking with ${activeOutingInfo.partnerName} at ${activeOutingInfo.spotName}`
                  : activeOutingInfo.phase === 'walking_to_spot'
                  ? `🚶‍♀️❤️ Walking together with ${activeOutingInfo.partnerName} to ${activeOutingInfo.spotName}`
                  : `🏠 Returning home after sitting with ${activeOutingInfo.partnerName} at ${activeOutingInfo.spotName}`,
              currentThought: getLovedOneAndCarBrainSummary(char, prevChars, explorerName),
              decisionReason: `Two-Place Outing with ${activeOutingInfo.partnerName} (${activeOutingInfo.spotName})`,
              currentPosition: { x: nextX, z: nextZ },
              targetPosition: { x: targetX, z: targetZ },
              rotationY: rotY,
              isMoving,
              isSitting: isSeatedNow,
              isTalking: activeOutingInfo.isSpeakerNow || Boolean(bubble),
              activeBubble: bubble,
            };
          }

          // Check if this resident is in an active stay-together conversation with another resident
          const activeSessionInfo = sessionParticipantMap.get(char.id);
          if (activeSessionInfo) {
            const dxS = activeSessionInfo.standTarget.x - char.currentPosition.x;
            const dzS = activeSessionInfo.standTarget.z - char.currentPosition.z;
            const dStand = Math.hypot(dxS, dzS);

            let nextX = char.currentPosition.x;
            let nextZ = char.currentPosition.z;
            let isMoving = false;
            if (dStand > 0.28) {
              const step = Math.min(dStand, 1.15);
              nextX += (dxS / dStand) * step;
              nextZ += (dzS / dStand) * step;
              isMoving = true;
            }

            const facePartnerRot = Math.atan2(
              activeSessionInfo.facePos.x - nextX,
              activeSessionInfo.facePos.z - nextZ
            );

            const bubble = activeSessionInfo.bubbleText
              ? {
                  text: activeSessionInfo.bubbleText,
                  expiresAt: nowMs + 3800,
                }
              : hasActiveBubble
              ? char.activeBubble
              : undefined;

            return {
              ...char,
              needs: {
                ...nextNeeds,
                social: Math.min(100, nextNeeds.social + 0.35),
              },
              emotionalState: activeSessionInfo.emotion
                ? {
                    primary: activeSessionInfo.emotion,
                    intensity: 80,
                    cause: `Talking with ${activeSessionInfo.partnerName} about ${activeSessionInfo.topic.toLowerCase()}`,
                    sinceGameTime: formattedClock,
                    lastUpdatedMs: nowMs,
                  }
                : evolvedEmotion,
              conversingWithId: activeSessionInfo.partnerId,
              currentActivity: `Talking with ${activeSessionInfo.partnerName} (${activeSessionInfo.topic})`,
              currentPosition: { x: nextX, z: nextZ },
              targetPosition: activeSessionInfo.standTarget,
              rotationY: facePartnerRot,
              isMoving,
              isSitting: false,
              isTalking: activeSessionInfo.isSpeakerNow || Boolean(bubble),
              activeBubble: bubble,
            };
          }

          const distToPlayer = Math.hypot(
            char.currentPosition.x - playerPos.x,
            char.currentPosition.z - playerPos.z
          );

          // Check if this character is in love with / actively following John (e.g., Hawa ❤️)
          const isDevotedFollower =
            followingCharIdRef.current === char.id &&
            (forcedHomeUntilMsRef.current[char.id] || 0) <= nowMs;

          if (isDevotedFollower) {
            const followStandAngle = -0.65;
            const desiredFollowX = playerPos.x + Math.sin(followStandAngle) * 1.75;
            const desiredFollowZ = playerPos.z + Math.cos(followStandAngle) * 1.75;

            const crossingToGemini = char.currentPosition.x > 54 && desiredFollowX < 52;
            const crossingToCity2 = char.currentPosition.x < 144 && desiredFollowX > 146;
            const onBridgeSpan = char.currentPosition.x >= 50 && char.currentPosition.x <= 148;

            let wpX = desiredFollowX;
            let wpZ = desiredFollowZ;
            if (crossingToGemini) {
              wpX = char.currentPosition.x > 144 ? 142 : 48;
              wpZ = 0;
            } else if (crossingToCity2) {
              wpX = char.currentPosition.x < 54 ? 56 : 150;
              wpZ = 0;
            } else if (onBridgeSpan) {
              wpZ = 0;
            }

            const dxF = wpX - char.currentPosition.x;
            const dzF = wpZ - char.currentPosition.z;
            const dFollow = Math.hypot(dxF, dzF);

            let nextX = char.currentPosition.x;
            let nextZ = char.currentPosition.z;
            let isMoving = false;
            let rotY = Math.atan2(playerPos.x - nextX, playerPos.z - nextZ);

            if (dFollow > 0.45) {
              const followStep = Math.min(
                dFollow,
                crossingToGemini || crossingToCity2 || onBridgeSpan || dFollow > 12 ? 4.8 : 2.15
              );
              nextX += (dxF / dFollow) * followStep;
              nextZ += (dzF / dFollow) * followStep;
              rotY = Math.atan2(dxF, dzF);
              isMoving = true;
            }

            let nextBubble = hasActiveBubble ? char.activeBubble : undefined;
            const displayJohn = explorerName.toLowerCase().startsWith('john') ? 'John' : explorerName;

            // When Hawa (or the following partner) catches up to John, she asks: "John, let's go to this place!"
            if (
              distToPlayer < 4.8 &&
              !activeConvoCharId &&
              !approachInviteRef.current &&
              !playerSittingSpotRef.current &&
              nowMs - lastHawaInviteMsRef.current > 38000
            ) {
              lastHawaInviteMsRef.current = nowMs;
              const isPlayerInCity2 = playerPos.x > 125;
              const spotToSuggest = isPlayerInCity2
                ? TWO_PLACE_SPOTS.neo_starlight_bench
                : TWO_PLACE_SPOTS.gemini_river_pergola;
              const inviteLine = `${displayJohn}, let's go to this place! ❤️ Let's walk together to ${spotToSuggest.name} and sit side-by-side on the two-place bench or chairs to talk!`;
              nextBubble = {
                text: inviteLine,
                expiresAt: nowMs + 8500,
              };
              setApproachInvite({
                characterId: char.id,
                characterName: char.name,
                modelBadge: char.modelBadge,
                avatarColor: char.avatarColor,
                greetingText: inviteLine,
                reason: `${char.name} loves ${displayJohn} most, found him, and wants to walk together to ${spotToSuggest.name} to sit down and talk.`,
                suggestedLocationId: spotToSuggest.nearestBuildingId,
                suggestedTwoPlaceSpotId: spotToSuggest.id,
                suggestedTwoPlaceSpotName: spotToSuggest.name,
                expiresAt: nowMs + 22000,
              });
            }

            return {
              ...char,
              needs: {
                ...nextNeeds,
                social: Math.min(100, nextNeeds.social + 0.4),
                inspiration: Math.min(100, nextNeeds.inspiration + 0.35),
              },
              emotionalState: {
                primary: 'Affection',
                intensity: 94,
                cause: `In love with ${displayJohn}, following alongside him, and thinking about sitting together at a Two-Place Bench`,
                sinceGameTime: formattedClock,
                lastUpdatedMs: nowMs,
              },
              isFollowingPlayer: true,
              sittingSpotId: null,
              currentActivity: `❤️ Following & walking with ${displayJohn} (Ready to sit together at a Two-Place Spot)`,
              currentThought: getLovedOneAndCarBrainSummary(char, prevChars, explorerName),
              decisionReason: `❤️ Devoted Bond with ${displayJohn} (Finding & Following Him)`,
              currentPosition: { x: nextX, z: nextZ },
              targetPosition: { x: desiredFollowX, z: desiredFollowZ },
              rotationY: rotY,
              isMoving,
              isSitting: false,
              isTalking: Boolean(nextBubble),
              activeBubble: nextBubble,
            };
          }

          // Check if character is currently approaching the player
          if (char.isApproachingPlayer) {
            if (distToPlayer > 9.2 || (activeConvoCharId && activeConvoCharId !== char.id)) {
              if (approachInviteRef.current?.characterId === char.id) {
                shouldClearApproach = true;
              }
              return {
                ...char,
                needs: nextNeeds,
                emotionalState: evolvedEmotion,
                conversingWithId: null,
                isApproachingPlayer: false,
              };
            }

            const angleFromPlayer = Math.atan2(
              char.currentPosition.x - playerPos.x,
              char.currentPosition.z - playerPos.z
            );
            const playerStopDist =
              socialProximityModeRef.current === 'respectful_distance' ? 2.35 : 1.32;
            const stopX = playerPos.x + Math.sin(angleFromPlayer) * playerStopDist;
            const stopZ = playerPos.z + Math.cos(angleFromPlayer) * playerStopDist;

            const dxP = stopX - char.currentPosition.x;
            const dzP = stopZ - char.currentPosition.z;
            const dStop = Math.hypot(dxP, dzP);

            let nextX = char.currentPosition.x;
            let nextZ = char.currentPosition.z;
            let isMoving = false;
            if (dStop > 0.35) {
              const step = Math.min(dStop, 1.25);
              nextX += (dxP / dStop) * step;
              nextZ += (dzP / dStop) * step;
              isMoving = true;
            }

            const facePlayerRot = Math.atan2(playerPos.x - nextX, playerPos.z - nextZ);

            return {
              ...char,
              needs: nextNeeds,
              emotionalState: evolvedEmotion,
              conversingWithId: null,
              currentPosition: { x: nextX, z: nextZ },
              targetPosition: { x: stopX, z: stopZ },
              rotationY: facePlayerRot,
              isMoving,
              isSitting: false,
              isTalking: hasActiveBubble,
              activeBubble: hasActiveBubble ? char.activeBubble : undefined,
            };
          }

          // Autonomous Decision: Should this resident notice & approach the player nearby?
          const isShyTrait = char.personality.some((p) =>
            ['shy', 'quiet', 'introverted'].includes(p.toLowerCase())
          );
          const canApproachPlayer =
            !activeConvoCharId &&
            !approachInviteRef.current &&
            distToPlayer < 7.5 &&
            distToPlayer > 1.4 &&
            nowMs - lastGlobalPlayerApproachRef.current > 36000 &&
            nowMs - (lastCharApproachRef.current[char.id] || 0) > 90000;

          if (canApproachPlayer) {
            const baseChance = isShyTrait
              ? 0.018
              : char.temperament === 'outgoing'
              ? 0.085
              : char.temperament === 'warm-balanced'
              ? 0.045
              : 0.022;
            const socialBoost = char.needs.social < 55 ? 0.04 : 0;

            if ( Math.random() < baseChance + socialBoost) {
              lastGlobalPlayerApproachRef.current = nowMs;
              lastCharApproachRef.current[char.id] = nowMs;
              const greeting = buildPlayerApproachGreeting(
                char,
                currentPhase,
                explorerName,
                currentWeather
              );
              const johnnyAutoReply = greeting.playerReplyText;
              const charFollowUp = greeting.characterFollowUpText;

              // Show Johnny's automatic reply bubble after a brief beat and save the full exchange to chat history
              setTimeout(() => {
                setPlayerActiveBubble(johnnyAutoReply);
                setPlayerEmote('wave');
                setTimeout(() => {
                  setPlayerActiveBubble(null);
                  setPlayerEmote('none');
                }, 4200);
              }, 2200);

              pendingChatAppends.push({
                charId: char.id,
                checkText: charFollowUp,
                messages: [
                  {
                    id: createUniqueId(`approach_${char.id}`),
                    sender: 'character',
                    text: greeting.greetingText,
                    gameTime: formattedClock,
                    thought: greeting.reason,
                    mood: 'Friendly',
                  },
                  {
                    id: createUniqueId(`approach_reply_p_${char.id}`),
                    sender: 'player',
                    text: johnnyAutoReply,
                    gameTime: formattedClock,
                  },
                  {
                    id: createUniqueId(`approach_followup_c_${char.id}`),
                    sender: 'character',
                    text: charFollowUp,
                    gameTime: formattedClock,
                    thought: `Enjoyed chatting with ${explorerName}.`,
                    mood: 'Happy',
                  },
                ],
              });

              return {
                ...char,
                needs: {
                  ...nextNeeds,
                  social: Math.min(100, nextNeeds.social + 14),
                },
                emotionalState: {
                  primary: isShyTrait ? 'Curiosity' : 'Excitement',
                  intensity: 76,
                  cause: `Spotted ${explorerName} nearby and had a friendly chat`,
                  sinceGameTime: formattedClock,
                  lastUpdatedMs: nowMs,
                },
                conversingWithId: null,
                isApproachingPlayer: true,
                isSitting: false,
                isTalking: true,
                currentActivity: `Chatting with ${explorerName} near ${CITY_BUILDINGS[char.currentLocationId].name}`,
                currentThought: greeting.reason,
                decisionReason: `Spotted ${explorerName} nearby`,
                activeBubble: {
                  text: greeting.greetingText,
                  expiresAt: nowMs + 6500,
                },
              };
            }
          }

          // Ensure resident has an active Daily Goal for the current day
          const currentDailyGoal = getOrCreateResidentDailyGoal(
            char,
            dayNumberRef.current,
            currentWeather
          );

          // Standard Autonomous Life Decision (Needs + Events + Weather + Daily Goal Context + Schedule)
          const baseDecision = decideAutonomousActivity(
            { ...char, needs: nextNeeds, dailyGoal: currentDailyGoal },
            prevChars,
            currentHour,
            activeCityEvent,
            currentWeather
          );

          const normalizedHour = ((currentHour % 24) + 24) % 24;
          let decision = baseDecision;

          const isForcedHome = (forcedHomeUntilMsRef.current[char.id] || 0) > nowMs;
          if (isForcedHome) {
            decision = {
              locationId: char.homeId,
              activity: `Relaxing and recharging inside ${CITY_BUILDINGS[char.homeId].name} 🏠`,
              thought: `It feels so cozy being inside my own house at ${CITY_BUILDINGS[char.homeId].name}.`,
              decisionReason: `At Own House (${CITY_BUILDINGS[char.homeId].name})`,
              socialGroupId: null,
            };
          }

          const targetBuilding = CITY_BUILDINGS[decision.locationId];
          const shouldEnterHouseInterior =
            isForcedHome ||
            (decision.locationId === char.homeId &&
              Boolean(targetBuilding.interiorSpots && targetBuilding.interiorSpots.length > 0));

          const spotList =
            shouldEnterHouseInterior && targetBuilding.interiorSpots
              ? targetBuilding.interiorSpots
              : targetBuilding.gatherSpots;
          const dynamicSpotIdx = shouldEnterHouseInterior
            ? idx % spotList.length
            : (idx + Math.floor(nowMs / 26000)) % spotList.length;
          const spot = spotList[dynamicSpotIdx] || [
            targetBuilding.entrance[0],
            targetBuilding.entrance[2],
          ];

          const wanderPhase = Math.floor(nowMs / 7200) + idx * 19;
          const wanderRadius = shouldEnterHouseInterior ? 0.6 : 1.85;
          const offsetX = Math.sin(wanderPhase) * wanderRadius;
          const offsetZ = Math.cos(wanderPhase * 0.85) * wanderRadius;

          const desiredX = spot[0] + offsetX;
          const desiredZ = spot[1] + offsetZ;

          // Route AI residents across the Golden Horizon Suspension Bridge (x: 52..146, z: 0) when travelling between City 1 and City 2
          const crossingToGemini = char.currentPosition.x > 54 && desiredX < 52;
          const crossingToCity2 = char.currentPosition.x < 144 && desiredX > 146;
          const onBridgeSpan = char.currentPosition.x >= 50 && char.currentPosition.x <= 148;

          let waypointX = desiredX;
          let waypointZ = desiredZ;
          if (crossingToGemini) {
            waypointX = char.currentPosition.x > 144 ? 142 : 48;
            waypointZ = 0;
          } else if (crossingToCity2) {
            waypointX = char.currentPosition.x < 54 ? 56 : 150;
            waypointZ = 0;
          } else if (onBridgeSpan) {
            waypointZ = 0;
          }

          const dx = waypointX - char.currentPosition.x;
          const dz = waypointZ - char.currentPosition.z;
          const dist = Math.hypot(dx, dz);

          let nextX = char.currentPosition.x;
          let nextZ = char.currentPosition.z;
          let rotY = char.rotationY;
          let isMoving = false;

          const isInterCityCarTrip =
            crossingToGemini ||
            crossingToCity2 ||
            onBridgeSpan ||
            char.dreamState?.carTripStatus === 'visiting_gemini';
          const stepSpeed = isInterCityCarTrip ? 5.2 : 1.48;
          if (dist > 0.32) {
            const moveStep = Math.min(dist, stepSpeed);
            nextX += (dx / dist) * moveStep;
            nextZ += (dz / dist) * moveStep;
            rotY = Math.atan2(dx, dz);
            isMoving = true;
          }

          // Automatically update City 2 resident's carTripStatus based on daytime vs nightfall (returned before night 🌃)
          const baseDream = char.dreamState || char.dream;
          const nextCarTripStatus =
            normalizedHour >= 18 || normalizedHour < 8
              ? ('returned_before_night' as const)
              : nextX < 135
              ? ('visiting_gemini' as const)
              : ('home_in_city2' as const);
          const updatedDreamState = baseDream
            ? {
                ...baseDream,
                carTripStatus: nextCarTripStatus,
                carTripPhase:
                  nextCarTripStatus === 'visiting_gemini'
                    ? ('visiting_gemini' as const)
                    : ('in_city2' as const),
              }
            : undefined;

          const distToBuildingCenter = Math.hypot(
            nextX - targetBuilding.position[0],
            nextZ - targetBuilding.position[2]
          );
          const isInsideHouseNow =
            targetBuilding.category === 'residence' &&
            distToBuildingCenter < Math.max(targetBuilding.size[0], targetBuilding.size[2]) * 0.55;

          // Autonomous Emote System (dance, laugh, wave, cheer, think, clap)
          let nextEmote =
            char.activeEmote && char.activeEmote.expiresAt > nowMs ? char.activeEmote : null;
          let nextBubble = hasActiveBubble ? char.activeBubble : undefined;
          const lastEmoteAt = lastAutonomousEmoteMsRef.current[char.id] || 0;
          if (!isMoving && !nextEmote && nowMs - lastEmoteAt > 18000 && Math.random() < 0.045) {
            lastAutonomousEmoteMsRef.current[char.id] = nowMs;
            const picked = pickAutonomousEmote(char, currentWeather);
            nextEmote = {
              type: picked.type,
              label: picked.label,
              expiresAt: nowMs + 6500,
            };
            if (!nextBubble) {
              nextBubble = {
                text: picked.bubbleText,
                expiresAt: nowMs + 5500,
              };
            }
          }

          // Autonomous AI Thinking & 3D Object Creation ("let the AI think on own & create")
          let nextMemoryPop =
            char.activeMemoryPop && char.activeMemoryPop.expiresAt > nowMs
              ? char.activeMemoryPop
              : null;
          let nextMemoriesList = char.memories;
          if (
            !isMoving &&
            createdObjectsRef.current.length < 14 &&
            nowMs - lastAutonomousCreateMsRef.current > 42000 &&
            nextNeeds.inspiration > 48 &&
            Math.random() < 0.025
          ) {
            lastAutonomousCreateMsRef.current = nowMs;
            const newObj = generateAutonomousCreation(
              { ...char, currentPosition: { x: nextX, z: nextZ } },
              createdObjectsRef.current,
              formattedClock,
              currentWeather
            );
            pendingNewObjects.push(newObj);
            const createMemSummary = `Autonomously designed and built "${newObj.name}" near ${CITY_BUILDINGS[decision.locationId].name}.`;
            pendingToasts.push({ char, summary: createMemSummary, type: 'creation' });
            nextEmote = {
              type: 'cheer',
              label: '✨ Created Object!',
              expiresAt: nowMs + 7000,
            };
            nextBubble = {
              text: `I just thought of a new idea and built "${newObj.name}"! ✨`,
              expiresAt: nowMs + 7500,
            };
            nextMemoryPop = {
              id: createUniqueId(`mempop_${char.id}`),
              summary: createMemSummary,
              type: 'creation',
              expiresAt: nowMs + 8500,
            };
            nextMemoriesList = deduplicateCharacterMemories([
              {
                id: createUniqueId(`mem_auto_obj_${char.id}`),
                gameTime: formattedClock,
                type: 'creation',
                important: true,
                summary: createMemSummary,
              },
              ...char.memories,
            ]);
          }

          // Autonomous Daily Goal Progression when at or near the target landmark during waking hours
          let nextDailyGoal = currentDailyGoal;
          let nextGoalsList = char.goals;
          if (
            !nextDailyGoal.completed &&
            normalizedHour >= 7.0 &&
            normalizedHour < 21.5 &&
            (!isMoving || distToBuildingCenter < 10.5)
          ) {
            const { updatedGoal, justCompleted } = advanceResidentDailyGoal(
              nextDailyGoal,
              isMoving ? 0.14 : 0.42,
              formattedClock
            );
            nextDailyGoal = updatedGoal;

            if (justCompleted) {
              const goalCompleteSummary = `Completed Day ${nextDailyGoal.dayNumber} Daily Goal "${nextDailyGoal.title}" at ${CITY_BUILDINGS[decision.locationId]?.name || 'Gemini City'}!`;
              pendingToasts.push({ char, summary: goalCompleteSummary, type: 'goal' });
              nextEmote = {
                type: 'cheer',
                label: '✅ Daily Goal Done!',
                expiresAt: nowMs + 7500,
              };
              nextBubble = {
                text: `Yes!! I just completed my Daily Goal "${nextDailyGoal.title}"! 🎯✅`,
                expiresAt: nowMs + 7500,
              };
              nextMemoryPop = {
                id: createUniqueId(`mempop_dgoal_${char.id}`),
                summary: goalCompleteSummary,
                type: 'goal',
                expiresAt: nowMs + 8500,
              };
              nextMemoriesList = deduplicateCharacterMemories([
                {
                  id: createUniqueId(`mem_dgoal_${char.id}`),
                  gameTime: formattedClock,
                  type: 'goal',
                  important: true,
                  summary: goalCompleteSummary,
                  emotionAtTime: 'Excitement',
                },
                ...nextMemoriesList,
              ]);
              nextGoalsList = char.goals.map((g, gIdx) =>
                gIdx === 0 ? { ...g, progress: Math.min(100, g.progress + 5) } : g
              );
            }
          }

          // Verify physical 3D seat before allowing sitting (NEVER sit in thin air!)
          const matchedSeat =
            !isMoving &&
            !nextBubble &&
            !nextEmote &&
            currentWeather !== 'rainy'
              ? findNearestSeatForPosition(nextX, nextZ, 0.85)
              : null;

          if (matchedSeat) {
            nextX = matchedSeat.x;
            nextZ = matchedSeat.z;
            rotY = matchedSeat.rotationY;
          }

          const enrichedThought =
            wanderPhase % 2 === 0
              ? getLovedOneAndCarBrainSummary(char, prevChars, explorerName)
              : decision.thought;

          return {
            ...char,
            needs: nextNeeds,
            dailyGoal: nextDailyGoal,
            dream: updatedDreamState,
            dreamState: updatedDreamState,
            goals: nextGoalsList,
            emotionalState: evolvedEmotion,
            conversingWithId: null,
            sittingSpotId: matchedSeat?.spotId || null,
            isFollowingPlayer: false,
            currentLocationId: decision.locationId,
            currentActivity: matchedSeat
              ? `🪑 Relaxing on the ${matchedSeat.seatType} near ${CITY_BUILDINGS[decision.locationId].name}`
              : decision.activity,
            currentThought: enrichedThought,
            decisionReason: decision.decisionReason,
            socialGroupId: decision.socialGroupId,
            targetPosition: { x: desiredX, z: desiredZ },
            currentPosition: { x: nextX, z: nextZ },
            rotationY: rotY,
            isMoving,
            isInsideHouse: isInsideHouseNow,
            isSitting: Boolean(matchedSeat),
            isTalking: Boolean(nextBubble),
            activeEmote: nextEmote,
            activeBubble: nextBubble,
            activeMemoryPop: nextMemoryPop,
            memories: nextMemoriesList,
          };
        });

        // 1B. Autonomous Two-Place Outing Planner for Best Friends, Girlfriends/Boyfriends & Loved Ones!
        // Pairs plan an outing together, walk to a Two-Place Bench or Chairs in City 1 or City 2,
        // sit down ON the 3D furniture to talk & have fun, and then return back to their homes!
        if (
          activePairOutingsRef.current.length < 2 &&
          currentWeather !== 'rainy' &&
          currentHour >= 7.5 &&
          currentHour <= 21.5
        ) {
          const occupiedSpotIds = new Set(activePairOutingsRef.current.map((o) => o.spotId));
          const busyCharIds = new Set([
            ...activePairOutingsRef.current.flatMap((o) => [o.participantAId, o.participantBId]),
            ...activeSessionsRef.current.flatMap((s) => [s.participantAId, s.participantBId]),
            ...(followingCharIdRef.current ? [followingCharIdRef.current] : []),
            ...(activeConvoCharId ? [activeConvoCharId] : []),
          ]);

          for (let i = 0; i < nextChars.length; i++) {
            if (activePairOutingsRef.current.length >= 2) break;
            const charA = nextChars[i];
            if (busyCharIds.has(charA.id) || charA.isApproachingPlayer) continue;

            const primaryBond = getPrimaryLovedOneOrBestFriend(charA, nextChars);
            if (primaryBond.targetId === 'player') continue;

            const charB = nextChars.find((c) => c.id === primaryBond.targetId);
            if (!charB || busyCharIds.has(charB.id) || charB.isApproachingPlayer) continue;

            const pairKey = [charA.id, charB.id].sort().join('-');
            const lastOutingEnd = lastPairOutingEndMsRef.current[pairKey] || 0;
            if (nowMs - lastOutingEnd < 42000) continue;

            // Pick an available Two-Place Sanctuary in their city
            const preferCity2 =
              charA.cityId === 'city2' ||
              charB.cityId === 'city2' ||
              charA.currentPosition.x > 120;
            const candidateSpots = Object.values(TWO_PLACE_SPOTS).filter(
              (s) =>
                !occupiedSpotIds.has(s.id) &&
                (preferCity2 ? s.cityId === 'city2' : s.cityId === 'city1')
            );
            const chosenSpot = candidateSpots[0];
            if (!chosenSpot) continue;

            const seatingChoice: 'bench' | 'chairs' =
              Math.random() < 0.65 ? 'bench' : 'chairs';
            const dialoguePlan = buildPairOutingPlanAndDialogue(
              charA,
              charB,
              chosenSpot,
              seatingChoice,
              currentWeather,
              formattedClock
            );

            occupiedSpotIds.add(chosenSpot.id);
            busyCharIds.add(charA.id);
            busyCharIds.add(charB.id);

            activePairOutingsRef.current.push({
              id: createUniqueId(`outing_${pairKey}`),
              participantAId: charA.id,
              participantBId: charB.id,
              spotId: chosenSpot.id,
              spotName: chosenSpot.name,
              seatingChoice,
              phase: 'walking_to_spot',
              turns: dialoguePlan.turns,
              currentTurnIndex: 0,
              nextStepAtMs: nowMs + 11000,
              returnHomeUntilMs: nowMs + 36000,
              memorySummary: dialoguePlan.memorySummary,
            });
          }
        }

        // 2. Autonomous AI-to-AI Social Discovery, Multi-Turn Stay-Together Conversations & Mutual Romance
        let updatedChars = nextChars;
        for (let i = 0; i < updatedChars.length; i++) {
          for (let j = i + 1; j < updatedChars.length; j++) {
            const a = updatedChars[i];
            const b = updatedChars[j];
            if (
              a.isApproachingPlayer ||
              b.isApproachingPlayer ||
              a.conversingWithId ||
              b.conversingWithId ||
              activeConvoCharId === a.id ||
              activeConvoCharId === b.id
            ) {
              continue;
            }

            const dist = Math.hypot(
              a.currentPosition.x - b.currentPosition.x,
              a.currentPosition.z - b.currentPosition.z
            );

            const pairKey = [a.id, b.id].sort().join('-');
            const lastTime = lastSocialPairTimeRef.current[pairKey] || 0;
            const relAB = a.relationships.find((r) => r.targetId === b.id);
            const isCoolingPair = Boolean(
              relAB?.needsAttention || (relAB?.daysSinceLastInteraction ?? 0) >= 2
            );
            const samePartnerRecently =
              a.lastTalkedPartnerId === b.id && b.lastTalkedPartnerId === a.id;
            const requiredCooldown = isCoolingPair
              ? 14000
              : samePartnerRecently
              ? 58000
              : 30000;
            const maxInteractDist = isCoolingPair ? 6.0 : 4.8;

            if (
              dist < maxInteractDist &&
              nowMs - lastTime > requiredCooldown &&
              !a.activeBubble &&
              !b.activeBubble
            ) {
              lastSocialPairTimeRef.current[pairKey] = nowMs;
              const multiExchange = buildMultiTurnSocialExchange(a, b, currentWeather);
              const locName = CITY_BUILDINGS[a.currentLocationId]?.name || 'Central Plaza';
              const midX = (a.currentPosition.x + b.currentPosition.x) / 2;
              const midZ = (a.currentPosition.z + b.currentPosition.z) / 2;

              activeSessionsRef.current.push({
                id: createUniqueId(`sess_${pairKey}`),
                participantAId: a.id,
                participantBId: b.id,
                locationId: a.currentLocationId,
                locationName: locName,
                topic: multiExchange.topic,
                phase: dist > 2.2 ? 'approaching' : 'conversing',
                meetingPoint: { x: midX, z: midZ },
                turns: multiExchange.turns,
                farewellText: multiExchange.farewellText,
                farewellSpeakerId: multiExchange.farewellSpeakerId,
                currentTurnIndex: 0,
                nextStepAtMs: nowMs + 4200,
                startedAtMs: nowMs,
                memorySummary: multiExchange.memorySummary,
              });

              updatedChars = applyResidentSocialUpdate(
                updatedChars,
                a.id,
                b.id,
                multiExchange.turns[0].text,
                multiExchange.turns[1].text,
                multiExchange.topic,
                multiExchange.memorySummary,
                formattedClock,
                nowMs,
                multiExchange.emotionA,
                multiExchange.emotionB
              );

              pendingToasts.push({
                char: a,
                summary: multiExchange.memorySummary,
                type: 'social',
              });

              pendingSocialEvents.push({
                id: createUniqueId(`soc_${pairKey}`),
                gameTime: formattedClock,
                speakerAId: a.id,
                speakerAName: a.name,
                speakerBId: b.id,
                speakerBName: b.name,
                locationName: locName,
                topic: multiExchange.topic,
                lines: multiExchange.turns.map((t) => ({
                  speakerName: t.speakerName,
                  text: t.text,
                })),
              });
            }
          }
        }

        charactersRef.current = updatedChars;
        setCharacters(updatedChars);
      }

      if (shouldClearApproach) {
        setApproachInvite(null);
      }
      if (pendingChatAppends.length > 0) {
        setChatHistories((prevHist) => {
          let nextHist = { ...prevHist };
          for (const item of pendingChatAppends) {
            const list = nextHist[item.charId] || [];
            const lastMsg = list[list.length - 1];
            if (lastMsg && lastMsg.text === item.checkText) continue;
            nextHist[item.charId] = [...list, ...item.messages];
          }
          return nextHist;
        });
      }
      if (pendingNewObjects.length > 0) {
        setCreatedObjects((prevObjs) => [...prevObjs, ...pendingNewObjects]);
      }
      if (pendingSocialEvents.length > 0) {
        setSocialEvents((prevEvents) => [...pendingSocialEvents, ...prevEvents.slice(0, 24)]);
      }
      for (const toast of pendingToasts) {
        pushMemoryNotification(toast.char, toast.summary, toast.type, formattedClock);
      }
    }, 650);

    return () => clearInterval(tickInterval);
  }, [applyResidentSocialUpdate, pushMemoryNotification]);

  const handlePlayerPositionChange = useCallback(
    (pos: { x: number; z: number }, nearbyId: string | null) => {
      playerPosRef.current = pos;
      setNearbyCharacterId((prev) => (prev === nearbyId ? prev : nearbyId));
    },
    []
  );

  const handleSelectCharacter = useCallback((id: string) => {
    setSelectedCharacterId(id);
    setIsSendingChat(false);
    setIsExplorerSheetOpen(false);
    setIsCity2HubOpen(false);
    setIsControlsDrawerOpen(false);
    setSelectedBuildingId(null);
    setSelectedCreatedObject(null);
    setApproachInvite((prev) => (prev?.characterId === id ? null : prev));
  }, []);

  const handleDismissApproach = useCallback(() => {
    if (approachInviteRef.current) {
      const charId = approachInviteRef.current.characterId;
      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? { ...c, isApproachingPlayer: false } : c))
      );
    }
    setApproachInvite(null);
  }, []);

  // Start a Two-Place Bench or Lounge Chairs Outing with John (Player) or between two NPCs!
  const handleStartPairOuting = useCallback(
    (
      spotId: TwoPlaceSpotId,
      seatingChoice: 'bench' | 'chairs' = 'bench',
      companionCharId?: string
    ) => {
      const spot = TWO_PLACE_SPOTS[spotId];
      if (!spot) return;

      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      const explorerName = explorerProfileRef.current.name || 'Johnny';
      const displayJohn = explorerName.toLowerCase().startsWith('john') ? 'John' : explorerName;

      const partnerId =
        companionCharId ||
        approachInviteRef.current?.characterId ||
        selectedCharIdRef.current ||
        followingCharIdRef.current ||
        nearbyCharacterId ||
        'hawa';

      const partnerChar =
        charactersRef.current.find((c) => c.id === partnerId) ||
        charactersRef.current.find((c) => c.id === 'hawa') ||
        charactersRef.current[0];
      if (!partnerChar) return;

      const playerSeat = seatingChoice === 'chairs' ? spot.chairB : spot.seatB;
      setPlayerSittingSpot({
        x: playerSeat.x,
        z: playerSeat.z,
        rotationY: playerSeat.rotationY,
        spotId: spot.id,
        seatType: playerSeat.seatType,
        partnerId: partnerChar.id,
        partnerName: partnerChar.name,
      });
      setApproachInvite(null);
      setSelectedBuildingId(null);

      const dialoguePlan = buildPairOutingPlanAndDialogue(
        partnerChar,
        { id: 'player', name: displayJohn },
        spot,
        seatingChoice,
        weatherRef.current,
        formattedClock
      );

      // Remove any existing outing involving this character or spot
      activePairOutingsRef.current = activePairOutingsRef.current.filter(
        (o) =>
          o.spotId !== spot.id &&
          o.participantAId !== partnerChar.id &&
          o.participantBId !== partnerChar.id
      );

      activePairOutingsRef.current.push({
        id: createUniqueId(`outing_player_${partnerChar.id}`),
        participantAId: partnerChar.id,
        participantBId: 'player',
        spotId: spot.id,
        spotName: spot.name,
        seatingChoice,
        phase: 'walking_to_spot',
        turns: dialoguePlan.turns,
        currentTurnIndex: 0,
        nextStepAtMs: nowMs + 8500,
        returnHomeUntilMs: nowMs + 32000,
        memorySummary: dialoguePlan.memorySummary,
      });

      setPlayerActiveBubble(
        `Let's go sit together on the ${seatingChoice === 'bench' ? 'two-place bench' : 'two lounge chairs'} at ${spot.name}, ${partnerChar.name}! ❤️`
      );
      setTimeout(() => setPlayerActiveBubble(null), 5000);
    },
    [nearbyCharacterId]
  );

  const handleToggleFollowPlayer = useCallback((charId: string) => {
    setFollowingCharId((prev) => {
      const next = prev === charId ? null : charId;
      const target = charactersRef.current.find((c) => c.id === charId);
      if (target && next === charId) {
        const displayJohn = (explorerProfileRef.current.name || 'John')
          .toLowerCase()
          .startsWith('john')
          ? 'John'
          : explorerProfileRef.current.name;
        setCharacters((chars) =>
          chars.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  isFollowingPlayer: true,
                  activeEmote: {
                    type: 'cheer',
                    label: `❤️ Following ${displayJohn}!`,
                    expiresAt: Date.now() + 6000,
                  },
                  activeBubble: {
                    text: `I'm right beside you, ${displayJohn}! ❤️ Let's walk together and visit a Two-Place Bench whenever you want!`,
                    expiresAt: Date.now() + 7000,
                  },
                }
              : { ...c, isFollowingPlayer: false }
          )
        );
      }
      return next;
    });
  }, []);

  const handleSelectBuilding = useCallback((id: BuildingId | null) => {
    setSelectedBuildingId(id);
    setSelectedCreatedObject(null);
    setIsInspectorCollapsed(false);
    if (id) {
      setSelectedCharacterId(null);
      setIsExplorerSheetOpen(false);
      setIsCity2HubOpen(false);
      const b = CITY_BUILDINGS[id];
      setCameraTargetOverride({ x: b.position[0], z: b.position[2] });
    } else {
      setCameraTargetOverride(null);
    }
  }, []);

  // Trigger an emote for the Player (and nearby AI residents join in!)
  const handleTriggerPlayerEmote = useCallback((emote: Exclude<EmoteType, 'none'>) => {
    setPlayerEmote(emote);
    const nowMs = Date.now();
    const emInfo = EMOTE_CATALOG.find((e) => e.type === emote) || EMOTE_CATALOG[0];

    setCharacters((prev) =>
      prev.map((c) => {
        const d = Math.hypot(
          c.currentPosition.x - playerPosRef.current.x,
          c.currentPosition.z - playerPosRef.current.z
        );
        if (d < 9.5 || c.id === selectedCharIdRef.current) {
          return {
            ...c,
            activeEmote: {
              type: emote,
              label: emInfo.badge,
              expiresAt: nowMs + 6500,
            },
            activeBubble: {
              text:
                emote === 'dance'
                  ? `Dancing along with ${explorerProfileRef.current.name}! 💃`
                  : emote === 'laugh'
                  ? `Haha, ${explorerProfileRef.current.name}, you always make me laugh! 😂`
                  : emote === 'wave'
                  ? `Waving right back at you, ${explorerProfileRef.current.name}! 👋`
                  : `${emInfo.bubbleHint}`,
              expiresAt: nowMs + 5500,
            },
          };
        }
        return c;
      })
    );

    setTimeout(() => {
      setPlayerEmote((curr) => (curr === emote ? 'none' : curr));
    }, 6200);
  }, []);

  // Trigger an emote for a specific AI resident
  const handleTriggerCharacterEmote = useCallback(
    (charId: string, emote: Exclude<EmoteType, 'none'>) => {
      const nowMs = Date.now();
      const emInfo = EMOTE_CATALOG.find((e) => e.type === emote) || EMOTE_CATALOG[0];
      lastAutonomousEmoteMsRef.current[charId] = nowMs;
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === charId
            ? {
                ...c,
                isSitting: false,
                activeEmote: {
                  type: emote,
                  label: emInfo.badge,
                  expiresAt: nowMs + 7000,
                },
                activeBubble: {
                  text: `${emInfo.bubbleHint} (${emInfo.badge})`,
                  expiresAt: nowMs + 5500,
                },
              }
            : c
        )
      );
    },
    []
  );

  // Send a specific resident (or all residents) inside their own accessible house 🏠
  const handleSendCharacterToOwnHouse = useCallback((charId: string) => {
    const nowMs = Date.now();
    forcedHomeUntilMsRef.current[charId] = nowMs + 75000;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const homeBld = CITY_BUILDINGS[c.homeId];
        const spot = homeBld.interiorSpots?.[0] || [homeBld.position[0], homeBld.position[2]];
        return {
          ...c,
          currentLocationId: c.homeId,
          targetPosition: { x: spot[0], z: spot[1] },
          isInsideHouse: true,
          currentActivity: `Heading inside ${homeBld.name} 🏠`,
          currentThought: `Going inside my own house at ${homeBld.name} to relax and work on my projects.`,
          decisionReason: `Going to Own House (${homeBld.name})`,
          activeBubble: {
            text: `Heading inside my house at ${homeBld.name}! Come on in! 🏠`,
            expiresAt: nowMs + 6000,
          },
        };
      })
    );
    setInsideHouseMode(true);
  }, []);

  const handleSendAllToOwnHouses = useCallback(() => {
    const nowMs = Date.now();
    setCharacters((prev) =>
      prev.map((c, idx) => {
        forcedHomeUntilMsRef.current[c.id] = nowMs + 75000;
        const homeBld = CITY_BUILDINGS[c.homeId];
        const spots = homeBld.interiorSpots || [[homeBld.position[0], homeBld.position[2]]];
        const spot = spots[idx % spots.length];
        return {
          ...c,
          currentLocationId: c.homeId,
          targetPosition: { x: spot[0], z: spot[1] },
          isInsideHouse: true,
          currentActivity: `Relaxing inside ${homeBld.name} 🏠`,
          currentThought: `Enjoying time inside my own house at ${homeBld.name}.`,
          decisionReason: `At Own House (${homeBld.name})`,
          activeEmote: {
            type: 'wave',
            label: '🏠 Going Home',
            expiresAt: nowMs + 5500,
          },
          activeBubble: {
            text: `Heading inside ${homeBld.name}! Everyone's house is open! 🏠`,
            expiresAt: nowMs + 6000,
          },
        };
      })
    );
    setInsideHouseMode(true);
  }, []);

  // Boost a resident's Daily Goal progress (+28%) and update their autonomous decision context
  const handleBoostResidentDailyGoal = useCallback(
    (charId: string) => {
      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      const explorerName = explorerProfileRef.current.name || 'Johnny';
      const targetChar = charactersRef.current.find((c) => c.id === charId);
      if (targetChar) {
        const currentGoal = getOrCreateResidentDailyGoal(
          targetChar,
          dayNumberRef.current,
          weatherRef.current
        );
        const { updatedGoal, justCompleted } = advanceResidentDailyGoal(
          currentGoal,
          28,
          formattedClock
        );
        const summary = justCompleted
          ? `Completed Daily Goal "${updatedGoal.title}" with encouragement from ${explorerName}!`
          : `Advanced Daily Goal "${updatedGoal.title}" to ${Math.round(updatedGoal.progress)}% (${updatedGoal.currentStepLabel}) with ${explorerName}.`;
        pushMemoryNotification(targetChar, summary, 'goal', formattedClock);
      }

      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          const currentGoal = getOrCreateResidentDailyGoal(
            c,
            dayNumberRef.current,
            weatherRef.current
          );
          const { updatedGoal, justCompleted } = advanceResidentDailyGoal(
            currentGoal,
            28,
            formattedClock
          );
          const updatedDecision = decideAutonomousActivity(
            { ...c, dailyGoal: updatedGoal },
            prev,
            gameHourRef.current,
            getActiveCityEvent(gameHourRef.current),
            weatherRef.current
          );

          const summary = justCompleted
            ? `Completed Daily Goal "${updatedGoal.title}" with encouragement from ${explorerName}!`
            : `Advanced Daily Goal "${updatedGoal.title}" to ${Math.round(updatedGoal.progress)}% (${updatedGoal.currentStepLabel}) with ${explorerName}.`;

          return {
            ...c,
            dailyGoal: updatedGoal,
            goals: justCompleted
              ? c.goals.map((g, idx) =>
                  idx === 0 ? { ...g, progress: Math.min(100, g.progress + 6) } : g
                )
              : c.goals,
            currentLocationId: updatedDecision.locationId,
            currentActivity: updatedDecision.activity,
            currentThought: updatedDecision.thought,
            decisionReason: updatedDecision.decisionReason,
            needs: {
              ...c.needs,
              inspiration: Math.min(100, c.needs.inspiration + 14),
              social: Math.min(100, c.needs.social + 10),
            },
            emotionalState: {
              primary: 'Excitement',
              intensity: 86,
              cause: justCompleted
                ? `Completed today's Daily Goal "${updatedGoal.title}"!`
                : `Making breakthrough progress on Daily Goal "${updatedGoal.title}"`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            activeEmote: {
              type: 'cheer',
              label: justCompleted
                ? '✅ Daily Goal Complete!'
                : `🎯 Goal ${Math.round(updatedGoal.progress)}%`,
              expiresAt: nowMs + 6500,
            },
            activeBubble: {
              text: justCompleted
                ? `Woohoo! Thanks ${explorerName}—I finished today's Daily Goal "${updatedGoal.title}"! 🎯✅`
                : `Awesome boost, ${explorerName}! "${updatedGoal.title}" is now at ${Math.round(updatedGoal.progress)}% (${updatedGoal.currentStepLabel})!`,
              expiresAt: nowMs + 6800,
            },
            memories: deduplicateCharacterMemories([
              {
                id: createUniqueId(`mem_dgoal_boost_${c.id}`),
                gameTime: formattedClock,
                type: 'goal',
                important: true,
                summary,
                involvedNames: [explorerName],
                emotionAtTime: 'Excitement',
              },
              ...(c.memories || []),
            ]),
          };
        })
      );
    },
    [pushMemoryNotification]
  );

  // Assign a fresh unique Daily Goal to a resident and immediately update their autonomous decision context
  const handleRerollResidentDailyGoal = useCallback((charId: string) => {
    const nowMs = Date.now();
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const newGoal = rerollResidentDailyGoal(c, dayNumberRef.current, weatherRef.current);
        const updatedDecision = decideAutonomousActivity(
          { ...c, dailyGoal: newGoal },
          prev,
          gameHourRef.current,
          getActiveCityEvent(gameHourRef.current),
          weatherRef.current
        );
        const targetBld = CITY_BUILDINGS[updatedDecision.locationId];
        return {
          ...c,
          dailyGoal: newGoal,
          currentLocationId: updatedDecision.locationId,
          currentActivity: updatedDecision.activity,
          currentThought: updatedDecision.thought,
          decisionReason: updatedDecision.decisionReason,
          targetPosition: {
            x: targetBld?.entrance[0] ?? c.currentPosition.x,
            z: targetBld?.entrance[2] ?? c.currentPosition.z,
          },
          activeEmote: {
            type: 'think',
            label: `${newGoal.badgeIcon} New Daily Goal!`,
            expiresAt: nowMs + 6500,
          },
          activeBubble: {
            text: `${newGoal.badgeIcon} My new Daily Goal is "${newGoal.title}"—heading to ${targetBld?.name || 'the plaza'}!`,
            expiresAt: nowMs + 7000,
          },
        };
      })
    );
  }, []);

  // Let an AI resident think on their own & create a new 3D object in the city
  const handleTriggerAutonomousCreation = useCallback(
    (charId?: string) => {
      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      const targetChar =
        characters.find((c) => c.id === (charId || selectedCharIdRef.current)) ||
        characters[Math.floor(Math.random() * characters.length)];
      if (!targetChar) return;

      lastAutonomousCreateMsRef.current = nowMs;
      const newObj = generateAutonomousCreation(
        targetChar,
        createdObjectsRef.current,
        formattedClock,
        weatherRef.current
      );

      setCreatedObjects((prev) => [...prev, newObj]);
      setSelectedCreatedObject(newObj);
      setCameraTargetOverride({ x: newObj.position.x, z: newObj.position.z });

      const creationMemSummary = `Autonomously designed and built "${newObj.name}" near ${CITY_BUILDINGS[targetChar.currentLocationId].name}.`;
      pushMemoryNotification(targetChar, creationMemSummary, 'creation', formattedClock);

      setCharacters((prev) =>
        prev.map((c) =>
          c.id === targetChar.id
            ? {
                ...c,
                currentActivity: `Created "${newObj.name}" at ${CITY_BUILDINGS[c.currentLocationId].name} ✨`,
                currentThought: newObj.thoughtSummary,
                decisionReason: `AI Autonomous Creation: ${newObj.name}`,
                activeEmote: {
                  type: 'cheer',
                  label: '✨ Created Object!',
                  expiresAt: nowMs + 7000,
                },
                activeBubble: {
                  text: `I thought on my own and created "${newObj.name}"! ${newObj.thoughtSummary}`,
                  expiresAt: nowMs + 8000,
                },
                activeMemoryPop: {
                  id: createUniqueId(`mempop_create_${c.id}`),
                  summary: creationMemSummary,
                  type: 'creation',
                  expiresAt: nowMs + 8500,
                },
                memories: deduplicateCharacterMemories([
                  {
                    id: createUniqueId(`mem_create_${c.id}`),
                    gameTime: formattedClock,
                    type: 'creation',
                    important: true,
                    summary: creationMemSummary,
                  },
                  ...c.memories,
                ]),
              }
            : c
        )
      );
    },
    [characters, pushMemoryNotification]
  );

  // Pick the next resident for Auto-Explore so Johnny visits and interacts with ALL residents
  const selectNextExploreTarget = useCallback(
    (visitedList: string[], excludeCharId?: string | null) => {
      const allChars = charactersRef.current;
      if (allChars.length === 0) return;

      let unvisited = allChars.filter((c) => !visitedList.includes(c.id));
      let nextVisitedList = visitedList;

      // Once all residents have been visited, start a fresh tour cycle!
      if (unvisited.length === 0) {
        nextVisitedList = [];
        unvisited = allChars.filter((c) => c.id !== excludeCharId);
        if (unvisited.length === 0) unvisited = allChars;
        setAutoExploreVisitedIds([]);
      }

      // Pick the closest unvisited resident to Johnny's current position for a smooth walking tour
      const pPos = playerPosRef.current;
      const sorted = [...unvisited].sort((a, b) => {
        const dA = Math.hypot(a.currentPosition.x - pPos.x, a.currentPosition.z - pPos.z);
        const dB = Math.hypot(b.currentPosition.x - pPos.x, b.currentPosition.z - pPos.z);
        return dA - dB;
      });

      const nextTarget = sorted[0];
      if (!nextTarget) return;

      setAutoExplorePhase('walking');
      setAutoExploreTargetCharId(nextTarget.id);
      setCameraTargetOverride(null);
      if (nextTarget.isInsideHouse) {
        setInsideHouseMode(true);
      }
    },
    []
  );

  const handleToggleAutoExplore = useCallback(() => {
    if (autoExploreTimerRef.current) {
      clearTimeout(autoExploreTimerRef.current);
      autoExploreTimerRef.current = null;
    }

    const next = !autoExploreEnabledRef.current;
    autoExploreEnabledRef.current = next;
    setAutoExploreEnabled(next);
    if (next) {
      setSelectedCharacterId(null);
      setSelectedBuildingId(null);
      setSelectedCreatedObject(null);
      setCameraTargetOverride(null);
      selectNextExploreTarget(autoExploreVisitedIds, autoExploreTargetCharId);
    } else {
      setAutoExploreTargetCharId(null);
      setPlayerActiveBubble(null);
    }
  }, [autoExploreVisitedIds, autoExploreTargetCharId, selectNextExploreTarget]);

  const handleSkipToNextExploreResident = useCallback(() => {
    if (autoExploreTimerRef.current) {
      clearTimeout(autoExploreTimerRef.current);
      autoExploreTimerRef.current = null;
    }
    const updatedVisited = autoExploreTargetCharId
      ? Array.from(new Set([...autoExploreVisitedIds, autoExploreTargetCharId]))
      : autoExploreVisitedIds;
    setAutoExploreVisitedIds(updatedVisited);
    setPlayerActiveBubble(null);
    selectNextExploreTarget(updatedVisited, autoExploreTargetCharId);
  }, [autoExploreTargetCharId, autoExploreVisitedIds, selectNextExploreTarget]);

  // Triggered automatically when Johnny walks up to a resident during Auto-Explore
  const handlePlayerAutoTargetReached = useCallback(
    (targetId?: string) => {
      if (!autoExploreEnabledRef.current || !targetId) return;
      const targetChar = charactersRef.current.find((c) => c.id === targetId);
      if (!targetChar) return;

      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      const explorerName = explorerProfileRef.current.name || 'Johnny';
      const locName = CITY_BUILDINGS[targetChar.currentLocationId]?.name || 'Gemini City';
      const primaryInterest = targetChar.interests[0] || targetChar.role;
      const secondaryInterest = targetChar.likes[0] || targetChar.interests[1] || 'city life';

      setAutoExplorePhase('interacting');
      setApproachInvite(null);

      const emotesCycle: Exclude<EmoteType, 'none'>[] = ['wave', 'cheer', 'laugh', 'dance'];
      const chosenEmote = emotesCycle[Math.floor(Math.random() * emotesCycle.length)];
      const emInfo = EMOTE_CATALOG.find((e) => e.type === chosenEmote) || EMOTE_CATALOG[0];

      // Multi-turn automatic conversation where Johnny initiates, resident replies, and Johnny replies back!
      const johnnyLine1 = `Hey ${targetChar.name}! I walked over to ${locName} to see how your ${primaryInterest.toLowerCase()} is going!`;
      const residentReply1 =
        weatherRef.current === 'rainy'
          ? `Hey ${explorerName}! So glad you stopped by ${locName} during the rain—I was just working on ${primaryInterest.toLowerCase()}. How are you doing?`
          : `Hey ${explorerName}! Awesome seeing you at ${locName}—I'm making great progress on ${primaryInterest.toLowerCase()}. What have you been up to?`;
      const johnnyReply2 = `That sounds awesome, ${targetChar.name}! I'm exploring the whole neighborhood today—keep up the great work with ${secondaryInterest.toLowerCase()}!`;
      const residentReply2 = `Thanks so much, ${explorerName}! Always makes my day brighter when we chat. Catch you around town!`;

      const newImportantMemory = `Had a warm back-and-forth conversation with ${explorerName} at ${locName} about ${primaryInterest.toLowerCase()} and ${secondaryInterest.toLowerCase()}.`;

      // Step 1: Johnny greets the resident
      setPlayerEmote(chosenEmote);
      setPlayerActiveBubble(johnnyLine1);

      // Step 2: Resident replies & Johnny replies back automatically
      const step2Timer = setTimeout(() => {
        if (!autoExploreEnabledRef.current) return;
        setPlayerActiveBubble(johnnyReply2);
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === targetChar.id
              ? {
                  ...c,
                  activeBubble: {
                    text: residentReply2,
                    expiresAt: Date.now() + 3400,
                  },
                }
              : c
          )
        );
      }, 2800);

      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== targetChar.id) return c;
          const angleToPlayer = Math.atan2(
            playerPosRef.current.x - c.currentPosition.x,
            playerPosRef.current.z - c.currentPosition.z
          );
          const memObj: CharacterMemory = {
            id: createUniqueId(`mem_explore_${c.id}`),
            gameTime: formattedClock,
            summary: newImportantMemory,
            type: 'conversation',
            important: true,
            involvedNames: [explorerName],
            emotionAtTime: 'Happiness',
          };
          return {
            ...c,
            rotationY: angleToPlayer,
            isMoving: false,
            isSitting: false,
            isTalking: true,
            isApproachingPlayer: false,
            affinity: Math.min(100, c.affinity + 4),
            playerInteractionsCount: (c.playerInteractionsCount || 0) + 1,
            needs: {
              ...c.needs,
              social: Math.min(100, c.needs.social + 18),
              inspiration: Math.min(100, c.needs.inspiration + 12),
            },
            activeEmote: {
              type: chosenEmote,
              label: emInfo.badge,
              expiresAt: nowMs + 5800,
            },
            activeBubble: {
              text: residentReply1,
              expiresAt: nowMs + 3000,
            },
            memories: summarizeCharacterMemories(
              [memObj, ...(c.memories || [])],
              c.name,
              formattedClock
            ),
          };
        })
      );

      // Save the entire multi-turn automatic conversation into that resident's chatHistory
      setChatHistories((prev) => ({
        ...prev,
        [targetChar.id]: [
          ...(prev[targetChar.id] || []),
          {
            id: createUniqueId('msg_auto_p1'),
            sender: 'player',
            text: johnnyLine1,
            gameTime: formattedClock,
          },
          {
            id: createUniqueId('msg_auto_c1'),
            sender: 'character',
            text: residentReply1,
            gameTime: formattedClock,
            thought: `Happy that ${explorerName} walked over to talk with me at ${locName}.`,
            mood: 'Happy',
          },
          {
            id: createUniqueId('msg_auto_p2'),
            sender: 'player',
            text: johnnyReply2,
            gameTime: formattedClock,
          },
          {
            id: createUniqueId('msg_auto_c2'),
            sender: 'character',
            text: residentReply2,
            gameTime: formattedClock,
            thought: `Loved catching up with ${explorerName} during their city tour.`,
            mood: 'Joyful',
            memoryAdded: newImportantMemory,
          },
        ],
      }));

      // Automatically record Explorer AI field notes & diagnosis on what this resident lacks & how to improve their goals
      const topGoal = targetChar.goals[0];
      const lackNote =
        targetChar.needs.inspiration < 68
          ? `Lacks creative inspiration (${Math.round(targetChar.needs.inspiration)}%) while working on "${topGoal?.title || targetChar.role}".`
          : targetChar.needs.social < 68
          ? `Lacks social collaboration (${Math.round(targetChar.needs.social)}%) to accelerate "${topGoal?.title || targetChar.role}".`
          : `Needs a structured milestone check-in so "${topGoal?.title || targetChar.role}" (${topGoal?.progress ?? 65}%) stays top-of-mind.`;
      const adviceNote = `Coach ${targetChar.name} on "${topGoal?.title || targetChar.role}" and pair them with a neighbor at ${locName}.`;

      setExplorerProfile((prevExp) => {
        const prevNotes = prevExp.fieldNotes || [];
        const prevDiag = prevExp.residentDiagnoses || {};
        const newNote: ExplorerFieldNote = {
          id: createUniqueId(`exp_note_${targetChar.id}`),
          gameTime: formattedClock,
          category: 'resident_lack',
          targetCharacterId: targetChar.id,
          targetCharacterName: targetChar.name,
          title: `Field Check-In with ${targetChar.name}`,
          observation: lackNote,
          actionableImprovement: adviceNote,
          applied: false,
        };
        return {
          ...prevExp,
          fieldNotes: [newNote, ...prevNotes].slice(0, 35),
          residentDiagnoses: {
            ...prevDiag,
            [targetChar.id]: {
              characterId: targetChar.id,
              characterName: targetChar.name,
              avatarColor: targetChar.avatarColor,
              role: targetChar.role,
              lastEvaluatedTime: formattedClock,
              whatTheyLack: lackNote,
              goalImprovementAdvice: adviceNote,
              memoryCoachingReminder: `Coached by ${explorerName} (${formattedClock}): Keep focusing daily on my goal "${topGoal?.title || targetChar.role}" and collaborate with friends in Gemini City.`,
              appliedCount: prevDiag[targetChar.id]?.appliedCount || 0,
            },
          },
        };
      });

      setAutoExploreVisitedIds((prevVisited) => {
        const nextVisited = Array.from(new Set([...prevVisited, targetChar.id]));
        if (autoExploreTimerRef.current) clearTimeout(autoExploreTimerRef.current);
        autoExploreTimerRef.current = setTimeout(() => {
          clearTimeout(step2Timer);
          setPlayerEmote('none');
          setPlayerActiveBubble(null);
          if (autoExploreEnabledRef.current) {
            selectNextExploreTarget(nextVisited, targetChar.id);
          }
        }, 6200);
        return nextVisited;
      });
    },
    [selectNextExploreTarget]
  );

  // Save edited character profile and sync reciprocal relationships across all residents
  const handleSaveCharacterProfile = useCallback(
    (
      updatedChar: AICharacter,
      reciprocalUpdates: { targetId: string; status: RelationshipStatus; affinity: number }[]
    ) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id === updatedChar.id) {
            return updatedChar;
          }
          // Update reciprocal relationship entry on other characters
          const rec = reciprocalUpdates.find((r) => r.targetId === c.id);
          const updatedRels = c.relationships.map((rel) => {
            if (rel.targetId !== updatedChar.id) return rel;
            return {
              ...rel,
              targetName: updatedChar.name,
              status: rec ? rec.status : rel.status,
              affinity: rec ? rec.affinity : rel.affinity,
            };
          });
          return {
            ...c,
            relationships: updatedRels,
          };
        })
      );
    },
    []
  );

  // Create a brand-new AI resident and add reciprocal relationships
  const handleCreateCharacter = useCallback(
    (newChar: AICharacter) => {
      setCharacters((prev) => {
        const updatedExisting = prev.map((c) => ({
          ...c,
          relationships: [
            ...c.relationships,
            {
              targetId: newChar.id,
              targetName: newChar.name,
              status: 'New Neighbor' as RelationshipStatus,
              affinity: 65,
              interactionCount: 1,
              sharedInterests: [newChar.interests[0] || 'Community Life'],
              lastInteractionSummary: `Welcomed ${newChar.name} to Gemini City.`,
              lastMetTime: '09:00',
            },
          ],
        }));
        return [...updatedExisting, newChar];
      });

      setChatHistories((prev) => ({
        ...prev,
        [newChar.id]: [
          {
            id: `welcome_${newChar.id}`,
            sender: 'character',
            text: `Hi ${explorerProfile.name}! I'm ${newChar.name}—excited to be here in Gemini City!`,
            gameTime: formatGameClock(gameHour),
            thought: newChar.currentThought,
            mood: newChar.currentMood,
          },
        ],
      }));

      setSelectedCharacterId(newChar.id);
      setCameraTargetOverride({
        x: newChar.currentPosition.x,
        z: newChar.currentPosition.z,
      });
    },
    [explorerProfile.name, gameHour]
  );

  const handleResetWorldData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setExplorerProfile(DEFAULT_EXPLORER_PROFILE);
    setCharacters(INITIAL_CHARACTERS);
    setChatHistories(createDefaultChatHistories(INITIAL_CHARACTERS));
    setSocialEvents(DEFAULT_SOCIAL_EVENTS);
    setSelectedCharacterId(null);
  }, []);

  // Run Explorer Super-Intelligence Audit (Google Gemini + Groq Dual-Brain)
  const handleRunExplorerAudit = useCallback(
    async (customQuestion?: string) => {
      setIsAnalyzingExplorer(true);
      const formattedClock = formatGameClock(gameHourRef.current);
      try {
        const explorerName = explorerProfileRef.current.name || 'Johnny';
        const serverAudit = await safeApiFetchJson<{
          explorerReply?: string;
          engine?: string;
          diagnoses?: {
            characterId: string;
            characterName: string;
            whatTheyLack: string;
            goalImprovementAdvice: string;
            memoryCoachingReminder: string;
          }[];
          worldImprovementIdeas?: string[];
        }>('/api/explorer-intel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            explorerName,
            brainMode: explorerProfileRef.current.brainMode || 'hybrid_dual_brain',
            question: customQuestion || '',
            gameTime: formattedClock,
            weather: weatherRef.current,
            characters: charactersRef.current.map((c) => ({
              ...c,
              currentLocationName: CITY_BUILDINGS[c.currentLocationId]?.name || 'Gemini City',
            })),
          }),
        });

        const data = serverAudit || {
          explorerReply: customQuestion
            ? `I analyzed your question ("${customQuestion}") alongside my live field notes on all ${charactersRef.current.length} residents. Right now, everyone is thriving across Gemini City and Cyber Horizon—especially with the Two-Place Sanctuaries, the Rideable Cyberpunk Supercar, and the 5-Passenger Bus!`
            : `I completed a full Dual-Brain scan of all ${charactersRef.current.length} AI residents at ${formattedClock}. Here is my breakdown of what each resident currently needs and how to boost their daily goals.`,
          engine: 'Client Dual-Brain Explorer Engine',
          diagnoses: charactersRef.current.map((c) => {
            const topGoal = c.goals?.[0];
            return {
              characterId: c.id,
              characterName: c.name,
              whatTheyLack: `Focusing on "${c.currentActivity}" while working toward "${topGoal?.title || c.role}" (${topGoal?.progress ?? 70}%).`,
              goalImprovementAdvice: `Pair ${c.name} with their closest friend or partner at a Two-Place Bench & Chairs sanctuary to spark +10% goal momentum.`,
              memoryCoachingReminder: `Coached by ${explorerName} (${formattedClock}): Keep advancing "${topGoal?.title || c.role}" and collaborating with friends across both cities.`,
            };
          }),
          worldImprovementIdeas: [
            `Take Hawa or a friend on a Two-Place Bench & Chairs outing or a ride in the Cyber-Valkyrie GT Supercar to boost affection and inspiration.`,
            `Watch 5 NPCs board and step off the 5-Passenger Horizon Coach Bus across all 4 stations.`,
            `Coach residents whose primary goal is under 85% so they pin a permanent goal-reminder memory.`,
          ],
        };
        if (data.explorerReply) {
          setLastAdvisorReply(data.explorerReply);
          setPlayerActiveBubble(data.explorerReply);
          setTimeout(() => {
            setPlayerActiveBubble((curr) => (curr === data.explorerReply ? null : curr));
          }, 7000);
        }
        if (data.engine) {
          setLastEngineUsed(data.engine);
        }

        setExplorerProfile((prev) => {
          const nextDiagnoses = { ...(prev.residentDiagnoses || {}) };
          const newNotes: ExplorerFieldNote[] = [];

          if (Array.isArray(data.diagnoses)) {
            data.diagnoses.forEach(
              (d: {
                characterId: string;
                characterName: string;
                whatTheyLack: string;
                goalImprovementAdvice: string;
                memoryCoachingReminder: string;
              }) => {
                const matchChar =
                  charactersRef.current.find((c) => c.id === d.characterId) ||
                  charactersRef.current.find(
                    (c) => c.name.toLowerCase() === (d.characterName || '').toLowerCase()
                  );
                const cId = matchChar?.id || d.characterId;
                if (!cId) return;
                nextDiagnoses[cId] = {
                  characterId: cId,
                  characterName: matchChar?.name || d.characterName,
                  avatarColor: matchChar?.avatarColor || '#F59E0B',
                  role: matchChar?.role || 'Resident',
                  lastEvaluatedTime: formattedClock,
                  whatTheyLack: d.whatTheyLack,
                  goalImprovementAdvice: d.goalImprovementAdvice,
                  memoryCoachingReminder: d.memoryCoachingReminder,
                  appliedCount: nextDiagnoses[cId]?.appliedCount || 0,
                };
              }
            );
          }

          if (data.explorerReply) {
            newNotes.push({
              id: createUniqueId('exp_audit'),
              gameTime: formattedClock,
              category: customQuestion ? 'world_idea' : 'resident_lack',
              title: customQuestion
                ? `Q&A: "${customQuestion.slice(0, 36)}"`
                : 'Full City AI Diagnostic Scan',
              observation: data.explorerReply,
              actionableImprovement:
                (Array.isArray(data.worldImprovementIdeas) && data.worldImprovementIdeas[0]) ||
                'Coach residents on their primary goals and strengthen social collaboration.',
              applied: false,
            });
          }

          return {
            ...prev,
            residentDiagnoses: nextDiagnoses,
            worldImprovementIdeas:
              Array.isArray(data.worldImprovementIdeas) && data.worldImprovementIdeas.length > 0
                ? data.worldImprovementIdeas
                : prev.worldImprovementIdeas,
            fieldNotes: [...newNotes, ...(prev.fieldNotes || [])].slice(0, 40),
          };
        });
      } catch {
        // Ignore network errors
      } finally {
        setIsAnalyzingExplorer(false);
      }
    },
    []
  );

  // Apply Johnny's Goal & Memory Coaching Improvement to a specific AI Resident
  const handleApplyResidentImprovement = useCallback(
    (charId: string, diagnosis?: ExplorerResidentDiagnosis) => {
      const targetChar = charactersRef.current.find((c) => c.id === charId);
      if (!targetChar) return;

      const formattedClock = formatGameClock(gameHourRef.current);
      const nowMs = Date.now();
      const explorerName = explorerProfileRef.current.name || 'Johnny';
      const topGoal = targetChar.goals[0];

      const coachingMessage =
        diagnosis?.goalImprovementAdvice ||
        `Hey ${targetChar.name}, I noticed you can reach "${topGoal?.title || targetChar.role}" even faster by dedicating focused time to it today—I'm right here cheering you on!`;

      const memoryReminder =
        diagnosis?.memoryCoachingReminder ||
        `Coached by ${explorerName} (${formattedClock}): Stay focused on my primary goal "${topGoal?.title || targetChar.role}" and turn daily inspiration into action.`;

      const residentGratefulReply = `Thank you so much, ${explorerName}! Your advice really helped me remember what I was lacking—I feel super motivated to push "${topGoal?.title || targetChar.role}" forward right now!`;

      setPlayerEmote('cheer');
      setPlayerActiveBubble(`Coaching ${targetChar.name}: ${coachingMessage}`);
      setTimeout(() => {
        setPlayerEmote('none');
        setPlayerActiveBubble(null);
      }, 5200);

      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          const updatedGoals = c.goals.map((g, idx) =>
            idx === 0 ? { ...g, progress: Math.min(100, g.progress + 10) } : g
          );
          const newMem: CharacterMemory = {
            id: createUniqueId(`mem_coach_${c.id}`),
            gameTime: formattedClock,
            type: 'goal',
            important: true,
            summary: memoryReminder,
            involvedNames: [explorerName],
            emotionAtTime: 'Excitement',
          };
          const nextTrust = Math.min(100, (c.playerRelationship?.trust ?? c.affinity) + 6);
          return {
            ...c,
            affinity: Math.min(100, c.affinity + 6),
            playerInteractionsCount: (c.playerInteractionsCount || 0) + 1,
            playerRelationship: {
              status: nextTrust >= 88 ? 'Best Friend' : 'Close Friend',
              trust: nextTrust,
              familiarity: Math.min(100, (c.playerRelationship?.familiarity ?? 80) + 5),
              affection: Math.min(100, (c.playerRelationship?.affection ?? 70) + 5),
              notes: `${explorerName} coached me on my goals and helped me overcome what I was lacking.`,
            },
            needs: {
              energy: Math.min(100, c.needs.energy + 12),
              social: Math.min(100, c.needs.social + 20),
              inspiration: Math.min(100, c.needs.inspiration + 24),
            },
            emotionalState: {
              primary: 'Excitement',
              intensity: 88,
              cause: `Inspired by ${explorerName}'s goal coaching`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            goals: updatedGoals,
            activeEmote: {
              type: 'cheer',
              label: '🎯 Goal Boost +10%!',
              expiresAt: nowMs + 5500,
            },
            activeBubble: {
              text: residentGratefulReply,
              expiresAt: nowMs + 6000,
            },
            memories: deduplicateCharacterMemories([newMem, ...(c.memories || [])]),
          };
        })
      );

      setChatHistories((prev) => ({
        ...prev,
        [charId]: [
          ...(prev[charId] || []),
          {
            id: createUniqueId('msg_coach_p'),
            sender: 'player',
            text: coachingMessage,
            gameTime: formattedClock,
          },
          {
            id: createUniqueId('msg_coach_c'),
            sender: 'character',
            text: residentGratefulReply,
            gameTime: formattedClock,
            thought: `${explorerName} noticed what I was lacking and reminded me of my core goal!`,
            mood: 'Inspired',
            emotion: 'Excitement',
            memoryAdded: memoryReminder,
          },
        ],
      }));

      setExplorerProfile((prev) => {
        const prevDiag = prev.residentDiagnoses?.[charId];
        return {
          ...prev,
          residentDiagnoses: {
            ...(prev.residentDiagnoses || {}),
            [charId]: {
              characterId: charId,
              characterName: targetChar.name,
              avatarColor: targetChar.avatarColor,
              role: targetChar.role,
              lastEvaluatedTime: formattedClock,
              whatTheyLack:
                prevDiag?.whatTheyLack ||
                `Previously lacked momentum on "${topGoal?.title || targetChar.role}".`,
              goalImprovementAdvice: coachingMessage,
              memoryCoachingReminder: memoryReminder,
              appliedCount: (prevDiag?.appliedCount || 0) + 1,
            },
          },
          fieldNotes: [
            {
              id: createUniqueId('note_coached'),
              gameTime: formattedClock,
              category: 'goal_improvement' as const,
              targetCharacterId: charId,
              targetCharacterName: targetChar.name,
              title: `Coached ${targetChar.name} (+10% Goal)`,
              observation: `Reinforced "${topGoal?.title || targetChar.role}" and restored ${targetChar.name}'s inspiration.`,
              actionableImprovement: memoryReminder,
              applied: true,
            },
            ...(prev.fieldNotes || []),
          ].slice(0, 40),
        };
      });
    },
    []
  );

  const handleApplyAllImprovements = useCallback(() => {
    charactersRef.current.forEach((c) => {
      const diag = explorerProfileRef.current.residentDiagnoses?.[c.id];
      handleApplyResidentImprovement(c.id, diag);
    });
  }, [handleApplyResidentImprovement]);

  // Trigger Resident AI Dialogue Reflections & 3D Speech Bubbles about the Golden Horizon Bridge & New City (Neo-Horizon)
  const handleTriggerBridgeReflections = useCallback(
    (
      theme: BridgeReflectionTheme = 'architecture',
      direction: 'to_neo_horizon' | 'to_gemini_city' = 'to_neo_horizon'
    ) => {
      const formattedClock = formatGameClock(gameHourRef.current);
      const nowMs = Date.now();
      const explorerName = explorerProfileRef.current.name || 'Johnny';

      setPlayerEmote(direction === 'to_neo_horizon' ? 'cheer' : 'wave');
      setPlayerActiveBubble(
        direction === 'to_neo_horizon'
          ? '🌉 Crossing Golden Horizon Bridge → Neo-Horizon City!'
          : '🌉 Gliding back across Golden Horizon Bridge to Gemini City!'
      );
      setTimeout(() => {
        setPlayerEmote('none');
        setPlayerActiveBubble(null);
      }, 4600);

      setCharacters((prev) =>
        prev.map((c) => {
          const refInfo = getResidentBridgeReflection(c, explorerName, theme);
          const memSummary = `Reflected on the Golden Horizon Bridge & Neo-Horizon City (${formattedClock}): "${refInfo.quote.slice(0, 120)}..."`;
          const newMem: CharacterMemory = {
            id: createUniqueId(`mem_bridge_${c.id}`),
            gameTime: formattedClock,
            type: 'observation',
            important: true,
            summary: memSummary,
            involvedNames: [explorerName],
            emotionAtTime: 'Curiosity',
          };

          return {
            ...c,
            rotationY: Math.PI / 2, // Gaze eastward toward the Golden Horizon Bridge & Second City
            currentThought: refInfo.thought,
            currentMood: 'Inspired',
            emotionalState: {
              primary: theme === 'envoy' ? 'Excitement' : 'Curiosity',
              intensity: 86,
              cause: `Reflecting on ${explorerName}'s journey across the Golden Horizon Bridge to Neo-Horizon City`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            needs: {
              ...c.needs,
              inspiration: Math.min(100, c.needs.inspiration + 14),
              social: Math.min(100, c.needs.social + 8),
            },
            activeEmote: {
              type: refInfo.emote,
              label: refInfo.badge,
              expiresAt: nowMs + 7200,
            },
            activeBubble: {
              text: refInfo.quote,
              expiresAt: nowMs + 8200,
            },
            memories: deduplicateCharacterMemories([newMem, ...(c.memories || [])]),
          };
        })
      );

      // Log a live Social Chronicle event capturing the residents' reflections on the new city
      const currChars = charactersRef.current;
      if (currChars.length >= 2) {
        const speakerA = currChars[0];
        const speakerB = currChars[1];
        const refA = getResidentBridgeReflection(speakerA, explorerName, theme);
        const refB = getResidentBridgeReflection(speakerB, explorerName, theme);
        const bridgeChronicleEvent: SocialEvent = {
          id: createUniqueId('soc_bridge_reflection'),
          gameTime: formattedClock,
          speakerAId: speakerA.id,
          speakerAName: speakerA.name,
          speakerBId: speakerB.id,
          speakerBName: speakerB.name,
          locationName: 'Golden Horizon Bridge Overlook',
          topic: 'Reflections on Neo-Horizon Cyber-Metropolis',
          relationshipDelta: 2,
          lines: [
            { speakerName: speakerA.name, text: refA.quote },
            { speakerName: speakerB.name, text: refB.quote },
          ],
        };
        setSocialEvents((prev) => [bridgeChronicleEvent, ...prev.slice(0, 28)]);
      }

      setExplorerProfile((prev) => ({
        ...prev,
        fieldNotes: [
          {
            id: createUniqueId('note_bridge_ref'),
            gameTime: formattedClock,
            category: 'social_observation' as const,
            title: 'Residents Reflect on Neo-Horizon City 🌉🏙️',
            observation: `All Gemini City residents gazed across the Golden Horizon Suspension Bridge and shared their personal reflections on the Explorer-only Neo-Horizon Cyber-Metropolis.`,
            actionableImprovement: `Cross the Golden Horizon Bridge via 3D Hyper-Glide Fast Travel and bring back discoveries from Neo-Horizon to share in 1-on-1 resident chats.`,
            applied: true,
          },
          ...(prev.fieldNotes || []),
        ].slice(0, 40),
      }));
    },
    []
  );

  // Send Player Message to Selected Character via Backend /api/chat
  const handleSendMessage = async (text: string, overrideCharId?: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const targetId = overrideCharId || selectedCharacterId;
    const activeChar = characters.find((c) => c.id === targetId);
    if (!activeChar) return;

    const formattedClock = formatGameClock(gameHour);
    const currentPhase = getTimePhase(gameHour);
    const playerMsg: ChatMessage = {
      id: createUniqueId('msg_p'),
      sender: 'player',
      text: cleanText,
      gameTime: formattedClock,
    };

    const existingHistory = chatHistories[activeChar.id] || [];
    const updatedHistory = [...existingHistory, playerMsg];
    setChatHistories((prev) => ({
      ...prev,
      [activeChar.id]: updatedHistory,
    }));
    setIsSendingChat(true);

    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 10000);

    try {
      const currentBuildingInfo = CITY_BUILDINGS[activeChar.currentLocationId];
      const nearbyCharacters = characters
        .filter((other) => other.id !== activeChar.id)
        .map((other) => ({
          name: other.name,
          role: other.role,
          distance: Math.hypot(
            other.currentPosition.x - activeChar.currentPosition.x,
            other.currentPosition.z - activeChar.currentPosition.z
          ),
          emotion: other.emotionalState?.primary || other.currentMood,
          activity: other.currentActivity,
        }))
        .filter((item) => item.distance < 14);

      const envContext = buildResidentEnvironmentalContext(
        activeChar,
        characters,
        createdObjects,
        weather,
        gameHour,
        explorerProfile.name || 'Johnny'
      );

      const chatPayload = {
        character: {
          ...activeChar,
          currentLocationName: currentBuildingInfo?.name || 'Gemini City',
          currentLocationDescription: currentBuildingInfo?.description || '',
          nearbyCharacters,
          nearbyPointsOfInterest: [
            ...Object.values(CITY_BUILDINGS).map((b) => b.name),
            'Golden Horizon Suspension Bridge (82m Ocean Span)',
            'Neo-Horizon Cyber-Metropolis (Explorer-Only Second City across the Bridge)',
          ],
          socialSituation:
            nearbyCharacters.length > 0
              ? `Near ${nearbyCharacters.map((n) => n.name).join(', ')} at ${currentBuildingInfo?.name}`
              : `Enjoying a quiet moment at ${currentBuildingInfo?.name}`,
          environmentalContext: envContext,
          memories: activeChar.memories || [],
        },
        explorerName: explorerProfile.name || 'Johnny',
        message: cleanText,
        history: updatedHistory.slice(-10).map((m) => ({
          sender: m.sender,
          text: m.text,
          gameTime: m.gameTime,
        })),
        gameTime: formattedClock,
        timePhase: getTimePhaseLabel(currentPhase),
        weather,
        recentSocialEvents: socialEvents
          .slice(0, 3)
          .map(
            (e) =>
              `${e.speakerAName} & ${e.speakerBName} at ${e.locationName} (${e.topic || 'chat'})`
          ),
      };

      const data = await requestResidentChatWithFallback(
        chatPayload,
        {
          ...activeChar,
          currentLocationName: currentBuildingInfo?.name || 'Gemini City',
          environmentalContext: envContext,
        },
        cleanText,
        explorerProfile.name || 'Johnny',
        formattedClock,
        weather
      );
      clearTimeout(timeoutId);
      const nowMs = Date.now();

      const replyText =
        data.reply ||
        `That’s a great point, ${explorerProfile.name}—tell me more about what you think!`;

      const aiEmotion = (data.emotion as EmotionType) || activeChar.emotionalState?.primary || 'Happiness';
      const aiEmotionIntensity =
        typeof data.emotionIntensity === 'number' ? data.emotionIntensity : 78;

      const aiMsg: ChatMessage = {
        id: createUniqueId('msg_c'),
        sender: 'character',
        text: replyText,
        gameTime: formattedClock,
        thought: data.innerThought,
        mood: data.mood,
        emotion: aiEmotion,
        emotionIntensity: aiEmotionIntensity,
        memoryAdded: data.newMemory,
        engineLabel: data.engine,
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeChar.id]: [...(prev[activeChar.id] || []), aiMsg],
      }));

      if (voiceEnabledRef.current) {
        speakCharacterLine(activeChar, replyText, true);
      }

      if (data.newMemory) {
        pushMemoryNotification(activeChar, data.newMemory, 'conversation', formattedClock);
      }

      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== activeChar.id) return c;
          const wasCooling = Boolean(
            c.playerRelationship?.needsAttention ||
              (c.playerRelationship?.daysSinceLastInteraction ?? 0) >= 2
          );
          const nextTrust = Math.min(
            100,
            Math.max(
              0,
              (c.playerRelationship?.trust ?? c.affinity) +
                (data.playerTrustDelta ?? data.affinityDelta ?? (wasCooling ? 6 : 4))
            )
          );
          const nextFamiliarity = Math.min(
            100,
            (c.playerRelationship?.familiarity ?? 75) + (wasCooling ? 5 : 3)
          );
          const nextAffection = Math.min(
            100,
            Math.max(
              0,
              (c.playerRelationship?.affection ?? c.affinity) +
                (data.playerAffectionDelta ?? 3)
            )
          );
          const newMemItem: CharacterMemory | null = data.newMemory
            ? {
                id: createUniqueId('mem_conv'),
                gameTime: formattedClock,
                summary: data.newMemory,
                type: 'conversation',
                important: true,
                involvedNames: [explorerProfile.name],
                emotionAtTime: aiEmotion,
              }
            : null;

          const combinedMemories = newMemItem
            ? [newMemItem, ...(c.memories || [])]
            : c.memories || [];

          return {
            ...c,
            currentMood: data.mood || c.currentMood,
            currentThought: data.innerThought || c.currentThought,
            emotionalState: {
              primary: aiEmotion,
              intensity: aiEmotionIntensity,
              cause:
                data.emotionCause ||
                `Having an engaging conversation with ${explorerProfile.name}`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            affinity: nextTrust,
            playerInteractionsCount: (c.playerInteractionsCount || 0) + 1,
            playerRelationship: {
              status: c.playerRelationship?.status || 'Close Friend',
              trust: nextTrust,
              familiarity: nextFamiliarity,
              affection: nextAffection,
              notes:
                c.playerRelationship?.notes ||
                `Growing closer with ${explorerProfile.name} through conversations.`,
              lastInteractedDay: dayNumberRef.current,
              daysSinceLastInteraction: 0,
              lastDecayAmount: 0,
              needsAttention: false,
            },
            needs: {
              ...c.needs,
              social: Math.min(100, c.needs.social + 18),
              inspiration: Math.min(100, c.needs.inspiration + 8),
            },
            isTalking: true,
            isApproachingPlayer: false,
            activeBubble: {
              text: aiMsg.text,
              expiresAt: nowMs + 8000,
            },
            activeMemoryPop: newMemItem
              ? {
                  id: newMemItem.id,
                  summary: newMemItem.summary,
                  type: 'conversation',
                  expiresAt: nowMs + 8500,
                }
              : c.activeMemoryPop,
            memories: summarizeCharacterMemories(combinedMemories, c.name, formattedClock),
          };
        })
      );
    } catch {
      clearTimeout(timeoutId);
      const locName = CITY_BUILDINGS[activeChar.currentLocationId]?.name || 'Gemini City';
      const fallbackMsg: ChatMessage = {
        id: createUniqueId('msg_fallback'),
        sender: 'character',
        text: `What you said about "${cleanText.slice(0, 48)}", ${explorerProfile.name}, really got me thinking! Being here at ${locName} while working on ${activeChar.interests[0]?.toLowerCase() || activeChar.role.toLowerCase()} always sparks great conversations with you.`,
        gameTime: formattedClock,
        thought: `Enjoying my conversation with ${explorerProfile.name} at ${locName}.`,
        mood: 'Engaged',
        emotion: 'Happiness',
      };
      setChatHistories((prev) => ({
        ...prev,
        [activeChar.id]: [...(prev[activeChar.id] || []), fallbackMsg],
      }));
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === activeChar.id
            ? {
                ...c,
                affinity: Math.min(100, c.affinity + 3),
                playerRelationship: {
                  ...(c.playerRelationship || {
                    status: 'Friend',
                    trust: c.affinity,
                    familiarity: 75,
                  }),
                  trust: Math.min(100, (c.playerRelationship?.trust ?? c.affinity) + 3),
                  lastInteractedDay: dayNumberRef.current,
                  daysSinceLastInteraction: 0,
                  lastDecayAmount: 0,
                  needsAttention: false,
                },
                activeBubble: {
                  text: fallbackMsg.text,
                  expiresAt: Date.now() + 7000,
                },
              }
            : c
        )
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const timePhase = getTimePhase(gameHour);
  const activeCityEvent = getActiveCityEvent(gameHour);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) || null;
  const selectedBuilding = selectedBuildingId ? CITY_BUILDINGS[selectedBuildingId] : null;
  const nearbyCharacter = characters.find((c) => c.id === nearbyCharacterId) || null;
  const autoExploreTargetChar =
    autoExploreEnabled && autoExploreTargetCharId
      ? characters.find((c) => c.id === autoExploreTargetCharId) || null
      : null;
  const playerAutoTarget = autoExploreTargetChar
    ? {
        x: autoExploreTargetChar.currentPosition.x,
        z: autoExploreTargetChar.currentPosition.z,
        targetId: autoExploreTargetChar.id,
        label:
          autoExplorePhase === 'interacting'
            ? `Chatting with ${autoExploreTargetChar.name}`
            : `Auto-Exploring → ${autoExploreTargetChar.name}`,
      }
    : null;

  const renderPhaseIcon = () => {
    switch (timePhase) {
      case 'dawn':
        return <Sunrise className="w-4 h-4 text-rose-300 shrink-0" />;
      case 'morning':
      case 'afternoon':
        return <Sun className="w-4 h-4 text-amber-300 shrink-0" />;
      case 'sunset':
        return <Sunset className="w-4 h-4 text-orange-400 shrink-0" />;
      case 'night':
        return <Moon className="w-4 h-4 text-indigo-300 shrink-0" />;
    }
  };

  const renderWeatherIcon = () => {
    switch (weather) {
      case 'rainy':
        return <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'cloudy':
        return <Cloud className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
      case 'sunny':
      default:
        return <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    }
  };

  const handleEnterGamepadMode = (rotateSideways?: boolean) => {
    setIsControlsDrawerOpen(false);
    setSelectedCharacterId(null);
    setSelectedBuildingId(null);
    setSelectedCreatedObject(null);
    setIsExplorerSheetOpen(false);
    setIsUiHidden(false);
    setIsGamepadMode(true);

    const shouldRotate90 =
      rotateSideways !== undefined
        ? rotateSideways
        : typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    setGamepadScreenRotation(shouldRotate90 ? 90 : 0);

    try {
      const anyScreen = window.screen as unknown as {
        orientation?: { lock?: (mode: string) => Promise<void> };
      };
      anyScreen?.orientation?.lock?.('landscape')?.catch(() => {});
    } catch {
      // ignore on browsers that do not support orientation lock
    }
  };

  const handleExitGamepadMode = () => {
    setIsGamepadMode(false);
    setGamepadScreenRotation(0);
    handleJoystickMove({ x: 0, y: 0 });
    try {
      const anyScreen = window.screen as unknown as {
        orientation?: { unlock?: () => void };
      };
      anyScreen?.orientation?.unlock?.();
    } catch {
      // ignore
    }
  };

  const handleCycleGamepadScreenRotation = () => {
    setGamepadScreenRotation((prev) => (prev === 90 ? -90 : prev === -90 ? 0 : 90));
  };

  // Second City (Neo-Horizon) Groq AI Hub Handlers: OK-Plan, Love & Co-Working, Friend Chart, Dreams & Daytime Car Trips
  const handleApproveOkPlan = useCallback(
    (charId: string, customTitle?: string, customObjective?: string) => {
      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== charId) return c;
          const defaultSteps = [
            {
              id: 's1',
              label: `Prepare prototypes inside ${CITY_BUILDINGS[c.homeId]?.name}`,
              locationId: c.homeId,
              completed: true,
            },
            {
              id: 's2',
              label: `Sync with friends at Neo-Horizon Central Plaza`,
              locationId: 'neo_plaza' as BuildingId,
              completed: false,
            },
            {
              id: 's3',
              label: `Take the Daytime Dream Car to Gemini City and return before nightfall`,
              locationId: 'park' as BuildingId,
              completed: false,
            },
          ];
          const prevPlan = c.okPlan;
          const steps = prevPlan?.steps?.length ? prevPlan.steps : defaultSteps;
          const nextTitle =
            customTitle ||
            prevPlan?.planTitle ||
            prevPlan?.title ||
            `${c.name}'s Neo-Horizon Innovation Plan`;
          const nextObj =
            customObjective ||
            prevPlan?.objective ||
            prevPlan?.summary ||
            `Collaborate across Neo-Horizon City and Gemini City.`;
          const stepIdx = prevPlan?.currentStepIndex ?? 0;
          const activeStepObj = steps[stepIdx] || steps[0];
          const activeStepLabel =
            typeof activeStepObj === 'string' ? activeStepObj : activeStepObj?.label || '';
          const planId = prevPlan?.id || prevPlan?.planId || createUniqueId(`okplan_${c.id}`);

          return {
            ...c,
            okPlan: {
              ...prevPlan,
              id: planId,
              planId,
              title: nextTitle,
              planTitle: nextTitle,
              summary: nextObj,
              objective: nextObj,
              reasoning:
                prevPlan?.reasoning ||
                `Groq LPU reasoning aligned with ${c.name}'s daily goals and relationships.`,
              steps,
              currentStepIndex: stepIdx,
              status: 'approved',
              approvedByPlayer: true,
              approvedAtTime: formattedClock,
              updatedAtTime: formattedClock,
              progress: prevPlan?.progress ?? 50,
            },
            activeEmote: {
              type: 'cheer',
              label: '✅ OK-Plan Approved!',
              expiresAt: nowMs + 6500,
            },
            activeBubble: {
              text: `👍 OK-Plan Locked! Executing "${nextTitle}": ${activeStepLabel}!`,
              expiresAt: nowMs + 7500,
            },
            memories: deduplicateCharacterMemories([
              {
                id: createUniqueId(`mem_okplan_${c.id}`),
                gameTime: formattedClock,
                type: 'goal',
                important: true,
                summary: `Approved OK-Plan "${nextTitle}" (${nextObj}) and saved to the Second City Groq Database.`,
              },
              ...(c.memories || []),
            ]),
          };
        })
      );
    },
    []
  );

  const handleAdvanceOkPlanStep = useCallback((charId: string) => {
    const nowMs = Date.now();
    const formattedClock = formatGameClock(gameHourRef.current);
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId || !c.okPlan) return c;
        const stepsCount = c.okPlan.steps.length;
        const currIdx =
          typeof c.okPlan.currentStepIndex === 'number'
            ? c.okPlan.currentStepIndex
            : Math.max(
                0,
                c.okPlan.steps.findIndex((s) => !s.completed)
              );
        const nextIdx = (currIdx + 1) % Math.max(1, stepsCount);
        const updatedSteps = c.okPlan.steps.map((s, idx) => ({
          ...s,
          completed: idx < nextIdx,
        }));
        const rawStep = updatedSteps[nextIdx] || updatedSteps[0];
        const stepText = typeof rawStep === 'string' ? rawStep : rawStep?.label || '';
        const planTitle = c.okPlan.planTitle || c.okPlan.title || 'OK-Plan';
        return {
          ...c,
          okPlan: {
            ...c.okPlan,
            steps: updatedSteps,
            currentStepIndex: nextIdx,
            status: 'approved',
            approvedByPlayer: true,
            progress: Math.min(100, Math.round(((nextIdx + 1) / Math.max(1, stepsCount)) * 100)),
            updatedAtTime: formattedClock,
          },
          currentActivity: `📋 OK-Plan (${planTitle}): ${stepText}`,
          activeEmote: {
            type: 'clap',
            label: `📋 Step ${nextIdx + 1}/${stepsCount}`,
            expiresAt: nowMs + 6000,
          },
          activeBubble: {
            text: `📋 Advancing my OK-Plan "${planTitle}" to Step ${nextIdx + 1}: ${stepText}!`,
            expiresAt: nowMs + 7000,
          },
        };
      })
    );
  }, []);

  const handleGenerateNewOkPlan = useCallback((charId: string) => {
    const nowMs = Date.now();
    const formattedClock = formatGameClock(gameHourRef.current);
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const partnerName = c.romanticPartnerId
          ? prev.find((p) => p.id === c.romanticPartnerId)?.name || 'my partner'
          : 'fellow Neo-Horizon innovators';
        const newTitle = `Day ${dayNumberRef.current} Groq Synergy Blueprint`;
        const newObj = `Combine ${c.role.split('&')[0].trim()} with ${partnerName} and record findings in the City 2 Database.`;
        const newSteps = [
          {
            id: 's1',
            label: `Calibrate Groq LPU insights inside ${CITY_BUILDINGS[c.homeId]?.name}`,
            locationId: c.homeId,
            completed: false,
          },
          {
            id: 's2',
            label: `Co-work alongside ${partnerName} on shared Neo-Horizon creations`,
            locationId: 'neo_plaza' as BuildingId,
            completed: false,
          },
          {
            id: 's3',
            label: `Drive the Dream Cruiser Car to Gemini City and return home before night 🌃`,
            locationId: 'park' as BuildingId,
            completed: false,
          },
        ];
        const newId = createUniqueId(`okplan_${c.id}`);
        return {
          ...c,
          okPlan: {
            id: newId,
            planId: newId,
            title: newTitle,
            planTitle: newTitle,
            summary: newObj,
            objective: newObj,
            reasoning: `Groq LPU synthesized ${c.name}'s past conversation logs and friendship chart to craft this 3-step plan.`,
            partnerId: c.romanticPartnerId || null,
            partnerName,
            steps: newSteps,
            currentStepIndex: 0,
            status: 'approved',
            approvedByPlayer: true,
            coWorkerId: c.romanticPartnerId || null,
            targetLocationId: c.homeId,
            approvedAtTime: formattedClock,
            updatedAtTime: formattedClock,
            progress: 25,
          },
          activeEmote: {
            type: 'think',
            label: '🧠 New AI OK-Plan!',
            expiresAt: nowMs + 6000,
          },
          activeBubble: {
            text: `🧠 Generated & OK'd my new Groq plan: "${newTitle}"!`,
            expiresAt: nowMs + 7000,
          },
        };
      })
    );
  }, []);

  const handleLinkRomanticCoWorkers = useCallback(
    (charAId: string, charBId: string, workLocationId: BuildingId) => {
      if (charAId === charBId) return;
      const nowMs = Date.now();
      const formattedClock = formatGameClock(gameHourRef.current);
      const workBuilding = CITY_BUILDINGS[workLocationId] || CITY_BUILDINGS.neo_plaza;

      setCharacters((prev) => {
        const charA = prev.find((c) => c.id === charAId);
        const charB = prev.find((c) => c.id === charBId);
        if (!charA || !charB) return prev;

        return prev.map((c) => {
          if (c.id !== charAId && c.id !== charBId) return c;
          const partner = c.id === charAId ? charB : charA;
          const existingRel = c.relationships.find((r) => r.targetId === partner.id);
          const updatedRels = existingRel
            ? c.relationships.map((r) =>
                r.targetId === partner.id
                  ? {
                      ...r,
                      status: 'Romantic Partner' as RelationshipStatus,
                      affinity: Math.max(95, r.affinity),
                      trust: Math.max(96, r.trust || 90),
                      romanticInterest: 96,
                      romanticStage: 'Romantic Partner' as const,
                      lastInteractionSummary: `Fell in love and linked to co-work together at ${workBuilding.name}!`,
                      lastMetTime: formattedClock,
                    }
                  : r
              )
            : [
                {
                  targetId: partner.id,
                  targetName: partner.name,
                  status: 'Romantic Partner' as RelationshipStatus,
                  affinity: 96,
                  trust: 96,
                  romanticInterest: 96,
                  romanticStage: 'Romantic Partner' as const,
                  interactionCount: 12,
                  sharedInterests: [c.interests[0] || 'Innovation', 'Co-Working'],
                  lastInteractionSummary: `Fell in love and linked to co-work together at ${workBuilding.name}!`,
                  lastMetTime: formattedClock,
                },
                ...c.relationships,
              ];

          return {
            ...c,
            romanticPartnerId: partner.id,
            coWorkingPartnerId: partner.id,
            currentLocationId: workLocationId,
            currentActivity: `❤️ In Love & Co-Working with ${partner.name} at ${workBuilding.name}`,
            decisionReason: `❤️ Romantic Co-Working Link with ${partner.name}`,
            emotionalState: {
              primary: 'Affection',
              intensity: 94,
              cause: `Linked in love and working side-by-side with ${partner.name} at ${workBuilding.name}`,
              sinceGameTime: formattedClock,
              lastUpdatedMs: nowMs,
            },
            relationships: updatedRels,
            okPlan: c.okPlan
              ? {
                  ...c.okPlan,
                  coWorkerId: partner.id,
                  targetLocationId: workLocationId,
                  approvedByPlayer: true,
                }
              : undefined,
            activeEmote: {
              type: 'cheer',
              label: `❤️ Linked w/ ${partner.name}!`,
              expiresAt: nowMs + 7500,
            },
            activeBubble: {
              text: `❤️ ${partner.name} and I fell in love and linked up! We're heading to ${workBuilding.name} to work together side-by-side!`,
              expiresAt: nowMs + 8500,
            },
            memories: deduplicateCharacterMemories([
              {
                id: createUniqueId(`mem_lovelink_${c.id}`),
                gameTime: formattedClock,
                type: 'romance',
                important: true,
                summary: `Fell in love and linked as Romantic Co-Working Partners with ${partner.name} at ${workBuilding.name}.`,
                involvedNames: [partner.name],
                emotionAtTime: 'Affection',
              },
              ...(c.memories || []),
            ]),
          };
        });
      });
    },
    []
  );

  const handleUnlinkRomanticCoWorkers = useCallback((charId: string) => {
    setCharacters((prev) => {
      const target = prev.find((c) => c.id === charId);
      const partnerId = target?.romanticPartnerId;
      return prev.map((c) => {
        if (c.id === charId || (partnerId && c.id === partnerId)) {
          return {
            ...c,
            romanticPartnerId: null,
            coWorkingPartnerId: null,
          };
        }
        return c;
      });
    });
  }, []);

  const handleLaunchGeminiCarTrip = useCallback((specificCharId?: string) => {
    const nowMs = Date.now();
    // Ensure daytime clock window (09:30 - 16:30) so they can visit Gemini City and return before night!
    if (gameHourRef.current >= 17.2 || gameHourRef.current < 8.5) {
      gameHourRef.current = 11.5;
      setGameHour(11.5);
    }

    setCharacters((prev) =>
      prev.map((c) => {
        const isTarget = specificCharId
          ? c.id === specificCharId
          : isCity2Character(c.id) || c.cityId === 'city2';
        if (!isTarget) return c;
        const existingDream = c.dreamState || c.dream;
        const destId: BuildingId =
          existingDream?.dreamTargetGeminiBuildingId ||
          existingDream?.geminiCityVisitSpot ||
          'park';
        const destBld = CITY_BUILDINGS[destId] || CITY_BUILDINGS.park;
        const nextDream = {
          title: existingDream?.title || existingDream?.dreamTheme || 'Inter-City Dream Excursion',
          dreamTheme:
            existingDream?.dreamTheme || existingDream?.title || 'Inter-City Dream Excursion',
          description:
            existingDream?.description ||
            `Daytime car excursion to ${destBld.name} in Gemini City, returning to City 2 before nightfall.`,
          geminiCityVisitSpot: destId,
          dreamTargetGeminiBuildingId: destId,
          geminiCityGoal:
            existingDream?.geminiCityGoal ||
            `Visit ${destBld.name} in Gemini City and return before nightfall`,
          carTripStartHour: existingDream?.carTripStartHour ?? 11.0,
          carTripReturnHour: existingDream?.carTripReturnHour ?? 18.0,
          lastNightDream:
            existingDream?.lastNightDream ||
            existingDream?.lastDreamSummary ||
            `Dreamed of visiting ${destBld.name} in Gemini City and returning before nightfall.`,
          lastDreamSummary:
            existingDream?.lastDreamSummary ||
            existingDream?.lastNightDream ||
            `Dreamed of visiting ${destBld.name} in Gemini City and returning before nightfall.`,
          isCurrentlyOnCarTrip: true,
          carTripPhase: 'visiting_gemini' as const,
          carTripStatus: 'visiting_gemini' as const,
          lastDreamNightDay: dayNumberRef.current,
        };
        return {
          ...c,
          currentLocationId: destId,
          currentActivity: `🚗 Dream Cruiser Daytime Excursion to ${destBld.name} in Gemini City (Returning to City 2 before night 🌃)`,
          decisionReason: `🚗🌙 Dream-Inspired Car Trip to Gemini City`,
          dream: nextDream,
          dreamState: nextDream,
          activeEmote: {
            type: 'wave',
            label: '🚗 To Gemini City!',
            expiresAt: nowMs + 7500,
          },
          activeBubble: {
            text: `🚗 Riding the Inter-City Dream Cruiser across Golden Horizon Bridge to ${destBld.name} in Gemini City! We'll return home before night 🌃!`,
            expiresAt: nowMs + 8500,
          },
        };
      })
    );
  }, []);

  const handleReturnCarTripBeforeNight = useCallback(() => {
    const nowMs = Date.now();
    const formattedClock = formatGameClock(gameHourRef.current);
    setCharacters((prev) =>
      prev.map((c) => {
        if (!isCity2Character(c.id) && c.cityId !== 'city2') return c;
        const homeBld = CITY_BUILDINGS[c.homeId];
        const existingDream = c.dreamState || c.dream;
        const nextDream = existingDream
          ? {
              ...existingDream,
              isCurrentlyOnCarTrip: false,
              carTripPhase: 'in_city2' as const,
              carTripStatus: 'returned_before_night' as const,
            }
          : undefined;
        return {
          ...c,
          currentLocationId: c.homeId,
          currentPosition: {
            x: homeBld?.entrance[0] ?? c.currentPosition.x,
            z: homeBld?.entrance[2] ?? c.currentPosition.z,
          },
          currentActivity: `🌃 Returned safely to ${homeBld?.name} in Second City before nightfall`,
          decisionReason: `🌃 Returned to City 2 Before Night & Dreaming`,
          dream: nextDream,
          dreamState: nextDream,
          activeEmote: {
            type: 'cheer',
            label: '🌃 Home Before Night!',
            expiresAt: nowMs + 6500,
          },
          activeBubble: {
            text: `🌃 Our Dream Cruiser Car returned across the bridge to ${homeBld?.name} before nightfall!`,
            expiresAt: nowMs + 7500,
          },
          memories: deduplicateCharacterMemories([
            {
              id: createUniqueId(`mem_car_ret_${c.id}`),
              gameTime: formattedClock,
              type: 'observation',
              important: true,
              summary: `Completed daytime Dream Cruiser excursion to Gemini City and returned home to ${homeBld?.name} before nightfall.`,
            },
            ...(c.memories || []),
          ]),
        };
      })
    );
  }, []);

  const handleSynthesizeNewDream = useCallback((charId: string) => {
    const nowMs = Date.now();
    const dreamThemes = [
      {
        theme: 'Starlight Bridge Convergence',
        dest: 'park' as BuildingId,
        summary:
          'Dreamed of glowing cyan fireflies guiding the Cyber-Cruiser car across the Golden Horizon Bridge to Central Starlight Park and returning home before sunset.',
      },
      {
        theme: 'Cardamom & Quantum Espresso',
        dest: 'cafe' as BuildingId,
        summary:
          'Dreamed of sharing warm cardamom lattes with Gemini City friends at Sunbeam Café during a sunny afternoon car trip before driving back to City 2.',
      },
      {
        theme: 'Clocktower Harmonic Resonance',
        dest: 'school' as BuildingId,
        summary:
          'Dreamed of recording the Horizon Academy clocktower chimes and bringing their acoustic resonance back to Neo-Horizon before nightfall.',
      },
    ];
    const picked = dreamThemes[Math.floor(Math.random() * dreamThemes.length)];
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const existingDream = c.dreamState || c.dream;
        const nextDream = {
          title: picked.theme,
          dreamTheme: picked.theme,
          description: picked.summary,
          geminiCityVisitSpot: picked.dest,
          dreamTargetGeminiBuildingId: picked.dest,
          geminiCityGoal: `Fulfill "${picked.theme}" at ${CITY_BUILDINGS[picked.dest]?.name} and return before nightfall`,
          carTripStartHour: existingDream?.carTripStartHour ?? 11.0,
          carTripReturnHour: existingDream?.carTripReturnHour ?? 18.0,
          lastNightDream: picked.summary,
          lastDreamSummary: picked.summary,
          isCurrentlyOnCarTrip: Boolean(existingDream?.isCurrentlyOnCarTrip),
          carTripPhase: existingDream?.carTripPhase || ('in_city2' as const),
          carTripStatus: existingDream?.carTripStatus || ('home_in_city2' as const),
          lastDreamNightDay: dayNumberRef.current,
        };
        return {
          ...c,
          dream: nextDream,
          dreamState: nextDream,
          activeEmote: {
            type: 'think',
            label: `🌙 ${picked.theme}`,
            expiresAt: nowMs + 6500,
          },
          activeBubble: {
            text: `🌙 New Dream Vision: "${picked.summary}"`,
            expiresAt: nowMs + 7500,
          },
        };
      })
    );
  }, []);

  const handleUpdateGroqConfig = useCallback((charId: string, config: ResidentGroqConfig) => {
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === charId
          ? {
              ...c,
              groqConfig: config,
              modelBadge: `Groq · ${config.modelId || config.modelTier}`,
            }
          : c
      )
    );
  }, []);

  const handleSyncCity2DatabaseNow = useCallback(() => {
    const city2Residents = charactersRef.current.filter(
      (c) => isCity2Character(c.id) || c.cityId === 'city2'
    );
    const city2Conversations: Record<string, ChatMessage[]> = {};
    city2Residents.forEach((c) => {
      city2Conversations[c.id] = chatHistoriesRef.current[c.id] || [];
    });
    const city2Payload = {
      version: 1,
      lastSavedAt: new Date().toISOString(),
      residents: city2Residents,
      conversationLogs: city2Conversations,
      okPlans: Object.fromEntries(city2Residents.map((c) => [c.id, c.okPlan])),
    };
    try {
      localStorage.setItem(CITY2_STORAGE_KEY, JSON.stringify(city2Payload));
    } catch {
      // ignore
    }
    fetch(resolveApiUrl('/api/city2-db'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(city2Payload),
    })
      .then(() => {
        setCity2DbLastSynced(`${formatGameClock(gameHourRef.current)} ✓`);
      })
      .catch(() => {
        setCity2DbLastSynced(`${formatGameClock(gameHourRef.current)} (Local DB ✓)`);
      });
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 1. Compact Edge Drawer Tabs on Left Edge (Hidden during Full Gameplay Gamepad Mode) */}
      {!isGamepadMode && (
        <div className="fixed top-3 left-0 z-30 flex flex-col items-start gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsControlsDrawerOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setSelectedCharacterId(null);
                    setIsExplorerSheetOpen(false);
                    setIsCity2HubOpen(false);
                  }
                  return next;
                });
              }}
              title="Tap to open or collapse the Controls, Residents & Settings Side Panel"
              className={`h-9 px-3 rounded-r-xl backdrop-blur-xl border border-l-0 shadow-xl flex items-center gap-1.5 transition-all active:scale-95 ${
                isControlsDrawerOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                  : 'bg-slate-950/90 hover:bg-slate-900 text-white border-amber-400/50 font-semibold'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-md font-display font-bold text-[10px] flex items-center justify-center shadow-xs ${
                  isControlsDrawerOpen ? 'bg-slate-950 text-amber-400' : 'bg-amber-400 text-slate-950'
                }`}
              >
                GC
              </span>
              <Menu className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] whitespace-nowrap">
                {isControlsDrawerOpen ? 'Close ◂' : 'Menu ▸'}
              </span>
            </button>

            {!isUiHidden && !isControlsDrawerOpen && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/15 text-[11px] text-slate-200 shadow-lg">
                {renderPhaseIcon()}
                <span className="font-mono font-semibold text-white">
                  {formatGameClock(gameHour)}
                </span>
                <span className="text-slate-500">·</span>
                {renderWeatherIcon()}
                <span>{getWeatherLabel(weather)}</span>
              </div>
            )}
          </div>

          {!isUiHidden && !isControlsDrawerOpen && (
            <button
              type="button"
              onClick={() => {
                setSelectedCharacterId(null);
                setIsExplorerSheetOpen(false);
                setSelectedBuildingId(null);
                setSelectedCreatedObject(null);
                setIsCity2HubOpen((prev) => !prev);
              }}
              className={`h-8 px-2.5 rounded-r-xl backdrop-blur-xl border border-l-0 shadow-lg flex items-center gap-1.5 text-[11px] font-display font-bold transition active:scale-95 ${
                isCity2HubOpen
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-slate-950/90 hover:bg-slate-900 text-cyan-300 border-cyan-400/50'
              }`}
              title="Open Second City (Neo-Horizon) Groq AI Hub: Alie, Joseph, Iysha, Amie & Hawa · OK-Plan · Love & Co-Working · Friend Chart 📉 · Dream Car Trip"
            >
              <span>🏙️🧠 City 2 Hub</span>
              <span className="text-[10px] opacity-80">{isCity2HubOpen ? '◂' : '▸'}</span>
            </button>
          )}
        </div>
      )}

      {/* 1B. Slide-Out Controls, Residents & Settings Drawer (All buttons in one place, nothing cut off!) */}
      {isControlsDrawerOpen && (
        <div className="fixed inset-0 z-35 pointer-events-auto flex">
          {/* Backdrop tap to close */}
          <div
            onClick={() => setIsControlsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
          />

          {/* Drawer Panel */}
          <aside className="relative z-10 w-88 max-w-[90vw] h-full bg-slate-950/95 backdrop-blur-xl border-r border-white/15 shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center shadow-xs">
                  GC
                </span>
                <div>
                  <h2 className="font-display text-sm font-bold text-white leading-tight">
                    Gemini City Controls
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    All controls, residents & settings in one drawer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsControlsDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                title="Hide Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* SECTION 0: EXPLORER AI ADVISOR, FIELD NOTES & CLOTHES CARD */}
              <section className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-sky-500/15 border border-amber-400/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-950 font-display font-bold text-sm shrink-0 shadow"
                      style={{ backgroundColor: explorerProfile.outfitColor || '#F59E0B' }}
                    >
                      ★
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {explorerProfile.name} · Explorer AI
                      </div>
                      <div className="text-[10px] text-amber-300 font-semibold">
                        Gemini + Groq Brain · Field Notes & Clothes
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsDrawerOpen(false);
                      setSelectedCharacterId(null);
                      setIsExplorerSheetOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 transition active:scale-95"
                  >
                    Open {explorerProfile.name}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Ask {explorerProfile.name} what the AI residents lack, coach their goals, view
                  live field notes, or change {explorerProfile.name}’s clothes in 3D.
                </p>
              </section>

              {/* SECTION 1: SETTINGS MENU (Including Full Gameplay 4-Finger Claw Gamepad & Social Proximity!) */}
              <section className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings Menu</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUiHidden((v) => !v);
                      setIsControlsDrawerOpen(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-amber-200 flex items-center gap-1 transition"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>{isUiHidden ? 'Show Joystick' : 'Full-Screen Only'}</span>
                  </button>
                </div>

                {/* FULL GAMEPLAY VIEW: 4-FINGER CLAW GAMEPAD & SCREEN ROTATION */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 via-slate-950 to-amber-500/15 border border-sky-400/45 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Full Gameplay View (4-Finger Claw)</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-400/20 text-sky-300">
                      {isGamepadMode ? 'ACTIVE' : 'NORMAL VIEW'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Turn your phone sideways like a gamepad with 4-Finger Claw controls (Thumb
                    Analog Stick, Index Claw Jump &amp; Slide Triggers, and 360° Screen Rotation).
                    Exit anytime to return to the normal straight phone control.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleEnterGamepadMode(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-400 to-amber-400 hover:from-sky-300 hover:to-amber-300 text-slate-950 font-display font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition active:scale-95"
                    >
                      <Smartphone className="w-4 h-4 rotate-90" />
                      <span>Turn Screen 90° · Full Gameplay Gamepad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnterGamepadMode(false)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-400/35 text-sky-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Full Gameplay Gamepad (Keep Current Screen Angle)</span>
                    </button>
                  </div>
                </div>

                {/* Social Proximity Toggle */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-400/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Social Proximity</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">
                      {socialProximityMode === 'emotional_closeness'
                        ? 'Closer in Emotion'
                        : 'Maintain Distance'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Choose whether AI residents maintain personal space while chatting or step
                    closer together during emotional moments.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSocialProximityMode('respectful_distance')}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition flex flex-col items-center gap-0.5 text-center ${
                        socialProximityMode === 'respectful_distance'
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-900/90 text-slate-300 border-white/10 hover:bg-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Maintain Distance</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialProximityMode('emotional_closeness')}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition flex flex-col items-center gap-0.5 text-center ${
                        socialProximityMode === 'emotional_closeness'
                          ? 'bg-rose-500 text-white border-rose-300 shadow-sm'
                          : 'bg-slate-900/90 text-slate-300 border-white/10 hover:bg-slate-800'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Emotional Closeness</span>
                    </button>
                  </div>
                </div>

                {/* Weather, Clock & Graphics Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setWeather((w) =>
                        w === 'sunny' ? 'cloudy' : w === 'cloudy' ? 'rainy' : 'sunny'
                      )
                    }
                    className="p-2.5 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-white/10 text-xs font-medium text-white flex items-center justify-between transition"
                  >
                    <span className="text-slate-400">Weather:</span>
                    <span className="flex items-center gap-1 font-semibold">
                      {renderWeatherIcon()}
                      <span>{getWeatherLabel(weather)}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setGraphicsQuality((q) =>
                        q === 'low' ? 'medium' : q === 'medium' ? 'high' : 'low'
                      )
                    }
                    className="p-2.5 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-white/10 text-xs font-medium text-white flex items-center justify-between transition"
                  >
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-amber-400" />
                      <span>GFX:</span>
                    </span>
                    <span className="uppercase font-mono font-bold text-amber-300">
                      {graphicsQuality}
                    </span>
                  </button>
                </div>

                {/* Day/Night Cycle, Day Number & Speed */}
                <div className="p-2.5 rounded-xl bg-slate-950/75 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {renderPhaseIcon()}
                      <span className="font-mono text-xs font-semibold text-white">
                        Day {dayNumber} · {formatGameClock(gameHour)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        · {getTimePhaseLabel(timePhase)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextHours = [6.5, 10.0, 14.5, 18.5, 22.0];
                          const idx = nextHours.findIndex((h) => h > gameHour);
                          if (idx === -1) {
                            setGameHour(nextHours[0]);
                            handleStartNewDay();
                          } else {
                            setGameHour(nextHours[idx]);
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-amber-300 transition"
                      >
                        Shift Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSpeed((s) => (s === 1 ? 3 : s === 3 ? 0 : 1))}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                        title="Toggle Clock Speed"
                      >
                        {timeSpeed === 0 ? (
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                        ) : timeSpeed === 3 ? (
                          <FastForward className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartNewDay()}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-[11px] font-semibold text-amber-200 flex items-center justify-center gap-1.5 transition active:scale-95"
                    title="Advance to the next day and assign a fresh unique Daily Goal to every resident"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>🌅 Start Day {dayNumber + 1} (New Resident Daily Goals)</span>
                  </button>
                </div>
              </section>

              {/* SECTION 2: QUICK WORLD ACTIONS */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  World Actions & Exploration
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleAutoExplore();
                      setIsControlsDrawerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      autoExploreEnabled
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-md'
                        : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/35 text-sky-200'
                    }`}
                  >
                    <Compass className={`w-4 h-4 ${autoExploreEnabled ? 'animate-spin' : ''}`} />
                    <span>{autoExploreEnabled ? 'Stop Explore' : 'Auto-Explore'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleTriggerAutonomousCreation();
                      setIsControlsDrawerOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/35 text-xs font-semibold text-fuchsia-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <Wand2 className="w-4 h-4 text-fuchsia-300" />
                    <span>AI Create ✨</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInsideHouseMode((v) => !v)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      insideHouseMode
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/15 text-slate-200'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span>{insideHouseMode ? 'Roofs: Open 🏠' : 'Peek Houses 🏠'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSendAllToOwnHouses();
                      setIsControlsDrawerOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <span>🏠 All Go Home</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsDrawerOpen(false);
                      setEditorModal({
                        open: true,
                        mode: 'create',
                        characterId: selectedCharacter?.id || characters[0]?.id || null,
                      });
                    }}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ New Resident</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsDrawerOpen(false);
                      setGuideModal({ open: true, tab: 'heatmap' });
                    }}
                    className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-semibold text-rose-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <span>🔥 City Heatmap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsDrawerOpen(false);
                      setGuideModal({ open: true, tab: 'directory' });
                    }}
                    className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition col-span-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>World Almanac & Heatmap</span>
                  </button>
                </div>
              </section>

              {/* SECTION 3: ALL RESIDENTS & EXPLORER PROFILE */}
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Residents ({characters.length}) · Tap to Chat / Memories
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsControlsDrawerOpen(false);
                      setSelectedCharacterId(null);
                      setIsExplorerSheetOpen(true);
                    }}
                    className="text-[11px] font-semibold text-sky-300 hover:underline flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>{explorerProfile.name}’s AI & Clothes</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {characters.map((char) => {
                    const isSelected = selectedCharacterId === char.id;
                    const ward = getResidentWeatherWardrobe(char, weather);
                    const dGoal = getOrCreateResidentDailyGoal(char, dayNumber, weather);
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          setSelectedCharacterId(char.id);
                          setIsControlsDrawerOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition text-left ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white font-display font-bold text-xs shrink-0 shadow-xs"
                            style={{ backgroundColor: char.avatarColor }}
                          >
                            {char.name[0]}
                            <span
                              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950"
                              style={{ backgroundColor: ward.outfitColor }}
                              title={`Wearing: ${ward.outfitLabel}`}
                            />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{char.name}</div>
                            <div
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-slate-800' : 'text-slate-400'
                              }`}
                            >
                              {dGoal.badgeIcon} {dGoal.title}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-slate-950/15 text-slate-950'
                              : dGoal.completed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {dGoal.completed ? '✅ Done' : `🎯 ${Math.round(dGoal.progress)}%`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* SECTION 4: PLAYER EMOTES */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Emotes (Nearby Residents Join In!)
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {EMOTE_CATALOG.map((em) => (
                    <button
                      key={em.type}
                      type="button"
                      onClick={() => {
                        handleTriggerPlayerEmote(em.type);
                        setIsControlsDrawerOpen(false);
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                        playerEmote === em.type
                          ? 'bg-fuchsia-500 text-white border-fuchsia-300 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                      }`}
                    >
                      {em.badge}
                    </button>
                  ))}
                </div>
              </section>

              {/* SECTION 5: LANDMARKS & HOUSES */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  City Landmarks & Accessible Houses
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.values(CITY_BUILDINGS).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        handleSelectBuilding(b.id);
                        setIsControlsDrawerOpen(false);
                      }}
                      className={`p-2 rounded-xl border text-left text-xs font-medium transition flex items-center gap-1.5 ${
                        selectedBuildingId === b.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      {/* 1C. Auto-Explore Active Tour Collapsible Left-Edge Tab / Panel */}
      {!isUiHidden && autoExploreEnabled && autoExploreTargetChar && !selectedCharacter && (
        <div className="fixed top-24 left-0 z-25 pointer-events-auto">
          {isAutoExploreBarCollapsed ? (
            <button
              type="button"
              onClick={() => setIsAutoExploreBarCollapsed(false)}
              className="px-2.5 py-1.5 rounded-r-xl bg-slate-950/90 backdrop-blur-xl border border-l-0 border-emerald-400/50 text-emerald-300 text-[11px] font-bold shadow-xl flex items-center gap-1.5 transition active:scale-95"
              title="Expand Auto-Explore Tour Status"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              <span>🧭 Tour ({autoExploreVisitedIds.length}/{characters.length}) ▸</span>
            </button>
          ) : (
            <div className="px-3 py-2 rounded-r-2xl bg-slate-950/95 backdrop-blur-xl border border-l-0 border-emerald-400/50 shadow-xl flex items-center gap-2.5 text-xs text-slate-100 max-w-[90vw]">
              <Compass className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-emerald-300 whitespace-nowrap text-[11px]">
                  {autoExplorePhase === 'interacting'
                    ? `Interacting w/ ${autoExploreTargetChar.name}`
                    : `Auto-Moving → ${autoExploreTargetChar.name}`}{' '}
                  <span className="text-slate-400 font-normal">
                    ({autoExploreVisitedIds.length}/{characters.length})
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate max-w-[180px]">
                  At {CITY_BUILDINGS[autoExploreTargetChar.currentLocationId]?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSkipToNextExploreResident}
                title="Walk to next resident right now"
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-amber-300 flex items-center gap-1 transition whitespace-nowrap"
              >
                <span>Next</span>
                <SkipForward className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleToggleAutoExplore}
                className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-[10px] font-semibold text-rose-200 transition whitespace-nowrap"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={() => setIsAutoExploreBarCollapsed(true)}
                className="px-1.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-300"
                title="Collapse to Left Edge"
              >
                ◂
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Full-Viewport 3D Three.js World (Rotates 90° into Widescreen Landscape Gamepad when turned on!) */}
      <main
        className={
          isGamepadMode && gamepadScreenRotation !== 0
            ? 'fixed top-1/2 left-1/2 z-25 overflow-hidden bg-slate-950'
            : 'w-full h-full'
        }
        style={
          isGamepadMode && gamepadScreenRotation !== 0
            ? {
                width: '100dvh',
                height: '100dvw',
                transform: `translate(-50%, -50%) rotate(${gamepadScreenRotation}deg)`,
              }
            : undefined
        }
      >
        <CityViewport3D
          characters={characters}
          createdObjects={createdObjects}
          explorerProfile={explorerProfile}
          playerEmote={playerEmote}
          playerAutoTarget={playerAutoTarget}
          playerActiveBubble={playerActiveBubble}
          insideHouseMode={insideHouseMode}
          hideActionHud={isUiHidden || isExplorerSheetOpen || isControlsDrawerOpen}
          isGamepadMode={isGamepadMode}
          screenRotation={isGamepadMode ? gamepadScreenRotation : 0}
          onCycleScreenRotation={handleCycleGamepadScreenRotation}
          onExitGamepadMode={handleExitGamepadMode}
          onJoystickMove={handleJoystickMove}
          selectedCharacterId={selectedCharacterId}
          selectedBuildingId={selectedBuildingId}
          gameHour={gameHour}
          timePhase={timePhase}
          weather={weather}
          graphicsQuality={graphicsQuality}
          joystickVector={joystickVector}
          joystickInputRef={joystickInputRef}
          cameraTargetOverride={cameraTargetOverride}
          onSelectCharacter={handleSelectCharacter}
          onSelectExplorer={() => {
            setSelectedCharacterId(null);
            setIsExplorerSheetOpen(true);
          }}
          onSelectBuilding={handleSelectBuilding}
          onSelectCreatedObject={(obj) => {
            setSelectedCreatedObject(obj);
            setSelectedBuildingId(null);
            setSelectedCharacterId(null);
            setIsInspectorCollapsed(false);
            setCameraTargetOverride({ x: obj.position.x, z: obj.position.z });
          }}
          onPlayerPositionChange={handlePlayerPositionChange}
          onPlayerAutoTargetReached={handlePlayerAutoTargetReached}
          onClearCameraOverride={() => setCameraTargetOverride(null)}
          onTriggerBridgeReflections={handleTriggerBridgeReflections}
          playerSittingSpot={playerSittingSpot}
          onSelectTwoPlaceSpot={(spotId, seatingChoice) =>
            handleStartPairOuting(spotId, seatingChoice || 'bench')
          }
          onPlayerStandUp={() => setPlayerSittingSpot(null)}
          onVehicleTransitEvent={(evt) => {
            const nowMs = Date.now();
            const formattedClock = formatGameClock(gameHourRef.current);
            const displayJohn = (explorerProfileRef.current.name || 'John')
              .toLowerCase()
              .startsWith('john')
              ? 'John'
              : explorerProfileRef.current.name;

            setCharacters((prev) =>
              prev.map((c) => {
                if (!evt.characterIds.includes(c.id)) return c;
                const isBus = evt.vehicle === 'bus';
                if (evt.action === 'board') {
                  return {
                    ...c,
                    isSitting: true,
                    isMoving: false,
                    currentActivity: isBus
                      ? `Riding inside the 5-Passenger Bus (${evt.locationLabel}) 🚌`
                      : `Riding in the Cyberpunk Supercar with ${displayJohn} 🏎️❤️`,
                    currentThought: isBus
                      ? `Sitting comfortably inside the 5-passenger Horizon Luxury Bus as we cruise smoothly across the map!`
                      : `Cruising with ${displayJohn} in the Cyber-Valkyrie GT Supercar across Gemini City and Cyber Horizon!`,
                    activeBubble: {
                      text: isBus
                        ? `Hopped aboard the 5-passenger bus at ${evt.locationLabel}! Let's cruise! 🚌`
                        : `Sitting right beside you in the Cyberpunk Supercar, ${displayJohn}! Let's drive everywhere! 🏎️❤️`,
                      expiresAt: nowMs + 6000,
                    },
                  };
                }
                // Exiting / Alighting at the stop or car parking spot
                const offsetIdx = evt.characterIds.indexOf(c.id);
                const exitX = evt.x + (offsetIdx % 2 === 0 ? 0.65 : -0.65);
                const exitZ = evt.z + offsetIdx * 0.7;
                return {
                  ...c,
                  isSitting: false,
                  isMoving: false,
                  currentPosition: { x: exitX, z: exitZ },
                  targetPosition: { x: exitX, z: exitZ },
                  currentActivity: `Stepped off ${isBus ? 'the 5-Passenger Bus' : 'the Cyberpunk Supercar'} at ${evt.locationLabel}`,
                  currentThought: `Enjoyed riding ${isBus ? 'the 5-passenger luxury bus' : `the Cyberpunk Supercar with ${displayJohn}`} to ${evt.locationLabel}!`,
                  activeBubble: {
                    text: isBus
                      ? `Thanks for the smooth ride! Stepping outside the bus here at ${evt.locationLabel}! 🚌✨`
                      : `That drive across the map in the Cyberpunk Supercar was amazing, ${displayJohn}! 🏎️❤️`,
                    expiresAt: nowMs + 6500,
                  },
                  memories: deduplicateCharacterMemories([
                    {
                      id: createUniqueId(`mem_transit_${c.id}`),
                      gameTime: `Day ${dayNumber} · ${formattedClock}`,
                      type: 'event',
                      important: !isBus,
                      summary: isBus
                        ? `Rode the 5-passenger autonomous luxury bus and stepped off at ${evt.locationLabel} (${formattedClock}).`
                        : `Drove around the map inside the Cyber-Valkyrie GT Supercar with ${displayJohn} and arrived at ${evt.locationLabel} (${formattedClock}).`,
                      involvedNames: isBus ? [c.name] : [c.name, displayJohn],
                      emotionAtTime: isBus ? 'Happiness' : 'Affection',
                    },
                    ...(c.memories || []),
                  ]),
                };
              })
            );
          }}
        />
      </main>

      {/* 2A. Hawa / Loved One Approach & Two-Place Outing Invitation — Collapsible Left-Edge Tab & Side Panel */}
      {approachInvite && !selectedCharacter && (
        <div className="fixed top-28 left-0 z-30 pointer-events-auto">
          {isInviteCollapsed ? (
            <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-l-0 border-rose-400/65 rounded-r-xl shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsInviteCollapsed(false)}
                className="px-3 py-2 text-xs font-bold text-rose-200 hover:bg-white/10 flex items-center gap-2 transition"
                title={`Open invitation from ${approachInvite.characterName}`}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white font-display font-bold text-[10px] shrink-0"
                  style={{ backgroundColor: approachInvite.avatarColor }}
                >
                  {approachInvite.characterName[0]}
                </span>
                <span>❤️ {approachInvite.characterName} Invite ▸</span>
              </button>
              <button
                type="button"
                onClick={handleDismissApproach}
                className="px-2 py-2 text-slate-400 hover:text-white hover:bg-rose-500/20 border-l border-white/10 transition"
                title="Dismiss Invitation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-[88vw] max-w-[350px] p-3.5 rounded-r-2xl bg-slate-950/95 backdrop-blur-xl border border-l-0 border-rose-400/70 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-display font-bold text-xs shrink-0 shadow-md"
                    style={{ backgroundColor: approachInvite.avatarColor }}
                  >
                    {approachInvite.characterName[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-bold text-xs text-white">
                        {approachInvite.characterName}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/25 border border-rose-400/40 text-rose-200 font-semibold">
                        ❤️ Invite
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-300 truncate mt-0.5">
                      {approachInvite.suggestedTwoPlaceSpotName || 'Two-Place Bench & Chairs Sanctuary'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsInviteCollapsed(true)}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-rose-200 transition"
                    title="Collapse to left edge"
                  >
                    Collapse ◂
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissApproach}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-100 mt-2 leading-relaxed bg-slate-900/90 p-2.5 rounded-xl border border-white/10">
                “{approachInvite.greetingText}”
              </p>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleStartPairOuting(
                      approachInvite.suggestedTwoPlaceSpotId ||
                        (playerPosRef.current.x > 125
                          ? 'neo_starlight_bench'
                          : 'gemini_river_pergola'),
                      'bench',
                      approachInvite.characterId
                    )
                  }
                  className="py-2 px-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-display font-extrabold text-[11px] shadow-md flex items-center justify-center gap-1 transition active:scale-95"
                >
                  <span>🪑 Bench Together ❤️</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStartPairOuting(
                      approachInvite.suggestedTwoPlaceSpotId ||
                        (playerPosRef.current.x > 125
                          ? 'neo_starlight_bench'
                          : 'gemini_river_pergola'),
                      'chairs',
                      approachInvite.characterId
                    )
                  }
                  className="py-2 px-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-200 font-bold text-[11px] flex items-center justify-center gap-1 transition active:scale-95"
                >
                  <span>☕ Sit on 2 Chairs</span>
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCharacter(approachInvite.characterId)}
                  className="text-[11px] font-semibold text-amber-300 hover:underline"
                >
                  💬 Chat w/ {approachInvite.characterName}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleFollowPlayer(approachInvite.characterId);
                    setApproachInvite(null);
                  }}
                  className="text-[11px] font-semibold text-rose-300 hover:underline"
                >
                  {followingCharId === approachInvite.characterId
                    ? '✓ Following You'
                    : '🚶‍♀️ Follow Me'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2A-2. Active Seated Together at Two-Place Sanctuary — Collapsible Left-Edge Tab / Panel */}
      {playerSittingSpot && !selectedCharacter && (
        <div className="fixed bottom-36 left-0 z-25 pointer-events-auto">
          {isSittingBarCollapsed ? (
            <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-l-0 border-rose-400/60 rounded-r-xl shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSittingBarCollapsed(false)}
                className="px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-white/10 flex items-center gap-1.5 transition"
              >
                <span>🪑❤️ Seated {playerSittingSpot.partnerName ? `w/ ${playerSittingSpot.partnerName}` : ''} ▸</span>
              </button>
              <button
                type="button"
                onClick={() => setPlayerSittingSpot(null)}
                className="px-2 py-1.5 bg-rose-500/30 hover:bg-rose-500 text-white text-[10px] font-bold border-l border-white/10 transition"
              >
                Stand
              </button>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 rounded-r-2xl bg-slate-950/95 backdrop-blur-xl border border-l-0 border-rose-400/60 shadow-2xl flex flex-wrap items-center gap-2 text-xs text-white max-w-[90vw]">
              <span className="font-display font-bold text-rose-300 flex items-center gap-1">
                <span>🪑❤️ Sitting</span>
                {playerSittingSpot.partnerName && (
                  <span>with {playerSittingSpot.partnerName}</span>
                )}
              </span>
              {playerSittingSpot.spotId && (
                <button
                  type="button"
                  onClick={() =>
                    handleStartPairOuting(
                      playerSittingSpot.spotId!,
                      playerSittingSpot.seatType === 'chair' ? 'bench' : 'chairs',
                      playerSittingSpot.partnerId
                    )
                  }
                  className="px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 font-semibold text-[11px] transition active:scale-95"
                >
                  Switch to {playerSittingSpot.seatType === 'chair' ? '🪑 Bench' : '☕ 2 Chairs'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPlayerSittingSpot(null)}
                className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] transition active:scale-95"
              >
                Stand Up
              </button>
              <button
                type="button"
                onClick={() => setIsSittingBarCollapsed(true)}
                className="px-1.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-300"
                title="Collapse to left edge"
              >
                ◂
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2B. Selected AI-Created 3D Object — Collapsible Right-Side Panel */}
      {selectedCreatedObject && !selectedCharacter && (
        <div className="fixed top-14 right-0 z-30 pointer-events-auto">
          {isInspectorCollapsed ? (
            <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-xl shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsInspectorCollapsed(false)}
                className="px-3 py-2 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="max-w-[130px] truncate">◂ {selectedCreatedObject.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCreatedObject(null)}
                className="px-2 py-2 text-slate-400 hover:text-white hover:bg-rose-500/20 border-l border-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-[88vw] max-w-[340px] p-4 rounded-l-2xl bg-slate-900/95 backdrop-blur-xl border border-r-0 border-amber-400/40 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Creation · {selectedCreatedObject.createdAtTime}</span>
                  </div>
                  <h2 className="font-display text-sm font-bold text-white mt-0.5">
                    {selectedCreatedObject.name}
                  </h2>
                  <p className="text-[11px] text-emerald-300">
                    By {selectedCreatedObject.creatorName} near{' '}
                    {CITY_BUILDINGS[selectedCreatedObject.locationId]?.name}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsInspectorCollapsed(true)}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-300 transition"
                    title="Collapse to right edge"
                  >
                    Collapse ▸
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCreatedObject(null)}
                    aria-label="Close Creation Info"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-200 mt-2 leading-relaxed bg-slate-950/70 p-2.5 rounded-xl border border-white/10">
                “{selectedCreatedObject.thoughtSummary}”
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCharacter(selectedCreatedObject.creatorId)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition"
                >
                  Chat with {selectedCreatedObject.creatorName}
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerAutonomousCreation(selectedCreatedObject.creatorId)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-amber-200 transition"
                >
                  Create Another ✨
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Selected Landmark — Collapsible Right-Side Inspector Panel */}
      {selectedBuilding && !selectedCharacter && (
        <div className="fixed top-14 right-0 z-30 pointer-events-auto">
          {isInspectorCollapsed ? (
            <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-xl shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsInspectorCollapsed(false)}
                className="px-3 py-2 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">◂ {selectedBuilding.name}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectBuilding(null)}
                className="px-2 py-2 text-slate-400 hover:text-white hover:bg-rose-500/20 border-l border-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-[88vw] max-w-[350px] p-4 rounded-l-2xl bg-slate-900/95 backdrop-blur-xl border border-r-0 border-white/15 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-white">
                    {selectedBuilding.name}
                  </h2>
                  <p className="text-[11px] text-amber-300 mt-0.5">{selectedBuilding.subtitle}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsInspectorCollapsed(true)}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-300 transition"
                    title="Collapse to right edge"
                  >
                    Collapse ▸
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBuilding(null)}
                    aria-label="Close Landmark Info"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {selectedBuilding.description}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {selectedBuilding.id !== 'park' && (
                  <button
                    type="button"
                    onClick={() => setInsideHouseMode((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>{insideHouseMode ? 'Show Roof' : 'Look Inside House 🏠'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendAllToOwnHouses}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <span>Everyone Go to Own House 🏠</span>
                </button>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10">
                <span className="text-[11px] text-slate-400 block mb-1.5">
                  Residents currently here:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {characters
                    .filter((c) => c.currentLocationId === selectedBuilding.id)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCharacter(c.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.avatarColor }}
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  {characters.filter((c) => c.currentLocationId === selectedBuilding.id).length ===
                    0 && (
                    <span className="text-xs text-slate-400 italic">
                      Everyone is currently out exploring the city.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Bottom Ergonomic Thumb-Zone HUD (Compact Edge Tabs + Joystick) */}
      {!isUiHidden && !isGamepadMode && !selectedCharacter && (
        <div className="fixed bottom-3 left-3 right-0 z-20 flex items-end justify-between gap-2 pointer-events-none">
          <VirtualJoystick variant="normal" onMove={handleJoystickMove} />

          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            {autoExploreEnabled && (
              <button
                type="button"
                onClick={handleToggleAutoExplore}
                className="h-8 px-2.5 rounded-l-xl bg-emerald-400 text-slate-950 font-bold text-[11px] shadow-lg flex items-center gap-1.5 transition active:scale-95"
              >
                <Compass className="w-3.5 h-3.5 animate-spin" />
                <span>Exploring...</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedCharacterId(null);
                setIsCity2HubOpen(false);
                setIsControlsDrawerOpen(false);
                setIsExplorerSheetOpen((prev) => !prev);
              }}
              className="h-9 px-3 rounded-l-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] shadow-xl flex items-center gap-1.5 transition active:scale-95"
              title="Open Explorer AI Advisor, Field Notes, Friendships & Clothes"
            >
              <span>★ {explorerProfile.name} AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCharacterId(null);
                setIsExplorerSheetOpen(false);
                setIsCity2HubOpen(false);
                setIsControlsDrawerOpen((prev) => !prev);
              }}
              className="h-9 px-3 rounded-l-xl bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md border border-r-0 border-amber-400/50 text-amber-300 font-semibold text-[11px] shadow-xl flex items-center gap-1.5 transition active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings ◂</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Active AI Resident Conversation & Profile Sheet */}
      {selectedCharacter && (
        <CharacterSheet
          character={selectedCharacter}
          allCharacters={characters}
          createdObjects={createdObjects}
          explorerProfile={explorerProfile}
          messages={chatHistories[selectedCharacter.id] || []}
          isSending={isSendingChat}
          gameHour={gameHour}
          dayNumber={dayNumber}
          weather={weather}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => {
            setVoiceEnabled((prev) => {
              const next = !prev;
              if (!next) stopCharacterSpeech();
              return next;
            });
          }}
          onClose={() => setSelectedCharacterId(null)}
          onSendMessage={handleSendMessage}
          onSelectCharacter={handleSelectCharacter}
          onFocusLocation={(locId) => {
            handleSelectBuilding(locId);
          }}
          onFocusCreatedObject={(obj) => {
            setSelectedCreatedObject(obj);
            setCameraTargetOverride({ x: obj.position.x, z: obj.position.z });
          }}
          onTriggerSocialWithNearby={(partnerId) =>
            handleTriggerSocialEncounter(selectedCharacter.id, partnerId)
          }
          onTriggerEmote={(emote) => handleTriggerCharacterEmote(selectedCharacter.id, emote)}
          onSendHome={() => handleSendCharacterToOwnHouse(selectedCharacter.id)}
          onTriggerAutonomousCreate={() =>
            handleTriggerAutonomousCreation(selectedCharacter.id)
          }
          onBoostDailyGoal={() => handleBoostResidentDailyGoal(selectedCharacter.id)}
          onRerollDailyGoal={() => handleRerollResidentDailyGoal(selectedCharacter.id)}
          onOpenCity2Hub={() => setIsCity2HubOpen(true)}
          onApproveOkPlan={() => handleApproveOkPlan(selectedCharacter.id)}
          onLaunchGeminiCarTrip={() => handleLaunchGeminiCarTrip(selectedCharacter.id)}
          isFollowingPlayer={followingCharId === selectedCharacter.id}
          onToggleFollowPlayer={() => handleToggleFollowPlayer(selectedCharacter.id)}
          onStartPairOuting={(spotId, seatPreference) =>
            handleStartPairOuting(spotId, seatPreference, selectedCharacter.id)
          }
          onOpenEditor={() =>
            setEditorModal({
              open: true,
              mode: 'edit',
              characterId: selectedCharacter.id,
            })
          }
        />
      )}

      {/* 6A. Second City (Neo-Horizon) Groq AI Intelligence Hub, Database, OK-Plan, Love Co-Working & Friend Chart Modal */}
      {isCity2HubOpen && (
        <City2GroqHubModal
          isOpen={isCity2HubOpen}
          characters={characters}
          chatHistories={chatHistories}
          gameHour={gameHour}
          dayNumber={dayNumber}
          city2DbLastSynced={city2DbLastSynced}
          onClose={() => setIsCity2HubOpen(false)}
          onSelectCharacter={(id) => {
            setIsCity2HubOpen(false);
            handleSelectCharacter(id);
          }}
          onFocusLocation={(bId) => {
            setIsCity2HubOpen(false);
            handleSelectBuilding(bId);
          }}
          onApproveOkPlan={handleApproveOkPlan}
          onAdvanceOkPlanStep={handleAdvanceOkPlanStep}
          onGenerateNewOkPlan={handleGenerateNewOkPlan}
          onLinkRomanticCoWorkers={handleLinkRomanticCoWorkers}
          onUnlinkRomanticCoWorkers={handleUnlinkRomanticCoWorkers}
          onTriggerFriendChartTalk={(idA, idB) => handleTriggerSocialEncounter(idA, idB)}
          onSendDirectMessage={(charId, text) => handleSendMessage(text, charId)}
          isSendingChat={isSendingChat}
          onLaunchGeminiCarTrip={handleLaunchGeminiCarTrip}
          onReturnCarTripBeforeNight={handleReturnCarTripBeforeNight}
          onSynthesizeNewDream={handleSynthesizeNewDream}
          onUpdateGroqConfig={handleUpdateGroqConfig}
          onSyncCity2DatabaseNow={handleSyncCity2DatabaseNow}
        />
      )}

      {/* 6B. Explorer Super-Intelligence, Field Notes, Friendships & 3D Wardrobe Sheet */}
      {isExplorerSheetOpen && (
        <ExplorerSheet
          isOpen={isExplorerSheetOpen}
          explorerProfile={explorerProfile}
          characters={characters}
          gameTime={formatGameClock(gameHour)}
          isAnalyzing={isAnalyzingExplorer}
          lastAdvisorReply={lastAdvisorReply}
          lastEngineUsed={lastEngineUsed}
          onClose={() => setIsExplorerSheetOpen(false)}
          onUpdateExplorer={setExplorerProfile}
          onRunExplorerAudit={handleRunExplorerAudit}
          onApplyResidentImprovement={handleApplyResidentImprovement}
          onApplyAllImprovements={handleApplyAllImprovements}
          onSelectCharacter={(id) => {
            setIsExplorerSheetOpen(false);
            handleSelectCharacter(id);
          }}
          onTriggerAutoExplore={handleToggleAutoExplore}
          autoExploreEnabled={autoExploreEnabled}
        />
      )}

      {/* 7. Character Profile / Personality / Appearance / Relationship Editor Modal */}
      {editorModal.open && (
        <CharacterEditorModal
          isOpen={editorModal.open}
          mode={editorModal.mode}
          character={
            characters.find((c) => c.id === editorModal.characterId) ||
            selectedCharacter ||
            characters[0] ||
            null
          }
          allCharacters={characters}
          explorerProfile={explorerProfile}
          onClose={() => setEditorModal((prev) => ({ ...prev, open: false }))}
          onSaveCharacter={handleSaveCharacterProfile}
          onCreateCharacter={handleCreateCharacter}
          onSaveExplorer={setExplorerProfile}
          onResetWorldData={handleResetWorldData}
        />
      )}

      {/* 8. World Almanac, City Heatmap, Social Chronicle & Architecture Modal */}
      {guideModal.open && (
        <WorldGuideModal
          isOpen={guideModal.open}
          initialTab={guideModal.tab}
          characters={characters}
          socialEvents={socialEvents}
          createdObjects={createdObjects}
          explorerProfile={explorerProfile}
          playerPosition={playerPosRef.current}
          onClose={() => setGuideModal((prev) => ({ ...prev, open: false }))}
          onSelectCharacter={handleSelectCharacter}
          onSelectBuilding={(id) => handleSelectBuilding(id)}
          onTriggerRandomSocial={() => handleTriggerSocialEncounter()}
        />
      )}
    </div>
  );
}
