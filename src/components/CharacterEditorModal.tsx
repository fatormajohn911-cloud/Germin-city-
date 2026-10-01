import React, { useEffect, useState } from 'react';
import {
  Check,
  Heart,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  CITY_BUILDINGS,
  createUniqueId,
  deduplicateCharacterMemories,
  EMOTION_LIST,
  PERSONALITY_PRESET_TRAITS,
  ROMANTIC_STAGE_LIST,
  SKIN_TONE_PRESETS,
} from '../data/cityData';
import {
  AICharacter,
  BuildingId,
  CharacterGender,
  CharacterMemory,
  CharacterVoiceConfig,
  EmotionType,
  ExplorerProfile,
  PlayerRelationshipStatus,
  RelationshipStatus,
  RomanticStage,
  SocialTemperament,
} from '../types/game';
import { speakCharacterLine } from '../utils/voiceSynthesis';

interface CharacterEditorModalProps {
  isOpen: boolean;
  mode: 'edit' | 'create' | 'explorer';
  character: AICharacter | null;
  allCharacters: AICharacter[];
  explorerProfile: ExplorerProfile;
  onClose: () => void;
  onSaveCharacter: (
    updated: AICharacter,
    reciprocalUpdates: { targetId: string; status: RelationshipStatus; affinity: number }[]
  ) => void;
  onCreateCharacter: (newChar: AICharacter) => void;
  onSaveExplorer: (updatedExplorer: ExplorerProfile) => void;
  onResetWorldData: () => void;
}

const GENDER_OPTIONS: CharacterGender[] = ['Male', 'Female', 'Other / Custom'];

const PLAYER_REL_STATUSES: PlayerRelationshipStatus[] = [
  'Stranger',
  'Acquaintance',
  'Friend',
  'Close Friend',
  'Best Friend',
  'Romantic Partner',
];

const RESIDENT_REL_STATUSES: RelationshipStatus[] = [
  'New Neighbor',
  'Knows',
  'Acquaintance',
  'Friend',
  'Close Friend',
  'Best Friend',
  'Collaborator',
  'Family',
  'Romantic Partner',
  'Rival',
];

const VOICE_PRESETS: { id: CharacterVoiceConfig['voicePreset']; label: string }[] = [
  { id: 'auto', label: 'Auto (Match Gender & Personality)' },
  { id: 'warm-male', label: 'Warm Male' },
  { id: 'deep-male', label: 'Deep Grounded Male' },
  { id: 'energetic-male', label: 'Energetic Male' },
  { id: 'soft-female', label: 'Soft Gentle Female' },
  { id: 'bright-female', label: 'Bright Expressive Female' },
  { id: 'neutral', label: 'Neutral Clear' },
];

