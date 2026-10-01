import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Clock,
  Edit3,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Pin,
  Send,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  buildResidentEnvironmentalContext,
  CITY_BUILDINGS,
  deduplicateCharacterMemories,
  EMOTE_CATALOG,
  formatGameClock,
  getOrCreateResidentDailyGoal,
  getPrimaryLovedOneOrBestFriend,
  getResidentWeatherWardrobe,
  getWeatherLabel,
  TWO_PLACE_SPOTS,
} from '../data/cityData';
import {
  AICharacter,
  BuildingId,
  CharacterMemory,
  ChatMessage,
  CreatedWorldObject,
  EmotionType,
  EmoteType,
  ExplorerProfile,
  RoutineStep,
  TwoPlaceSpotId,
  WeatherType,
} from '../types/game';
import { speakCharacterLine } from '../utils/voiceSynthesis';

interface CharacterSheetProps {
  character: AICharacter;
  allCharacters: AICharacter[];
  createdObjects?: CreatedWorldObject[];
  explorerProfile: ExplorerProfile;
  messages: ChatMessage[];
  isSending: boolean;
  gameHour: number;
  dayNumber?: number;
  weather?: WeatherType;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onSelectCharacter: (id: string) => void;
  onFocusLocation: (locationId: BuildingId) => void;
  onFocusCreatedObject?: (obj: CreatedWorldObject) => void;
  onTriggerSocialWithNearby?: (partnerId: string) => void;
  onTriggerEmote?: (emote: Exclude<EmoteType, 'none'>) => void;
  onSendHome?: () => void;
  onTriggerAutonomousCreate?: () => void;
  onBoostDailyGoal?: () => void;
  onRerollDailyGoal?: () => void;
  onOpenEditor: () => void;
  onOpenCity2Hub?: () => void;
  onApproveOkPlan?: () => void;
  onLaunchGeminiCarTrip?: () => void;
  isFollowingPlayer?: boolean;
  onToggleFollowPlayer?: () => void;
  onStartPairOuting?: (spotId: TwoPlaceSpotId, seatingChoice: 'bench' | 'chairs') => void;
}

type SheetTab = 'chat' | 'profile' | 'social' | 'memories' | 'routine';
type MemoryFilter = 'all' | 'events' | 'romance' | 'creations' | 'goals';

