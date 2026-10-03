export type TimePhase = 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type SocialProximityMode = 'respectful_distance' | 'emotional_closeness';

export type EmoteType = 'none' | 'dance' | 'laugh' | 'wave' | 'cheer' | 'think' | 'clap';

export type CreatedObjectCategory =
  | 'lantern_arch'
  | 'solar_bot'
  | 'espresso_cart'
  | 'sound_sculpture'
  | 'story_easel'
  | 'holo_globe';

export interface CreatedWorldObject {
  id: string;
  name: string;
  category: CreatedObjectCategory;
  creatorId: string;
  creatorName: string;
  locationId: BuildingId;
  position: { x: number; z: number };
  primaryColor: string;
  accentColor: string;
  thoughtSummary: string;
  createdAtTime: string;
}

export type BuildingId =
  | 'solaris_house'
  | 'lin_cottage'
  | 'hearth_villa'
  | 'cafe'
  | 'school'
  | 'park'
  | 'alie_villa'
  | 'joseph_loft'
  | 'iysha_bungalow'
  | 'amie_manor'
  | 'hawa_sanctuary'
  | 'neo_plaza'
  | 'hokage_mansion'
  | 'ninja_academy'
  | 'ichiraku_ramen'
  | 'training_grounds'
  | 'uchiha_clan_compound'
  | 'chunin_arena';

export interface BuildingInfo {
  id: BuildingId;
  cityId?: 'city1' | 'city2' | 'city3';
  name: string;
  subtitle: string;
  category: 'residence' | 'cafe' | 'school' | 'park';
  description: string;
  position: [number, number, number];
  size: [number, number, number];
  entrance: [number, number, number];
  gatherSpots: [number, number][];
  interiorSpots?: [number, number][];
  wallColor: string;
  roofColor: string;
  accentColor: string;
  residentIds: string[];
}

export interface RoutineStep {
  startHour: number;
  endHour: number;
  locationId: BuildingId;
  activity: string;
  thought: string;
}

export type EmotionType =
  | 'Happiness'
  | 'Sadness'
  | 'Anger'
  | 'Fear'
  | 'Excitement'
  | 'Curiosity'
  | 'Embarrassment'
  | 'Loneliness'
  | 'Jealousy'
  | 'Affection'
  | 'Calmness';

export interface EmotionalState {
  primary: EmotionType;
  intensity: number; // 0 to 100
  cause: string;
  sinceGameTime: string;
  lastUpdatedMs?: number;
}

export type RomanticStage =
  | 'None'
  | 'Curious'
  | 'Warm Spark'
  | 'Mutual Crush'
  | 'Dating'
  | 'Romantic Partner'
  | 'Not Compatible';

export type RelationshipStatus =
  | 'New Neighbor'
  | 'Knows'
  | 'Acquaintance'
  | 'Friend'
  | 'Close Friend'
  | 'Best Friend'
  | 'Collaborator'
  | 'Family'
  | 'Romantic Partner'
  | 'Rival';

export type PlayerRelationshipStatus =
  | 'Stranger'
  | 'Acquaintance'
  | 'Friend'
  | 'Close Friend'
  | 'Best Friend'
  | 'Romantic Partner';

export interface PlayerRelationship {
  status: PlayerRelationshipStatus;
  trust: number; // 0 to 100
  familiarity: number; // 0 to 100
  affection?: number; // 0 to 100
  notes?: string;
  lastInteractedDay?: number;
  daysSinceLastInteraction?: number;
  lastDecayAmount?: number;
  needsAttention?: boolean;
}

export interface SocialRelationship {
  targetId: string;
  targetName: string;
  affinity: number; // 0 to 100
  trust?: number; // 0 to 100
  romanticInterest?: number; // 0 to 100 (this character's romantic feelings toward target)
  romanticStage?: RomanticStage; // Mutual stage if both adult characters reciprocate
  howWeMet?: string;
  knownPreferences?: string[]; // Things this character remembers the other likes/dislikes
  conflictState?: {
    active: boolean;
    reason: string;
    sinceTime: string;
  } | null;
  status: RelationshipStatus;
  interactionCount: number;
  sharedInterests: string[];
  lastInteractionSummary: string;
  lastMetTime: string;
  lastMetDay?: number;
  daysSinceLastInteraction?: number;
  lastDecayAmount?: number;
  needsAttention?: boolean;
}