export const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({
  isOpen,
  mode: initialMode,
  character,
  allCharacters,
  explorerProfile,
  onClose,
  onSaveCharacter,
  onCreateCharacter,
  onSaveExplorer,
  onResetWorldData,
}) => {
  const [activeMode, setActiveMode] = useState<'edit' | 'create' | 'explorer'>(initialMode);
  const [activeSection, setActiveSection] = useState<
    'identity' | 'personality' | 'appearance' | 'relationships' | 'memories'
  >('identity');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  const [draft, setDraft] = useState<AICharacter | null>(null);
  const [explorerDraft, setExplorerDraft] = useState<ExplorerProfile>(explorerProfile);

  // Tag inputs
  const [newTrait, setNewTrait] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');
  const [newFamilyConn, setNewFamilyConn] = useState('');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<CharacterMemory['type']>('conversation');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveMode(initialMode);
    setExplorerDraft(explorerProfile);

    if (initialMode === 'edit' && character) {
      setDraft(JSON.parse(JSON.stringify(character)));
    } else if (initialMode === 'create') {
      const id = `resident_${Date.now().toString(36)}`;
      const defaultRels = allCharacters.map((c) => ({
        targetId: c.id,
        targetName: c.name,
        status: 'Friend' as RelationshipStatus,
        affinity: 70,
        interactionCount: 1,
        sharedInterests: ['Community Life', c.interests[0] || 'Exploration'],
        lastInteractionSummary: `Moved into Gemini City and greeted ${c.name} near the plaza.`,
        lastMetTime: '09:00',
      }));
      setDraft({
        id,
        name: 'John',
        gender: 'Male',
        role: 'Community Innovator',
        age: 28,
        modelIdentity: 'gemini-2.5-pro',
        modelBadge: 'Gemini 2.5 Pro',
        modelTrait: 'Adaptive Reasoning & Social Empathy',
        independentTitle: 'Independent Community Innovator · Hearthstone Commons',
        temperament: 'outgoing',
        avatarColor: '#38BDF8',
        skinColor: '#E5B887',
        outfitColor: '#2563EB',
        accentColor: '#F59E0B',
        hairColor: '#1E1B18',
        scale: 1.0,
        homeId: 'solaris_house',
        currentLocationId: 'park',
        currentPosition: { x: 2, z: 2 },
        targetPosition: { x: 2, z: 2 },
        rotationY: 0,
        isMoving: false,
        isSitting: false,
        isTalking: false,
        personality: ['Friendly', 'Funny', 'Confident', 'Helpful', 'Social'],
        interests: ['Architecture', 'Music', 'Community Coffee', 'Stargazing'],
        likes: ['Helping neighbors', 'Good jokes', 'Morning espresso at Sunbeam Café'],
        dislikes: ['Dishonesty', 'Boring routines'],
        familyConnections: [
          'Close community bond with Ibrahim, Ephraim, Abdullah, Sana, and Maya',
        ],
        learnedPreferences: ['Loves bringing residents together for conversations'],
        bio: 'A friendly, confident, and outgoing resident who loves connecting people across Gemini City.',
        voiceStyle: 'Warm, friendly, confident, humorous, and welcoming.',
        voiceConfig: {
          voicePreset: 'warm-male',
          pitch: 1.0,
          rate: 1.0,
          enabled: true,
        },
        currentMood: 'Friendly',
        currentActivity: 'Exploring Central Park and greeting neighbors',
        currentThought: `Looking forward to catching up with ${explorerProfile.name} and everyone in town!`,
        decisionReason: 'Passionate about community connection',
        affinity: 85,
        playerInteractionsCount: 1,
        starterPrompts: [
          'How is your day going in Gemini City?',
          'What are your favorite places to hang out?',
        ],
        playerRelationship: {
          status: 'Close Friend',
          trust: 85,
          familiarity: 80,
          notes: `Gets along wonderfully with ${explorerProfile.name}.`,
        },
        needs: {
          energy: 90,
          social: 85,
          inspiration: 88,
        },
        relationships: defaultRels,
        routines: [
          {
            startHour: 7,
            endHour: 11,
            locationId: 'cafe',
            activity: 'Grabbing morning espresso and chatting with neighbors at Sunbeam Café',
            thought: 'Nothing beats starting the morning with friends.',
          },
          {
            startHour: 11,
            endHour: 17,
            locationId: 'school',
            activity: 'Collaborating on community ideas at Horizon Academy',
            thought: 'Sharing ideas keeps Gemini City thriving.',
          },
          {
            startHour: 17,
            endHour: 23,
            locationId: 'park',
            activity: 'Strolling through Central Park and sharing stories under the lanterns',
            thought: 'Evening conversations in the park are always memorable.',
          },
        ],
        goals: [
          {
            id: `goal_${Date.now()}`,
            title: 'Build Strong Friendships Across Town',
            progress: 70,
            description: 'Connect with every resident and explorer in Gemini City.',
          },
        ],
        memories: [
          {
            id: `mem_${Date.now()}`,
            gameTime: '09:00',
            summary: `Arrived in Gemini City and became friends with ${explorerProfile.name}.`,
            type: 'conversation',
            important: true,
          },
        ],
      });
    } else if (character) {
      setDraft(JSON.parse(JSON.stringify(character)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode, character?.id]);

  if (!isOpen) return null;

  const handleGenderChange = (newGender: CharacterGender) => {
    if (!draft) return;
    const nextVoice: CharacterVoiceConfig = {
      ...(draft.voiceConfig || { voicePreset: 'auto', pitch: 1, rate: 1, enabled: true }),
    };
    if (newGender === 'Female' && nextVoice.voicePreset.includes('male')) {
      nextVoice.voicePreset = 'soft-female';
      nextVoice.pitch = 1.1;
    } else if (newGender === 'Male' && nextVoice.voicePreset.includes('female')) {
      nextVoice.voicePreset = 'warm-male';
      nextVoice.pitch = 0.94;
    }
    setDraft({
      ...draft,
      gender: newGender,
      voiceConfig: nextVoice,
    });
  };

  const handleToggleTrait = (trait: string) => {
    if (!draft) return;
    const exists = draft.personality.some((p) => p.toLowerCase() === trait.toLowerCase());
    const nextPersonality = exists
      ? draft.personality.filter((p) => p.toLowerCase() !== trait.toLowerCase())
      : [...draft.personality, trait];

    const lower = nextPersonality.map((t) => t.toLowerCase());
    let nextTemp: SocialTemperament = draft.temperament;
    if (lower.some((t) => ['shy', 'quiet', 'introverted'].includes(t))) {
      nextTemp = 'shy';
    } else if (
      lower.some((t) => ['outgoing', 'energetic', 'social', 'adventurous', 'funny'].includes(t))
    ) {
      nextTemp = 'outgoing';
    } else {
      nextTemp = 'warm-balanced';
    }

    setDraft({
      ...draft,
      personality: nextPersonality.length > 0 ? nextPersonality : ['Friendly'],
      temperament: nextTemp,
    });
  };

  const handleAddCustomTrait = () => {
    const clean = newTrait.trim();
    if (!clean || !draft) return;
    if (!draft.personality.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      handleToggleTrait(clean);
    }
    setNewTrait('');
  };

  const handleSaveCharacterClick = () => {
    if (!draft) return;
    const cleanedName = draft.name.trim() || 'Resident';
    const finalChar: AICharacter = {
      ...draft,
      name: cleanedName,
      role: draft.role.trim() || 'Resident',
      affinity: draft.playerRelationship?.trust ?? draft.affinity,
    };

    const reciprocalUpdates = finalChar.relationships.map((r) => ({
      targetId: r.targetId,
      status: r.status,
      affinity: r.affinity,
    }));

    if (activeMode === 'create') {
      onCreateCharacter(finalChar);
    } else {
      onSaveCharacter(finalChar, reciprocalUpdates);
    }
    onClose();
  };

  const handleSaveExplorerClick = () => {
    onSaveExplorer({
      ...explorerDraft,
      name: explorerDraft.name.trim() || 'Johnny',
    });
    onClose();
  };

  if (isPanelCollapsed) {
    return (
      <div className="fixed top-1/2 -translate-y-1/2 right-0 z-50 flex flex-col items-end gap-1 pointer-events-auto">
        <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-2xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
            title="Expand Profile & Appearance Editor Side Panel"
          >
            <span>◂ ✏️ Profile Editor</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-rose-500/30 border-l border-white/10 transition"
            title="Close Editor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[92vw] sm:w-[460px] md:w-[540px] h-full flex pointer-events-auto">
      <div className="relative w-full h-full flex flex-col rounded-l-2xl border-l border-white/15 bg-slate-900/96 backdrop-blur-xl text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/60 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                {activeMode === 'explorer'
                  ? `Explorer Profile (${explorerDraft.name || 'Johnny'})`
                  : activeMode === 'create'
                  ? 'Create New AI Resident'
                  : `Edit Profile: ${draft?.name || ''}`}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Customize personality, gender, skin tone, relationships, voice &amp; memories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 transition"
              title="Collapse panel to side edge so you can see the 3D world"
            >
              ▸
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              title="Close Editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Bar */}
        <div className="flex items-center justify-between gap-1.5 px-4 py-2 border-b border-white/10 bg-slate-950/40">
          <div className="flex items-center gap-1.5 flex-wrap">
            {character && (
              <button
                type="button"
                onClick={() => {
                  setActiveMode('edit');
                  setDraft(JSON.parse(JSON.stringify(character)));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeMode === 'edit'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Edit {character.name.split(' ')[0]}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveMode('create');
                const id = `resident_${Date.now().toString(36)}`;
                setDraft((prev) =>
                  prev && activeMode === 'create'
                    ? prev
                    : {
                        ...(character || allCharacters[0]),
                        id,
                        name: 'John',
                        gender: 'Male',
                        age: 27,
                        role: 'Urban Innovator & Community Builder',
                        independentTitle: 'Independent Community Innovator',
                        skinColor: '#E5B887',
                        personality: ['Friendly', 'Funny', 'Confident', 'Helpful', 'Social'],
                        likes: ['Helping friends', 'Music', 'Coffee at Sunbeam Café'],
                        dislikes: ['Rudeness', 'Isolation'],
                      }
                );
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === 'create'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ New Resident</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('explorer')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === 'explorer'
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Explorer ({explorerDraft.name})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* EXPLORER PROFILE EDITOR */}
        {activeMode === 'explorer' ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-4">
              <h3 className="text-sm font-bold text-sky-300 mb-1">
                Player / Explorer Identity (Default: Johnny)
              </h3>
              <p className="text-xs text-slate-300">
                Every AI resident in Gemini City recognizes your name, remembers facts about you,
                and renders your 3D avatar with your chosen skin tone and outfit colors.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Explorer Name
                </label>
                <input
                  type="text"
                  value={explorerDraft.name}
                  onChange={(e) => setExplorerDraft({ ...explorerDraft, name: e.target.value })}
                  placeholder="Johnny"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Explorer Skin Tone
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {SKIN_TONE_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setExplorerDraft({ ...explorerDraft, skinColor: preset.color })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                        explorerDraft.skinColor.toLowerCase() === preset.color.toLowerCase()
                          ? 'border-sky-400 bg-sky-500/20 text-white font-semibold'
                          : 'border-white/10 bg-slate-800/70 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/30"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span>{preset.label.split(' (')[0]}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={explorerDraft.skinColor}
                    onChange={(e) =>
                      setExplorerDraft({ ...explorerDraft, skinColor: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
                    title="Custom Skin Color"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Explorer Jacket / Outfit Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={explorerDraft.outfitColor}
                    onChange={(e) =>
                      setExplorerDraft({ ...explorerDraft, outfitColor: e.target.value })
                    }
                    className="h-9 w-14 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                  <span className="text-xs text-slate-300 font-mono">
                    {explorerDraft.outfitColor}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Explorer Hair Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={explorerDraft.hairColor}
                    onChange={(e) =>
                      setExplorerDraft({ ...explorerDraft, hairColor: e.target.value })
                    }
                    className="h-9 w-14 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                  <span className="text-xs text-slate-300 font-mono">
                    {explorerDraft.hairColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onResetWorldData}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-950/40 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Saved World Data to Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExplorerClick}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Explorer Profile</span>
                </button>
              </div>
            </div>
          </div>
        ) : draft ? (
          <>
            {/* Sub-navigation tabs for Character Profile Editor */}
            <div className="flex overflow-x-auto border-b border-white/10 bg-slate-900/90 px-4 gap-1">
              {[
                { id: 'identity', label: '1. Identity & Gender' },
                { id: 'personality', label: '2. Personality & Likes' },
                { id: 'appearance', label: '3. Skin Tone, Outfit & Voice' },
                { id: 'relationships', label: '4. Relationships & Bonds' },
                { id: 'memories', label: '5. Memories & Goals' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id as typeof activeSection)}
                  className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${
                    activeSection === tab.id
                      ? 'border-amber-400 text-amber-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* SECTION 1: IDENTITY & GENDER */}
              {activeSection === 'identity' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Human Name
                      </label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="e.g. Sana, Ibrahim, Ephraim, Abdullah, Maya, John"
                        className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Gender (Editable)
                      </label>
                      <div className="flex gap-1.5">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleGenderChange(g)}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold border transition ${
                              draft.gender === g
                                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                                : 'border-white/10 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {g === 'Other / Custom' ? 'Custom' : g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Age & Current Mood
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={16}
                          max={95}
                          value={draft.age}
                          onChange={(e) =>
                            setDraft({ ...draft, age: Math.max(16, Number(e.target.value) || 25) })
                          }
                          className="w-20 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={draft.currentMood || 'Warm'}
                          onChange={(e) => setDraft({ ...draft, currentMood: e.target.value })}
                          placeholder="Current Mood"
                          className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {draft.gender === 'Other / Custom' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Custom Gender Identity / Pronouns
                      </label>
                      <input
                        type="text"
                        value={draft.customGender || ''}
                        onChange={(e) => setDraft({ ...draft, customGender: e.target.value })}
                        placeholder="Specify custom gender or pronouns..."
                        className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Occupation / Role
                      </label>
                      <input
                        type="text"
                        value={draft.role}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            role: e.target.value,
                            independentTitle: `${e.target.value} · ${
                              CITY_BUILDINGS[draft.homeId]?.name || 'Gemini City'
                            }`,
                          })
                        }
                        placeholder="e.g. Urban Architect, Head Roaster, Robotics Tinkerer"
                        className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Current Location in Gemini City
                      </label>
                      <select
                        value={draft.currentLocationId}
                        onChange={(e) => {
                          const locId = e.target.value as BuildingId;
                          const bld = CITY_BUILDINGS[locId];
                          setDraft({
                            ...draft,
                            currentLocationId: locId,
                            currentPosition: { x: bld.entrance[0], z: bld.entrance[2] },
                            targetPosition: { x: bld.entrance[0], z: bld.entrance[2] },
                          });
                        }}
                        className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                      >
                        {Object.values(CITY_BUILDINGS).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.subtitle})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Character Bio & Background
                    </label>
                    <textarea
                      rows={3}
                      value={draft.bio}
                      onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-slate-950/80 p-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Emotional State Editor */}
                  <div className="rounded-xl border border-amber-500/25 bg-slate-950/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Dynamic Emotional State & Cause
                      </span>
                      <span className="text-xs font-mono text-amber-200">
                        {draft.emotionalState?.primary || 'Calmness'} (
                        {draft.emotionalState?.intensity ?? 72}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Primary Emotion</label>
                        <select
                          value={draft.emotionalState?.primary || 'Calmness'}
                          onChange={(e) => {
                            const nextEmo = e.target.value as EmotionType;
                            setDraft({
                              ...draft,
                              currentMood: nextEmo,
                              emotionalState: {
                                primary: nextEmo,
                                intensity: draft.emotionalState?.intensity ?? 75,
                                cause:
                                  draft.emotionalState?.cause ||
                                  `Feeling ${nextEmo.toLowerCase()} in Gemini City`,
                                sinceGameTime: draft.emotionalState?.sinceGameTime || '09:00',
                                lastUpdatedMs: Date.now(),
                              },
                            });
                          }}
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          {EMOTION_LIST.map((emo) => (
                            <option key={emo} value={emo}>
                              {emo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Emotion Intensity ({draft.emotionalState?.intensity ?? 75}%)
                        </label>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          value={draft.emotionalState?.intensity ?? 75}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emotionalState: {
                                primary: draft.emotionalState?.primary || 'Calmness',
                                intensity: Number(e.target.value),
                                cause:
                                  draft.emotionalState?.cause ||
                                  'Experiencing life in Gemini City',
                                sinceGameTime: draft.emotionalState?.sinceGameTime || '09:00',
                                lastUpdatedMs: Date.now(),
                              },
                            })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Emotional Cause / Trigger
                        </label>
                        <input
                          type="text"
                          value={draft.emotionalState?.cause || ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emotionalState: {
                                primary: draft.emotionalState?.primary || 'Calmness',
                                intensity: draft.emotionalState?.intensity ?? 75,
                                cause: e.target.value,
                                sinceGameTime: draft.emotionalState?.sinceGameTime || '09:00',
                                lastUpdatedMs: Date.now(),
                              },
                            })
                          }
                          placeholder="Why they feel this way..."
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: PERSONALITY, INTERESTS, LIKES & DISLIKES */}
              {activeSection === 'personality' && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Personality Traits (Shapes AI Conversation Tone & Social Behavior)
                      </label>
                      <span className="text-xs text-amber-300">
                        Temperament: <strong>{draft.temperament}</strong>
                      </span>
                    </div>

                    {/* Quick Trait Presets */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {PERSONALITY_PRESET_TRAITS.map((trait: string) => {
                        const active = draft.personality.some(
                          (p) => p.toLowerCase() === trait.toLowerCase()
                        );
                        return (
                          <button
                            key={trait}
                            type="button"
                            onClick={() => handleToggleTrait(trait)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                              active
                                ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                                : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 text-amber-300" />}
                            <span>{trait}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Trait Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTrait}
                        onChange={(e) => setNewTrait(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), handleAddCustomTrait())
                        }
                        placeholder="Add any custom personality trait (e.g. Poetic, Philosophical, Witty)..."
                        className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomTrait}
                        className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
                      >
                        + Add Trait
                      </button>
                    </div>
                  </div>

                  {/* Likes & Dislikes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Likes */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
                        Likes
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {(draft.likes || []).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-200"
                          >
                            {item}
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  likes: (draft.likes || []).filter((_, i) => i !== idx),
                                })
                              }
                              className="text-emerald-300/70 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newLike}
                          onChange={(e) => setNewLike(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newLike.trim()) {
                              e.preventDefault();
                              setDraft({
                                ...draft,
                                likes: [...(draft.likes || []), newLike.trim()],
                              });
                              setNewLike('');
                            }
                          }}
                          placeholder="Add something they like..."
                          className="flex-1 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newLike.trim()) return;
                            setDraft({
                              ...draft,
                              likes: [...(draft.likes || []), newLike.trim()],
                            });
                            setNewLike('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/25 text-xs font-semibold text-emerald-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Dislikes */}
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 p-3.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">
                        Dislikes
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {(draft.dislikes || []).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-400/30 px-2.5 py-1 text-xs text-rose-200"
                          >
                            {item}
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  dislikes: (draft.dislikes || []).filter((_, i) => i !== idx),
                                })
                              }
                              className="text-rose-300/70 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newDislike}
                          onChange={(e) => setNewDislike(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newDislike.trim()) {
                              e.preventDefault();
                              setDraft({
                                ...draft,
                                dislikes: [...(draft.dislikes || []), newDislike.trim()],
                              });
                              setNewDislike('');
                            }
                          }}
                          placeholder="Add something they dislike..."
                          className="flex-1 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newDislike.trim()) return;
                            setDraft({
                              ...draft,
                              dislikes: [...(draft.dislikes || []), newDislike.trim()],
                            });
                            setNewDislike('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/25 text-xs font-semibold text-rose-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Interests */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Interests & Hobbies
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {draft.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 border border-sky-400/30 px-2.5 py-1 text-xs text-sky-200"
                        >
                          {interest}
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                interests: draft.interests.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-sky-300/70 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newInterest.trim()) {
                            e.preventDefault();
                            setDraft({
                              ...draft,
                              interests: [...draft.interests, newInterest.trim()],
                            });
                            setNewInterest('');
                          }
                        }}
                        placeholder="Add an interest or hobby..."
                        className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newInterest.trim()) return;
                          setDraft({
                            ...draft,
                            interests: [...draft.interests, newInterest.trim()],
                          });
                          setNewInterest('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/30 text-xs font-semibold text-sky-200"
                      >
                        + Add Interest
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: APPEARANCE (SKIN TONE, HAIR, OUTFIT) & VOICE */}
              {activeSection === 'appearance' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-amber-500/25 bg-slate-950/60 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        3D Character Skin Tone & Appearance (Updates 3D World Immediately)
                      </h3>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Skin Color / Tone
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {SKIN_TONE_PRESETS.map((preset) => (
                          <button
                            key={preset.color}
                            type="button"
                            onClick={() => setDraft({ ...draft, skinColor: preset.color })}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition ${
                              draft.skinColor.toLowerCase() === preset.color.toLowerCase()
                                ? 'border-amber-400 bg-amber-500/20 text-white font-semibold'
                                : 'border-white/10 bg-slate-800/70 text-slate-300 hover:border-white/30'
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-white/30 shadow-inner"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span>{preset.label}</span>
                          </button>
                        ))}
                        <input
                          type="color"
                          value={draft.skinColor}
                          onChange={(e) => setDraft({ ...draft, skinColor: e.target.value })}
                          className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
                          title="Custom Skin Color"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Hair Color</label>
                        <input
                          type="color"
                          value={draft.hairColor}
                          onChange={(e) => setDraft({ ...draft, hairColor: e.target.value })}
                          className="h-9 w-full cursor-pointer rounded-lg border border-white/15 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Outfit Color
                        </label>
                        <input
                          type="color"
                          value={draft.outfitColor}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              outfitColor: e.target.value,
                              avatarColor: e.target.value,
                            })
                          }
                          className="h-9 w-full cursor-pointer rounded-lg border border-white/15 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Accent Color
                        </label>
                        <input
                          type="color"
                          value={draft.accentColor}
                          onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
                          className="h-9 w-full cursor-pointer rounded-lg border border-white/15 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Voice Synthesis Configuration */}
                  <div className="rounded-xl border border-sky-500/25 bg-slate-950/60 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-sky-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                          Character Voice & Speaking Style
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          speakCharacterLine(
                            draft,
                            `Hello ${explorerProfile.name}! I'm ${draft.name}, and I'm excited to explore Gemini City with you.`,
                            true
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 transition"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Test Voice</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Voice Preset</label>
                        <select
                          value={draft.voiceConfig?.voicePreset || 'auto'}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              voiceConfig: {
                                voicePreset:
                                  e.target.value as CharacterVoiceConfig['voicePreset'],
                                pitch: draft.voiceConfig?.pitch ?? 1.0,
                                rate: draft.voiceConfig?.rate ?? 1.0,
                                enabled: draft.voiceConfig?.enabled ?? true,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          {VOICE_PRESETS.map((vp) => (
                            <option key={vp.id} value={vp.id}>
                              {vp.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Voice Pitch ({(draft.voiceConfig?.pitch ?? 1.0).toFixed(2)})
                        </label>
                        <input
                          type="range"
                          min={0.75}
                          max={1.3}
                          step={0.02}
                          value={draft.voiceConfig?.pitch ?? 1.0}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              voiceConfig: {
                                voicePreset: draft.voiceConfig?.voicePreset || 'auto',
                                pitch: Number(e.target.value),
                                rate: draft.voiceConfig?.rate ?? 1.0,
                                enabled: draft.voiceConfig?.enabled ?? true,
                              },
                            })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Speaking Rate ({(draft.voiceConfig?.rate ?? 1.0).toFixed(2)})
                        </label>
                        <input
                          type="range"
                          min={0.85}
                          max={1.2}
                          step={0.02}
                          value={draft.voiceConfig?.rate ?? 1.0}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              voiceConfig: {
                                voicePreset: draft.voiceConfig?.voicePreset || 'auto',
                                pitch: draft.voiceConfig?.pitch ?? 1.0,
                                rate: Number(e.target.value),
                                enabled: draft.voiceConfig?.enabled ?? true,
                              },
                            })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Speaking Style Description (Used by Gemini AI)
                      </label>
                      <input
                        type="text"
                        value={draft.voiceStyle}
                        onChange={(e) => setDraft({ ...draft, voiceStyle: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: RELATIONSHIPS (WITH PLAYER & OTHER RESIDENTS) */}
              {activeSection === 'relationships' && (
                <div className="space-y-5">
                  {/* Relationship with the Player (Johnny) */}
                  <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Relationship with Explorer ({explorerProfile.name})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Status</label>
                        <select
                          value={draft.playerRelationship?.status || 'Close Friend'}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              playerRelationship: {
                                status: e.target.value as PlayerRelationshipStatus,
                                trust: draft.playerRelationship?.trust ?? draft.affinity,
                                familiarity: draft.playerRelationship?.familiarity ?? 75,
                                notes:
                                  draft.playerRelationship?.notes ||
                                  `Close bond with ${explorerProfile.name}.`,
                              },
                            })
                          }
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          {PLAYER_REL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Trust Level ({draft.playerRelationship?.trust ?? draft.affinity}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={draft.playerRelationship?.trust ?? draft.affinity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDraft({
                              ...draft,
                              affinity: val,
                              playerRelationship: {
                                status: draft.playerRelationship?.status || 'Close Friend',
                                trust: val,
                                familiarity: draft.playerRelationship?.familiarity ?? 75,
                                notes: draft.playerRelationship?.notes || '',
                              },
                            });
                          }}
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Familiarity ({draft.playerRelationship?.familiarity ?? 75}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={draft.playerRelationship?.familiarity ?? 75}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              playerRelationship: {
                                status: draft.playerRelationship?.status || 'Close Friend',
                                trust: draft.playerRelationship?.trust ?? draft.affinity,
                                familiarity: Number(e.target.value),
                                notes: draft.playerRelationship?.notes || '',
                              },
                            })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Relationship Notes about {explorerProfile.name}
                      </label>
                      <input
                        type="text"
                        value={draft.playerRelationship?.notes || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            playerRelationship: {
                              status: draft.playerRelationship?.status || 'Close Friend',
                              trust: draft.playerRelationship?.trust ?? draft.affinity,
                              familiarity: draft.playerRelationship?.familiarity ?? 75,
                              notes: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Connections with Other AI Residents */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                        Relationships with Other AI Characters
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      {draft.relationships.map((rel, idx) => (
                        <div
                          key={`${rel.targetId}_${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/90 p-3"
                        >
                          <div className="min-w-[130px]">
                            <div className="text-xs font-bold text-white">{rel.targetName}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                              {rel.lastInteractionSummary}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={rel.status}
                              onChange={(e) => {
                                const nextRels = [...draft.relationships];
                                nextRels[idx] = {
                                  ...rel,
                                  status: e.target.value as RelationshipStatus,
                                };
                                setDraft({ ...draft, relationships: nextRels });
                              }}
                              className="rounded-lg border border-white/15 bg-slate-950 px-2.5 py-1.5 text-xs text-amber-200"
                            >
                              {RESIDENT_REL_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>

                            <select
                              value={rel.romanticStage || 'None'}
                              onChange={(e) => {
                                const stage = e.target.value as RomanticStage;
                                const nextRels = [...draft.relationships];
                                nextRels[idx] = {
                                  ...rel,
                                  romanticStage: stage,
                                  romanticInterest:
                                    stage === 'Romantic Partner'
                                      ? 90
                                      : stage === 'Dating'
                                      ? 78
                                      : stage === 'Mutual Crush'
                                      ? 62
                                      : rel.romanticInterest ?? 20,
                                };
                                setDraft({
                                  ...draft,
                                  romanticPartnerId:
                                    stage === 'Romantic Partner'
                                      ? rel.targetId
                                      : draft.romanticPartnerId,
                                  relationships: nextRels,
                                });
                              }}
                              title="Romantic Relationship Stage"
                              className="rounded-lg border border-pink-400/30 bg-slate-950 px-2.5 py-1.5 text-xs text-pink-200"
                            >
                              {ROMANTIC_STAGE_LIST.map((stage) => (
                                <option key={stage} value={stage}>
                                  ♥ {stage}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min={10}
                                max={100}
                                value={rel.affinity}
                                onChange={(e) => {
                                  const nextRels = [...draft.relationships];
                                  nextRels[idx] = {
                                    ...rel,
                                    affinity: Number(e.target.value),
                                  };
                                  setDraft({ ...draft, relationships: nextRels });
                                }}
                                className="w-20 accent-sky-400"
                              />
                              <span className="text-xs font-mono text-sky-300 w-9 text-right">
                                {rel.affinity}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Family & Close Connections Notes */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-2.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Family / Brotherhood / Sisterhood / Special Connections
                    </label>
                    <div className="space-y-1.5">
                      {(draft.familyConnections || []).map((conn, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-slate-200 border border-white/10"
                        >
                          <span>{conn}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                familyConnections: (draft.familyConnections || []).filter(
                                  (_, idx) => idx !== i
                                ),
                              })
                            }
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFamilyConn}
                        onChange={(e) => setNewFamilyConn(e.target.value)}
                        placeholder="e.g. Close friend: Ibrahim | Brotherly bond with Ephraim & Abdullah"
                        className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newFamilyConn.trim()) return;
                          setDraft({
                            ...draft,
                            familyConnections: [
                              ...(draft.familyConnections || []),
                              newFamilyConn.trim(),
                            ],
                          });
                          setNewFamilyConn('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-xs font-semibold text-amber-200"
                      >
                        + Add Connection
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: MEMORIES & GOALS */}
              {activeSection === 'memories' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-purple-500/25 bg-purple-950/15 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Character Memory Bank (Persistent & Editable)
                    </h3>
                    <p className="text-xs text-slate-300">
                      Add important memories, facts about {explorerProfile.name}, or past events.
                      Important memories are prioritized during AI conversations.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={newMemoryType}
                        onChange={(e) =>
                          setNewMemoryType(e.target.value as CharacterMemory['type'])
                        }
                        className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="conversation">Conversation ({explorerProfile.name})</option>
                        <option value="social">Relationship / Social</option>
                        <option value="romance">Romance / Affection Milestone</option>
                        <option value="promise">Important Promise</option>
                        <option value="conflict">Conflict / Resolution</option>
                        <option value="opinion">Personal Opinion / Preference</option>
                        <option value="event">Important Event</option>
                      </select>
                      <input
                        type="text"
                        value={newMemoryText}
                        onChange={(e) => setNewMemoryText(e.target.value)}
                        placeholder={`e.g. ${explorerProfile.name} loves exploring the park at sunset...`}
                        className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newMemoryText.trim()) return;
                          const entry: CharacterMemory = {
                            id: createUniqueId('mem_custom'),
                            gameTime: 'Pinned',
                            summary: newMemoryText.trim(),
                            type: newMemoryType,
                            important: true,
                          };
                          setDraft({
                            ...draft,
                            memories: deduplicateCharacterMemories([entry, ...draft.memories]),
                          });
                          setNewMemoryText('');
                        }}
                        className="flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-purple-500 text-xs font-bold text-slate-950 hover:bg-purple-400"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Memory</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {deduplicateCharacterMemories(draft.memories).map(
                        (mem: CharacterMemory, memIdx: number) => (
                          <div
                            key={`${mem.id}_${memIdx}`}
                            className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                            mem.important
                              ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                              : 'border-white/10 bg-slate-900/80 text-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="font-mono text-amber-300">[{mem.gameTime}]</span>
                              <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                                {mem.type}
                              </span>
                              {mem.important && (
                                <span className="text-amber-300 font-semibold">★ Important</span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed">{mem.summary}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  memories: draft.memories.map((m: CharacterMemory) =>
                                    m.id === mem.id ? { ...m, important: !m.important } : m
                                  ),
                                })
                              }
                              title="Toggle Important / Pin"
                              className={`p-1.5 rounded-lg ${
                                mem.important
                                  ? 'text-amber-300 bg-amber-500/20'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  memories: draft.memories.filter(
                                    (m: CharacterMemory) => m.id !== mem.id
                                  ),
                                })
                              }
                              title="Delete Memory"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Personal Goals */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Personal Goals
                    </h3>
                    <div className="space-y-2">
                      {draft.goals.map((g, idx) => (
                        <div
                          key={`${g.id}_${idx}`}
                          className="rounded-xl border border-white/10 bg-slate-900 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{g.title}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={g.progress}
                                onChange={(e) => {
                                  const nextGoals = [...draft.goals];
                                  nextGoals[idx] = { ...g, progress: Number(e.target.value) };
                                  setDraft({ ...draft, goals: nextGoals });
                                }}
                                className="w-20 accent-emerald-400"
                              />
                              <span className="text-xs font-mono text-emerald-300">
                                {g.progress}%
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    goals: draft.goals.filter((_, i) => i !== idx),
                                  })
                                }
                                className="text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">{g.description}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        placeholder="New goal title..."
                        className="rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={newGoalDesc}
                        onChange={(e) => setNewGoalDesc(e.target.value)}
                        placeholder="Goal description..."
                        className="rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newGoalTitle.trim()) return;
                          setDraft({
                            ...draft,
                            goals: [
                              ...draft.goals,
                              {
                                id: `goal_${Date.now()}`,
                                title: newGoalTitle.trim(),
                                progress: 35,
                                description:
                                  newGoalDesc.trim() || 'Working toward this personal milestone.',
                              },
                            ],
                          });
                          setNewGoalTitle('');
                          setNewGoalDesc('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-xs font-semibold text-emerald-200"
                      >
                        + Add Goal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-950/80 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border border-white/30"
                  style={{ backgroundColor: draft.skinColor }}
                />
                <span>
                  <strong>{draft.name}</strong> ({draft.gender}) ·{' '}
                  {draft.personality.slice(0, 3).join(', ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCharacterClick}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {activeMode === 'create'
                      ? `Spawn ${draft.name} in World`
                      : `Save ${draft.name}'s Profile`}
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