function getEmotionBadgeClasses(emotion?: EmotionType): string {
  switch (emotion) {
    case 'Happiness':
    case 'Excitement':
      return 'bg-amber-400/15 border-amber-400/40 text-amber-300';
    case 'Affection':
      return 'bg-pink-500/15 border-pink-400/40 text-pink-300';
    case 'Curiosity':
      return 'bg-sky-500/15 border-sky-400/40 text-sky-300';
    case 'Calmness':
      return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300';
    case 'Embarrassment':
      return 'bg-rose-400/15 border-rose-400/40 text-rose-200';
    case 'Sadness':
    case 'Loneliness':
      return 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300';
    case 'Anger':
    case 'Jealousy':
      return 'bg-red-500/15 border-red-400/40 text-red-300';
    case 'Fear':
      return 'bg-purple-500/15 border-purple-400/40 text-purple-300';
    default:
      return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300';
  }
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  character,
  allCharacters,
  createdObjects = [],
  explorerProfile,
  messages,
  isSending,
  gameHour,
  dayNumber = 1,
  weather = 'sunny',
  voiceEnabled,
  onToggleVoice,
  onClose,
  onSendMessage,
  onSelectCharacter,
  onFocusLocation,
  onFocusCreatedObject,
  onTriggerSocialWithNearby,
  onTriggerEmote,
  onSendHome,
  onTriggerAutonomousCreate,
  onBoostDailyGoal,
  onRerollDailyGoal,
  onOpenEditor,
  onOpenCity2Hub,
  onApproveOkPlan,
  onLaunchGeminiCarTrip,
  isFollowingPlayer = false,
  onToggleFollowPlayer,
  onStartPairOuting,
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>('chat');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [inputText, setInputText] = useState('');
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsPanelCollapsed(false);
  }, [character.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab, isSending, character.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    onSendMessage(trimmed);
  };

  const currentBuilding = CITY_BUILDINGS[character.currentLocationId];
  const homeBuilding = CITY_BUILDINGS[character.homeId];

  // Find another resident nearby to allow triggering a live AI-to-AI social exchange
  const nearbyResident = allCharacters.find((other) => {
    if (other.id === character.id) return false;
    const d = Math.hypot(
      other.currentPosition.x - character.currentPosition.x,
      other.currentPosition.z - character.currentPosition.z
    );
    return d < 9.5;
  });

  const conversingPartner = character.conversingWithId
    ? allCharacters.find((c) => c.id === character.conversingWithId)
    : null;

  const firstName = character.name.split(' ')[0];
  const favLike =
    (character.likes && character.likes[0]) ||
    (character.interests && character.interests[0]) ||
    character.role;

  const emotionalState = character.emotionalState || {
    primary: 'Calmness' as EmotionType,
    intensity: 68,
    cause: `Feeling grounded at ${currentBuilding?.name || 'Gemini City'}`,
    sinceGameTime: formatGameClock(gameHour),
  };

  const wardrobe = getResidentWeatherWardrobe(character, weather);
  const dailyGoal = getOrCreateResidentDailyGoal(
    character,
    character.dailyGoal?.dayNumber || 1,
    weather
  );
  const dailyGoalTargetBuilding = CITY_BUILDINGS[dailyGoal.targetLocationId];
  const envContext = buildResidentEnvironmentalContext(
    character,
    allCharacters,
    createdObjects,
    weather,
    gameHour,
    explorerProfile.name || 'Johnny'
  );

  const quickPrompts = [
    `Hey ${firstName}! How is your Daily Goal "${dailyGoal.title}" (${Math.round(dailyGoal.progress)}%) going today, and how does it guide your decisions?`,
    `Hey ${firstName}! I love your ${wardrobe.outfitLabel}—how are you feeling about this ${weather} weather and everything around you right now?`,
    `What do you think and feel when you look across the Golden Horizon Bridge toward Neo-Horizon City?`,
    `Tell me about your passion for ${favLike.toLowerCase()} and what's happening around ${currentBuilding?.name || 'the plaza'}.`,
  ];

  // Combine character.memories with any memories recorded on chat messages so nothing is lost when separated from chat
  const chatDerivedMemories: CharacterMemory[] = messages
    .filter((m) => Boolean(m.memoryAdded))
    .map((m) => ({
      id: `chat_mem_${m.id}`,
      gameTime: m.gameTime,
      summary: m.memoryAdded as string,
      type: 'conversation' as const,
      important: true,
      involvedNames: [explorerProfile.name],
      emotionAtTime: m.emotion,
    }));

  const memoriesList: CharacterMemory[] = deduplicateCharacterMemories([
    ...(character.memories || []),
    ...chatDerivedMemories,
  ]);

  // Categorized memories & creations for the dedicated 'Memories' tab
  const residentCreations = createdObjects.filter((obj) => obj.creatorId === character.id);
  const creationMemories = memoriesList.filter(
    (m) =>
      m.type === 'creation' ||
      m.summary.toLowerCase().includes('autonomously designed and built') ||
      m.summary.toLowerCase().includes('created "')
  );
  const romanceMemories = memoriesList.filter(
    (m) =>
      m.type === 'romance' ||
      m.emotionAtTime === 'Affection' ||
      m.summary.toLowerCase().includes('romantic') ||
      m.summary.toLowerCase().includes('crush') ||
      m.summary.toLowerCase().includes('dating')
  );
  const romanticBonds = character.relationships.filter(
    (rel) =>
      (rel.romanticStage &&
        rel.romanticStage !== 'None' &&
        rel.romanticStage !== 'Not Compatible') ||
      rel.status === 'Romantic Partner' ||
      (rel.romanticInterest ?? 0) >= 25
  );
  const lifeEventMemories = memoriesList.filter(
    (m) =>
      m.type !== 'romance' &&
      m.type !== 'creation' &&
      !m.summary.toLowerCase().includes('autonomously designed and built')
  );
  const totalMemoriesBadgeCount =
    memoriesList.length + residentCreations.length + romanticBonds.length;
  const playerRel = character.playerRelationship || {
    status: 'Close Friend',
    trust: character.affinity,
    familiarity: 80,
    affection: 65,
    notes: `Trusted friend of ${explorerProfile.name}.`,
  };
  const coolingBondsCount = character.relationships.filter(
    (r) => r.needsAttention || (r.daysSinceLastInteraction ?? 0) >= 2
  ).length;
  const currentHourNormalized = ((gameHour % 24) + 24) % 24;

  // Ensure there is always at least 1 visible message in the chat stream so the chat box is never blank
  const effectiveMessages: ChatMessage[] =
    messages.length > 0
      ? messages
      : [
          {
            id: `init_welcome_${character.id}`,
            sender: 'character',
            text: `Hey ${explorerProfile.name}! I'm right here at ${currentBuilding?.name || 'the plaza'} working on "${dailyGoal.title}". Ask me anything or type a message below!`,
            gameTime: formatGameClock(gameHour),
            thought: character.currentThought,
            mood: character.currentMood,
            emotion: emotionalState.primary,
          },
        ];

  if (isPanelCollapsed) {
    return (
      <div className="fixed top-1/2 -translate-y-1/2 right-0 z-40 flex flex-col items-end gap-1 pointer-events-auto">
        <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-2xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
            title={`Expand ${character.name} Conversation Side Panel`}
          >
            <span>◂ 💬 {character.name}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-rose-500/30 border-l border-white/10 transition"
            title="Close Conversation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[90vw] max-w-[430px] sm:w-[430px] h-full z-40 flex flex-col bg-slate-900/96 backdrop-blur-xl border-l border-white/15 rounded-l-2xl shadow-2xl text-slate-100 overflow-hidden pointer-events-auto">
      {/* Header with Character Identity, Skin Tone Swatch, Voice Toggle, Collapse & EDIT Button */}
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-950/75 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-base shrink-0 shadow-md border border-white/20"
            style={{ backgroundColor: character.avatarColor }}
          >
            {character.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
            <span
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 shadow"
              style={{ backgroundColor: character.skinColor }}
              title={`Skin tone: ${character.skinColor}`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
                {character.name}
              </h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                {character.gender === 'Other / Custom' && character.customGender
                  ? character.customGender
                  : character.gender}{' '}
                · {character.age}y
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] flex-wrap">
              <span className="text-amber-300 font-medium truncate max-w-[140px] sm:max-w-[180px]">
                {character.role}
              </span>
              <span className="text-slate-500">·</span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded border text-[10px] font-semibold ${getEmotionBadgeClasses(
                  emotionalState.primary
                )}`}
              >
                ● {emotionalState.primary} ({emotionalState.intensity}%)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Voice, EDIT, Collapse to Side, Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleVoice}
            title={voiceEnabled ? 'Mute AI Voice Speech' : 'Enable AI Voice Speech'}
            className={`p-1.5 rounded-xl border text-xs transition ${
              voiceEnabled
                ? 'border-sky-400/40 bg-sky-500/20 text-sky-300'
                : 'border-white/10 bg-slate-800/70 text-slate-400 hover:text-white'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenEditor}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition active:scale-95"
            title="Edit Character Profile, Personality, Skin Tone, Gender, Emotions & Relationships"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>EDIT</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPanelCollapsed(true)}
            title="Collapse panel to side edge so the 3D world is clearly visible"
            className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-amber-300 transition"
          >
            ▸
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close character panel"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Collapsible Live Status & World Awareness Bar (Keeps Chat Area Spacious!) */}
      <div className="px-3.5 py-1.5 bg-slate-950/85 border-b border-white/10 flex flex-col gap-1.5 text-xs shrink-0">
        {/* Quick Loved One / Best Friend & Two-Place Bench Outing + Follow Bar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-white/10">
          <span className="text-[10px] font-semibold text-rose-300 flex items-center gap-1 truncate">
            <Heart className="w-3 h-3 text-rose-400 shrink-0" />
            <span>
              Loved One / Best Friend:{' '}
              <strong className="text-white">
                {getPrimaryLovedOneOrBestFriend(character, allCharacters).targetName}
              </strong>{' '}
              ({getPrimaryLovedOneOrBestFriend(character, allCharacters).relationshipLabel})
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {onToggleFollowPlayer && (
              <button
                type="button"
                onClick={onToggleFollowPlayer}
                className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition active:scale-95 ${
                  isFollowingPlayer
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-rose-200'
                }`}
                title="Have this character find you, follow alongside you, and invite you to Two-Place Benches"
              >
                {isFollowingPlayer ? '❤️ Following You' : '🚶‍♀️ Follow Me'}
              </button>
            )}
            {onStartPairOuting && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const defaultSpot: TwoPlaceSpotId =
                      character.cityId === 'city2' || character.currentPosition.x > 120
                        ? 'neo_starlight_bench'
                        : 'gemini_river_pergola';
                    onStartPairOuting(defaultSpot, 'bench');
                    onClose();
                  }}
                  className="px-2 py-0.5 rounded-md bg-gradient-to-r from-rose-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-bold text-[10px] transition active:scale-95"
                  title="Walk together and sit side-by-side on a Two-Place Bench to talk and have fun"
                >
                  🪑 Sit on Bench ❤️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaultSpot: TwoPlaceSpotId =
                      character.cityId === 'city2' || character.currentPosition.x > 120
                        ? 'neo_sakura_terrace'
                        : 'gemini_harbor_lounge';
                    onStartPairOuting(defaultSpot, 'chairs');
                    onClose();
                  }}
                  className="px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 font-bold text-[10px] transition active:scale-95"
                  title="Walk together and sit on the Two Companion Lounge Chairs"
                >
                  ☕ 2 Chairs
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onFocusLocation(character.currentLocationId)}
            className="flex items-center gap-1 text-slate-300 hover:text-amber-300 transition-colors truncate min-w-0"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate text-[11px]">
              <strong>{currentBuilding?.name}</strong> · {dailyGoal.badgeIcon}{' '}
              {Math.round(dailyGoal.progress)}%
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCity2Hub && (character.cityId === 'city2' || character.okPlan) && (
              <button
                type="button"
                onClick={onOpenCity2Hub}
                className="px-2 py-0.5 rounded-md bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[10px] transition"
              >
                🏙️ Hub &amp; Chart 📉
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsStatusExpanded((prev) => !prev)}
              className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-amber-300 font-semibold text-[10px] transition"
            >
              {isStatusExpanded ? 'Hide Details ▴' : 'Status & Actions ▾'}
            </button>
          </div>
        </div>

        {isStatusExpanded && (
          <div className="space-y-1.5 pt-1 border-t border-white/10 max-h-[28vh] overflow-y-auto">
            {/* Emotional Cause & Weather Wardrobe Bar */}
            <div className="text-[11px] text-slate-400 truncate">
              Feeling <strong className="text-slate-200">{emotionalState.primary.toLowerCase()}</strong>:{' '}
              {emotionalState.cause}
            </div>

        {/* Daily Goal & Autonomous Decision Context Pill */}
        <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/10 border border-amber-400/35 text-[11px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs shrink-0">{dailyGoal.badgeIcon}</span>
              <span className="font-bold text-amber-300 truncate">
                Daily Goal (Day {dailyGoal.dayNumber}):{' '}
                <span className="text-white">{dailyGoal.title}</span>
              </span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
                dailyGoal.completed
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  : 'bg-amber-400/20 text-amber-300 border border-amber-400/35'
              }`}
            >
              {dailyGoal.completed ? '✅ 100% DONE' : `${Math.round(dailyGoal.progress)}%`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
            <span className="truncate">
              <strong className="text-emerald-300">Autonomous Context:</strong>{' '}
              {character.decisionReason}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {onBoostDailyGoal && !dailyGoal.completed && (
                <button
                  type="button"
                  onClick={onBoostDailyGoal}
                  className="px-1.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition active:scale-95"
                  title="Help resident advance today's Daily Goal (+28%)"
                >
                  +Boost
                </button>
              )}
              {onRerollDailyGoal && (
                <button
                  type="button"
                  onClick={onRerollDailyGoal}
                  className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-amber-200 font-semibold transition active:scale-95"
                  title="Assign a new unique Daily Goal task for today"
                >
                  New Task
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat');
                  onSendMessage(
                    `Hey ${firstName}! Tell me about your Daily Goal "${dailyGoal.title}" (${Math.round(dailyGoal.progress)}% — ${dailyGoal.currentStepLabel}) and how it's guiding your autonomous decisions today!`
                  );
                }}
                className="font-bold text-amber-300 hover:text-amber-200 underline"
              >
                Ask Goal
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-white/30 shadow-xs"
              style={{ backgroundColor: wardrobe.outfitColor }}
              title={`Primary Outfit Color: ${wardrobe.outfitColor}`}
            />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30 shadow-xs"
              style={{ backgroundColor: wardrobe.accentColor }}
              title={`Accent Trim Color: ${wardrobe.accentColor}`}
            />
            <span className="text-slate-200 font-semibold truncate">
              {wardrobe.badgeIcon} Wearing: <span className="text-amber-300">{wardrobe.outfitLabel}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              onSendMessage(
                `Hey ${firstName}, tell me about your ${wardrobe.outfitLabel}, how you feel about everything around you right now, and what you think of Neo-Horizon City across the bridge!`
              );
            }}
            className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 shrink-0 underline"
          >
            Ask Outfit &amp; World
          </button>
        </div>

        {/* Second City (Neo-Horizon) Groq Brain, OK-Plan, Love Co-Working & Dream Cruiser Bar */}
        {(character.cityId === 'city2' || character.okPlan || character.romanticPartnerId) && (
          <div className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/15 via-slate-900 to-fuchsia-500/15 border border-cyan-400/40 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono font-bold text-[10px]">
                  🧠 {character.groqConfig?.modelId || character.groqConfig?.modelTier || 'Groq LPU'}
                </span>
                {character.romanticPartnerId && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold text-[10px] truncate">
                    ❤️ Co-Working w/{' '}
                    {allCharacters.find((c) => c.id === character.romanticPartnerId)?.name ||
                      character.romanticPartnerId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onApproveOkPlan && (
                  <button
                    type="button"
                    onClick={onApproveOkPlan}
                    className={`px-2 py-0.5 rounded font-bold text-[10px] transition ${
                      character.okPlan?.approvedByPlayer ||
                      character.okPlan?.status === 'approved' ||
                      character.okPlan?.status === 'active'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                        : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                    }`}
                  >
                    {character.okPlan?.approvedByPlayer ||
                    character.okPlan?.status === 'approved' ||
                    character.okPlan?.status === 'active'
                      ? '✅ OK-Plan Active'
                      : '👍 OK Plan'}
                  </button>
                )}
                {onLaunchGeminiCarTrip && character.cityId === 'city2' && (
                  <button
                    type="button"
                    onClick={onLaunchGeminiCarTrip}
                    className="px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-bold text-[10px] transition"
                    title="Send on Daytime Dream Cruiser Car Trip to Gemini City (returns before night)"
                  >
                    🚗 Car Trip
                  </button>
                )}
                {onOpenCity2Hub && (
                  <button
                    type="button"
                    onClick={onOpenCity2Hub}
                    className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[10px] transition"
                  >
                    🏙️ City 2 Hub &amp; Chart 📉
                  </button>
                )}
              </div>
            </div>

            {character.okPlan && (() => {
              const steps = Array.isArray(character.okPlan.steps) ? character.okPlan.steps : [];
              const firstIncompleteIdx = steps.findIndex(
                (s) => typeof s === 'object' && s !== null && !s.completed
              );
              const stepIdx =
                typeof character.okPlan.currentStepIndex === 'number'
                  ? character.okPlan.currentStepIndex
                  : firstIncompleteIdx !== -1
                  ? firstIncompleteIdx
                  : 0;
              const rawStep = steps[stepIdx] || steps[0];
              const stepLabel =
                typeof rawStep === 'string'
                  ? rawStep
                  : rawStep && typeof rawStep === 'object' && 'label' in rawStep
                  ? String(rawStep.label)
                  : '';
              const planTitle = character.okPlan.planTitle || character.okPlan.title || 'Daily Plan';
              return (
                <div className="text-[10px] text-slate-300 truncate">
                  <strong className="text-emerald-300">OK-Plan:</strong> {planTitle} — Step{' '}
                  {Math.min(steps.length || 1, stepIdx + 1)}/{Math.max(1, steps.length)}:{' '}
                  {stepLabel}
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {character.personality.map((trait, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium text-amber-200 whitespace-nowrap"
            >
              {trait}
            </span>
          ))}
        </div>

        {/* Emotes, Accessible House & Autonomous AI Creation Controls */}
        <div className="pt-1.5 border-t border-white/10 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {onSendHome && (
              <button
                type="button"
                onClick={onSendHome}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-semibold whitespace-nowrap transition active:scale-95"
                title={`Send ${character.name} inside their own house (${homeBuilding?.name})`}
              >
                <Home className="w-3 h-3 text-emerald-300" />
                <span>
                  {character.isInsideHouse && character.currentLocationId === character.homeId
                    ? `Inside ${homeBuilding?.name.split(' ')[0] || 'Home'} 🏠`
                    : `Go to Own House 🏠`}
                </span>
              </button>
            )}

            {onTriggerAutonomousCreate && (
              <button
                type="button"
                onClick={onTriggerAutonomousCreate}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-semibold whitespace-nowrap transition active:scale-95"
                title={`Let ${character.name} think on their own and create a 3D object in the city`}
              >
                <Wand2 className="w-3 h-3 text-amber-300" />
                <span>Think & Create Object ✨</span>
              </button>
            )}
          </div>

          {onTriggerEmote && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {EMOTE_CATALOG.map((em) => {
                const isDoingThis =
                  character.activeEmote?.type === em.type &&
                  character.activeEmote.expiresAt > Date.now();
                return (
                  <button
                    key={em.type}
                    type="button"
                    onClick={() => onTriggerEmote(em.type)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap transition active:scale-95 ${
                      isDoingThis
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/15'
                    }`}
                    title={`${character.name}: ${em.bubbleHint}`}
                  >
                    {em.badge}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-5 border-b border-white/10 bg-slate-900/80 text-xs font-medium shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            activeTab === 'chat'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('social')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            activeTab === 'social'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Bonds</span>
          {coolingBondsCount > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-rose-500/25 text-rose-300 text-[10px] font-mono"
              title={`${coolingBondsCount} bond(s) cooling from lack of interaction`}
            >
              ⏳{coolingBondsCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('memories')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            activeTab === 'memories'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Memories</span>
          {totalMemoriesBadgeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono">
              {totalMemoriesBadgeCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('routine')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            activeTab === 'routine'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Routine</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
        {/* TAB 1: CHAT */}
        {activeTab === 'chat' && (
          <>
            <div className="px-3 py-2 rounded-xl bg-slate-950/75 border border-white/10 text-[11px] text-slate-300 flex items-center justify-between gap-2">
              <span className="truncate">
                💭 <em className="text-slate-200">“{character.currentThought}”</em>
              </span>
              <button
                type="button"
                onClick={() => speakCharacterLine(character, character.currentThought, true)}
                className="inline-flex items-center gap-1 text-sky-300 hover:underline shrink-0"
              >
                <Volume2 className="w-3 h-3" />
                <span>Voice</span>
              </button>
            </div>

            <div className="space-y-3">
              {effectiveMessages.map((msg, msgIdx) => {
                const isPlayer = msg.sender === 'player';
                return (
                  <div
                    key={`${msg.id}_${msgIdx}`}
                    className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                      <span>{isPlayer ? explorerProfile.name : character.name}</span>
                      <span>·</span>
                      <span>{msg.gameTime}</span>
                      {!isPlayer && msg.emotion && (
                        <span className="text-amber-300 font-medium">· {msg.emotion}</span>
                      )}
                      {!isPlayer && (
                        <button
                          type="button"
                          onClick={() => speakCharacterLine(character, msg.text, true)}
                          className="text-sky-400 hover:text-sky-300 ml-1"
                          title="Speak this reply"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isPlayer
                          ? 'bg-amber-400 text-slate-950 font-medium rounded-br-xs'
                          : 'bg-slate-800/95 text-slate-100 border border-white/10 rounded-bl-xs'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>

                    {!isPlayer && msg.thought && (
                      <div className="mt-1 px-2 text-[11px] text-slate-400 italic max-w-[85%]">
                        Inner thought: “{msg.thought}”
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-amber-300 py-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>{character.name} is thinking and responding...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}

        {/* TAB 2: FULL CHARACTER PROFILE & EMOTIONAL LIFE */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-400/30 p-3">
              <div>
                <div className="text-xs font-bold text-amber-300">Complete Character Profile</div>
                <div className="text-[11px] text-slate-300">
                  Tap EDIT anytime to customize {character.name}'s identity, emotion, or bonds.
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenEditor}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Dynamic Emotional State & World Awareness Card */}
            <div className="rounded-xl bg-slate-950/80 border border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Current Emotional State
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getEmotionBadgeClasses(
                    emotionalState.primary
                  )}`}
                >
                  {emotionalState.primary} · {emotionalState.intensity}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${emotionalState.intensity}%` }}
                />
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                <strong>Cause:</strong> {emotionalState.cause}
              </p>
              {character.decisionReason && (
                <p className="text-[11px] text-slate-400 border-t border-white/10 pt-2">
                  <strong>Autonomous Decision:</strong> {character.decisionReason}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-slate-400">Energy</div>
                  <div className="font-mono font-bold text-emerald-300">
                    {Math.round(character.needs.energy)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-slate-400">Social</div>
                  <div className="font-mono font-bold text-sky-300">
                    {Math.round(character.needs.social)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-slate-400">Inspiration</div>
                  <div className="font-mono font-bold text-amber-300">
                    {Math.round(character.needs.inspiration)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Weather-Adaptive Wardrobe & Omniscient Surroundings Card */}
            <div className="rounded-xl bg-slate-950/80 border border-cyan-400/30 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold uppercase tracking-wider text-cyan-300">
                  {wardrobe.badgeIcon} Weather Wardrobe &amp; World Awareness
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: wardrobe.outfitColor }}
                    title={wardrobe.colorName}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: wardrobe.accentColor }}
                  />
                  <span className="text-[11px] font-semibold text-amber-300">
                    {wardrobe.colorName}
                  </span>
                </div>
              </div>
              <p className="text-slate-200 leading-relaxed">
                <strong>Current Outfit ({getWeatherLabel(weather)}):</strong> {wardrobe.outfitLabel} —{' '}
                <span className="text-slate-300">{wardrobe.feeling}</span>
              </p>
              <p className="text-slate-300 leading-relaxed border-t border-white/10 pt-2">
                <strong>Surroundings &amp; Feelings:</strong> {envContext.surroundingsSummary}{' '}
                {envContext.feelingsAboutSurroundings}
              </p>
              <p className="text-cyan-200/90 leading-relaxed border-t border-white/10 pt-2">
                <strong>🌉 Neo-Horizon Second City Reflection:</strong>{' '}
                {envContext.secondCityReflection}
              </p>
            </div>

            {/* Key Attributes Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Full Name
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block">{character.name}</span>
              </div>
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Gender & Age
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {character.gender === 'Other / Custom' && character.customGender
                    ? character.customGender
                    : character.gender}{' '}
                  · {character.age} yrs
                </span>
              </div>
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Occupation / Role
                </span>
                <span className="text-xs font-semibold text-amber-300 mt-0.5 block">
                  {character.role}
                </span>
              </div>
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Current Location & Mood
                </span>
                <span className="text-xs font-semibold text-emerald-300 mt-0.5 block">
                  {currentBuilding?.name} · {character.currentMood}
                </span>
              </div>
            </div>

            {/* Personality Traits */}
            <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Personality Traits
                </span>
                <span className="text-[11px] text-amber-300 capitalize">
                  {character.temperament} temperament
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {character.personality.map((trait, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-xs font-medium text-amber-200"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* Likes & Dislikes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/25 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Likes</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-200">
                  {(character.likes && character.likes.length > 0
                    ? character.likes
                    : character.interests
                  ).map((like, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{like}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-rose-950/20 border border-rose-500/25 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Dislikes</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-200">
                  {(character.dislikes && character.dislikes.length > 0
                    ? character.dislikes
                    : ['Dishonesty', 'Rushed routines']
                  ).map((dislike, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>{dislike}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Interests */}
            <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3.5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Interests & Passions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {character.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/30 text-xs text-sky-200"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* TODAY'S UNIQUE DAILY GOAL & AUTONOMOUS DECISION CONTEXT CARD */}
            <div className="rounded-xl bg-gradient-to-br from-amber-500/15 via-slate-950 to-emerald-500/15 border border-amber-400/45 p-3.5 space-y-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Today’s Unique Daily Goal · Day {dailyGoal.dayNumber} ({dailyGoal.category})
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                    <span>{dailyGoal.badgeIcon}</span>
                    <span>{dailyGoal.title}</span>
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs shrink-0 ${
                    dailyGoal.completed
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/45'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {dailyGoal.completed ? '✅ Completed' : `${Math.round(dailyGoal.progress)}%`}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">{dailyGoal.description}</p>

              {/* Progress Bar & Current Step Milestone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-200">{dailyGoal.currentStepLabel}</span>
                  <button
                    type="button"
                    onClick={() => onFocusLocation(dailyGoal.targetLocationId)}
                    className="inline-flex items-center gap-1 text-emerald-300 hover:underline font-medium"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Target: {dailyGoalTargetBuilding?.name}</span>
                  </button>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      dailyGoal.completed
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                        : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.round(dailyGoal.progress))}%` }}
                  />
                </div>
              </div>

              {/* Autonomous Decision Context Explanation */}
              <div className="p-2.5 rounded-lg bg-slate-950/85 border border-white/10 space-y-1 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  Autonomous Decision Context (Why {firstName} Chooses Actions)
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {dailyGoal.autonomousContextReason}
                </p>
                <div className="pt-1 border-t border-white/10 text-[11px] text-emerald-300">
                  <strong>Live Decision Reason:</strong> {character.decisionReason}
                </div>
              </div>

              {/* Interactive Daily Goal Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {onBoostDailyGoal && !dailyGoal.completed && (
                  <button
                    type="button"
                    onClick={onBoostDailyGoal}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition active:scale-95"
                  >
                    ⚡ Help Advance Goal (+28%)
                  </button>
                )}
                {onRerollDailyGoal && (
                  <button
                    type="button"
                    onClick={onRerollDailyGoal}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-amber-200 font-semibold text-xs transition active:scale-95"
                  >
                    🔄 Assign New Daily Task
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('chat');
                    onSendMessage(
                      `Hey ${firstName}! How is your Daily Goal "${dailyGoal.title}" (${Math.round(dailyGoal.progress)}%) going at ${dailyGoalTargetBuilding?.name}, and how is it shaping your decisions today?`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-200 font-semibold text-xs transition active:scale-95"
                >
                  💬 Discuss in Chat
                </button>
              </div>
            </div>

            {/* Family & Important Connections */}
            <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3.5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Close Friends, Family & Connections
              </span>
              <div className="space-y-1.5 text-xs text-slate-200">
                {(character.familyConnections || []).map((conn, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 leading-relaxed"
                  >
                    {conn}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RELATIONSHIPS, FRIENDSHIPS & ROMANCE */}
        {activeTab === 'social' && (
          <div className="space-y-4">
            {/* Subtle Friendship Decay & Bond Maintenance Banner */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-400/35 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bond Maintenance &amp; Friendship Decay (Day {dayNumber})</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    coolingBondsCount > 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  }`}
                >
                  {coolingBondsCount > 0
                    ? `⏳ ${coolingBondsCount} Cooling Bond${coolingBondsCount > 1 ? 's' : ''}`
                    : '✨ All Bonds Fresh'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Affinity subtly decreases (<strong>-1% to -2%/day</strong>) if residents haven’t
                interacted for <strong>2+ game days</strong>. Residents autonomously prioritize
                reconnecting with cooling friends, or you can trigger a catch-up below for a{' '}
                <strong className="text-emerald-300">+5% Reconnection Bonus</strong>!
              </p>
            </div>

            {/* Relationship with the Player (Johnny) */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Relationship with {explorerProfile.name} (You)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {playerRel.needsAttention || (playerRel.daysSinceLastInteraction ?? 0) >= 2 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10px] font-semibold">
                      ⏳ {playerRel.daysSinceLastInteraction ?? 2}d apart (-
                      {playerRel.lastDecayAmount || 1}%)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-[10px] font-semibold">
                      ✨ Fresh Bond
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">
                    {playerRel.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Trust</span>
                    <span className="font-mono text-amber-300">{playerRel.trust}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${playerRel.trust}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Familiarity</span>
                    <span className="font-mono text-sky-300">{playerRel.familiarity}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${playerRel.familiarity}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Affection</span>
                    <span className="font-mono text-pink-300">
                      {playerRel.affection ?? playerRel.trust}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-400 rounded-full"
                      style={{ width: `${playerRel.affection ?? playerRel.trust}%` }}
                    />
                  </div>
                </div>
              </div>

              {playerRel.notes && (
                <p className="text-xs text-slate-200 leading-relaxed pt-1 border-t border-white/10">
                  {playerRel.notes}
                </p>
              )}
            </div>

            {nearbyResident && onTriggerSocialWithNearby && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-semibold text-emerald-300">
                    {nearbyResident.name} is nearby!
                  </div>
                  <div className="text-slate-400">
                    Have {firstName} & {nearbyResident.name.split(' ')[0]} approach and talk
                    together
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTriggerSocialWithNearby(nearbyResident.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs shrink-0 transition-colors"
                >
                  Talk Together
                </button>
              </div>
            )}

            {/* Relationships with Other Characters (Including Romantic Stage & Memories) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-400">
                  Relationships & Romance with Residents (Tap to Switch)
                </h3>
                <button
                  type="button"
                  onClick={onOpenEditor}
                  className="text-xs text-amber-300 hover:underline"
                >
                  Edit Bonds
                </button>
              </div>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {character.relationships.map((rel, relIdx) => {
                  const targetChar = allCharacters.find((c) => c.id === rel.targetId);
                  const romStage = rel.romanticStage || 'None';
                  const hasRomanticSpark =
                    romStage !== 'None' && romStage !== 'Not Compatible';
                  const daysApart = rel.daysSinceLastInteraction ?? 0;
                  const isCooling = Boolean(rel.needsAttention || daysApart >= 2);
                  return (
                    <div
                      key={`${rel.targetId}_${relIdx}`}
                      className="w-full py-3 flex flex-col gap-2 text-left hover:bg-white/5 transition-colors px-2 rounded-lg"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCharacter(rel.targetId);
                              setActiveTab('chat');
                            }}
                            className="flex items-center gap-2 min-w-0 flex-wrap text-left hover:underline"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: targetChar?.avatarColor || '#FBBF24' }}
                            />
                            <span className="text-sm font-semibold text-white truncate">
                              {targetChar?.name || rel.targetName}
                            </span>
                            <span className="text-xs font-semibold text-amber-300 shrink-0">
                              {rel.status}
                            </span>
                            {hasRomanticSpark && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-[10px] font-bold text-pink-300">
                                ♥ {romStage}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCooling ? (
                              <span
                                className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[10px] font-semibold"
                                title={`Haven't interacted for ${Math.max(2, daysApart)} game days (-${rel.lastDecayAmount || 1}% affinity decay)`}
                              >
                                ⏳ {Math.max(2, daysApart)}d apart (-{rel.lastDecayAmount || 1}%)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-medium">
                                ✨ {daysApart === 0 ? 'Talked Today' : '1d ago'}
                              </span>
                            )}
                            <span className="text-xs font-mono text-emerald-400">
                              {rel.affinity}% Bond
                            </span>
                          </div>
                        </div>

                        {rel.howWeMet && (
                          <p className="text-[11px] text-slate-400 italic">
                            How they met: {rel.howWeMet}
                          </p>
                        )}

                        <p className="text-xs text-slate-200 leading-relaxed">
                          {rel.lastInteractionSummary}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {rel.sharedInterests && rel.sharedInterests.length > 0 && (
                              <span>Shared: {rel.sharedInterests.join(', ')}</span>
                            )}
                            {(rel.romanticInterest ?? 0) > 20 && (
                              <span className="text-pink-300 font-mono">
                                · Affection: {rel.romanticInterest}%
                              </span>
                            )}
                          </div>
                          {onTriggerSocialWithNearby && (
                            <button
                              type="button"
                              onClick={() => onTriggerSocialWithNearby(rel.targetId)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 ${
                                isCooling
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs'
                                  : 'bg-white/10 hover:bg-white/20 text-emerald-300'
                              }`}
                            >
                              {isCooling ? '🤝 Reconnect (+5%)' : '💬 Talk Together'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEDICATED MEMORIES TAB (Life Events, Romance Milestones & Autonomous Creations) */}
        {activeTab === 'memories' && (
          <div className="space-y-4">
            {/* Overview Header & Quick Filter Bar */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-amber-400" />
                    <span>{firstName}’s Memory Archive</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Important life events, romance milestones & autonomous 3D creations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenEditor}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 text-[11px] font-semibold shrink-0 transition"
                >
                  + Add Memory
                </button>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                {(
                  [
                    { id: 'all', label: 'All', count: totalMemoriesBadgeCount },
                    { id: 'events', label: 'Life Events', count: lifeEventMemories.length },
                    {
                      id: 'romance',
                      label: 'Romance',
                      count: romanticBonds.length + romanceMemories.length,
                    },
                    {
                      id: 'creations',
                      label: 'Creations',
                      count: residentCreations.length + creationMemories.length,
                    },
                    { id: 'goals', label: 'Goals', count: character.goals.length },
                  ] as { id: MemoryFilter; label: string; count: number }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMemoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 transition ${
                      memoryFilter === tab.id
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1 rounded text-[10px] font-mono ${
                        memoryFilter === tab.id
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 1: AUTONOMOUS CREATIONS */}
            {(memoryFilter === 'all' || memoryFilter === 'creations') && (
              <div className="rounded-xl bg-slate-950/70 border border-amber-400/25 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Autonomous Creations ({residentCreations.length})
                    </span>
                  </h4>
                  {onTriggerAutonomousCreate && (
                    <button
                      type="button"
                      onClick={onTriggerAutonomousCreate}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition active:scale-95"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Create New ✨</span>
                    </button>
                  )}
                </div>

                {residentCreations.length === 0 && creationMemories.length === 0 ? (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-400 flex items-center justify-between gap-2">
                    <span>
                      {firstName} hasn’t built a 3D creation yet. Let them think and invent one!
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {residentCreations.map((obj) => {
                      const bld = CITY_BUILDINGS[obj.locationId];
                      return (
                        <div
                          key={obj.id}
                          className="p-3 rounded-xl bg-slate-900/90 border border-amber-400/30 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                                style={{ backgroundColor: obj.primaryColor }}
                              />
                              <span className="text-xs font-bold text-white truncate">
                                {obj.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-300 shrink-0">
                              {obj.createdAtTime}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 italic leading-relaxed">
                            “{obj.thoughtSummary}”
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                            <span>Near {bld?.name || 'Gemini Plaza'}</span>
                            {onFocusCreatedObject && (
                              <button
                                type="button"
                                onClick={() => onFocusCreatedObject(obj)}
                                className="text-amber-300 hover:underline font-semibold flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Focus in 3D</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {creationMemories.map((mem, idx) => (
                      <div
                        key={`${mem.id}_${idx}`}
                        className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                          <span>{mem.gameTime} · Creation Log</span>
                          <span>✨ Invention</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{mem.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: ROMANCE MILESTONES */}
            {(memoryFilter === 'all' || memoryFilter === 'romance') && (
              <div className="rounded-xl bg-slate-950/70 border border-pink-400/25 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    <span>
                      Romance Milestones ({romanticBonds.length + romanceMemories.length})
                    </span>
                  </h4>
                  {playerRel.status === 'Romantic Partner' && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-[10px] font-bold text-pink-300">
                      ♥ Partner with {explorerProfile.name}
                    </span>
                  )}
                </div>

                {/* Active Romantic Bonds */}
                {romanticBonds.length > 0 && (
                  <div className="space-y-2">
                    {romanticBonds.map((rel) => {
                      const partner = allCharacters.find((c) => c.id === rel.targetId);
                      return (
                        <div
                          key={rel.targetId}
                          className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-400/30 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onSelectCharacter(rel.targetId)}
                              className="flex items-center gap-2 text-xs font-bold text-white hover:text-pink-200 transition"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: partner?.avatarColor || '#F472B6' }}
                              />
                              <span>{partner?.name || rel.targetName}</span>
                            </button>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/25 border border-pink-400/40 text-[10px] font-bold text-pink-200">
                                ♥ {rel.romanticStage && rel.romanticStage !== 'None' ? rel.romanticStage : rel.status}
                              </span>
                              <span className="text-[11px] font-mono text-pink-300">
                                {rel.romanticInterest ?? rel.affinity}% Affection
                              </span>
                            </div>
                          </div>
                          {rel.howWeMet && (
                            <p className="text-[11px] text-pink-200/80 italic">
                              Origin: {rel.howWeMet}
                            </p>
                          )}
                          <p className="text-xs text-slate-200 leading-relaxed">
                            {rel.lastInteractionSummary}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Chronological Romance Memories */}
                {romanceMemories.length > 0 ? (
                  <div className="space-y-2">
                    {romanceMemories.map((mem, idx) => (
                      <div
                        key={`${mem.id}_${idx}`}
                        className="p-2.5 rounded-lg bg-rose-950/30 border border-pink-400/25 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-pink-300">
                          <span>
                            {mem.gameTime} · Romance Milestone
                            {mem.emotionAtTime ? ` (${mem.emotionAtTime})` : ''}
                          </span>
                          {mem.important && (
                            <span className="inline-flex items-center gap-1 font-sans font-semibold text-pink-300">
                              <Pin className="w-3 h-3" /> Milestone
                            </span>
                          )}
                        </div>
                        <p className="text-slate-100 leading-relaxed">{mem.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  romanticBonds.length === 0 && (
                    <p className="text-xs text-slate-400 italic">
                      No romance milestones recorded yet—sparks grow naturally as residents spend time together!
                    </p>
                  )
                )}
              </div>
            )}

            {/* SECTION 3: IMPORTANT LIFE EVENTS & CORE MEMORIES */}
            {(memoryFilter === 'all' || memoryFilter === 'events') && (
              <div className="rounded-xl bg-slate-950/70 border border-emerald-400/25 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Important Life Events ({lifeEventMemories.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={onOpenEditor}
                    className="text-[11px] text-amber-300 hover:underline"
                  >
                    + Pin Event
                  </button>
                </div>

                {lifeEventMemories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No life events recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {lifeEventMemories.map((mem: CharacterMemory, memIdx: number) => (
                      <div key={`${mem.id}_${memIdx}`} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-mono tabular-nums">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{mem.gameTime}</span>
                            <span>·</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] capitalize font-sans font-semibold ${
                                mem.type === 'promise'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : mem.type === 'conflict'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : mem.type === 'event' || mem.type === 'social'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {mem.type === 'conversation'
                                ? 'Life Moment'
                                : mem.type === 'social'
                                ? 'Social Event'
                                : mem.type}
                            </span>
                            {mem.emotionAtTime && (
                              <span className="text-[10px] font-sans text-slate-300">
                                ({mem.emotionAtTime})
                              </span>
                            )}
                          </div>
                          {mem.important && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-amber-300">
                              <Pin className="w-3 h-3" /> Important
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 leading-relaxed">{mem.summary}</p>
                        {mem.involvedNames && mem.involvedNames.length > 0 && (
                          <div className="text-[10px] text-slate-400">
                            With: <span className="text-slate-300">{mem.involvedNames.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: PERSONAL GOALS & AMBITIONS */}
            {(memoryFilter === 'all' || memoryFilter === 'goals') && (
              <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>Personal Goals & Ambitions ({character.goals.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={onOpenEditor}
                    className="text-[11px] text-amber-300 hover:underline"
                  >
                    + Edit Goals
                  </button>
                </div>
                <div className="space-y-3">
                  {character.goals.map((goal, goalIdx) => (
                    <div
                      key={`${goal.id}_${goalIdx}`}
                      className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
                        <span>{goal.title}</span>
                        <span className="font-mono tabular-nums text-amber-300">
                          {goal.progress}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-300"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{goal.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ROUTINE */}
        {activeTab === 'routine' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-slate-300">
              <div>
                Home Residence:{' '}
                <button
                  type="button"
                  onClick={() => onFocusLocation(character.homeId)}
                  className="font-semibold text-amber-300 hover:underline"
                >
                  {homeBuilding?.name}
                </button>
              </div>
              <div className="mt-1 text-slate-400">
                Current City Time:{' '}
                <strong className="font-mono text-white">{formatGameClock(gameHour)}</strong>
              </div>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {character.routines.map((step: RoutineStep, idx: number) => {
                const isCurrent =
                  step.startHour < step.endHour
                    ? currentHourNormalized >= step.startHour &&
                      currentHourNormalized < step.endHour
                    : currentHourNormalized >= step.startHour ||
                      currentHourNormalized < step.endHour;
                const b = CITY_BUILDINGS[step.locationId];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onFocusLocation(step.locationId)}
                    className={`w-full py-3 px-2.5 text-left flex items-start justify-between gap-3 transition-colors rounded-lg ${
                      isCurrent ? 'bg-amber-400/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono tabular-nums font-semibold text-amber-300">
                          {String(step.startHour).padStart(2, '0')}:00 –{' '}
                          {String(step.endHour).padStart(2, '0')}:00
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-white font-medium truncate">{b?.name}</span>
                        {isCurrent && (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            · Active Now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{step.activity}</p>
                      <p className="text-[11px] text-slate-400 italic">“{step.thought}”</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Chat Input Footer when on Chat Tab */}
      {activeTab === 'chat' && (
        <div
          className="p-2.5 sm:p-3 bg-slate-950/95 border-t border-white/10 space-y-2 shrink-0"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        >
          {/* Compact 1-line horizontal scrollable starter prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(prompt)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-slate-200 whitespace-nowrap transition shrink-0"
              >
                💬 {prompt.slice(0, 46)}...
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              autoComplete="off"
              placeholder={`Type a message to ${firstName}...`}
              className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-slate-900 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label="Send message"
              className="min-w-[44px] min-h-[42px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-semibold text-sm flex items-center justify-center gap-1 transition-transform active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
