import React, { useState } from 'react';
import {
  Brain,
  Car,
  CheckCircle2,
  Database,
  Heart,
  Home,
  MessageSquare,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { CITY_BUILDINGS, isCity2Character } from '../data/cityData';
import {
  AICharacter,
  BuildingId,
  ChatMessage,
  ResidentGroqConfig,
} from '../types/game';

interface City2GroqHubModalProps {
  isOpen: boolean;
  characters: AICharacter[];
  chatHistories: Record<string, ChatMessage[]>;
  gameHour: number;
  dayNumber: number;
  city2DbLastSynced: string | null;
  onClose: () => void;
  onSelectCharacter: (charId: string) => void;
  onFocusLocation: (buildingId: BuildingId) => void;
  onApproveOkPlan: (charId: string, customTitle?: string, customObjective?: string) => void;
  onAdvanceOkPlanStep: (charId: string) => void;
  onGenerateNewOkPlan: (charId: string) => void;
  onLinkRomanticCoWorkers: (charAId: string, charBId: string, workLocationId: BuildingId) => void;
  onUnlinkRomanticCoWorkers: (charId: string) => void;
  onTriggerFriendChartTalk: (charAId: string, charBId: string) => void;
  onSendDirectMessage?: (charId: string, text: string) => void;
  isSendingChat?: boolean;
  onLaunchGeminiCarTrip: (charId?: string) => void;
  onReturnCarTripBeforeNight: () => void;
  onSynthesizeNewDream: (charId: string) => void;
  onUpdateGroqConfig: (charId: string, config: ResidentGroqConfig) => void;
  onSyncCity2DatabaseNow: () => void;
}

type HubTab =
  | 'npcs_houses'
  | 'ok_plan'
  | 'love_cowork'
  | 'friend_chart'
  | 'dreams_car'
  | 'groq_database';

const GROQ_MODELS: { id: ResidentGroqConfig['modelTier']; label: string; badge: string }[] = [
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
    badge: 'Fast Strategic & Social',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    label: 'DeepSeek R1 Distill Llama 70B',
    badge: 'Deep Chain-of-Thought',
  },
  {
    id: 'qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B Instruct',
    badge: 'Creative & Expressive',
  },
  {
    id: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B 32K',
    badge: '32K Long-Context Memory',
  },
  {
    id: 'gemma2-9b-it',
    label: 'Gemma 2 9B Instruct',
    badge: 'Ultra-Low Latency LPU',
  },
];