export interface CharacterNeeds {
  energy: number; // 0 to 100 (low -> rest or coffee)
  social: number; // 0 to 100 (low -> seek residents or player; very low -> Loneliness)
  inspiration: number; // 0 to 100 (low -> explore park, school, or plaza)
}

export interface CharacterMemory {
  id: string;
  gameTime: string;
  summary: string;
  type:
    | 'conversation'
    | 'social'
    | 'goal'
    | 'creation'
    | 'observation'
    | 'event'
    | 'opinion'
    | 'romance'
    | 'conflict'
    | 'promise'
    | 'summary';
  important?: boolean;
  involvedNames?: string[];
  emotionAtTime?: EmotionType;
}

export interface CharacterGoal {
  id: string;
  title: string;
  progress: number;
  description: string;
}

export interface ResidentDailyGoal {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  category: 'architecture' | 'robotics' | 'acoustics' | 'culinary' | 'chronicle' | 'community';
  badgeIcon: string;
  targetLocationId: BuildingId;
  preferredWeather?: WeatherType | 'any';
  progress: number; // 0 to 100
  completed: boolean;
  completedAtTime?: string;
  autonomousContextReason: string;
  currentStepLabel: string;
}

export type GroqModelId =
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distill-llama-70b'
  | 'qwen-2.5-72b-instruct'
  | 'llama-3.1-8b-instant'
  | 'mixtral-8x7b-32768'
  | 'gemma2-9b-it';

export interface ResidentGroqConfig {
  modelTier: GroqModelId;
  modelId?: GroqModelId;
  reasoningDepth: 'fast' | 'balanced' | 'deep_r1';
  reasoningStyle?:
    | 'autonomous-planner'
    | 'deep-chain-of-thought'
    | 'empathetic-social'
    | 'creative-dreamer';
  temperature: number;
  memoryRecallLimit: number;
  memoryWindowDepth?: number;
  autonomousPlanEnabled: boolean;
}

export interface ResidentOkPlanStep {
  id: string;
  label: string;
  locationId: BuildingId;
  completed: boolean;
}

export interface ResidentOkPlan {
  id: string;
  title: string;
  summary: string;
  reasoning: string;
  partnerId?: string | null;
  partnerName?: string | null;
  steps: ResidentOkPlanStep[];
  status: 'proposed' | 'approved' | 'active' | 'completed';
  approvedAtTime?: string;
  progress: number; // 0 to 100
  // Optional synchronized UI fields
  planId?: string;
  planTitle?: string;
  objective?: string;
  currentStepIndex?: number;
  approvedByPlayer?: boolean;
  coWorkerId?: string | null;
  targetLocationId?: BuildingId;
  updatedAtTime?: string;
}

export interface ResidentDreamState {
  title: string;
  description: string;
  geminiCityVisitSpot: BuildingId;
  geminiCityGoal: string;
  carTripStartHour: number; // e.g., 10.0
  carTripReturnHour: number; // e.g., 18.0 (returns before night 🌃)
  lastNightDream: string;
  isCurrentlyOnCarTrip?: boolean;
  carTripPhase?: 'in_city2' | 'driving_to_gemini' | 'visiting_gemini' | 'returning_before_night';
  // Optional synchronized UI fields
  dreamTheme?: string;
  lastDreamSummary?: string;
  dreamTargetGeminiBuildingId?: BuildingId;
  carTripStatus?: 'home_in_city2' | 'visiting_gemini' | 'returned_before_night';
  lastDreamNightDay?: number;
}

export type SocialTemperament = 'outgoing' | 'warm-balanced' | 'reflective' | 'shy';

export type CharacterGender = 'Male' | 'Female' | 'Other / Custom';

export interface CharacterVoiceConfig {
  pitch: number; // 0.5 to 1.5
  rate: number; // 0.7 to 1.4
  voicePreset:
    | 'auto'
    | 'warm-male'
    | 'deep-male'
    | 'energetic-male'
    | 'soft-female'
    | 'bright-female'
    | 'neutral';
  enabled: boolean;
}

export type TwoPlaceSpotId =
  | 'gemini_river_pergola'
  | 'gemini_harbor_lounge'
  | 'neo_starlight_bench'
  | 'neo_sakura_terrace'
  | 'leaf_ramen_terrace'
  | 'leaf_hokage_overlook';

