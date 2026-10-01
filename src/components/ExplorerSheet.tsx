import React, { useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Compass,
  Crown,
  Heart,
  Lightbulb,
  MessageSquare,
  Palette,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { SKIN_TONE_PRESETS } from '../data/cityData';
import {
  AICharacter,
  ExplorerBackGear,
  ExplorerBrainMode,
  ExplorerFieldNote,
  ExplorerHeadgear,
  ExplorerOutfitStyle,
  ExplorerProfile,
  ExplorerResidentDiagnosis,
} from '../types/game';

interface ExplorerSheetProps {
  isOpen: boolean;
  explorerProfile: ExplorerProfile;
  characters: AICharacter[];
  gameTime: string;
  isAnalyzing: boolean;
  lastAdvisorReply: string | null;
  lastEngineUsed: string | null;
  onClose: () => void;
  onUpdateExplorer: (updated: ExplorerProfile) => void;
  onRunExplorerAudit: (customQuestion?: string) => void;
  onApplyResidentImprovement: (characterId: string, diagnosis?: ExplorerResidentDiagnosis) => void;
  onApplyAllImprovements: () => void;
  onSelectCharacter: (characterId: string) => void;
  onTriggerAutoExplore: () => void;
  autoExploreEnabled: boolean;
}

type ExplorerTab = 'advisor' | 'wardrobe' | 'friendships' | 'identity';

const OUTFIT_STYLES: { id: ExplorerOutfitStyle; label: string; desc: string }[] = [
  {
    id: 'cyber_explorer',
    label: 'Cyber AI Jacket',
    desc: 'Glowing hexagonal chest core with sculpted shoulder pauldrons',
  },
  {
    id: 'royal_commander',
    label: 'Royal Commander Coat',
    desc: 'Regal tailcoat with diagonal sash and gold trim',
  },
  {
    id: 'street_hoodie',
    label: 'Neon Hoodie Vest',
    desc: 'Layered streetwear puffer vest with hood and neon accents',
  },
  {
    id: 'tactical_suit',
    label: 'Tactical Armor Suit',
    desc: 'Futuristic armored chest plate and utility belt pouches',
  },
  {
    id: 'safari_blazer',
    label: 'Adventure Blazer',
    desc: 'Field explorer jacket with cross-body leather satchel',
  },
];

const HEADGEAR_OPTIONS: { id: ExplorerHeadgear; label: string }[] = [
  { id: 'visor', label: '🕶️ Cyber AI Visor' },
  { id: 'crown', label: '👑 Golden Crown' },
  { id: 'cap', label: '🧢 Explorer Cap' },
  { id: 'headphones', label: '🎧 Tech Headphones' },
  { id: 'none', label: '✨ No Headgear' },
];

const BACK_GEAR_OPTIONS: { id: ExplorerBackGear; label: string }[] = [
  { id: 'jetpack', label: '🚀 AI Hover Jetpack' },
  { id: 'cape', label: '🦸 Heroic Cape' },
  { id: 'backpack', label: '🎒 Field Backpack' },
  { id: 'none', label: '✨ Clean Back' },
];

const SIGNATURE_OUTFIT_PRESETS: {
  name: string;
  outfitStyle: ExplorerOutfitStyle;
  headgear: ExplorerHeadgear;
  backGear: ExplorerBackGear;
  outfitColor: string;
  secondaryColor: string;
  pantsColor: string;
  shoesColor: string;
}[] = [
  {
    name: 'Solaris Cyber Architect',
    outfitStyle: 'cyber_explorer',
    headgear: 'visor',
    backGear: 'jetpack',
    outfitColor: '#F59E0B',
    secondaryColor: '#38BDF8',
    pantsColor: '#0F172A',
    shoesColor: '#F59E0B',
  },
  {
    name: 'Royal Astral Commander',
    outfitStyle: 'royal_commander',
    headgear: 'crown',
    backGear: 'cape',
    outfitColor: '#4F46E5',
    secondaryColor: '#FBBF24',
    pantsColor: '#1E1B4B',
    shoesColor: '#FBBF24',
  },
  {
    name: 'Neon Street Innovator',
    outfitStyle: 'street_hoodie',
    headgear: 'headphones',
    backGear: 'backpack',
    outfitColor: '#10B981',
    secondaryColor: '#F472B6',
    pantsColor: '#1E293B',
    shoesColor: '#10B981',
  },
  {
    name: 'Crimson Tactical Ace',
    outfitStyle: 'tactical_suit',
    headgear: 'visor',
    backGear: 'jetpack',
    outfitColor: '#E11D48',
    secondaryColor: '#22D3EE',
    pantsColor: '#090D16',
    shoesColor: '#E11D48',
  },
  {
    name: 'Golden Horizon Scout',
    outfitStyle: 'safari_blazer',
    headgear: 'cap',
    backGear: 'backpack',
    outfitColor: '#D97706',
    secondaryColor: '#34D399',
    pantsColor: '#27272A',
    shoesColor: '#92400E',
  },
];

export const ExplorerSheet: React.FC<ExplorerSheetProps> = ({
  isOpen,
  explorerProfile,
  characters,
  gameTime,
  isAnalyzing,
  lastAdvisorReply,
  lastEngineUsed,
  onClose,
  onUpdateExplorer,
  onRunExplorerAudit,
  onApplyResidentImprovement,
  onApplyAllImprovements,
  onSelectCharacter,
  onTriggerAutoExplore,
  autoExploreEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<ExplorerTab>('advisor');
  const [questionInput, setQuestionInput] = useState('');
  const [newIdeaText, setNewIdeaText] = useState('');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  if (!isOpen) return null;

  if (isPanelCollapsed) {
    return (
      <div className="fixed top-1/2 -translate-y-1/2 right-0 z-40 flex flex-col items-end gap-1 pointer-events-auto">
        <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-2xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
            title="Expand Explorer AI Side Panel"
          >
            <span>◂ ★ {explorerProfile.name} AI</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-rose-500/30 border-l border-white/10 transition"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const brainMode: ExplorerBrainMode = explorerProfile.brainMode || 'hybrid_dual_brain';
  const inspectorEnabled = explorerProfile.inspectorModeEnabled ?? true;
  const diagnosesMap = explorerProfile.residentDiagnoses || {};
  const fieldNotes: ExplorerFieldNote[] = explorerProfile.fieldNotes || [];
  const worldIdeas: string[] = explorerProfile.worldImprovementIdeas || [];

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || isAnalyzing) return;
    setQuestionInput('');
    onRunExplorerAudit(trimmed);
  };

  const handleAddUserIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newIdeaText.trim();
    if (!trimmed) return;
    setNewIdeaText('');
    const newNote: ExplorerFieldNote = {
      id: `note_${Date.now()}`,
      gameTime,
      category: 'world_idea',
      title: 'Explorer & Player Co-Design Idea',
      observation: trimmed,
      actionableImprovement: `Implement "${trimmed}" during city exploration and resident coaching.`,
      applied: false,
    };
    onUpdateExplorer({
      ...explorerProfile,
      worldImprovementIdeas: [trimmed, ...worldIdeas],
      fieldNotes: [newNote, ...fieldNotes],
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[90vw] max-w-[440px] sm:w-[440px] h-full z-40 flex flex-col bg-slate-900/96 backdrop-blur-xl border-l border-amber-400/30 rounded-l-2xl shadow-2xl text-slate-100 overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center text-slate-950 font-display font-bold text-lg shrink-0 shadow-lg border-2 border-amber-300"
            style={{ backgroundColor: explorerProfile.outfitColor || '#F59E0B' }}
          >
            <span>★</span>
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950"
              style={{ backgroundColor: explorerProfile.secondaryColor || '#38BDF8' }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-base font-bold text-white truncate">
                {explorerProfile.name} (Explorer AI)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                {brainMode === 'hybrid_dual_brain'
                  ? 'Gemini + Groq Dual-Brain'
                  : brainMode === 'groq_llama'
                  ? 'Groq Fast Brain'
                  : 'Google Gemini Brain'}
              </span>
            </div>
            <p className="text-xs text-sky-300 font-medium truncate mt-0.5">
              {explorerProfile.title || 'Chief World Explorer & AI Architect'}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>{fieldNotes.length} Field Notes</span>
              <span>·</span>
              <span>{characters.length} AI Friends</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(true)}
            title="Collapse panel to side edge so the 3D world is clearly visible"
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 transition"
          >
            ▸
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Explorer Sheet"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Action Bar: Inspector Toggle & Auto-Explore */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() =>
            onUpdateExplorer({
              ...explorerProfile,
              inspectorModeEnabled: !inspectorEnabled,
            })
          }
          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition ${
            inspectorEnabled
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              : 'bg-slate-900 border-white/10 text-slate-400'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>
            AI Lack & Goal Inspector: {inspectorEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTriggerAutoExplore}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition active:scale-95 ${
              autoExploreEnabled
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${autoExploreEnabled ? 'animate-spin' : ''}`} />
            <span>{autoExploreEnabled ? 'Exploring All AI...' : 'Auto-Explore & Inspect'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 border-b border-white/10 bg-slate-900/90 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('advisor')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition ${
            activeTab === 'advisor'
              ? 'border-amber-400 text-amber-300 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>AI Advisor</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wardrobe')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition ${
            activeTab === 'wardrobe'
              ? 'border-amber-400 text-amber-300 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Clothes</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('friendships')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition ${
            activeTab === 'friendships'
              ? 'border-amber-400 text-amber-300 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Friends</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`py-2.5 flex items-center justify-center gap-1 border-b-2 transition ${
            activeTab === 'identity'
              ? 'border-amber-400 text-amber-300 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: AI ADVISOR, WHAT RESIDENTS LACK & FIELD NOTES */}
        {activeTab === 'advisor' && (
          <div className="space-y-4">
            {/* Intelligence Engine Selector (Google Gemini + Groq) */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-sky-400/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  <span>Explorer Intelligence Engine</span>
                </span>
                {lastEngineUsed && (
                  <span className="text-[10px] font-mono text-emerald-300">
                    Active: {lastEngineUsed}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'hybrid_dual_brain', label: '⚡ Gemini + Groq' },
                    { id: 'google_gemini', label: '✦ Google Gemini' },
                    { id: 'groq_llama', label: '🚀 Groq Llama' },
                  ] as { id: ExplorerBrainMode; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      onUpdateExplorer({
                        ...explorerProfile,
                        brainMode: mode.id,
                      })
                    }
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                      brainMode === mode.id
                        ? 'bg-sky-400 text-slate-950 border-sky-300 shadow'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {explorerProfile.name} observes every conversation and resident routine, noting what
                each AI lacks and how to help them remember and achieve their goals.
              </p>
            </div>

            {/* Ask Johnny Direct Question or Run Full Diagnostic */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask {explorerProfile.name}: What Does the AI Lack?</span>
                </h3>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => onRunExplorerAudit()}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-[11px] transition active:scale-95"
                >
                  {isAnalyzing ? 'Scanning AI...' : 'Scan All AI Now'}
                </button>
              </div>

              <form onSubmit={handleAskSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={`Ask ${explorerProfile.name} what the AI lacks or how to improve goals...`}
                  className="flex-1 h-9 px-3 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !questionInput.trim()}
                  className="h-9 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Quick Question Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {[
                  'What are the AI residents lacking right now?',
                  'How can we help every resident remember their goals?',
                  'What game improvements should we make next?',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onRunExplorerAudit(q)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-900 border border-white/10 text-[10px] text-amber-200 whitespace-nowrap transition"
                  >
                    “{q}”
                  </button>
                ))}
              </div>

              {lastAdvisorReply && (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-400/40 text-xs text-slate-100 leading-relaxed space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    {explorerProfile.name}’s Live Report:
                  </div>
                  <p>{lastAdvisorReply}</p>
                </div>
              )}
            </div>

            {/* Resident-by-Resident Diagnostic: What Each AI Lacks & Goal Coaching */}
            <div className="rounded-xl bg-slate-950/80 border border-white/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>What Each AI Lacks & Goal Coaching ({characters.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={onApplyAllImprovements}
                  className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition active:scale-95"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Coach & Improve All AI</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {characters.map((char) => {
                  const diag = diagnosesMap[char.id];
                  const topGoal = char.goals[0];
                  const lowNeed =
                    char.needs.inspiration < 65
                      ? `Low Inspiration (${Math.round(char.needs.inspiration)}%)`
                      : char.needs.social < 65
                      ? `Low Social (${Math.round(char.needs.social)}%)`
                      : char.needs.energy < 65
                      ? `Low Energy (${Math.round(char.needs.energy)}%)`
                      : 'Needs stronger daily focus on their primary ambition';

                  const whatTheyLack =
                    diag?.whatTheyLack ||
                    `${lowNeed}. Currently "${char.currentActivity}" while their main goal "${
                      topGoal?.title || char.role
                    }" is at ${topGoal?.progress ?? 60}%.`;

                  const goalAdvice =
                    diag?.goalImprovementAdvice ||
                    `Remind ${char.name} of "${
                      topGoal?.title || char.role
                    }" and connect their daily routine with a collaborator.`;

                  return (
                    <div
                      key={char.id}
                      className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCharacter(char.id)}
                          className="flex items-center gap-2 text-left hover:text-amber-300 transition"
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: char.avatarColor }}
                          />
                          <span className="text-xs font-bold text-white">{char.name}</span>
                          <span className="text-[10px] text-slate-400">· {char.role}</span>
                        </button>
                        {topGoal && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[10px] font-mono text-amber-300">
                            Goal: {topGoal.progress}%
                          </span>
                        )}
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-rose-200/95 leading-snug">
                          <strong className="text-rose-300">What They Lack:</strong> {whatTheyLack}
                        </p>
                        <p className="text-emerald-200/95 leading-snug">
                          <strong className="text-emerald-300">Improvement to Make:</strong>{' '}
                          {goalAdvice}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-[10px] text-slate-400">
                          {diag?.appliedCount
                            ? `Coached ${diag.appliedCount}x · Last: ${diag.lastEvaluatedTime}`
                            : 'Tap to coach & pin goal memory'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onApplyResidentImprovement(char.id, diag)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold text-[10px] flex items-center gap-1 transition active:scale-95"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Coach & Boost Goal (+10%)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* World & Game Improvement Ideas + Co-Design Input */}
            <div className="rounded-xl bg-slate-950/80 border border-amber-400/25 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>{explorerProfile.name}’s Game Improvement Ideas</span>
                </h3>
              </div>

              <form onSubmit={handleAddUserIdea} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  placeholder="Add your own game improvement idea to Johnny's notebook..."
                  className="flex-1 h-9 px-3 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!newIdeaText.trim()}
                  className="h-9 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs"
                >
                  + Add
                </button>
              </form>

              <div className="space-y-2">
                {worldIdeas.map((idea, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/25 text-xs text-slate-200 flex items-start gap-2"
                  >
                    <span className="text-amber-400 font-bold">#{i + 1}</span>
                    <span className="leading-relaxed">{idea}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological Live Field Notes */}
            <div className="rounded-xl bg-slate-950/80 border border-white/10 p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live Explorer Field Notebook ({fieldNotes.length})
              </h3>
              <div className="divide-y divide-white/10 max-h-60 overflow-y-auto">
                {fieldNotes.map((note) => (
                  <div key={note.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                      <span>
                        {note.gameTime} · {note.title}
                      </span>
                      {note.targetCharacterName && (
                        <span className="text-sky-300">{note.targetCharacterName}</span>
                      )}
                    </div>
                    <p className="text-slate-200 leading-relaxed">{note.observation}</p>
                    <p className="text-[11px] text-emerald-300">
                      → Action: {note.actionableImprovement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHANGEABLE CLOTHES & 3D WARDROBE */}
        {activeTab === 'wardrobe' && (
          <div className="space-y-4">
            {/* Signature Preset Outfits */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-400/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Signature Outfits (Instant 3D Change)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SIGNATURE_OUTFIT_PRESETS.map((preset) => {
                  const isCurrent =
                    explorerProfile.outfitStyle === preset.outfitStyle &&
                    explorerProfile.outfitColor === preset.outfitColor;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        onUpdateExplorer({
                          ...explorerProfile,
                          outfitStyle: preset.outfitStyle,
                          headgear: preset.headgear,
                          backGear: preset.backGear,
                          outfitColor: preset.outfitColor,
                          secondaryColor: preset.secondaryColor,
                          pantsColor: preset.pantsColor,
                          shoesColor: preset.shoesColor,
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-slate-900/90 hover:bg-slate-800 border-white/10 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center -space-x-1">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-950"
                            style={{ backgroundColor: preset.outfitColor }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-slate-950"
                            style={{ backgroundColor: preset.secondaryColor }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-slate-950"
                            style={{ backgroundColor: preset.pantsColor }}
                          />
                        </div>
                        <span className="text-xs font-bold">{preset.name}</span>
                      </div>
                      <span className="text-[10px] text-amber-300 font-semibold">Wear</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. Outfit / Jacket Style */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                1. Explorer Clothes & Jacket Style
              </label>
              <div className="space-y-1.5">
                {OUTFIT_STYLES.map((st) => {
                  const active = (explorerProfile.outfitStyle || 'cyber_explorer') === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        onUpdateExplorer({
                          ...explorerProfile,
                          outfitStyle: st.id,
                        })
                      }
                      className={`w-full p-2.5 rounded-xl border text-left transition ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold">{st.label}</div>
                      <div
                        className={`text-[11px] ${
                          active ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {st.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Headgear & 3. Back Gear */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  2. Headgear
                </label>
                <div className="flex flex-col gap-1.5">
                  {HEADGEAR_OPTIONS.map((hg) => {
                    const active = (explorerProfile.headgear || 'visor') === hg.id;
                    return (
                      <button
                        key={hg.id}
                        type="button"
                        onClick={() =>
                          onUpdateExplorer({
                            ...explorerProfile,
                            headgear: hg.id,
                          })
                        }
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition ${
                          active
                            ? 'bg-sky-400 text-slate-950 border-sky-300 font-bold'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                        }`}
                      >
                        {hg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  3. Back Gear
                </label>
                <div className="flex flex-col gap-1.5">
                  {BACK_GEAR_OPTIONS.map((bg) => {
                    const active = (explorerProfile.backGear || 'jetpack') === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() =>
                          onUpdateExplorer({
                            ...explorerProfile,
                            backGear: bg.id,
                          })
                        }
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition ${
                          active
                            ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
                        }`}
                      >
                        {bg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Custom Clothing & Body Colors */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                4. Custom Clothing, Pants, Shoes & Skin Colors
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-400 block">Jacket / Top</span>
                  <input
                    type="color"
                    value={explorerProfile.outfitColor || '#F59E0B'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, outfitColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Glow / Trim Accent</span>
                  <input
                    type="color"
                    value={explorerProfile.secondaryColor || '#38BDF8'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, secondaryColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Pants / Trousers</span>
                  <input
                    type="color"
                    value={explorerProfile.pantsColor || '#0F172A'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, pantsColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Boots / Shoes</span>
                  <input
                    type="color"
                    value={explorerProfile.shoesColor || '#F59E0B'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, shoesColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Skin Tone</span>
                  <input
                    type="color"
                    value={explorerProfile.skinColor || '#E5B887'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, skinColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Hair Color</span>
                  <input
                    type="color"
                    value={explorerProfile.hairColor || '#1E293B'}
                    onChange={(e) =>
                      onUpdateExplorer({ ...explorerProfile, hairColor: e.target.value })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-900 border border-white/15"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-white/10">
                <span className="text-[11px] text-slate-400 block mb-1.5">Skin Tone Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SKIN_TONE_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() =>
                        onUpdateExplorer({ ...explorerProfile, skinColor: preset.color })
                      }
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] text-slate-200"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span>{preset.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXPLORER'S OWN FRIENDSHIPS & BONDS */}
        {activeTab === 'friendships' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-300">
              <strong>{explorerProfile.name}</strong> builds independent friendships with every AI
              resident as he explores the city, chats with them, and coaches them on their goals.
            </div>

            <div className="space-y-2.5">
              {characters.map((char) => {
                const rel = char.playerRelationship || {
                  status: 'Close Friend',
                  trust: char.affinity,
                  familiarity: 80,
                };
                const interactions = char.playerInteractionsCount || 1;
                return (
                  <div
                    key={char.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: char.avatarColor }}
                        />
                        <span className="text-xs font-bold text-white">{char.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                          {rel.status}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-emerald-300">
                        {char.affinity}% Bond · {interactions} chats
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${char.affinity}%` }}
                      />
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {rel.notes ||
                        `Trusted friend of ${explorerProfile.name}. Currently at ${char.currentActivity}.`}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyResidentImprovement(char.id, diagnosesMap[char.id]);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-[10px] font-bold"
                      >
                        Coach Goal (+Bond)
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectCharacter(char.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Open Chat & Profile</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: EXPLORER IDENTITY & MISSION */}
        {activeTab === 'identity' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Explorer Name</label>
                <input
                  type="text"
                  value={explorerProfile.name}
                  onChange={(e) =>
                    onUpdateExplorer({ ...explorerProfile, name: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/15 text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Explorer Title & Role
                </label>
                <input
                  type="text"
                  value={
                    explorerProfile.title || 'Chief World Explorer & AI Architect'
                  }
                  onChange={(e) =>
                    onUpdateExplorer({ ...explorerProfile, title: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/15 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Explorer Bio & Personality
                </label>
                <textarea
                  rows={3}
                  value={
                    explorerProfile.bio ||
                    'An autonomous, hyper-observant explorer powered by Google Gemini & Groq dual-brain intelligence.'
                  }
                  onChange={(e) =>
                    onUpdateExplorer({ ...explorerProfile, bio: e.target.value })
                  }
                  className="w-full p-3 rounded-xl bg-slate-900 border border-white/15 text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Master Goal (Making the Game & AI Better)
                </label>
                <textarea
                  rows={3}
                  value={
                    explorerProfile.goal ||
                    'Make Gemini City and every AI resident smarter, more fulfilled, and deeply connected by observing their lives and coaching them toward their ambitions.'
                  }
                  onChange={(e) =>
                    onUpdateExplorer({ ...explorerProfile, goal: e.target.value })
                  }
                  className="w-full p-3 rounded-xl bg-slate-900 border border-white/15 text-white leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