export const City2GroqHubModal: React.FC<City2GroqHubModalProps> = ({
  isOpen,
  characters,
  chatHistories,
  gameHour,
  dayNumber,
  city2DbLastSynced,
  onClose,
  onSelectCharacter,
  onFocusLocation,
  onApproveOkPlan,
  onAdvanceOkPlanStep,
  onGenerateNewOkPlan,
  onLinkRomanticCoWorkers,
  onUnlinkRomanticCoWorkers,
  onTriggerFriendChartTalk,
  onSendDirectMessage,
  isSendingChat = false,
  onLaunchGeminiCarTrip,
  onReturnCarTripBeforeNight,
  onSynthesizeNewDream,
  onUpdateGroqConfig,
  onSyncCity2DatabaseNow,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>('npcs_houses');
  const city2Chars = characters.filter((c) => isCity2Character(c.id) || c.cityId === 'city2');
  const [focusedCharId, setFocusedCharId] = useState<string>('alie');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('iysha');
  const [selectedWorkLoc, setSelectedWorkLoc] = useState<BuildingId>('alie_villa');
  const [customPlanTitle, setCustomPlanTitle] = useState<string>('');
  const [customPlanObjective, setCustomPlanObjective] = useState<string>('');
  const [hubChatInput, setHubChatInput] = useState<string>('');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  if (!isOpen) return null;

  if (isPanelCollapsed) {
    return (
      <div className="fixed top-1/2 -translate-y-1/2 right-0 z-40 flex flex-col items-end gap-1 pointer-events-auto">
        <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-cyan-400/50 rounded-l-2xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="px-3 py-2.5 text-xs font-bold text-cyan-300 hover:bg-white/10 flex items-center gap-1.5 transition"
            title="Expand City 2 AI Hub Side Panel"
          >
            <span>◂ 🏙️🧠 City 2 AI Hub</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-rose-500/30 border-l border-white/10 transition"
            title="Close City 2 Hub"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const focusedChar = city2Chars.find((c) => c.id === focusedCharId) || city2Chars[0];
  const normalizedHour = ((gameHour % 24) + 24) % 24;
  const isDaytimeWindow = normalizedHour >= 9 && normalizedHour < 18;

  const totalSavedMessages = city2Chars.reduce(
    (acc, c) => acc + (chatHistories[c.id]?.length || 0),
    0
  );
  const totalMemories = city2Chars.reduce((acc, c) => acc + (c.memories?.length || 0), 0);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[92vw] sm:w-[480px] md:w-[560px] h-full flex pointer-events-auto">
      <div className="relative w-full h-full bg-slate-950/96 backdrop-blur-xl border-l border-cyan-400/40 rounded-l-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-cyan-500/20 via-slate-900 to-fuchsia-500/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-slate-950 font-display font-black text-sm flex items-center justify-center shadow-lg shrink-0">
              C2
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-display text-sm sm:text-base font-extrabold text-white truncate">
                  Second City · Groq AI Hub 🧠
                </h2>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-400/20 border border-cyan-400/40 text-cyan-300">
                  5 GROQ NPCs · CITY 2 DB
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                Alie, Joseph, Iysha, Amie &amp; Hawa · OK-Plan · Love &amp; Work · Friend Chart 📉
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-cyan-300 transition"
              title="Collapse panel to side edge so the 3D world is clearly visible"
            >
              ▸
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition shrink-0"
              title="Close Second City Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-slate-900/80 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'npcs_houses', label: '🏠 5 NPCs & Houses', icon: Home },
              { id: 'ok_plan', label: '✅ OK-Plan & Frontend Plan', icon: CheckCircle2 },
              { id: 'love_cowork', label: '❤️ Love & Work Together', icon: Heart },
              { id: 'friend_chart', label: '📉 Friend Chart', icon: TrendingUp },
              { id: 'dreams_car', label: '🚗 Dreams & Car to Gemini City', icon: Car },
              { id: 'groq_database', label: '🗄️ City 2 AI Database', icon: Database },
            ] as { id: HubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
                  active
                    ? 'bg-gradient-to-r from-cyan-400 to-fuchsia-400 text-slate-950 shadow-md'
                    : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Resident Selector Bar */}
        {focusedChar && (
          <div className="px-4 py-2.5 bg-slate-950/90 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                City 2 Resident:
              </span>
              {city2Chars.map((c) => {
                const isSel = c.id === focusedChar.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFocusedCharId(c.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isSel
                        ? 'bg-cyan-400 text-slate-950 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.avatarColor }}
                    />
                    <span>{c.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({c.gender === 'Male' ? 'Man' : 'Woman'})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFocusLocation(focusedChar.homeId);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-cyan-300 flex items-center gap-1 transition"
              >
                <Home className="w-3 h-3" />
                <span>Visit {CITY_BUILDINGS[focusedChar.homeId]?.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectCharacter(focusedChar.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 transition"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Chat with {focusedChar.name}</span>
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB 1: 5 GROQ NPCs & THEIR 5 BESPOKE HOUSES */}
          {activeTab === 'npcs_houses' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-slate-900 to-fuchsia-500/15 border border-cyan-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    🏙️ 5 Second City (Neo-Horizon) Groq AI Residents &amp; Bespoke 3D Houses
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Each resident has a unique Groq LPU personality, temperament, 3D furnished home
                    with roof cutaway, love &amp; co-working behavior, and daytime car trips to
                    Gemini City.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSyncCity2DatabaseNow}
                  className="px-3 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Save City 2 DB Now</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {city2Chars.map((c, idx) => {
                  const house = CITY_BUILDINGS[c.homeId];
                  const partner = c.romanticPartnerId
                    ? characters.find((p) => p.id === c.romanticPartnerId)
                    : null;
                  const msgCount = (chatHistories[c.id] || []).length;
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-cyan-400/40 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-display font-bold text-base shadow-md shrink-0"
                            style={{ backgroundColor: c.avatarColor }}
                          >
                            {idx + 1}. {c.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-display text-sm font-bold text-white">
                                {idx + 1}. {c.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-cyan-200">
                                {c.gender === 'Male' ? 'Man' : 'Woman'} · {c.age}y
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-400/30 text-[10px] font-mono text-fuchsia-200">
                                {c.modelBadge}
                              </span>
                            </div>
                            <p className="text-xs text-amber-300 font-medium mt-0.5">{c.role}</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{c.bio}</p>

                      {/* Personality Pills */}
                      <div className="flex flex-wrap gap-1">
                        {c.personality.map((trait) => (
                          <span
                            key={trait}
                            className="px-2 py-0.5 rounded-md bg-slate-950 border border-white/10 text-[10px] font-medium text-slate-200"
                          >
                            ✨ {trait}
                          </span>
                        ))}
                      </div>

                      {/* Bespoke House Info */}
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-400/25 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                            <Home className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{house?.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {house?.subtitle} · Currently: {c.currentActivity}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onFocusLocation(c.homeId);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-[10px] font-bold shrink-0 transition"
                        >
                          3D House →
                        </button>
                      </div>

                      {/* Status Badges: Love Partner, OK-Plan, Past Conversations */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {partner ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-200 font-semibold">
                              ❤️ In Love &amp; Co-Working with {partner.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400">
                              💭 Open to Romance
                            </span>
                          )}
                          {(c.okPlan?.approvedByPlayer ||
                            c.okPlan?.status === 'approved' ||
                            c.okPlan?.status === 'active') &&
                            c.okPlan && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold">
                                ✅ OK-Plan (
                                {(typeof c.okPlan.currentStepIndex === 'number'
                                  ? c.okPlan.currentStepIndex
                                  : Math.max(
                                      0,
                                      c.okPlan.steps.findIndex(
                                        (s) => typeof s === 'object' && s !== null && !s.completed
                                      )
                                    )) + 1}
                                /{Math.max(1, c.okPlan.steps.length)})
                              </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400">
                            {msgCount} msgs · {c.memories.length} memories
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectCharacter(c.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition"
                          >
                            Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: OK-PLAN FEATURE & FRONTEND GROQ INTELLIGENCE PLAN */}
          {activeTab === 'ok_plan' && focusedChar && (
            <div className="space-y-4">
              {/* Frontend Groq Brain Plan Configurator */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-slate-900 to-fuchsia-500/15 border border-cyan-400/35 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-cyan-400" />
                      <span>
                        Frontend Groq LPU Brain Plan · {focusedChar.name} (No Backend Access Needed)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Configure {focusedChar.name}’s Groq LPU model, reasoning mode, temperature,
                      and memory window directly from the frontend. All settings persist in the City
                      2 Database.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold">
                    ⚡ GROQ LPU READY
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Groq LPU Model Architecture
                    </label>
                    <select
                      value={
                        focusedChar.groqConfig?.modelId ||
                        focusedChar.groqConfig?.modelTier ||
                        'llama-3.3-70b-versatile'
                      }
                      onChange={(e) => {
                        const nextModel = e.target.value as ResidentGroqConfig['modelTier'];
                        onUpdateGroqConfig(focusedChar.id, {
                          modelTier: nextModel,
                          modelId: nextModel,
                          reasoningDepth: focusedChar.groqConfig?.reasoningDepth || 'deep_r1',
                          reasoningStyle:
                            focusedChar.groqConfig?.reasoningStyle || 'autonomous-planner',
                          temperature: focusedChar.groqConfig?.temperature ?? 0.78,
                          memoryRecallLimit: focusedChar.groqConfig?.memoryRecallLimit ?? 15,
                          memoryWindowDepth: focusedChar.groqConfig?.memoryWindowDepth ?? 15,
                          autonomousPlanEnabled:
                            focusedChar.groqConfig?.autonomousPlanEnabled ?? true,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    >
                      {GROQ_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Cognitive Reasoning Mode
                    </label>
                    <select
                      value={focusedChar.groqConfig?.reasoningStyle || 'autonomous-planner'}
                      onChange={(e) => {
                        const nextStyle =
                          e.target.value as NonNullable<ResidentGroqConfig['reasoningStyle']>;
                        const activeModel =
                          focusedChar.groqConfig?.modelId ||
                          focusedChar.groqConfig?.modelTier ||
                          'llama-3.3-70b-versatile';
                        onUpdateGroqConfig(focusedChar.id, {
                          modelTier: activeModel,
                          modelId: activeModel,
                          reasoningDepth:
                            nextStyle === 'deep-chain-of-thought' ? 'deep_r1' : 'balanced',
                          reasoningStyle: nextStyle,
                          temperature: focusedChar.groqConfig?.temperature ?? 0.78,
                          memoryRecallLimit: focusedChar.groqConfig?.memoryRecallLimit ?? 15,
                          memoryWindowDepth: focusedChar.groqConfig?.memoryWindowDepth ?? 15,
                          autonomousPlanEnabled:
                            focusedChar.groqConfig?.autonomousPlanEnabled ?? true,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    >
                      <option value="autonomous-planner">Autonomous OK-Planner</option>
                      <option value="deep-chain-of-thought">Deep Chain-of-Thought 🧠</option>
                      <option value="empathetic-social">Empathetic Social &amp; Romance ❤️</option>
                      <option value="creative-dreamer">Creative Dream Synthesizer 🌙</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Creativity Temperature ({focusedChar.groqConfig?.temperature ?? 0.78}) &amp;
                      Memory (
                      {focusedChar.groqConfig?.memoryWindowDepth ??
                        focusedChar.groqConfig?.memoryRecallLimit ??
                        16}{' '}
                      turns)
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={focusedChar.groqConfig?.temperature ?? 0.78}
                      onChange={(e) => {
                        const activeModel =
                          focusedChar.groqConfig?.modelId ||
                          focusedChar.groqConfig?.modelTier ||
                          'llama-3.3-70b-versatile';
                        onUpdateGroqConfig(focusedChar.id, {
                          modelTier: activeModel,
                          modelId: activeModel,
                          reasoningDepth: focusedChar.groqConfig?.reasoningDepth || 'deep_r1',
                          reasoningStyle:
                            focusedChar.groqConfig?.reasoningStyle || 'autonomous-planner',
                          temperature: parseFloat(e.target.value),
                          memoryRecallLimit: focusedChar.groqConfig?.memoryRecallLimit ?? 16,
                          memoryWindowDepth: focusedChar.groqConfig?.memoryWindowDepth ?? 16,
                          autonomousPlanEnabled:
                            focusedChar.groqConfig?.autonomousPlanEnabled ?? true,
                        });
                      }}
                      className="w-full accent-cyan-400 mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Active OK-Plan Feature Card */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-400/35 space-y-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                        📋 OK-PLAN FEATURE
                      </span>
                      <span className="text-xs text-slate-400">
                        Status:{' '}
                        <strong className="text-white uppercase">
                          {focusedChar.okPlan?.status || 'active'}
                        </strong>
                      </span>
                    </div>
                    <h4 className="font-display text-base font-bold text-white mt-1">
                      {focusedChar.okPlan?.planTitle ||
                        focusedChar.okPlan?.title ||
                        `${focusedChar.name}'s Master Plan`}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {focusedChar.okPlan?.objective || focusedChar.okPlan?.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onApproveOkPlan(focusedChar.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-extrabold text-xs shadow-lg flex items-center gap-1.5 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {focusedChar.okPlan?.approvedByPlayer ||
                        focusedChar.okPlan?.status === 'approved' ||
                        focusedChar.okPlan?.status === 'active'
                          ? '✅ OK-Plan Locked'
                          : '👍 OK Plan!'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdvanceOkPlanStep(focusedChar.id)}
                      className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold text-xs flex items-center gap-1 transition active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Advance Step</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onGenerateNewOkPlan(focusedChar.id)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>New AI Plan</span>
                    </button>
                  </div>
                </div>

                {/* Plan Steps Timeline */}
                <div className="space-y-2 pt-1">
                  {(focusedChar.okPlan?.steps || []).map((step, sIdx) => {
                    const stepsList = focusedChar.okPlan?.steps || [];
                    const firstIncompleteIdx = stepsList.findIndex(
                      (s) => typeof s === 'object' && s !== null && !s.completed
                    );
                    const currentIdx =
                      typeof focusedChar.okPlan?.currentStepIndex === 'number'
                        ? focusedChar.okPlan.currentStepIndex
                        : firstIncompleteIdx !== -1
                        ? firstIncompleteIdx
                        : 0;
                    const stepLabel =
                      typeof step === 'string'
                        ? step
                        : step && typeof step === 'object' && 'label' in step
                        ? String(step.label)
                        : '';
                    const stepKey =
                      typeof step === 'string'
                        ? `${sIdx}_${step}`
                        : step?.id || `${sIdx}_${stepLabel}`;
                    const isDone =
                      (typeof step === 'object' && step !== null && Boolean(step.completed)) ||
                      sIdx < currentIdx ||
                      focusedChar.okPlan?.status === 'completed';
                    const isCurrent =
                      !isDone &&
                      sIdx === currentIdx &&
                      focusedChar.okPlan?.status !== 'completed';
                    return (
                      <div
                        key={stepKey}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                            : isDone
                            ? 'bg-slate-950/60 border-white/10 text-emerald-300'
                            : 'bg-slate-950/40 border-white/5 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center ${
                              isDone
                                ? 'bg-emerald-500 text-slate-950'
                                : isCurrent
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isDone ? '✓' : sIdx + 1}
                          </span>
                          <span className="text-xs font-medium">{stepLabel}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/30">
                          {isDone ? 'Completed' : isCurrent ? 'Executing Now' : 'Queued'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Frontend OK-Plan Creator */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs font-bold text-cyan-300">
                    💡 Propose a Custom OK-Plan for {focusedChar.name}:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={customPlanTitle}
                      onChange={(e) => setCustomPlanTitle(e.target.value)}
                      placeholder="Plan Title (e.g. Solar Bridge Symphony)"
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={customPlanObjective}
                      onChange={(e) => setCustomPlanObjective(e.target.value)}
                      placeholder="Objective & Co-Working Goal..."
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customPlanTitle.trim()) return;
                        onApproveOkPlan(
                          focusedChar.id,
                          customPlanTitle.trim(),
                          customPlanObjective.trim() ||
                            `Execute "${customPlanTitle.trim()}" across Neo-Horizon & Gemini City.`
                        );
                        setCustomPlanTitle('');
                        setCustomPlanObjective('');
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-bold text-xs transition active:scale-95"
                    >
                      ✅ Set &amp; OK Custom Plan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FALL IN LOVE & LINK TO WORK TOGETHER */}
          {activeTab === 'love_cowork' && focusedChar && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/20 via-slate-900 to-fuchsia-500/20 border border-rose-400/40 space-y-3">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span>
                    Fall in Love &amp; Co-Working Link · {focusedChar.name}
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Link {focusedChar.name} in love with any resident! Once linked, they fall in love,
                  walk to the same workplace or house, and work together side-by-side while sharing
                  affectionate 3D dialogue bubbles and persistent romance memories.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-200 mb-1">
                      Partner to Fall in Love &amp; Link With:
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    >
                      {characters
                        .filter((c) => c.id !== focusedChar.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.gender === 'Male' ? 'Man' : 'Woman'} ·{' '}
                            {isCity2Character(c.id) ? 'City 2' : 'Gemini City'})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-rose-200 mb-1">
                      Shared Co-Working Destination:
                    </label>
                    <select
                      value={selectedWorkLoc}
                      onChange={(e) => setSelectedWorkLoc(e.target.value as BuildingId)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    >
                      {Object.values(CITY_BUILDINGS).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.cityId === 'city2' ? 'City 2' : 'Gemini City'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onLinkRomanticCoWorkers(focusedChar.id, selectedPartnerId, selectedWorkLoc)
                      }
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-display font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>Link in Love &amp; Work Together</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Romantic Co-Working Couples List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Love &amp; Co-Working Links Across City 2
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {city2Chars.map((c) => {
                    const partner = c.romanticPartnerId
                      ? characters.find((p) => p.id === c.romanticPartnerId)
                      : null;
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {partner ? (
                              <>
                                <span className="text-rose-400">❤️ Linked with</span>
                                <span className="text-rose-300">{partner.name}</span>
                              </>
                            ) : (
                              <span className="text-slate-400 font-normal">
                                · Currently Single / Exploring
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {partner
                              ? `Co-Working together at ${CITY_BUILDINGS[c.currentLocationId]?.name}`
                              : `Working at ${CITY_BUILDINGS[c.currentLocationId]?.name}`}
                          </div>
                        </div>

                        {partner && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onTriggerFriendChartTalk(c.id, partner.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-bold transition"
                            >
                              Talk Together 💬
                            </button>
                            <button
                              type="button"
                              onClick={() => onUnlinkRomanticCoWorkers(c.id)}
                              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] transition"
                            >
                              Unlink
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FRIEND CHART 📉 (LIVE FRIENDSHIP & ROMANCE ANALYTICS + DIRECT CHAT & BOND MAINTENANCE) */}
          {activeTab === 'friend_chart' && focusedChar && (
            <div className="space-y-4">
              {/* Direct Interactive NPC Chat Box inside Friend Chart so you can type & read messages right here! */}
              <div
                className="p-4 rounded-2xl bg-slate-900/95 border border-amber-400/40 space-y-3"
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <h4 className="font-display text-sm font-bold text-white">
                      Direct Chat with {focusedChar.name} ({focusedChar.groqConfig?.modelTier || 'Groq LPU'})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCharacter(focusedChar.id)}
                    className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-[11px] font-bold transition"
                  >
                    Open Full Chat Drawer ↗
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
                  {(chatHistories[focusedChar.id] || []).slice(-6).map((msg, idx) => {
                    const isPlayer = msg.sender === 'player';
                    return (
                      <div
                        key={`${msg.id}_${idx}`}
                        className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] text-slate-400 px-1 mb-0.5">
                          {isPlayer ? 'You (Johnny)' : focusedChar.name} · {msg.gameTime}
                        </span>
                        <div
                          className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${
                            isPlayer
                              ? 'bg-amber-400 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-100 border border-white/10'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  {isSendingChat && (
                    <div className="text-xs text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>{focusedChar.name} is replying...</span>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = hubChatInput.trim();
                    if (!trimmed || !onSendDirectMessage) return;
                    setHubChatInput('');
                    onSendDirectMessage(focusedChar.id, trimmed);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={hubChatInput}
                    onChange={(e) => setHubChatInput(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    autoComplete="off"
                    placeholder={`Type a message to ${focusedChar.name}...`}
                    className="flex-1 min-h-[38px] px-3.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!hubChatInput.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs transition active:scale-95"
                  >
                    Send 💬
                  </button>
                </form>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-400/35 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>
                        {focusedChar.name}’s Live Friend &amp; Romance Chart 📉 (Day {dayNumber})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Subtle <strong>Friendship Decay</strong> (-1% to -2%/day) applies if residents
                      haven’t interacted for <strong>2+ game days</strong>. Click{' '}
                      <strong>“Reconnect / Talk 💬”</strong> to maintain bonds!
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {focusedChar.relationships.map((rel) => {
                    const friendChar = characters.find((c) => c.id === rel.targetId);
                    const affinity = Math.round(rel.affinity || 50);
                    const trust = Math.round(rel.trust ?? rel.affinity ?? 50);
                    const romance = Math.round(rel.romanticInterest ?? 0);
                    const daysApart = rel.daysSinceLastInteraction ?? 0;
                    const isCooling = Boolean(rel.needsAttention || daysApart >= 2);
                    return (
                      <div
                        key={rel.targetId}
                        className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-display font-bold text-xs"
                              style={{ backgroundColor: friendChar?.avatarColor || '#38bdf8' }}
                            >
                              {rel.targetName[0]}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                <span>{rel.targetName}</span>
                                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px]">
                                  {rel.status}
                                </span>
                                {isCooling ? (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[10px] font-semibold">
                                    ⏳ Cooling ({Math.max(2, daysApart)}d apart · -{rel.lastDecayAmount || 1}%)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-[10px]">
                                    ✨ Fresh ({daysApart === 0 ? 'Today' : '1d ago'})
                                  </span>
                                )}
                                {rel.romanticStage && rel.romanticStage !== 'None' && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px]">
                                    ❤️ {rel.romanticStage}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Last talked ({rel.lastMetTime}): “{rel.lastInteractionSummary}”
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onTriggerFriendChartTalk(focusedChar.id, rel.targetId)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition active:scale-95 ${
                                isCooling
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                                  : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950'
                              }`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{isCooling ? 'Reconnect (+5%) 🤝' : 'Talk to Friend 💬'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onLinkRomanticCoWorkers(
                                  focusedChar.id,
                                  rel.targetId,
                                  focusedChar.homeId
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition"
                              title="Fall in Love & Work Together"
                            >
                              ❤️ Love Link
                            </button>
                          </div>
                        </div>

                        {/* Visual Bars for Friend Chart 📉 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-cyan-300">Friendship Affinity</span>
                              <span className="text-white font-bold">{affinity}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full transition-all duration-300"
                                style={{ width: `${affinity}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-emerald-300">Co-Working Trust</span>
                              <span className="text-white font-bold">{trust}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300"
                                style={{ width: `${trust}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-rose-300">Romance Spark ❤️</span>
                              <span className="text-white font-bold">{romance}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-300"
                                style={{ width: `${romance}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DREAMS & DAYTIME CAR TRIP TO GEMINI CITY (RETURNED BEFORE NIGHT 🌃) */}
          {activeTab === 'dreams_car' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-indigo-500/20 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                      🚗🌙 DREAMS &amp; INTER-CITY DREAM CRUISER
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      {isDaytimeWindow
                        ? '☀️ Daytime Excursion Window Open (09:00–17:59)'
                        : '🌃 Night Curfew Active (All Cars Returned to City 2)'}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Dream-Guided Daytime Car Trips to Gemini City (Always Returned Before Night 🌃)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Each night, City 2 residents synthesize vivid dreams that inspire a daytime
                    Cyber-Cruiser car trip across the Golden Horizon Bridge to Gemini City—and they
                    automatically drive back home to City 2 before nightfall (18:00)!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onLaunchGeminiCarTrip()}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 hover:from-amber-300 hover:to-cyan-300 text-slate-950 font-display font-extrabold text-xs shadow-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Car className="w-4 h-4" />
                    <span>🚗 Send Car to Gemini City Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={onReturnCarTripBeforeNight}
                    className="px-3 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-200 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>🌃 Return to City 2 Before Night</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {city2Chars.map((c) => {
                  const dream = c.dreamState || c.dream;
                  const targetSpotId: BuildingId =
                    dream?.dreamTargetGeminiBuildingId || dream?.geminiCityVisitSpot || 'park';
                  const destBld = CITY_BUILDINGS[targetSpotId] || CITY_BUILDINGS.park;
                  const isVisitingGemini =
                    dream?.carTripStatus === 'visiting_gemini' ||
                    dream?.carTripPhase === 'visiting_gemini' ||
                    Boolean(dream?.isCurrentlyOnCarTrip);
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-display font-bold text-xs"
                            style={{ backgroundColor: c.avatarColor }}
                          >
                            {c.name[0]}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white">{c.name}’s Dream Log</div>
                            <div className="text-[11px] text-amber-300 font-medium">
                              🌙 {dream?.dreamTheme || dream?.title || 'Starlight Bridge Vision'}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            isVisitingGemini
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          }`}
                        >
                          {isVisitingGemini
                            ? '🚗 Visiting Gemini City'
                            : '🏡 Home in City 2 before Night'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 italic bg-slate-950/80 p-3 rounded-xl border border-white/10">
                        “{dream?.lastDreamSummary || dream?.lastNightDream || dream?.description}”
                      </p>

                      <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                        <span className="text-cyan-300">
                          🎯 Daytime Car Stop: <strong>{destBld?.name}</strong> (Returns &lt; 18:00)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSynthesizeNewDream(c.id)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 font-semibold transition flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>New Dream</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onLaunchGeminiCarTrip(c.id)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/40 text-cyan-200 font-bold transition"
                          >
                            🚗 Drive Trip
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: SECOND CITY PERSISTENT DATABASE INSPECTOR */}
          {activeTab === 'groq_database' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-400/35 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span>
                        Second City (Neo-Horizon) Persistent AI Memory &amp; Plan Database
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Every conversation, OK-Plan, Love &amp; Co-Working link, Friend Chart score,
                      and Dream Log is automatically stored in both Frontend Storage and{' '}
                      <code className="text-cyan-300">/api/city2-db</code> so the AI remembers
                      everything across sessions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSyncCity2DatabaseNow}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Database Now</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase">City 2 Groq NPCs</div>
                    <div className="text-lg font-display font-extrabold text-cyan-300">
                      {city2Chars.length} Residents
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase">
                      Saved Past Messages
                    </div>
                    <div className="text-lg font-display font-extrabold text-emerald-300">
                      {totalSavedMessages} Turns
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase">Long-Term Memories</div>
                    <div className="text-lg font-display font-extrabold text-amber-300">
                      {totalMemories} Entries
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase">Last DB Sync</div>
                    <div className="text-xs font-mono font-bold text-fuchsia-300 mt-1">
                      {city2DbLastSynced || `Day ${dayNumber} · Live`}
                    </div>
                  </div>
                </div>

                {/* Past Conversation & Memory Records per City 2 Resident */}
                <div className="space-y-2.5 pt-2">
                  {city2Chars.map((c) => {
                    const msgs = (chatHistories[c.id] || []).slice(-3);
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            🗄️ {c.name} ·{' '}
                            {c.groqConfig?.modelId ||
                              c.groqConfig?.modelTier ||
                              'llama-3.3-70b-versatile'}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-300">
                            {(chatHistories[c.id] || []).length} messages · {c.memories.length}{' '}
                            memories
                          </span>
                        </div>
                        <div className="space-y-1">
                          {msgs.map((m) => (
                            <div
                              key={m.id}
                              className="text-[11px] text-slate-300 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-white/5"
                            >
                              <strong className="text-amber-300">
                                {m.sender === 'player' ? 'Explorer' : c.name} ({m.gameTime}):
                              </strong>{' '}
                              {m.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