export interface TwoPlaceSeatCoord {
  x: number;
  z: number;
  rotationY: number;
  seatType: 'bench' | 'chair';
}

export interface TwoPlaceSpotInfo {
  id: TwoPlaceSpotId;
  cityId: 'city1' | 'city2' | 'city3';
  name: string;
  subtitle: string;
  description: string;
  nearestBuildingId: BuildingId;
  center: { x: number; z: number };
  seatA: TwoPlaceSeatCoord;
  seatB: TwoPlaceSeatCoord;
  chairA: TwoPlaceSeatCoord;
  chairB: TwoPlaceSeatCoord;
  accentColor: string;
}

export interface ActivePairOuting {
  id: string;
  participantAId: string;
  participantBId: string; // Can be another NPC id or 'player'
  charAId?: string;
  charBId?: string;
  spotId: TwoPlaceSpotId;
  spotName: string;
  seatingChoice: 'bench' | 'chairs';
  phase: 'walking_to_spot' | 'walking_together' | 'sitting_and_talking' | 'returning_home';
  turns: {
    speakerId: string;
    speakerName: string;
    text: string;
    emotion?: EmotionType;
  }[];
  currentTurnIndex: number;
  nextStepAtMs: number;
  returnHomeUntilMs: number;
  startedAtMs?: number;
  sitStartedAtMs?: number;
  memorySummary: string;
}

export interface ActiveConversationSession {
  id: string;
  participantAId: string;
  participantBId: string;
  locationId: BuildingId;
  locationName: string;
  topic: string;
  phase: 'approaching' | 'conversing' | 'farewell';
  meetingPoint: { x: number; z: number };
  turns: {
    speakerId: string;
    speakerName: string;
    text: string;
    emotion?: EmotionType;
  }[];
  farewellText?: string;
  farewellSpeakerId?: string;
  currentTurnIndex: number;
  nextStepAtMs: number;
  startedAtMs: number;
  memorySummary: string;
}

export interface AICharacter {
  id: string;
  cityId?: 'city1' | 'city2' | 'city3';
  name: string;
  gender: CharacterGender;
  customGender?: string;
  role: string;
  age: number;
  modelIdentity: string;
  modelBadge: string;
  modelTrait: string;
  independentTitle: string;
  homeId: BuildingId;
  avatarColor: string;
  outfitColor: string;
  accentColor: string;
  hairColor: string;
  skinColor: string;
  outfitStyle?: ExplorerOutfitStyle;
  headgear?: ExplorerHeadgear;
  backGear?: ExplorerBackGear;
  scale: number;
  temperament: SocialTemperament;
  personality: string[];
  interests: string[];
  likes: string[];
  dislikes: string[];
  familyConnections: string[];
  learnedPreferences: string[];
  bio: string;
  voiceStyle: string;
  voiceConfig: CharacterVoiceConfig;
  needs: CharacterNeeds;
  emotionalState?: EmotionalState;
  romanticPartnerId?: string | null;
  coWorkingWithId?: string | null;
  coWorkingPartnerId?: string | null;
  groqConfig?: ResidentGroqConfig;
  okPlan?: ResidentOkPlan;
  dream?: ResidentDreamState;
  dreamState?: ResidentDreamState;
  relationships: SocialRelationship[];
  playerRelationship: PlayerRelationship;
  routines: RoutineStep[];
  memories: CharacterMemory[];
  goals: CharacterGoal[];
  dailyGoal?: ResidentDailyGoal;
  affinity: number; // Player friendship bond (0-100)
  playerInteractionsCount: number;
  starterPrompts: string[];
  // Dynamic runtime state
  currentPosition: { x: number; z: number };
  targetPosition: { x: number; z: number };
  rotationY: number;
  currentActivity: string;
  currentThought: string;
  currentMood: string;
  currentLocationId: BuildingId;
  decisionReason?: string;
  socialGroupId?: string | null;
  lastTalkedPartnerId?: string | null;
  conversingWithId?: string | null;
  walkingTogetherWithId?: string | null;
  sittingSpotId?: TwoPlaceSpotId | string | null;
  isFollowingPlayer?: boolean;
  isApproachingPlayer?: boolean;
  isMoving: boolean;
  isTalking: boolean;
  isSitting?: boolean;
  isInsideHouse?: boolean;
  lookingAtPlayer?: boolean;
  activeEmote?: {
    type: EmoteType;
    label: string;
    expiresAt: number;
  } | null;
  activeBubble?: {
    text: string;
    expiresAt: number;
  };
  activeMemoryPop?: {
    id: string;
    summary: string;
    type: CharacterMemory['type'];
    expiresAt: number;
  } | null;
}

export interface MemoryToastNotification {
  id: string;
  characterId: string;
  characterName: string;
  avatarColor: string;
  memorySummary: string;
  memoryType: CharacterMemory['type'];
  gameTime: string;
  expiresAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'player' | 'character';
  text: string;
  gameTime: string;
  thought?: string;
  mood?: string;
  emotion?: EmotionType;
  emotionIntensity?: number;
  memoryAdded?: string;
  engineLabel?: string;
}

export interface SocialEvent {
  id: string;
  gameTime: string;
  speakerAId: string;
  speakerAName: string;
  speakerBId: string;
  speakerBName: string;
  locationName: string;
  topic?: string;
  relationshipDelta?: number;
  romanceMilestone?: string;
  lines: {
    speakerName: string;
    text: string;
  }[];
}

export interface CityEvent {
  id: string;
  title: string;
  description: string;
  locationId: BuildingId;
  startHour: number;
  endHour: number;
  participantIds: string[];
}

export interface PlayerApproachInvitation {
  characterId: string;
  characterName: string;
  modelBadge: string;
  avatarColor: string;
  greetingText: string;
  reason: string;
  suggestedLocationId?: BuildingId;
  suggestedTwoPlaceSpotId?: TwoPlaceSpotId;
  suggestedTwoPlaceSpotName?: string;
  expiresAt: number;
}

export type ExplorerOutfitStyle =
  | 'cyber_explorer'
  | 'royal_commander'
  | 'street_hoodie'
  | 'tactical_suit'
  | 'safari_blazer'
  | 'naruto_sage'
  | 'akatsuki_cloak'
  | 'jonin_vest'
  | 'hokage_cloak';

export type ExplorerHeadgear =
  | 'visor'
  | 'crown'
  | 'cap'
  | 'headphones'
  | 'shinobi_headband'
  | 'hokage_hat'
  | 'anbu_mask'
  | 'none';

export type ExplorerBackGear =
  | 'jetpack'
  | 'cape'
  | 'backpack'
  | 'giant_scroll'
  | 'katana_pack'
  | 'katana_sheath'
  | 'uchiha_fan'
  | 'none';

export type ExplorerBrainMode = 'google_gemini' | 'groq_llama' | 'hybrid_dual_brain';

export interface ExplorerResidentDiagnosis {
  characterId: string;
  characterName: string;
  avatarColor: string;
  role: string;
  lastEvaluatedTime: string;
  whatTheyLack: string;
  goalImprovementAdvice: string;
  memoryCoachingReminder: string;
  appliedCount?: number;
}

export interface ExplorerFieldNote {
  id: string;
  gameTime: string;
  category: 'resident_lack' | 'goal_improvement' | 'world_idea' | 'social_observation';
  targetCharacterId?: string;
  targetCharacterName?: string;
  title: string;
  observation: string;
  actionableImprovement: string;
  applied?: boolean;
}

export interface ExplorerFriendship {
  characterId: string;
  characterName: string;
  status: PlayerRelationshipStatus;
  affinity: number;
  trust: number;
  sharedMomentsCount: number;
  lastTalkSummary: string;
}

export interface ExplorerProfile {
  name: string;
  title?: string;
  bio?: string;
  goal?: string;
  skinColor: string;
  outfitColor: string;
  secondaryColor?: string;
  pantsColor?: string;
  shoesColor?: string;
  hairColor: string;
  outfitStyle?: ExplorerOutfitStyle;
  headgear?: ExplorerHeadgear;
  backGear?: ExplorerBackGear;
  brainMode?: ExplorerBrainMode;
  inspectorModeEnabled?: boolean;
  fieldNotes?: ExplorerFieldNote[];
  residentDiagnoses?: Record<string, ExplorerResidentDiagnosis>;
  worldImprovementIdeas?: string[];
  friendships?: Record<string, ExplorerFriendship>;
}
