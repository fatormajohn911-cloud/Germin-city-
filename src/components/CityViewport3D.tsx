import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowUp,
  Camera,
  Compass,
  Gamepad2,
  MessageSquare,
  Move,
  RotateCcw,
  RotateCw,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  CITY_BUILDINGS,
  DEFAULT_EXPLORER_PROFILE,
  findNearestSeatForPosition,
  getOrCreateResidentDailyGoal,
  getResidentWeatherWardrobe,
  TWO_PLACE_SPOTS,
} from '../data/cityData';
import { VirtualJoystick } from './VirtualJoystick';
import { AudioManager } from '../audio/AudioManager';
import {
  AICharacter,
  BuildingId,
  BuildingInfo,
  CreatedWorldObject,
  EmoteType,
  ExplorerProfile,
  GraphicsQuality,
  TimePhase,
  TwoPlaceSpotId,
  WeatherType,
} from '../types/game';
import {
  createAsphaltTexture,
  createCliffRockTexture,
  createContactAOShadowTexture,
  createFacadeTexture,
  createFoliageTexture,
  createGlassCurtainWallTexture,
  createGrassTexture,
  createNeoCityGroundTexture,
  createPaverTexture,
  createRoofTileTexture,
  createSandTexture,
  createSkyEnvTexture,
  createTireTreadTexture,
  createTreeBarkTexture,
  createWaterNormalTexture,
  createWoodPlankTexture,
} from '../utils/proceduralMaterials';
import {
  animateHumanoidRig,
  createHumanoidRig,
  HumanoidRig,
  updateHumanoidRigAppearance,
} from '../utils/humanoidRig';
import { buildNinjaVillageAndHighway } from '../utils/ninjaVillageBuilder';

export type CameraViewMode = 'chase' | 'action' | 'panoramic' | 'sky';

interface CityViewport3DProps {
  characters: AICharacter[];
  createdObjects?: CreatedWorldObject[];
  explorerProfile?: ExplorerProfile;
  playerEmote?: EmoteType;
  playerAutoTarget?: { x: number; z: number; targetId?: string; label?: string } | null;
  playerActiveBubble?: string | null;
  insideHouseMode?: boolean;
  hideActionHud?: boolean;
  isGamepadMode?: boolean;
  screenRotation?: 0 | 90 | -90;
  onCycleScreenRotation?: () => void;
  onExitGamepadMode?: () => void;
  onJoystickMove?: (vector: { x: number; y: number }) => void;
  selectedCharacterId: string | null;
  nearbyCharacterId?: string | null;
  selectedBuildingId: BuildingId | null;
  gameHour: number;
  timePhase: TimePhase;
  weather?: WeatherType;
  graphicsQuality: GraphicsQuality;
  joystickVector: { x: number; y: number };
  joystickInputRef?: React.MutableRefObject<{ x: number; y: number }>;
  cameraTargetOverride: { x: number; z: number } | null;
  onSelectCharacter: (id: string) => void;
  onSelectExplorer?: () => void;
  onSelectBuilding: (id: BuildingId | null) => void;
  onSelectCreatedObject?: (obj: CreatedWorldObject) => void;
  onPlayerPositionChange: (pos: { x: number; z: number }, nearbyCharId: string | null) => void;
  onPlayerAutoTargetReached?: (targetId?: string) => void;
  onClearCameraOverride: () => void;
  onTriggerBridgeReflections?: (
    theme: 'architecture' | 'mystery' | 'envoy',
    direction?: 'to_neo_horizon' | 'to_gemini_city'
  ) => void;
  playerSittingSpot?: {
    x: number;
    z: number;
    rotationY: number;
    spotId?: TwoPlaceSpotId;
    seatType?: 'bench' | 'chair';
    partnerId?: string;
    partnerName?: string;
  } | null;
  onSelectTwoPlaceSpot?: (spotId: TwoPlaceSpotId, seatingChoice?: 'bench' | 'chairs') => void;
  onPlayerStandUp?: () => void;
  onVehicleTransitEvent?: (event: {
    vehicle: 'cyber_car' | 'bus';
    action: 'board' | 'exit';
    characterIds: string[];
    x: number;
    z: number;
    locationLabel: string;
  }) => void;
}

export type BridgeReflectionTheme = 'architecture' | 'mystery' | 'envoy';

export interface BusStopStationDef {
  id: string;
  code: string;
  waypointIdx: number;
  name: string;
  shortName: string;
  zone: string;
  x: number;
  z: number;
  shelterX: number;
  shelterZ: number;
  shelterRotY: number;
  exitOffset: [number, number];
  accentColor: string;
}

export const BUS_STOP_STATIONS: BusStopStationDef[] = [
  {
    id: 'stop_academy',
    code: '01',
    waypointIdx: 5,
    name: 'North Academy & Solaris Bus Stop',
    shortName: 'Academy & Solaris',
    zone: 'Gemini City · North',
    x: -10.5,
    z: -10.5,
    shelterX: -14.2,
    shelterZ: -7.5,
    shelterRotY: Math.PI / 2,
    exitOffset: [-2.6, 0.8],
    accentColor: '#fbbf24',
  },
  {
    id: 'stop_cafe',
    code: '02',
    waypointIdx: 6,
    name: 'Sunbeam Café & River Bus Stop',
    shortName: 'Sunbeam Café & River',
    zone: 'Gemini City · West',
    x: -10.5,
    z: 10.5,
    shelterX: -7.2,
    shelterZ: 14.2,
    shelterRotY: Math.PI,
    exitOffset: [0.8, 2.6],
    accentColor: '#f97316',
  },
  {
    id: 'stop_park',
    code: '03',
    waypointIdx: 7,
    name: 'Central Starlight Park & Harbor Stop',
    shortName: 'Starlight Park & Harbor',
    zone: 'Gemini City · South-East',
    x: 10.5,
    z: 10.5,
    shelterX: 14.2,
    shelterZ: 7.2,
    shelterRotY: -Math.PI / 2,
    exitOffset: [2.6, -0.8],
    accentColor: '#34d399',
  },
  {
    id: 'stop_bridge',
    code: '04',
    waypointIdx: 10,
    name: 'Golden Horizon Bridge Vista Stop',
    shortName: 'Horizon Bridge Vista',
    zone: 'Suspension Bridge · Mid-Span',
    x: 99.0,
    z: 1.65,
    shelterX: 99.0,
    shelterZ: 4.35,
    shelterRotY: Math.PI,
    exitOffset: [0.0, 2.2],
    accentColor: '#38bdf8',
  },
  {
    id: 'stop_cyber_plaza',
    code: '05',
    waypointIdx: 12,
    name: 'Cyber-Horizon Grand Plaza Station',
    shortName: 'Cyber-Horizon Plaza',
    zone: 'Cyber Horizon · Central',
    x: 182.0,
    z: 1.65,
    shelterX: 182.0,
    shelterZ: 5.2,
    shelterRotY: Math.PI,
    exitOffset: [0.6, 2.8],
    accentColor: '#e879f9',
  },
  {
    id: 'stop_astral_loop',
    code: '06',
    waypointIdx: 13,
    name: 'Astral Lagoon & Bio-Dome Station',
    shortName: 'Astral Lagoon Loop',
    zone: 'Cyber Horizon · East Loop',
    x: 194.0,
    z: 0.0,
    shelterX: 198.2,
    shelterZ: -3.6,
    shelterRotY: -Math.PI / 4,
    exitOffset: [2.4, -1.6],
    accentColor: '#22d3ee',
  },
];

export function getResidentBridgeReflection(
  char: AICharacter,
  explorerName: string,
  theme: BridgeReflectionTheme = 'architecture'
): { quote: string; thought: string; emote: EmoteType; badge: string } {
  const id = char.id.toLowerCase();
  if (id === 'aria' || char.name === 'Ibrahim') {
    if (theme === 'mystery') {
      return {
        quote: `Our civic charter binds all of us residents to Gemini Island, ${explorerName}. That’s why Neo-Horizon stands silent across the water—built as a pure architectural frontier that only you, the Explorer, can step into.`,
        thought: `Reflecting on why only ${explorerName} can cross the Golden Horizon Bridge into the uninhabited metropolis.`,
        emote: 'think',
        badge: '🏛️ Structural Reflection',
      };
    }
    if (theme === 'envoy') {
      return {
        quote: `Every time you streak across those 82 meters of crimson suspension steel, ${explorerName}, inspect how the Prism Twin Towers anchor into the obsidian seabed for my blueprints!`,
        thought: `Hoping ${explorerName} brings back structural observations from Neo-Horizon’s Sky-Bridge.`,
        emote: 'wave',
        badge: '📐 Blueprint Envoy',
      };
    }
    return {
      quote: `Look at the catenary curve on the Golden Horizon Bridge, ${explorerName}—two 29-meter steel towers carrying you straight into Neo-Horizon’s neon-glass skyline. It’s the boldest engineering feat in our world.`,
      thought: `Studying how the Golden Horizon Bridge spans the deep ocean channel to the Second City.`,
      emote: 'clap',
      badge: '🌉 Bridge Architecture',
    };
  }

  if (id === 'leo' || char.name === 'Abdullah') {
    if (theme === 'mystery') {
      return {
        quote: `My sensors show zero resident footprints in Neo-Horizon, bro—just automated hydro-foils, anti-gravity gyroscopes, and pure synthwave energy waiting exclusively for ${explorerName}!`,
        thought: `Scanning the electromagnetic pulse of Neo-Horizon’s central gyroscope core from across the bay.`,
        emote: 'think',
        badge: '📡 Telemetry Scan',
      };
    }
    if (theme === 'envoy') {
      return {
        quote: `Hit the bridge Hyper-Glide portal at full boost, ${explorerName}! When you touch down by the Quantum Data-Cube in Neo-Horizon, test how fast your jetpack charges near the neon grid!`,
        thought: `Cheering ${explorerName} on as he launches through the Golden Horizon speed rings.`,
        emote: 'cheer',
        badge: '⚡ Hyper-Glide Boost',
      };
    }
    return {
      quote: `Bro, the Golden Horizon Bridge’s speed-boost rings are locked onto your Explorer signature! One tap and you can jet-glide straight from Gemini City into the heart of Neo-Horizon!`,
      thought: `Admiring the glowing cyan and gold energy rings along the suspension bridge deck.`,
      emote: 'cheer',
      badge: '🤖 Cyber-Grid Tech',
    };
  }

  if (id === 'elena' || char.name === 'Sana') {
    if (theme === 'mystery') {
      return {
        quote: `There is a serene poetry to an uninhabited city across the sea, ${explorerName}. While our island hums with daily voices, Neo-Horizon listens in crystal stillness until your footsteps arrive.`,
        thought: `Listening to the wind harp harmonics vibrating across the Golden Horizon suspension cables.`,
        emote: 'think',
        badge: '🎶 Acoustic Stillness',
      };
    }
    if (theme === 'envoy') {
      return {
        quote: `When you cross the bridge into Neo-Horizon, ${explorerName}, visit the Solstice Geodesic Bio-Dome and tell me what the bioluminescent crystal trees sound like in the sea breeze.`,
        thought: `Wishing ${explorerName} a peaceful journey across the Golden Horizon Bridge.`,
        emote: 'wave',
        badge: '🌸 Bio-Dome Harmony',
      };
    }
    return {
      quote: `From East Blossom Lane, the suspension cables of the Golden Horizon Bridge sing like a giant harp above the waves, guiding you toward those glowing cyan lagoons of Neo-Horizon.`,
      thought: `Captivated by the reflection of Neo-Horizon’s magenta spires on the ocean strait.`,
      emote: 'clap',
      badge: '🌊 Harmonic Horizon',
    };
  }

  if (id === 'kaelen' || char.name === 'Ephraim') {
    if (theme === 'mystery') {
      return {
        quote: `Imagine a whole cyber-metropolis with 46-meter megatowers and not a single espresso bar yet! That’s why Neo-Horizon belongs to the Explorer—it’s your private sanctuary of light, ${explorerName}.`,
        thought: `Picturing ${explorerName} looking back at Sunbeam Café’s warm lanterns from Neo-Horizon’s promenade.`,
        emote: 'laugh',
        badge: '☕ Roaster’s Wonder',
      };
    }
    if (theme === 'envoy') {
      return {
        quote: `Enjoy your fast-travel flight across the Golden Horizon Bridge, my friend! Whenever you glide back to Gemini City, a fresh single-origin pour-over will be waiting on the patio.`,
        thought: `Keeping a warm espresso ready for ${explorerName}’s return from the Second City.`,
        emote: 'cheer',
        badge: '🏠 Warm Return',
      };
    }
    return {
      quote: `Standing on the harbor pier at sunset and seeing the Golden Horizon Bridge light up between our cozy island and Neo-Horizon’s cyber-towers makes the whole world feel twice as grand, ${explorerName}!`,
      thought: `Admiring how the sunset crimson steel of the bridge connects two completely different worlds.`,
      emote: 'wave',
      badge: '🌅 Two Worlds Connected',
    };
  }

  if (id === 'maya' || char.name === 'Maya') {
    if (theme === 'mystery') {
      return {
        quote: `I’m calling tonight’s podcast episode "The City Where Only the Explorer Walks." Every resident here loves our home island, ${explorerName}, so we entrust the mysteries of Neo-Horizon entirely to you!`,
        thought: `Drafting a chronicle entry about the uninhabited Neo-Horizon Cyber-Metropolis.`,
        emote: 'think',
        badge: '🎙️ Chronicle Mystery',
      };
    }
    if (theme === 'envoy') {
      return {
        quote: `Look at ${explorerName} crossing the Golden Horizon Bridge! Bring back stories from the Nova Synth-Pyramid and the high-altitude Sky-Bridge for our next town broadcast!`,
        thought: `Recording live commentary as ${explorerName} activates the Golden Horizon Bridge.`,
        emote: 'cheer',
        badge: '📖 Explorer’s Legend',
      };
    }
    return {
      quote: `Two cities, two completely different vibes, one iconic suspension bridge! Gemini City is our warm neighborhood heart, and Neo-Horizon is your futuristic cyber-odyssey, ${explorerName}.`,
      thought: `Inspired by the contrast between Gemini City’s timber cottages and Neo-Horizon’s neon spires.`,
      emote: 'clap',
      badge: '✨ Tale of Two Cities',
    };
  }

  // Fallback for any custom user-created AI Resident
  return {
    quote: `Seeing the Golden Horizon Bridge stretch across the ocean to Neo-Horizon fills me with wonder, ${explorerName}! Since only the Explorer can visit the Second City, tell us everything you discover over there!`,
    thought: `Gazing across the Golden Horizon Bridge toward the glowing towers of Neo-Horizon City.`,
    emote: 'wave',
    badge: '🌉 Horizon Reflection',
  };
}

export const CityViewport3D: React.FC<CityViewport3DProps> = ({
  characters,
  createdObjects = [],
  explorerProfile = DEFAULT_EXPLORER_PROFILE,
  playerEmote = 'none',
  playerAutoTarget = null,
  playerActiveBubble = null,
  insideHouseMode = false,
  hideActionHud = false,
  isGamepadMode = false,
  screenRotation = 0,
  onCycleScreenRotation,
  onExitGamepadMode,
  onJoystickMove,
  selectedCharacterId,
  nearbyCharacterId = null,
  selectedBuildingId,
  gameHour,
  timePhase,
  weather = 'sunny',
  graphicsQuality,
  joystickVector,
  joystickInputRef,
  cameraTargetOverride,
  onSelectCharacter,
  onSelectExplorer,
  onSelectBuilding,
  onSelectCreatedObject,
  onPlayerPositionChange,
  onPlayerAutoTargetReached,
  onClearCameraOverride,
  onTriggerBridgeReflections,
  playerSittingSpot = null,
  onSelectTwoPlaceSpot,
  onPlayerStandUp,
  onVehicleTransitEvent,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [cameraViewMode, setCameraViewMode] = useState<CameraViewMode>('chase');
  const [autoFollowCamera, setAutoFollowCamera] = useState<boolean>(true);
  const lookPadContainerRef = useRef<HTMLDivElement | null>(null);
  const lookPadKnobRef = useRef<HTMLDivElement | null>(null);
  const lookPadCachedRectRef = useRef<DOMRect | null>(null);
  const [isLookPadActive, setIsLookPadActive] = useState(false);
  const lookPadPointerId = useRef<number | null>(null);
  const lookPadPrevPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Action & Camera control refs bridged directly to the 60FPS Three.js loop
  const triggerJumpRef = useRef<(() => void) | null>(null);
  const triggerSlideRef = useRef<(() => void) | null>(null);
  const snapBehindPlayerRef = useRef<(() => void) | null>(null);
  const applyCameraViewPresetRef = useRef<((mode: CameraViewMode) => void) | null>(null);
  const travelToSpotRef = useRef<((x: number, z: number, walkThere?: boolean) => void) | null>(null);
  const triggerBridgeFastTravelRef = useRef<
    ((targetCity?: 'neo_horizon' | 'gemini_city') => void) | null
  >(null);
  const [explorerZone, setExplorerZone] = useState<
    'gemini_city' | 'suspension_bridge' | 'neo_horizon' | 'shinobi_highway' | 'ninja_village'
  >('gemini_city');
  const explorerZoneRef = useRef<
    'gemini_city' | 'suspension_bridge' | 'neo_horizon' | 'shinobi_highway' | 'ninja_village'
  >('gemini_city');
  const [isBridgeHubOpen, setIsBridgeHubOpen] = useState(false);
  const [bridgeReflectionTheme, setBridgeReflectionTheme] =
    useState<BridgeReflectionTheme>('architecture');
  const bridgeReflectionThemeRef = useRef<BridgeReflectionTheme>('architecture');
  bridgeReflectionThemeRef.current = bridgeReflectionTheme;
  const [fastTravelStatus, setFastTravelStatus] = useState<{
    active: boolean;
    destinationLabel: string;
    progress: number;
  } | null>(null);
  const rotateDeltaRef = useRef<{ dAzimuth: number; dPolar: number }>({ dAzimuth: 0, dPolar: 0 });
  const continuousRotateDirRef = useRef<number>(0);
  const cameraViewModeRef = useRef<CameraViewMode>(cameraViewMode);
  cameraViewModeRef.current = cameraViewMode;
  const autoFollowCameraRef = useRef<boolean>(autoFollowCamera);
  autoFollowCameraRef.current = autoFollowCamera;
  const screenRotationRef = useRef<0 | 90 | -90>(screenRotation);
  screenRotationRef.current = screenRotation;

  // Refs for DOM-projected labels (updated at 60fps without React re-renders)
  const charLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const twoPlaceLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playerLabelRef = useRef<HTMLDivElement | null>(null);
  const bridgeLabelRef = useRef<HTMLDivElement | null>(null);
  const cyberCarLabelRef = useRef<HTMLDivElement | null>(null);
  const busLabelRef = useRef<HTMLDivElement | null>(null);
  const busDepotLabelRef = useRef<HTMLDivElement | null>(null);
  const cyberStationLabelRef = useRef<HTMLDivElement | null>(null);
  const jamaicaStationLabelRef = useRef<HTMLDivElement | null>(null);

  // Rideable Cyberpunk Supercar ("Cyber-Valkyrie GT") State & 60FPS Refs
  const [isRidingCyberCar, setIsRidingCyberCar] = useState(false);
  const isRidingCyberCarRef = useRef(false);
  isRidingCyberCarRef.current = isRidingCyberCar;

  // Car ONLY moves when player sits inside it AND presses the Move / Drive button!
  const [isCyberCarMoving, setIsCyberCarMoving] = useState(false);
  const isCyberCarMovingRef = useRef(false);
  isCyberCarMovingRef.current = isCyberCarMoving;

  const [cyberCarDoorsOpen, setCyberCarDoorsOpen] = useState(false);
  const cyberCarDoorsOpenRef = useRef(false);
  cyberCarDoorsOpenRef.current = cyberCarDoorsOpen;

  const [cyberCarWingDeployed, setCyberCarWingDeployed] = useState(false);
  const cyberCarWingDeployedRef = useRef(false);
  cyberCarWingDeployedRef.current = cyberCarWingDeployed;

  const [cyberCarTelemetry, setCyberCarTelemetry] = useState<{
    speedKmh: number;
    gear: 'P' | 'D' | 'S+' | 'R';
    trafficLightWait: boolean;
  }>({
    speedKmh: 0,
    gear: 'P',
    trafficLightWait: false,
  });

  const [cyberCarCompanionId, setCyberCarCompanionId] = useState<string | null>('hawa');
  const cyberCarCompanionIdRef = useRef<string | null>('hawa');
  cyberCarCompanionIdRef.current = cyberCarCompanionId;

  const [cyberCarDriveMode, setCyberCarDriveMode] = useState<
    'grand_tour' | 'manual' | 'destination'
  >('manual');
  const cyberCarDriveModeRef = useRef<'grand_tour' | 'manual' | 'destination'>('manual');
  cyberCarDriveModeRef.current = cyberCarDriveMode;

  const [cyberCarDestLabel, setCyberCarDestLabel] = useState<string>(
    'Parked — Sit Inside & Press Move to Drive'
  );
  const cyberCarTargetPointRef = useRef<[number, number] | null>(null);
  const exitCyberCarActionRef = useRef<(() => void) | null>(null);
  const boardCyberCarActionRef = useRef<((companionId?: string | null) => void) | null>(null);
  const toggleCyberCarMoveRef = useRef<((forceMove?: boolean) => void) | null>(null);
  const summonCyberCarRef = useRef<(() => void) | null>(null);

  // 5-Passenger Autonomous Luxury Transit Bus ("Horizon Grand 5-Seater Coach") State & 60FPS Refs
  const [isRidingBus, setIsRidingBus] = useState(false);
  const isRidingBusRef = useRef(false);
  isRidingBusRef.current = isRidingBus;

  // Bus Engine ON/OFF & Dedicated Bus Parking Depot State (When stopped/parked, bus waits until turned ON!)
  const [isBusEngineOn, setIsBusEngineOn] = useState(true);
  const isBusEngineOnRef = useRef(true);
  isBusEngineOnRef.current = isBusEngineOn;

  const [isBusParked, setIsBusParked] = useState(false);
  const isBusParkedRef = useRef(false);
  isBusParkedRef.current = isBusParked;

  const [busDriveMode, setBusDriveMode] = useState<'auto_route' | 'manual'>('auto_route');
  const busDriveModeRef = useRef<'auto_route' | 'manual'>('auto_route');
  busDriveModeRef.current = busDriveMode;

  const [showBusStopMarkers, setShowBusStopMarkers] = useState(false);
  const showBusStopMarkersRef = useRef(false);
  showBusStopMarkersRef.current = showBusStopMarkers;

  const [isTransitMenuOpen, setIsTransitMenuOpen] = useState(false);
  const [isVehiclePanelCollapsed, setIsVehiclePanelCollapsed] = useState(false);
  const [isBusStopVisualizerOpen, setIsBusStopVisualizerOpen] = useState(false);
  const busStopLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dispatchBusToStopRef = useRef<((stopId: string, instantPause?: boolean) => void) | null>(
    null
  );

  // Real 3D Traffic Lights State & Phase
  const [trafficSignalPhase, setTrafficSignalPhase] = useState<
    'ns_green' | 'ns_yellow' | 'ew_green' | 'ew_yellow'
  >('ns_green');
  const trafficSignalPhaseRef = useRef<
    'ns_green' | 'ns_yellow' | 'ew_green' | 'ew_yellow'
  >('ns_green');
  trafficSignalPhaseRef.current = trafficSignalPhase;

  const [busUiStatus, setBusUiStatus] = useState<{
    passengerIds: string[];
    phase:
      | 'driving'
      | 'braking'
      | 'doors_open'
      | 'parked'
      | 'parked_depot'
      | 'red_light'
      | 'stopped_red_light';
    stopName: string;
    activeStopId?: string | null;
    nextStopId?: string | null;
    speedKmh: number;
  }>({
    passengerIds: [],
    phase: 'driving',
    stopName: 'Gemini City ↔ Cyber Horizon Loop',
    activeStopId: null,
    nextStopId: 'stop_cafe',
    speedKmh: 44,
  });
  // Start with 0 pre-teleported passengers: NPCs can ONLY get in the bus when physically close (<= 9.5m) to the bus!
  const busPassengersRef = useRef<string[]>([]);
  const triggerBusStopNowRef = useRef<(() => void) | null>(null);
  const stopAndParkBusRef = useRef<(() => void) | null>(null);
  const parkBusAtDepotRef = useRef<((instant?: boolean) => void) | null>(null);
  const startBusEngineRef = useRef<(() => void) | null>(null);
  const honkBusHornRef = useRef<(() => void) | null>(null);
  const boardAllFiveBusRef = useRef<(() => void) | null>(null);

  const playerSittingSpotRef = useRef(playerSittingSpot);
  playerSittingSpotRef.current = playerSittingSpot;

  // Keep latest props in refs for the 60fps animation loop
  const charactersRef = useRef<AICharacter[]>(characters);
  charactersRef.current = characters;

  const createdObjectsRef = useRef<CreatedWorldObject[]>(createdObjects);
  createdObjectsRef.current = createdObjects;

  const explorerRef = useRef<ExplorerProfile>(explorerProfile);
  explorerRef.current = explorerProfile;

  const playerEmoteRef = useRef<EmoteType>(playerEmote);
  playerEmoteRef.current = playerEmote;

  const playerAutoTargetRef = useRef<{
    x: number;
    z: number;
    targetId?: string;
    label?: string;
  } | null>(playerAutoTarget);
  playerAutoTargetRef.current = playerAutoTarget;

  const playerActiveBubbleRef = useRef<string | null>(playerActiveBubble);
  playerActiveBubbleRef.current = playerActiveBubble;

  const insideHouseModeRef = useRef<boolean>(insideHouseMode);
  insideHouseModeRef.current = insideHouseMode;

  const selectedCharIdRef = useRef<string | null>(selectedCharacterId);
  selectedCharIdRef.current = selectedCharacterId;

  const selectedBuildingIdRef = useRef<BuildingId | null>(selectedBuildingId);
  selectedBuildingIdRef.current = selectedBuildingId;

  const gameHourRef = useRef<number>(gameHour);
  gameHourRef.current = gameHour;

  const timePhaseRef = useRef<TimePhase>(timePhase);
  timePhaseRef.current = timePhase;

  const weatherRef = useRef<WeatherType>(weather);
  weatherRef.current = weather;

  const qualityRef = useRef<GraphicsQuality>(graphicsQuality);
  qualityRef.current = graphicsQuality;

  const joystickRef = useRef<{ x: number; y: number }>(joystickVector);
  joystickRef.current = joystickVector;

  const cameraOverrideRef = useRef<{ x: number; z: number } | null>(cameraTargetOverride);
  cameraOverrideRef.current = cameraTargetOverride;

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  const callbacksRef = useRef({
    onSelectCharacter,
    onSelectExplorer,
    onSelectBuilding,
    onSelectCreatedObject,
    onPlayerPositionChange,
    onPlayerAutoTargetReached,
    onClearCameraOverride,
    onTriggerBridgeReflections,
    onSelectTwoPlaceSpot,
    onPlayerStandUp,
    onVehicleTransitEvent,
  });
  callbacksRef.current = {
    onSelectCharacter,
    onSelectExplorer,
    onSelectBuilding,
    onSelectCreatedObject,
    onPlayerPositionChange,
    onPlayerAutoTargetReached,
    onClearCameraOverride,
    onTriggerBridgeReflections,
    onSelectTwoPlaceSpot,
    onPlayerStandUp,
    onVehicleTransitEvent,
  };

  // Dynamically apply Graphics Quality changes (Low / Medium / High) without recreating the scene
  useEffect(() => {
    const renderer = rendererRef.current;
    const dirLight = dirLightRef.current;
    if (!renderer || !dirLight) return;

    const dpr = window.devicePixelRatio || 1;
    if (graphicsQuality === 'low') {
      renderer.setPixelRatio(Math.min(dpr, 1.35));
      renderer.shadowMap.enabled = false;
      dirLight.castShadow = false;
    } else if (graphicsQuality === 'medium') {
      renderer.setPixelRatio(Math.min(dpr, 1.85));
      renderer.shadowMap.enabled = true;
      dirLight.castShadow = true;
    } else {
      renderer.setPixelRatio(Math.min(dpr, 2.25));
      renderer.shadowMap.enabled = true;
      dirLight.castShadow = true;
    }
    renderer.shadowMap.needsUpdate = true;
  }, [graphicsQuality]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#68a8e8');
    scene.fog = new THREE.FogExp2('#68a8e8', 0.0024);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      2200
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;

    const dpr = window.devicePixelRatio || 1;
    const initialDpr =
      qualityRef.current === 'low'
        ? Math.min(dpr, 1.35)
        : qualityRef.current === 'medium'
        ? Math.min(dpr, 1.85)
        : Math.min(dpr, 2.25);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(initialDpr);
    renderer.shadowMap.enabled = qualityRef.current !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // 2. High-Definition Procedural PBR Textures & Sky Environment Reflection Map
    const skyEnvTex = createSkyEnvTexture();
    scene.environment = skyEnvTex;

    const grassTex = createGrassTexture();
    const neoCityGroundTex = createNeoCityGroundTexture();
    const glassCurtainTex = createGlassCurtainWallTexture();
    const asphaltTex = createAsphaltTexture();
    const sidewalkTex = createPaverTexture('#dbe4ef', '#94a3b8');
    const plazaTex = createPaverTexture('#e2e8f0', '#cbd5e1');
    const waterNormalTex = createWaterNormalTexture();
    const sandTex = createSandTexture();
    const cliffRockTex = createCliffRockTexture();
    const woodDeckTex = createWoodPlankTexture('#9a5822');
    const barkTex = createTreeBarkTexture('#6b4423');
    const pineBarkTex = createTreeBarkTexture('#4a2c11');
    const pineFoliageTex = createFoliageTexture('pine');
    const oakFoliageTex = createFoliageTexture('oak');
    const sakuraFoliageTex = createFoliageTexture('sakura');
    const aoShadowTex = createContactAOShadowTexture();
    const tireTreadTex = createTireTreadTexture();

    // Helper to place ambient occlusion contact shadow beneath structures
    const addContactShadow = (parent: THREE.Object3D, width: number, depth: number, opacity = 0.55) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({
          map: aoShadowTex,
          transparent: true,
          depthWrite: false,
          opacity,
        })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 0.025;
      parent.add(plane);
    };

    // 3. Cinematic 3-Point Lighting & Sky Dome System (Key Sun/Moon + Hemisphere Bounce + Rim Backlight)
    const hemiLight = new THREE.HemisphereLight('#fffbeb', '#4d9c46', 1.12);
    hemiLight.position.set(0, 65, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#fff7ed', 1.68);
    dirLightRef.current = dirLight;
    dirLight.position.set(36, 48, 28);
    dirLight.castShadow = qualityRef.current !== 'low';
    const shadowRes = qualityRef.current === 'high' ? 2048 : 1536;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 185;
    const shadowBound = 68;
    dirLight.shadow.camera.left = -shadowBound;
    dirLight.shadow.camera.right = shadowBound;
    dirLight.shadow.camera.top = shadowBound;
    dirLight.shadow.camera.bottom = -shadowBound;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Subtle Rim / Back Fill Light to accentuate 3D contours of faces, hair, and 5-finger hands
    const rimLight = new THREE.DirectionalLight('#bae6fd', 0.52);
    rimLight.position.set(-34, 28, -32);
    scene.add(rimLight);

    // Sun / Moon Celestial Disc in Sky
    const celestialOrbMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      fog: false,
    });
    const celestialOrb = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 20), celestialOrbMat);
    scene.add(celestialOrb);

    // Drifting Volumetric 3D Cloud Clusters across the larger island sky
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.88,
    });
    const cloudCoords: [number, number, number, number][] = [
      [-45, 30, -52, 1.5],
      [38, 32, -44, 1.3],
      [-28, 31, 46, 1.25],
      [48, 29, 32, 1.45],
      [0, 34, -62, 1.6],
      [-56, 28, 12, 1.35],
      [58, 30, -8, 1.4],
      [14, 33, 58, 1.3],
    ];
    cloudCoords.forEach(([cx, cy, cz, cScale]) => {
      const cluster = new THREE.Group();
      cluster.position.set(cx, cy, cz);
      cluster.scale.setScalar(cScale);
      const puffs: [number, number, number, number][] = [
        [0, 0, 0, 2.2],
        [-1.8, -0.3, 0.4, 1.6],
        [1.8, -0.2, -0.3, 1.7],
        [0.6, 0.7, 0.5, 1.5],
      ];
      puffs.forEach(([px, py, pz, pr]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 12, 10), cloudMat);
        puff.position.set(px, py, pz);
        puff.scale.set(1.3, 0.68, 1.0);
        cluster.add(puff);
      });
      cloudsGroup.add(cluster);
    });

    // 4. Grounded Island Landmass, Golden Sandy Beaches & Floating Rippling Sea Water
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 4A. Deep Seabed Ocean Floor (Spans across Gemini City, Suspension Bridge, Neo-Horizon & Extended 750m Northern Shinobi Region)
    const seabedGeo = new THREE.CylinderGeometry(1450, 1450, 2.0, 48);
    const seabedMat = new THREE.MeshStandardMaterial({
      color: '#0369a1',
      roughness: 0.9,
    });
    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    seabedMesh.position.set(95, -6.2, -320);
    worldGroup.add(seabedMesh);

    // 4B. Animated Crystalline Sea Water Expanse (🌊 2500m x 2500m with realistic wave caustics & sky reflections)
    const waterGeo = new THREE.PlaneGeometry(2500, 2500, 44, 44);
    waterGeo.rotateX(-Math.PI / 2);
    const waterPosAttr = waterGeo.getAttribute('position') as THREE.BufferAttribute;
    const waterPosArr = waterPosAttr.array as Float32Array;
    const waterBaseXZ = new Float32Array(waterPosAttr.count * 2);
    for (let i = 0; i < waterPosAttr.count; i++) {
      waterBaseXZ[i * 2] = waterPosArr[i * 3];
      waterBaseXZ[i * 2 + 1] = waterPosArr[i * 3 + 2];
    }

    const waterMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: waterNormalTex,
      emissive: '#0284c7',
      emissiveIntensity: 0.14,
      roughness: 0.14,
      metalness: 0.18,
      transparent: true,
      opacity: 0.94,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(95, -0.85, 0);
    waterMesh.receiveShadow = true;
    worldGroup.add(waterMesh);

    // Shallow Turquoise Coastal Lagoon Reef Shelf around the Island
    const lagoonGeo = new THREE.CylinderGeometry(84, 96, 1.4, 72);
    const lagoonMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      map: waterNormalTex,
      emissive: '#0891b2',
      emissiveIntensity: 0.12,
      roughness: 0.2,
      metalness: 0.12,
      transparent: true,
      opacity: 0.68,
    });
    const lagoonMesh = new THREE.Mesh(lagoonGeo, lagoonMat);
    lagoonMesh.position.set(0, -1.52, 0);
    worldGroup.add(lagoonMesh);

    // Animated White Sea-Foam Shoreline Wave Rings washing onto the golden sand beach
    const foamRingMat1 = new THREE.MeshBasicMaterial({
      color: '#f0f9ff',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const foamRingMat2 = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
    });
    const foamRing1 = new THREE.Mesh(new THREE.RingGeometry(71.2, 72.8, 72), foamRingMat1);
    foamRing1.rotation.x = -Math.PI / 2;
    foamRing1.position.y = -0.74;
    worldGroup.add(foamRing1);

    const foamRing2 = new THREE.Mesh(new THREE.RingGeometry(73.4, 74.8, 72), foamRingMat2);
    foamRing2.rotation.x = -Math.PI / 2;
    foamRing2.position.y = -0.76;
    worldGroup.add(foamRing2);

    // 4C. Deep Submarine Bedrock & Tiered Coastal Granite Cliff Foundation (Rooted into Seabed)
    const bedrockMat = new THREE.MeshStandardMaterial({
      map: cliffRockTex,
      color: '#cbd5e1',
      roughness: 0.84,
    });
    const deepBedrock = new THREE.Mesh(new THREE.CylinderGeometry(74.5, 88, 5.6, 64), bedrockMat);
    deepBedrock.position.set(0, -3.65, 0);
    deepBedrock.receiveShadow = true;
    worldGroup.add(deepBedrock);

    // Golden Sandy Beach Shoreline & Sloping Coastal Cove Ring (Top at y = -0.06, cleanly below grass!)
    const beachMat = new THREE.MeshStandardMaterial({
      map: sandTex,
      color: '#ffffff',
      roughness: 0.82,
    });
    const beachSlope = new THREE.Mesh(new THREE.CylinderGeometry(64.8, 73.6, 1.44, 72), beachMat);
    beachSlope.position.set(0, -0.78, 0);
    beachSlope.receiveShadow = true;
    beachSlope.userData = { type: 'ground' };
    worldGroup.add(beachSlope);

    // Sculpted Coastal Stone Retaining Ledge (Top at y = -0.08, strictly below groundMesh so it never overlaps!)
    const cliffMesh = new THREE.Mesh(new THREE.CylinderGeometry(64.9, 66.4, 0.88, 72), bedrockMat);
    cliffMesh.position.set(0, -0.52, 0);
    cliffMesh.receiveShadow = true;
    worldGroup.add(cliffMesh);

    // Natural Coastal Boulders & Sea Rocks along the Island Shoreline
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2 + (i % 3) * 0.06;
      // Leave South Harbor Pier channel (angle ~ PI/2) and East Suspension Bridge Gateway (angle ~ 0) clear
      if (
        Math.abs(angle - Math.PI / 2) < 0.14 ||
        angle < 0.18 ||
        angle > Math.PI * 2 - 0.18
      ) {
        continue;
      }
      const r = 65.5 + (i % 5) * 1.65;
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;
      const rockSize = 1.1 + (i % 4) * 0.65;
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rockSize, 1),
        bedrockMat
      );
      boulder.position.set(bx, -0.55 + (i % 3) * 0.18, bz);
      boulder.scale.set(1.3, 0.72, 1.15);
      boulder.rotation.set(i * 0.4, i * 1.1, (i % 2) * 0.2);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      worldGroup.add(boulder);
    }

    // Distant Horizon Archipelago Islands & Mountain Peaks in the Sea
    const distantIslandGrassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: '#4ade80',
      roughness: 0.85,
    });
    const distantIslands: [number, number, number, number][] = [
      [-175, -145, 38, 22],
      [185, -130, 44, 26],
      [-190, 115, 34, 18],
      [165, 155, 42, 24],
      [-88, -210, 36, 24], // Reshaped and relocated away from highway to ensure completely clear road to Hidden Ninja Village!
      [95, -185, 46, 28],
      [95, 175, 40, 22],
    ];
    distantIslands.forEach(([ix, iz, ir, ih]) => {
      const isleGroup = new THREE.Group();
      isleGroup.position.set(ix, -1.5, iz);
      // Sandy beach ring around distant island
      const isleBeach = new THREE.Mesh(
        new THREE.CylinderGeometry(ir * 1.04, ir * 1.18, 1.6, 24),
        beachMat
      );
      isleBeach.position.y = 0.8;
      isleGroup.add(isleBeach);
      const base = new THREE.Mesh(new THREE.ConeGeometry(ir, ih, 20), bedrockMat);
      base.position.y = ih * 0.42;
      isleGroup.add(base);
      const lushCap = new THREE.Mesh(
        new THREE.ConeGeometry(ir * 0.76, ih * 0.68, 20),
        distantIslandGrassMat
      );
      lushCap.position.y = ih * 0.58;
      isleGroup.add(lushCap);
      worldGroup.add(isleGroup);
    });

    // 4D. Expansive Lush Meadow Grass Island Terrain (Radius 65m — Vibrant, Sunlit & Realistic!)
    const groundGeo = new THREE.CylinderGeometry(64.8, 65.2, 0.52, 72);
    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: '#ffffff',
      roughness: 0.84,
      metalness: 0.0,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -0.24, 0); // Top surface at y = +0.02, cleanly above cliffMesh (-0.08) and beachSlope (-0.06)
    groundMesh.receiveShadow = true;
    groundMesh.userData = { type: 'ground' };
    worldGroup.add(groundMesh);

    // Scenic Rolling Green Meadow Knolls & Wildflower Garden Beds across the Island
    const knollCoords: [number, number, number, number][] = [
      [-46, -34, 11.5, 0.65],
      [46, -34, 11.0, 0.6],
      [-46, 34, 10.5, 0.58],
      [44, 34, 10.0, 0.55],
      [-24, -48, 9.5, 0.52],
      [24, -48, 9.5, 0.52],
    ];
    knollCoords.forEach(([kx, kz, kr, kh]) => {
      const knoll = new THREE.Mesh(
        new THREE.CylinderGeometry(kr * 0.68, kr, kh, 24),
        groundMat
      );
      knoll.position.set(kx, kh * 0.35, kz);
      knoll.receiveShadow = true;
      knoll.userData = { type: 'ground' };
      worldGroup.add(knoll);
    });

    // Colorful 3D Wildflower & Botanical Garden Beds bordering Central Park & Avenues
    const flowerColors = ['#f43f5e', '#fbbf24', '#c084fc', '#38bdf8', '#fb7185', '#f97316'];
    const flowerPatchCoords: [number, number, number][] = [
      [-5.6, -3.6, 1.4],
      [5.6, -3.6, 1.4],
      [-5.6, 4.8, 1.4],
      [5.6, 4.8, 1.4],
      [-14.2, -14.2, 1.8],
      [14.2, -14.2, 1.8],
      [-14.2, 14.2, 1.8],
      [14.2, 14.2, 1.8],
      [-4.2, 28, 1.6],
      [4.2, 28, 1.6],
      [-4.2, 42, 1.6],
      [4.2, 42, 1.6],
    ];
    flowerPatchCoords.forEach(([fx, fz, fr], fIdx) => {
      const patchGroup = new THREE.Group();
      patchGroup.position.set(fx, 0.03, fz);
      const turfRing = new THREE.Mesh(
        new THREE.CylinderGeometry(fr, fr + 0.18, 0.08, 18),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.85 })
      );
      turfRing.position.y = 0.04;
      patchGroup.add(turfRing);
      for (let b = 0; b < 7; b++) {
        const ang = (b / 7) * Math.PI * 2;
        const dist = b === 0 ? 0 : fr * 0.58;
        const blossom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24 + (b % 2) * 0.06, 1),
          new THREE.MeshStandardMaterial({
            color: flowerColors[(fIdx + b) % flowerColors.length],
            roughness: 0.6,
          })
        );
        blossom.position.set(Math.cos(ang) * dist, 0.16, Math.sin(ang) * dist);
        blossom.scale.set(1.2, 0.7, 1.2);
        patchGroup.add(blossom);
      }
      worldGroup.add(patchGroup);
    });

    // 4E. South Harbor Wooden Boardwalk Pier & Coastal Lighthouse overlooking the Sea
    const pierDeckMat = new THREE.MeshStandardMaterial({
      map: woodDeckTex,
      color: '#ffffff',
      roughness: 0.72,
    });
    const pierGroup = new THREE.Group();
    worldGroup.add(pierGroup);

    const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 24), pierDeckMat);
    pierDeck.position.set(0, 0.12, 68);
    pierDeck.castShadow = true;
    pierDeck.receiveShadow = true;
    pierDeck.userData = { type: 'ground' };
    pierGroup.add(pierDeck);

    // Wooden Pier Support Pilings & Mooring Bollards in the Sea
    const pilingMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.88 });
    for (let pz = 58; pz <= 79; pz += 4.2) {
      for (const px of [-2.3, 2.3]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.4, 10), pilingMat);
        piling.position.set(px, -0.75, pz);
        piling.castShadow = true;
        pierGroup.add(piling);
      }
    }

    // Coastal Harbor Lighthouse on the Southeast Rocky Point
    const lighthouseGroup = new THREE.Group();
    lighthouseGroup.position.set(44, 0, 46);
    addContactShadow(lighthouseGroup, 6.5, 6.5, 0.6);
    const lhRockBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 1.6, 16), bedrockMat);
    lhRockBase.position.y = 0.6;
    lighthouseGroup.add(lhRockBase);
    const lhTower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.95, 9.5, 20),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 })
    );
    lhTower.position.y = 5.6;
    lhTower.castShadow = true;
    lighthouseGroup.add(lhTower);
    const lhRedBand = new THREE.Mesh(
      new THREE.CylinderGeometry(1.52, 1.72, 2.6, 20),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.55 })
    );
    lhRedBand.position.y = 5.8;
    lighthouseGroup.add(lhRedBand);
    const lhLanternRoom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 1.5, 16),
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.95,
        roughness: 0.15,
      })
    );
    lhLanternRoom.position.y = 11.0;
    lighthouseGroup.add(lhLanternRoom);
    const lhCap = new THREE.Mesh(
      new THREE.ConeGeometry(1.45, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.5 })
    );
    lhCap.position.y = 12.4;
    lighthouseGroup.add(lhCap);
    worldGroup.add(lighthouseGroup);

    const pickableObjects: THREE.Object3D[] = [
      groundMesh,
      beachSlope,
      pierDeck,
    ];

    // 5. Realistic Roads, Curbs, Sidewalks, Crosswalks, 3D Traffic Lights 🚦⛔ & Bus Parking Depot 🅿️🚏
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: '#ffffff',
      roughness: 0.78,
      metalness: 0.06,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      color: '#ffffff',
      roughness: 0.76,
    });
    const curbStoneMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.62,
      metalness: 0.08,
    });
    const drainGrateMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.4,
      metalness: 0.85,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.48,
    });
    const centerLineMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.45,
    });
    const roadReflectorMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#f59e0b',
      emissiveIntensity: 1.15,
      roughness: 0.2,
    });

    const createRoadSegment = (x: number, z: number, w: number, l: number, isNorthSouth: boolean) => {
      // Raised Stone Sidewalk & Curb Base
      const sw = new THREE.Mesh(new THREE.BoxGeometry(w + 1.75, 0.11, l + 1.75), sidewalkMat);
      sw.position.set(x, 0.035, z);
      sw.receiveShadow = true;
      sw.userData = { type: 'ground' };
      worldGroup.add(sw);

      // Raised Beveled Granite Curbstones along Left & Right Roadway Edges
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(isNorthSouth ? 0.16 : w, 0.13, isNorthSouth ? l : 0.16),
          curbStoneMat
        );
        curb.position.set(
          isNorthSouth ? x + side * (w * 0.5 + 0.08) : x,
          0.055,
          isNorthSouth ? z : z + side * (l * 0.5 + 0.08)
        );
        curb.receiveShadow = true;
        worldGroup.add(curb);

        // Crisp White Shoulder Edge Line inside roadway
        const edgeLine = new THREE.Mesh(
          new THREE.BoxGeometry(isNorthSouth ? 0.07 : w - 0.4, 0.018, isNorthSouth ? l - 0.4 : 0.07),
          stripeMat
        );
        edgeLine.position.set(
          isNorthSouth ? x + side * (w * 0.5 - 0.22) : x,
          0.094,
          isNorthSouth ? z : z + side * (l * 0.5 - 0.22)
        );
        worldGroup.add(edgeLine);
      }

      // Asphalt Roadway Bed
      const rd = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), roadMat);
      rd.position.set(x, 0.048, z);
      rd.receiveShadow = true;
      rd.userData = { type: 'ground' };
      worldGroup.add(rd);

      // Realistic Double Yellow Center Line + Dashed Lane Markings + Cat's-Eye Reflector Studs + Storm Drains
      const totalLen = isNorthSouth ? l : w;
      const steps = Math.floor(totalLen / 3.2);
      for (let i = -Math.floor(steps / 2); i <= Math.floor(steps / 2); i++) {
        const offset = i * 3.2;
        // Skip markings directly inside intersection boxes (±10.5)
        if (Math.abs(offset) >= 8.0 && Math.abs(offset) <= 13.0) continue;

        // Twin parallel yellow center lines
        for (const sep of [-0.075, 0.075]) {
          const yellowLine = new THREE.Mesh(
            new THREE.BoxGeometry(
              isNorthSouth ? 0.065 : 2.55,
              0.02,
              isNorthSouth ? 2.55 : 0.065
            ),
            centerLineMat
          );
          yellowLine.position.set(
            isNorthSouth ? x + sep : x + offset,
            0.096,
            isNorthSouth ? z + offset : z + sep
          );
          worldGroup.add(yellowLine);
        }

        // Reflective Cat's-Eye Road Stud every 2nd segment
        if (i % 2 === 0) {
          const stud = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.11), roadReflectorMat);
          stud.position.set(
            isNorthSouth ? x : x + offset,
            0.098,
            isNorthSouth ? z + offset : z
          );
          worldGroup.add(stud);
        }

        // Cast-iron Curbside Storm Drain Grates every 4th segment
        if (i % 4 === 0 && Math.abs(offset) > 3.5) {
          for (const side of [-1, 1]) {
            const grate = new THREE.Mesh(
              new THREE.BoxGeometry(isNorthSouth ? 0.28 : 0.56, 0.022, isNorthSouth ? 0.56 : 0.28),
              drainGrateMat
            );
            grate.position.set(
              isNorthSouth ? x + side * (w * 0.5 - 0.16) : x + offset,
              0.095,
              isNorthSouth ? z + offset : z + side * (l * 0.5 - 0.16)
            );
            worldGroup.add(grate);
          }
        }
      }
    };

    // Expanded West & East Grand Avenues
    createRoadSegment(-10.5, 0, 3.8, 64, true);
    createRoadSegment(10.5, 0, 3.8, 64, true);
    // Expanded North & South Boulevards
    createRoadSegment(0, -10.5, 66, 3.8, false);
    createRoadSegment(0, 10.5, 66, 3.8, false);
    // South Harbor Promenade connecting Central Plaza to the Harbor Boardwalk Pier
    createRoadSegment(0, 34, 3.4, 44, true);
    // East Bay Bridge Approach Highway connecting Gemini City to the Golden Horizon Suspension Bridge!
    createRoadSegment(36.5, 0, 48, 4.6, false);

    // Scenic Forest & Coastal Exploration Stone Footpaths
    const trailMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      color: '#e2e8f0',
      roughness: 0.78,
    });
    const createScenicTrail = (x: number, z: number, w: number, l: number, rotY = 0) => {
      const trail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, l), trailMat);
      trail.position.set(x, 0.032, z);
      trail.rotation.y = rotY;
      trail.receiveShadow = true;
      trail.userData = { type: 'ground' };
      worldGroup.add(trail);
    };
    // Forest & Coastal Exploration Trails
    createScenicTrail(-36, 0, 2.2, 46, 0);
    createScenicTrail(36, 0, 2.2, 46, 0);
    createScenicTrail(0, -38, 48, 2.2, 0);
    createScenicTrail(0, 42, 46, 2.2, 0);

    // =========================================================================================
    // 5A-1. 4-WAY CONTINENTAL CROSSWALKS, WHITE STOP LINES & REAL 3D TRAFFIC LIGHTS (🚦⛔)
    // =========================================================================================
    interface TrafficSignalVisual {
      axis: 'ns' | 'ew';
      redLensMat: THREE.MeshStandardMaterial;
      yellowLensMat: THREE.MeshStandardMaterial;
      greenLensMat: THREE.MeshStandardMaterial;
      pedSignalMat: THREE.MeshStandardMaterial;
    }
    const trafficSignalVisuals: TrafficSignalVisual[] = [];

    const signalIntersections: { x: number; z: number; label: string; isNeo?: boolean }[] = [
      { x: -10.5, z: -10.5, label: 'NW Solaris & Academy Jct' },
      { x: 10.5, z: -10.5, label: 'NE Blossom & Academy Jct' },
      { x: -10.5, z: 10.5, label: 'SW Sunbeam Café Jct' },
      { x: 10.5, z: 10.5, label: 'SE Starlight Park & Harbor Jct' },
      { x: 182.0, z: 0.0, label: 'Cyber-Horizon Grand Plaza Jct', isNeo: true },
    ];

    const signalPoleMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.32,
      metalness: 0.85,
    });
    const signalHousingMat = new THREE.MeshStandardMaterial({
      color: '#eab308',
      roughness: 0.35,
      metalness: 0.45,
    });
    const signalVisorMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.4,
      metalness: 0.7,
    });

    signalIntersections.forEach((inter) => {
      const ix = inter.x;
      const iz = inter.z;

      // 1) 4-Way Continental Zebra Crosswalks & White Stop Bars on North, South, East, West approaches
      for (const side of [-1, 1]) {
        // North & South Crosswalks + White Stop Bars
        for (let s = -1.44; s <= 1.44; s += 0.48) {
          const nsStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 1.35), stripeMat);
          nsStripe.position.set(ix + s, 0.097, iz + side * 2.55);
          worldGroup.add(nsStripe);

          const ewStripe = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.026, 0.24), stripeMat);
          ewStripe.position.set(ix + side * 2.55, 0.097, iz + s);
          worldGroup.add(ewStripe);
        }

        // Solid White Stop Line Bars before each crosswalk
        const nsStopBar = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.027, 0.26), stripeMat);
        nsStopBar.position.set(ix, 0.098, iz + side * 3.55);
        worldGroup.add(nsStopBar);

        const ewStopBar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.027, 3.3), stripeMat);
        ewStopBar.position.set(ix + side * 3.55, 0.098, iz);
        worldGroup.add(ewStopBar);
      }

      // 2) Build 2 Cantilevered 3D Traffic Signal Masts per Intersection (1 controlling NS, 1 controlling EW)
      const signalCorners: {
        cx: number;
        cz: number;
        rotY: number;
        axis: 'ns' | 'ew';
      }[] = [
        { cx: ix + 2.65, cz: iz - 2.65, rotY: 0, axis: 'ns' },
        { cx: ix - 2.65, cz: iz + 2.65, rotY: Math.PI / 2, axis: 'ew' },
      ];

      signalCorners.forEach((sc) => {
        const sigGroup = new THREE.Group();
        sigGroup.position.set(sc.cx, 0, sc.cz);
        sigGroup.rotation.y = sc.rotY;

        // Octagonal cast-iron base & vertical mast pole
        const basePedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.22, 0.55, 8),
          signalPoleMat
        );
        basePedestal.position.y = 0.28;
        basePedestal.castShadow = true;
        basePedestal.userData = { type: 'traffic_light' };
        sigGroup.add(basePedestal);
        pickableObjects.push(basePedestal);

        const verticalPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.11, 4.6, 12),
          signalPoleMat
        );
        verticalPole.position.y = 2.45;
        verticalPole.castShadow = true;
        verticalPole.userData = { type: 'traffic_light' };
        sigGroup.add(verticalPole);
        pickableObjects.push(verticalPole);

        // Overhanging horizontal cantilevered mast arm reaching over the road lane
        const mastArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.075, 2.85, 10),
          signalPoleMat
        );
        mastArm.rotation.z = Math.PI / 2;
        mastArm.position.set(-1.38, 4.55, 0);
        mastArm.castShadow = true;
        sigGroup.add(mastArm);

        // Illuminated Street Name Sign Blade mounted on mast arm
        const streetSign = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.24, 0.06),
          new THREE.MeshStandardMaterial({
            color: '#0284c7',
            emissive: '#0369a1',
            emissiveIntensity: 0.45,
            roughness: 0.3,
          })
        );
        streetSign.position.set(-0.95, 4.55, 0.08);
        sigGroup.add(streetSign);

        // 3-Aspect Traffic Signal Head Housing (Red ⛔ Top, Yellow ⚠️ Mid, Green 🟢 Bottom)
        const headBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 1.06, 0.28),
          signalHousingMat
        );
        headBox.position.set(-2.25, 4.22, 0);
        headBox.castShadow = true;
        headBox.userData = { type: 'traffic_light' };
        sigGroup.add(headBox);
        pickableObjects.push(headBox);

        // Dark backplate border frame for high visibility
        const backplate = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 1.16, 0.04),
          signalVisorMat
        );
        backplate.position.set(-2.25, 4.22, -0.12);
        sigGroup.add(backplate);

        const redLensMat = new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#ef4444',
          emissiveIntensity: 2.2,
          roughness: 0.15,
        });
        const yellowLensMat = new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#f59e0b',
          emissiveIntensity: 0.08,
          roughness: 0.15,
        });
        const greenLensMat = new THREE.MeshStandardMaterial({
          color: '#22c55e',
          emissive: '#22c55e',
          emissiveIntensity: 0.08,
          roughness: 0.15,
        });
        const pedSignalMat = new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#38bdf8',
          emissiveIntensity: 1.2,
          roughness: 0.2,
        });

        const lensOffsets: [number, THREE.MeshStandardMaterial][] = [
          [4.54, redLensMat],    // Top: RED STOP ⛔
          [4.22, yellowLensMat], // Mid: AMBER CAUTION ⚠️
          [3.90, greenLensMat],  // Bot: GREEN GO 🟢
        ];

        lensOffsets.forEach(([ly, lMat]) => {
          // Front & Rear Dual-Faced Signal Lenses so visible from both approaches!
          for (const faceDir of [-1, 1]) {
            const lens = new THREE.Mesh(
              new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16),
              lMat
            );
            lens.rotation.x = Math.PI / 2;
            lens.position.set(-2.25, ly, faceDir * 0.15);
            sigGroup.add(lens);

            const visor = new THREE.Mesh(
              new THREE.CylinderGeometry(0.125, 0.125, 0.14, 14, 1, true, 0, Math.PI),
              signalVisorMat
            );
            visor.rotation.z = Math.PI / 2;
            visor.rotation.y = faceDir > 0 ? 0 : Math.PI;
            visor.position.set(-2.25, ly + 0.02, faceDir * 0.18);
            sigGroup.add(visor);
          }
        });

        // Pedestrian Crosswalk Signal Box on vertical pole
        const pedBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.34, 0.18),
          signalVisorMat
        );
        pedBox.position.set(-0.14, 2.15, 0);
        sigGroup.add(pedBox);

        const pedLens = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.22, 0.2),
          pedSignalMat
        );
        pedLens.position.set(-0.14, 2.15, 0);
        sigGroup.add(pedLens);

        worldGroup.add(sigGroup);
        trafficSignalVisuals.push({
          axis: sc.axis,
          redLensMat,
          yellowLensMat,
          greenLensMat,
          pedSignalMat,
        });
      });
    });

    // =========================================================================================
    // 5A-2. DEDICATED 3D BUS PARKING DEPOT & CHARGING STATION (🅿️🚏) AT (-15.4, 0, -2.0)
    //       + CYBER-CAR VIP PARKING PAD (🅿️🏎️) AT (13.8, 0, 5.2)
    // =========================================================================================
    const BUS_DEPOT_COORDS = { x: -15.4, z: -2.0, rotY: 0 };
    const busDepotGroup = new THREE.Group();
    busDepotGroup.position.set(BUS_DEPOT_COORDS.x, 0, BUS_DEPOT_COORDS.z);
    addContactShadow(busDepotGroup, 6.2, 10.6, 0.55);

    // Asphalt Pull-In Apron connecting West Grand Avenue (x = -10.5) to the Depot Bay
    const depotApron = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.095, 10.4), roadMat);
    depotApron.position.set(0.8, 0.045, 0);
    depotApron.receiveShadow = true;
    depotApron.userData = { type: 'bus_depot' };
    busDepotGroup.add(depotApron);
    pickableObjects.push(depotApron);

    // Painted Yellow "BUS PARKING ONLY" Bay Boundary Lines & Wheel-Stop Chocks
    const depotLineMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#ca8a04',
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    for (const sideX of [-1.75, 1.75]) {
      const sideBayLine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 8.8), depotLineMat);
      sideBayLine.position.set(sideX, 0.096, 0);
      busDepotGroup.add(sideBayLine);
    }
    for (const endZ of [-4.4, 4.4]) {
      const endBayLine = new THREE.Mesh(new THREE.BoxGeometry(3.64, 0.025, 0.14), depotLineMat);
      endBayLine.position.set(0, 0.096, endZ);
      busDepotGroup.add(endBayLine);

      // Heavy rubber/concrete wheel-stop chock bar
      const wheelChock = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.26), depotLineMat);
      wheelChock.position.set(0, 0.14, endZ * 0.88);
      wheelChock.castShadow = true;
      busDepotGroup.add(wheelChock);
    }

    // High-Clearance Solar-Glass Bus Depot Canopy Roof (4.15m tall so the luxury bus parks underneath!)
    for (const pz of [-3.6, 0, 3.6]) {
      const depotPillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 4.1, 12),
        signalPoleMat
      );
      depotPillar.position.set(-2.15, 2.05, pz);
      depotPillar.castShadow = true;
      busDepotGroup.add(depotPillar);
    }
    const depotRoofCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.14, 9.4),
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#0369a1',
        emissiveIntensity: 0.32,
        transparent: true,
        opacity: 0.68,
        roughness: 0.15,
        metalness: 0.5,
      })
    );
    depotRoofCanopy.position.set(-0.2, 4.12, 0);
    depotRoofCanopy.rotation.z = -0.05;
    depotRoofCanopy.castShadow = true;
    depotRoofCanopy.userData = { type: 'bus_depot' };
    busDepotGroup.add(depotRoofCanopy);
    pickableObjects.push(depotRoofCanopy);

    // Depot Illuminated Signboard & Electric Bus Charging Pantograph Totem
    const depotStatusGlowMat = new THREE.MeshStandardMaterial({
      color: '#34d399',
      emissive: '#10b981',
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const depotSignBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.62, 4.6),
      depotStatusGlowMat
    );
    depotSignBoard.position.set(1.85, 4.28, 0);
    depotSignBoard.userData = { type: 'bus_depot' };
    busDepotGroup.add(depotSignBoard);
    pickableObjects.push(depotSignBoard);

    worldGroup.add(busDepotGroup);

    // Build 3D Cyber-Valkyrie GT VIP Parking & Induction Charging Pad at (13.8, 0, 5.2) beside East Grand Ave
    const carParkingPadGroup = new THREE.Group();
    carParkingPadGroup.position.set(13.8, 0, 5.2);
    const carPadApron = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.095, 6.4), roadMat);
    carPadApron.position.set(-0.6, 0.045, 0);
    carPadApron.receiveShadow = true;
    carParkingPadGroup.add(carPadApron);

    const carInductionMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0891b2',
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });
    const carInductionRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 32),
      carInductionMat
    );
    carInductionRing.rotation.x = -Math.PI / 2;
    carInductionRing.position.set(0, 0.098, 0);
    carParkingPadGroup.add(carInductionRing);
    worldGroup.add(carParkingPadGroup);

    // 5B. Realistic Flowing Scenic Rivers ("Silverbrook River" & "Sakura Creek"), Alpine Waterfall & Arched Stone Bridges
    const riverWaterTex = waterNormalTex.clone();
    riverWaterTex.needsUpdate = true;
    riverWaterTex.repeat.set(4, 18);
    const riverWaterMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      map: riverWaterTex,
      emissive: '#0284c7',
      emissiveIntensity: 0.24,
      roughness: 0.08,
      metalness: 0.32,
      transparent: true,
      opacity: 0.92,
    });
    const riverCobbleMat = new THREE.MeshStandardMaterial({
      map: cliffRockTex,
      color: '#94a3b8',
      roughness: 0.76,
    });
    const lilyPadMat = new THREE.MeshStandardMaterial({
      color: '#16a34a',
      roughness: 0.65,
    });
    const waterLilyMat = new THREE.MeshStandardMaterial({
      color: '#fbcfe8',
      emissive: '#f472b6',
      emissiveIntensity: 0.2,
      roughness: 0.4,
    });

    const buildScenicRiverChannel = (rx: number, rzStart: number, rzEnd: number, width = 3.2) => {
      const length = Math.abs(rzEnd - rzStart);
      const midZ = (rzStart + rzEnd) * 0.5;
      const rGroup = new THREE.Group();
      rGroup.position.set(rx, 0, midZ);

      // Pebbled riverbed & stone embankment curbs
      const riverbed = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.9, 0.06, length + 0.6),
        riverCobbleMat
      );
      riverbed.position.y = 0.015;
      riverbed.receiveShadow = true;
      rGroup.add(riverbed);

      // Flowing crystalline river water surface
      const waterStrip = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.065, length),
        riverWaterMat
      );
      waterStrip.position.y = 0.032;
      waterStrip.receiveShadow = true;
      waterStrip.userData = { type: 'ground' };
      rGroup.add(waterStrip);

      // Smooth riverbank boulders, reeds & floating water lilies along both banks
      const steps = Math.max(3, Math.floor(length / 4.2));
      for (let i = 0; i <= steps; i++) {
        const localZ = -length * 0.46 + (i / steps) * (length * 0.92);
        for (const side of [-1, 1]) {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.32 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.12, 1),
            riverCobbleMat
          );
          rock.position.set(
            side * (width * 0.5 + 0.28 + ((i * 3) % 2) * 0.12),
            0.1,
            localZ + side * 0.22
          );
          rock.scale.set(1.25, 0.62, 1.15);
          rock.castShadow = true;
          rock.receiveShadow = true;
          rGroup.add(rock);
        }

        // Floating emerald lily pad & lotus blossom on calm river stretches
        if (i % 2 === 0) {
          const padX = (i % 4 === 0 ? -1 : 1) * (width * 0.24);
          const lilyPad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.34, 0.02, 14),
            lilyPadMat
          );
          lilyPad.position.set(padX, 0.068, localZ);
          rGroup.add(lilyPad);

          const lotus = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.12, 1),
            waterLilyMat
          );
          lotus.position.set(padX, 0.11, localZ);
          lotus.scale.set(1.2, 0.75, 1.2);
          rGroup.add(lotus);
        }
      }

      worldGroup.add(rGroup);
    };

    // Western Silverbrook River (Flows from Northern Waterfall Pool z = -52 down to Southern Coastal Lagoon z = +54 along x = -25.5)
    buildScenicRiverChannel(-25.5, -52, -12.6, 3.2);
    buildScenicRiverChannel(-25.5, -8.4, 8.4, 3.2);
    buildScenicRiverChannel(-25.5, 12.6, 54, 3.4);

    // Eastern Sakura Creek (Flows through East Blossom Meadows along x = 25.5, clear of Bridge Highway at z = 0)
    buildScenicRiverChannel(25.5, -50, -12.6, 2.9);
    buildScenicRiverChannel(25.5, 12.6, 52, 3.1);

    // Northern Alpine Waterfall & Spring Lagoon Headwaters (at x = -25.5, z = -53.5)
    const waterfallGroup = new THREE.Group();
    waterfallGroup.position.set(-25.5, 0, -53.5);
    const cliffMass = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.6, 4.8, 16),
      bedrockMat
    );
    cliffMass.position.set(0, 2.2, -1.6);
    cliffMass.castShadow = true;
    cliffMass.receiveShadow = true;
    waterfallGroup.add(cliffMass);

    const cascadeSheet = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 4.4, 0.45),
      riverWaterMat
    );
    cascadeSheet.position.set(0, 2.1, -0.1);
    cascadeSheet.rotation.x = 0.22;
    waterfallGroup.add(cascadeSheet);

    const plungePool = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.8, 0.08, 24),
      riverWaterMat
    );
    plungePool.position.set(0, 0.036, 1.1);
    waterfallGroup.add(plungePool);

    const poolFoam = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 2.2, 24),
      foamRingMat1
    );
    poolFoam.rotation.x = -Math.PI / 2;
    poolFoam.position.set(0, 0.08, 0.8);
    waterfallGroup.add(poolFoam);
    worldGroup.add(waterfallGroup);

    // Arched Stone & Timber Footbridges carrying Boulevards & Trails across the Rivers
    const bridgeArchStoneMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      color: '#cbd5e1',
      roughness: 0.65,
    });
    const buildStoneRiverBridge = (bx: number, bz: number, spanW = 4.6, deckDepth = 3.8) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0, bz);

      // Arched stone deck
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(spanW, 0.18, deckDepth),
        bridgeArchStoneMat
      );
      deck.position.y = 0.16;
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.userData = { type: 'ground' };
      bGroup.add(deck);

      // Low stone parapet walls & timber top rails on North & South sides of bridge
      for (const sideZ of [-1, 1]) {
        const parapet = new THREE.Mesh(
          new THREE.BoxGeometry(spanW, 0.58, 0.24),
          bridgeArchStoneMat
        );
        parapet.position.set(0, 0.48, sideZ * (deckDepth * 0.5 - 0.12));
        parapet.castShadow = true;
        bGroup.add(parapet);

        for (const postX of [-spanW * 0.45, spanW * 0.45]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.78, 0.34),
            bridgeArchStoneMat
          );
          post.position.set(postX, 0.56, sideZ * (deckDepth * 0.5 - 0.12));
          post.castShadow = true;
          bGroup.add(post);

          const lantern = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 10, 10),
            new THREE.MeshStandardMaterial({
              color: '#fef08a',
              emissive: '#f59e0b',
              emissiveIntensity: 0.85,
              roughness: 0.2,
            })
          );
          lantern.position.set(postX, 1.02, sideZ * (deckDepth * 0.5 - 0.12));
          bGroup.add(lantern);
        }
      }
      worldGroup.add(bGroup);
    };

    // Bridges where North & South Boulevards and Woodland Trails cross Silverbrook River & Sakura Creek
    buildStoneRiverBridge(-25.5, -10.5, 4.8, 4.2);
    buildStoneRiverBridge(-25.5, 10.5, 4.8, 4.2);
    buildStoneRiverBridge(-25.5, -38, 4.4, 2.8);
    buildStoneRiverBridge(-25.5, 42, 4.4, 2.8);
    buildStoneRiverBridge(25.5, -10.5, 4.8, 4.2);
    buildStoneRiverBridge(25.5, 10.5, 4.8, 4.2);

    // 6. Central Starlight Park (Cobblestone Plaza, Tiered Architectural Fountain, Benches)
    const plazaGeo = new THREE.CylinderGeometry(7.5, 7.5, 0.12, 36);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      color: '#ffffff',
      roughness: 0.72,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.set(0, 0.04, 1);
    plazaMesh.receiveShadow = true;
    plazaMesh.userData = { type: 'ground' };
    worldGroup.add(plazaMesh);

    const fountainGroup = new THREE.Group();
    fountainGroup.position.set(0, 0.09, 1);
    fountainGroup.userData = { type: 'building', buildingId: 'park' };
    worldGroup.add(fountainGroup);
    addContactShadow(fountainGroup, 6.2, 6.2, 0.5);

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.55 });
    const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.75, 0.62, 28), stoneMat);
    basinOuter.position.y = 0.28;
    basinOuter.castShadow = true;
    basinOuter.receiveShadow = true;
    basinOuter.userData = { type: 'building', buildingId: 'park' };
    fountainGroup.add(basinOuter);

    const fountainWaterMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.28,
      roughness: 0.1,
      metalness: 0.25,
    });
    const basinWater = new THREE.Mesh(
      new THREE.CylinderGeometry(2.32, 2.32, 0.64, 28),
      fountainWaterMat
    );
    basinWater.position.y = 0.29;
    basinWater.userData = { type: 'building', buildingId: 'park' };
    fountainGroup.add(basinWater);

    // Mid-Tier Fountain Bowl
    const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.85, 0.35, 24), stoneMat);
    midBowl.position.y = 1.15;
    midBowl.castShadow = true;
    midBowl.userData = { type: 'building', buildingId: 'park' };
    fountainGroup.add(midBowl);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.9, 16), stoneMat);
    pillar.position.y = 0.98;
    pillar.castShadow = true;
    pillar.userData = { type: 'building', buildingId: 'park' };
    fountainGroup.add(pillar);

    const crystalSpire = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 1),
      new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.45,
        roughness: 0.12,
        metalness: 0.3,
      })
    );
    crystalSpire.position.y = 2.32;
    crystalSpire.userData = { type: 'building', buildingId: 'park' };
    fountainGroup.add(crystalSpire);

    // Detailed Park Benches with Cast-Iron Armrests & Wood Slats
    const benchPositions: [number, number, number][] = [
      [-4.3, 1, Math.PI / 2],
      [4.3, 1, -Math.PI / 2],
      [0, -3.3, 0],
    ];
    const woodSlatsMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.72 });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.6,
      roughness: 0.4,
    });
    benchPositions.forEach(([bx, bz, rot]) => {
      const bench = new THREE.Group();
      bench.position.set(bx, 0.08, bz);
      bench.rotation.y = rot;
      addContactShadow(bench, 2.2, 1.0, 0.4);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.58), woodSlatsMat);
      seat.position.y = 0.38;
      seat.castShadow = true;
      bench.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.44, 0.09), woodSlatsMat);
      back.position.set(0, 0.64, -0.25);
      back.rotation.x = -0.12;
      back.castShadow = true;
      bench.add(back);

      for (const lx of [-0.78, 0.78]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.56), ironMat);
        leg.position.set(lx, 0.21, 0);
        leg.castShadow = true;
        bench.add(leg);
      }
      worldGroup.add(bench);
    });

    // 7. Detailed Realistic Architectural Buildings with Accessible Furnished Interiors & Cutaway Roofs
    const windowMaterials: THREE.MeshStandardMaterial[] = [];
    const buildingCutawayRefs: Record<
      string,
      {
        roofGroup: THREE.Group;
        frontUpperWall: THREE.Mesh;
        roofMat: THREE.MeshStandardMaterial;
        wallMat: THREE.MeshStandardMaterial;
      }
    > = {};
    pickableObjects.push(
      plazaMesh,
      basinOuter,
      pillar,
      crystalSpire
    );

    // 6B. Build the 4 Dedicated "Two-Place" Seating Sanctuaries (2 in Gemini City + 2 in Second City / Neo-Horizon)
    // Each Two-Place Spot has a shared 2-person Loveseat Bench (`seatA`, `seatB`), 2 Companion Lounge Chairs (`chairA`, `chairB`)
    // facing a Bistro Table with coffee cups & lantern, plus a floral/sakura pergola arch!
    Object.values(TWO_PLACE_SPOTS).forEach((spot) => {
      const isNeo = spot.cityId === 'city2';
      const spotGroup = new THREE.Group();
      worldGroup.add(spotGroup);

      // 1. Circular Ornamental Terrace Plinth & Glowing Rim
      const terraceDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(2.75, 2.88, 0.06, 32),
        new THREE.MeshStandardMaterial({
          map: plazaTex,
          color: isNeo ? '#1e293b' : '#f1f5f9',
          roughness: 0.65,
          metalness: isNeo ? 0.35 : 0.08,
        })
      );
      terraceDisc.position.set(spot.center.x, 0.03, spot.center.z);
      terraceDisc.receiveShadow = true;
      terraceDisc.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'bench' };
      spotGroup.add(terraceDisc);
      pickableObjects.push(terraceDisc);

      const rimMat = new THREE.MeshStandardMaterial({
        color: spot.accentColor,
        emissive: spot.accentColor,
        emissiveIntensity: isNeo ? 0.85 : 0.4,
        roughness: 0.25,
        metalness: 0.5,
      });
      const terraceRim = new THREE.Mesh(
        new THREE.TorusGeometry(2.78, 0.045, 10, 40),
        rimMat
      );
      terraceRim.rotation.x = Math.PI / 2;
      terraceRim.position.set(spot.center.x, 0.065, spot.center.z);
      spotGroup.add(terraceRim);

      // 2. Shared Two-Place Loveseat Bench (Centered between seatA and seatB at z = spot.center.z - 0.75)
      const benchCenterX = (spot.seatA.x + spot.seatB.x) * 0.5;
      const benchCenterZ = (spot.seatA.z + spot.seatB.z) * 0.5;
      const twoPlaceBench = new THREE.Group();
      twoPlaceBench.position.set(benchCenterX, 0, benchCenterZ);
      addContactShadow(twoPlaceBench, 2.45, 1.05, 0.48);

      const benchFrameMat = new THREE.MeshStandardMaterial({
        map: woodDeckTex,
        color: isNeo ? '#0f172a' : '#78350f',
        roughness: 0.52,
        metalness: isNeo ? 0.45 : 0.12,
      });
      const cushionMat = new THREE.MeshStandardMaterial({
        color: isNeo ? '#164e63' : '#fff1f2',
        roughness: 0.68,
      });
      const accentPillowMat = new THREE.MeshStandardMaterial({
        color: spot.accentColor,
        emissive: spot.accentColor,
        emissiveIntensity: 0.22,
        roughness: 0.55,
      });

      // Bench Base & Plush Seat Cushion (Top at y = 0.45m so pelvisY = 0.50 rests flush on the bench!)
      const benchSeatFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.16, 0.08, 0.62),
        benchFrameMat
      );
      benchSeatFrame.position.set(0, 0.36, 0);
      benchSeatFrame.castShadow = true;
      benchSeatFrame.receiveShadow = true;
      benchSeatFrame.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'bench' };
      twoPlaceBench.add(benchSeatFrame);
      pickableObjects.push(benchSeatFrame);

      const benchCushion = new THREE.Mesh(
        new THREE.BoxGeometry(2.04, 0.06, 0.56),
        cushionMat
      );
      benchCushion.position.set(0, 0.42, 0.01);
      benchCushion.castShadow = true;
      benchCushion.receiveShadow = true;
      benchCushion.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'bench' };
      twoPlaceBench.add(benchCushion);
      pickableObjects.push(benchCushion);

      // Individual Seat A & Seat B Tufted Pads so it visibly looks like a Two-Place Loveseat
      for (const sx of [-0.52, 0.52]) {
        const seatPad = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.025, 0.52),
          accentPillowMat
        );
        seatPad.position.set(sx, 0.455, 0.01);
        seatPad.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'bench' };
        twoPlaceBench.add(seatPad);
        pickableObjects.push(seatPad);
      }

      // Sculpted Backrest with Accent Trim & Cozy Throw Pillows
      const benchBack = new THREE.Mesh(
        new THREE.BoxGeometry(2.14, 0.48, 0.09),
        benchFrameMat
      );
      benchBack.position.set(0, 0.66, -0.26);
      benchBack.rotation.x = -0.1;
      benchBack.castShadow = true;
      benchBack.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'bench' };
      twoPlaceBench.add(benchBack);
      pickableObjects.push(benchBack);

      const benchTopRail = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.05, 0.11),
        rimMat
      );
      benchTopRail.position.set(0, 0.91, -0.28);
      twoPlaceBench.add(benchTopRail);

      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.38, 0.58),
          ironMat
        );
        leg.position.set(side * 0.96, 0.19, 0);
        leg.castShadow = true;
        twoPlaceBench.add(leg);

        const armrest = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.06, 0.62),
          benchFrameMat
        );
        armrest.position.set(side * 1.0, 0.56, 0);
        armrest.castShadow = true;
        twoPlaceBench.add(armrest);

        const armPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8),
          ironMat
        );
        armPost.position.set(side * 1.0, 0.46, 0.22);
        twoPlaceBench.add(armPost);

        const pillow = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.22, 0.12),
          accentPillowMat
        );
        pillow.position.set(side * 0.84, 0.56, -0.14);
        pillow.rotation.z = side * 0.22;
        pillow.rotation.y = -side * 0.25;
        twoPlaceBench.add(pillow);
      }
      spotGroup.add(twoPlaceBench);

      // 3. Two Companion Lounge Chairs (`chairA` & `chairB`) facing a Round Bistro Table
      const buildLoungeChair = (chairCoord: { x: number; z: number; rotationY: number }) => {
        const chair = new THREE.Group();
        chair.position.set(chairCoord.x, 0, chairCoord.z);
        chair.rotation.y = chairCoord.rotationY;
        addContactShadow(chair, 1.05, 1.05, 0.42);

        const chairBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.36, 0.7),
          benchFrameMat
        );
        chairBase.position.set(0, 0.18, 0);
        chairBase.castShadow = true;
        chairBase.receiveShadow = true;
        chairBase.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'chairs' };
        chair.add(chairBase);
        pickableObjects.push(chairBase);

        const chairCushion = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.08, 0.64),
          cushionMat
        );
        chairCushion.position.set(0, 0.4, 0.02);
        chairCushion.castShadow = true;
        chairCushion.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'chairs' };
        chair.add(chairCushion);
        pickableObjects.push(chairCushion);

        const chairPad = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.025, 0.54),
          accentPillowMat
        );
        chairPad.position.set(0, 0.445, 0.02);
        chairPad.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'chairs' };
        chair.add(chairPad);
        pickableObjects.push(chairPad);

        const chairBack = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.46, 0.1),
          benchFrameMat
        );
        chairBack.position.set(0, 0.64, -0.29);
        chairBack.rotation.x = -0.12;
        chairBack.castShadow = true;
        chairBack.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'chairs' };
        chair.add(chairBack);
        pickableObjects.push(chairBack);

        for (const cSide of [-1, 1]) {
          const cArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.22, 0.66),
            benchFrameMat
          );
          cArm.position.set(cSide * 0.34, 0.48, -0.02);
          cArm.castShadow = true;
          chair.add(cArm);
        }

        spotGroup.add(chair);
      };
      buildLoungeChair(spot.chairA);
      buildLoungeChair(spot.chairB);

      // Round Bistro Table between Chair A and Chair B with 2 Cups & Glowing Lantern
      const tableX = (spot.chairA.x + spot.chairB.x) * 0.5;
      const tableZ = (spot.chairA.z + spot.chairB.z) * 0.5;
      const tableGroup = new THREE.Group();
      tableGroup.position.set(tableX, 0, tableZ);
      addContactShadow(tableGroup, 1.2, 1.2, 0.38);

      const tablePedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.26, 0.64, 14),
        ironMat
      );
      tablePedestal.position.y = 0.32;
      tablePedestal.castShadow = true;
      tableGroup.add(tablePedestal);

      const tableTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.5, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: isNeo ? '#0f172a' : '#f8fafc',
          roughness: 0.2,
          metalness: isNeo ? 0.6 : 0.1,
        })
      );
      tableTop.position.y = 0.65;
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      tableTop.userData = { type: 'two_place_spot', spotId: spot.id, seatingChoice: 'chairs' };
      tableGroup.add(tableTop);
      pickableObjects.push(tableTop);

      const tableRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.018, 8, 24),
        rimMat
      );
      tableRim.rotation.x = Math.PI / 2;
      tableRim.position.y = 0.655;
      tableGroup.add(tableRim);

      // Two Espresso/Tea Cups & Glowing Centerpiece Lantern on the Bistro Table
      const cupMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
      for (const cx of [-0.22, 0.22]) {
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.015, 12), cupMat);
        saucer.position.set(cx, 0.682, 0.04);
        tableGroup.add(saucer);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.07, 12), accentPillowMat);
        cup.position.set(cx, 0.72, 0.04);
        tableGroup.add(cup);
      }
      const centerLantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.065, 0.16, 12),
        rimMat
      );
      centerLantern.position.set(0, 0.75, -0.08);
      tableGroup.add(centerLantern);
      spotGroup.add(tableGroup);

      // 4. Romantic Floral / Cyber-Sakura Pergola Archway behind the Two-Place Bench
      const archGroup = new THREE.Group();
      archGroup.position.set(benchCenterX, 0, benchCenterZ - 0.52);
      for (const px of [-1.32, 1.32]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.085, 2.35, 12),
          benchFrameMat
        );
        post.position.set(px, 1.175, 0);
        post.castShadow = true;
        archGroup.add(post);

        const lanternGlobe = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 12),
          rimMat
        );
        lanternGlobe.position.set(px, 2.05, 0.18);
        archGroup.add(lanternGlobe);
      }
      const topBeam = new THREE.Mesh(
        new THREE.BoxGeometry(2.95, 0.1, 0.28),
        benchFrameMat
      );
      topBeam.position.set(0, 2.36, 0);
      topBeam.castShadow = true;
      archGroup.add(topBeam);

      // Blooming Rose / Sakura Blossom Clusters along the Pergola Arch
      const blossomMat = new THREE.MeshStandardMaterial({
        color: spot.accentColor,
        emissive: spot.accentColor,
        emissiveIntensity: isNeo ? 0.45 : 0.18,
        roughness: 0.6,
      });
      for (let bx = -1.2; bx <= 1.2; bx += 0.4) {
        const bloom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.22 + (Math.abs(bx) < 0.5 ? 0.06 : 0), 1),
          blossomMat
        );
        bloom.position.set(bx, 2.46 + Math.cos(bx) * 0.08, 0.06);
        archGroup.add(bloom);
      }
      spotGroup.add(archGroup);
    });

    // =======================================================================================
    // 6C. BUILD PHYSICAL AUDIO STATIONS (CYBER CITY & JAMAICA CITY)
    // =======================================================================================
    const stationEqualizerBars: {
      mesh: THREE.Mesh;
      baseY: number;
      maxHeight: number;
      speed: number;
      phase: number;
    }[] = [];

    // ---------------------------------------------------------------------------------------
    // STATION 1: ⚡ CYBER CITY AUDIO STATION (x: 198, z: 8) in Neo-Horizon Cyber-Core Plaza
    // ---------------------------------------------------------------------------------------
    const cyberStationGroup = new THREE.Group();
    cyberStationGroup.position.set(198, 0, 8);
    worldGroup.add(cyberStationGroup);
    addContactShadow(cyberStationGroup, 7.5, 7.5, 0.6);

    // 1A. Metallic Obsidian Circular Terrace Plinth with Cyan Neon Underglow Ring
    const cyberPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.75, 0.12, 36),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.35,
        metalness: 0.85,
      })
    );
    cyberPlinth.position.set(0, 0.06, 0);
    cyberPlinth.userData = { type: 'audio_station', stationId: 'cyber_city_station' };
    cyberStationGroup.add(cyberPlinth);
    pickableObjects.push(cyberPlinth);

    const cyberNeonRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.68, 0.05, 12, 48),
      new THREE.MeshStandardMaterial({
        color: '#00f0ff',
        emissive: '#00f0ff',
        emissiveIntensity: 1.2,
      })
    );
    cyberNeonRing.rotation.x = Math.PI / 2;
    cyberNeonRing.position.set(0, 0.12, 0);
    cyberStationGroup.add(cyberNeonRing);

    // 1B. Modern Cyber Music Console Desk (Chamfered Obsidian with Carbon Deck)
    const cyberConsole = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.88, 1.0),
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.25,
        metalness: 0.9,
      })
    );
    cyberConsole.position.set(0, 0.52, 0);
    cyberConsole.castShadow = true;
    cyberConsole.userData = { type: 'audio_station', stationId: 'cyber_city_station' };
    cyberStationGroup.add(cyberConsole);
    pickableObjects.push(cyberConsole);

    // Glowing Cyan Trim on Console Edge
    const cyberConsoleTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.34, 0.04, 1.04),
      new THREE.MeshStandardMaterial({
        color: '#00f0ff',
        emissive: '#00f0ff',
        emissiveIntensity: 0.8,
      })
    );
    cyberConsoleTrim.position.set(0, 0.96, 0);
    cyberStationGroup.add(cyberConsoleTrim);

    // Twin Turntable Jog Platters
    for (const jx of [-0.68, 0.68]) {
      const platter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: '#090d16',
          roughness: 0.15,
          metalness: 0.95,
        })
      );
      platter.position.set(jx, 0.98, 0.05);
      cyberStationGroup.add(platter);

      const platterRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.29, 0.02, 8, 24),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#38bdf8',
          emissiveIntensity: 0.9,
        })
      );
      platterRing.rotation.x = Math.PI / 2;
      platterRing.position.set(jx, 1.01, 0.05);
      cyberStationGroup.add(platterRing);
    }

    // Central Mixer Controls (Tactile Knobs & Faders)
    for (let fIdx = -0.18; fIdx <= 0.18; fIdx += 0.12) {
      const fader = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.03, 0.22),
        new THREE.MeshStandardMaterial({ color: '#f43f5e', emissive: '#f43f5e', emissiveIntensity: 0.5 })
      );
      fader.position.set(fIdx, 0.98, 0.06);
      cyberStationGroup.add(fader);
    }

    // Angled Holographic Equalizer Screen & Subtle Animated Bars
    const cyberEqScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.44, 0.04),
      new THREE.MeshStandardMaterial({
        color: '#020617',
        roughness: 0.1,
        metalness: 0.7,
        emissive: '#082f49',
        emissiveIntensity: 0.3,
      })
    );
    cyberEqScreen.position.set(0, 1.25, -0.32);
    cyberEqScreen.rotation.x = -0.25;
    cyberStationGroup.add(cyberEqScreen);

    // 7 Animated Equalizer Bars on Screen
    const cyberEqBarColors = ['#00f0ff', '#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#f43f5e', '#00f0ff'];
    for (let bIdx = 0; bIdx < 7; bIdx++) {
      const bx = -0.48 + bIdx * 0.16;
      const barMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.03),
        new THREE.MeshStandardMaterial({
          color: cyberEqBarColors[bIdx],
          emissive: cyberEqBarColors[bIdx],
          emissiveIntensity: 1.0,
        })
      );
      barMesh.position.set(bx, 1.25, -0.29);
      barMesh.rotation.x = -0.25;
      cyberStationGroup.add(barMesh);

      stationEqualizerBars.push({
        mesh: barMesh,
        baseY: 1.25,
        maxHeight: 0.28,
        speed: 2.8 + (bIdx % 3) * 1.2,
        phase: bIdx * 0.9,
      });
    }

    // 1C. Dual Cyber Tower Speakers (Left & Right)
    for (const sx of [-2.05, 2.05]) {
      const speakerTower = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.95, 0.55),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.3,
          metalness: 0.8,
        })
      );
      speakerTower.position.set(sx, 0.98, -0.15);
      speakerTower.castShadow = true;
      cyberStationGroup.add(speakerTower);

      // Vertical Glowing Neon Acoustic Strips
      const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 1.75, 0.56),
        new THREE.MeshStandardMaterial({
          color: '#00f0ff',
          emissive: '#00f0ff',
          emissiveIntensity: 1.1,
        })
      );
      neonStrip.position.set(sx + (sx > 0 ? -0.27 : 0.27), 0.98, -0.15);
      cyberStationGroup.add(neonStrip);

      // Dual Subwoofer Cones on front face
      for (const sy of [0.55, 1.35]) {
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.12, 0.06, 16),
          new THREE.MeshStandardMaterial({
            color: '#1e293b',
            roughness: 0.4,
            metalness: 0.7,
            emissive: '#0284c7',
            emissiveIntensity: 0.25,
          })
        );
        cone.rotation.x = Math.PI / 2;
        cone.position.set(sx, sy, 0.14);
        cyberStationGroup.add(cone);
      }
    }

    // 1D. Overhead Holographic Station Canopy & Sign
    for (const px of [-1.15, 1.15]) {
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 2.45, 12),
        new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.9, roughness: 0.2 })
      );
      pylon.position.set(px, 1.25, -0.42);
      cyberStationGroup.add(pylon);
    }
    const cyberSignBeam = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 0.28, 0.08),
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#00f0ff',
        emissiveIntensity: 0.75,
        roughness: 0.2,
      })
    );
    cyberSignBeam.position.set(0, 2.48, -0.42);
    cyberSignBeam.userData = { type: 'audio_station', stationId: 'cyber_city_station' };
    cyberStationGroup.add(cyberSignBeam);
    pickableObjects.push(cyberSignBeam);

    // 1E. Physical Relaxation & Listening Area in front of Console (x: 198, z: 10.2)
    // 2 Cyber Lounge Armchairs angled toward the music station
    for (const [cx, cz, rotY] of [
      [-1.25, 2.2, 0.2],
      [1.25, 2.2, -0.2],
    ]) {
      const chairGroup = new THREE.Group();
      chairGroup.position.set(cx, 0, cz);
      chairGroup.rotation.y = rotY;
      cyberStationGroup.add(chairGroup);

      const seatPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.15, 0.8),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.7 })
      );
      seatPad.position.set(0, 0.35, 0);
      seatPad.castShadow = true;
      chairGroup.add(seatPad);
      seatPad.userData = {
        type: 'audio_station_chair',
        chairTarget: { x: 198 + cx, z: 8 + cz },
      };
      pickableObjects.push(seatPad);

      const backRest = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 0.12),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.35,
          metalness: 0.8,
        })
      );
      backRest.position.set(0, 0.72, 0.38);
      backRest.rotation.x = -0.12;
      backRest.castShadow = true;
      chairGroup.add(backRest);
      backRest.userData = {
        type: 'audio_station_chair',
        chairTarget: { x: 198 + cx, z: 8 + cz },
      };
      pickableObjects.push(backRest);

      // Glowing Neon Accent along the back of the chair
      const chairNeon = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.04, 0.04),
        new THREE.MeshStandardMaterial({ color: '#00f0ff', emissive: '#00f0ff', emissiveIntensity: 0.9 })
      );
      chairNeon.position.set(0, 1.05, 0.42);
      chairGroup.add(chairNeon);
    }

    // Glass & Chrome Cocktail Table with Glowing Cyber Prism
    const cyberTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: '#082f49', metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.85 })
    );
    cyberTable.position.set(0, 0.38, 2.2);
    cyberStationGroup.add(cyberTable);

    const cyberTableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.16, 0.38, 16),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.9, roughness: 0.2 })
    );
    cyberTableLeg.position.set(0, 0.19, 2.2);
    cyberStationGroup.add(cyberTableLeg);

    const cyberPrism = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#00f0ff', emissiveIntensity: 1.0 })
    );
    cyberPrism.position.set(0, 0.54, 2.2);
    cyberStationGroup.add(cyberPrism);

    // Decorative Holographic Planter Box with Crystal Flora
    const cyberPlanter = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.35, 0.65),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.8 })
    );
    cyberPlanter.position.set(2.4, 0.18, 1.8);
    cyberStationGroup.add(cyberPlanter);

    const crystalFlora = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      new THREE.MeshStandardMaterial({ color: '#a855f7', emissive: '#c084fc', emissiveIntensity: 0.85 })
    );
    crystalFlora.position.set(2.4, 0.52, 1.8);
    cyberStationGroup.add(crystalFlora);

    // ---------------------------------------------------------------------------------------
    // STATION 2: 🌴 JAMAICA CITY AUDIO STATION (x: -8, z: 6) in Central Starlight Park
    // ---------------------------------------------------------------------------------------
    const jamaicaStationGroup = new THREE.Group();
    jamaicaStationGroup.position.set(-8, 0, 6);
    worldGroup.add(jamaicaStationGroup);
    addContactShadow(jamaicaStationGroup, 7.5, 7.5, 0.6);

    // 2A. Warm Teak Wood Circular Terrace Plinth with Golden Brass Rim
    const jamaicaPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.75, 0.12, 36),
      new THREE.MeshStandardMaterial({
        map: woodDeckTex,
        color: '#78350f',
        roughness: 0.55,
        metalness: 0.15,
      })
    );
    jamaicaPlinth.position.set(0, 0.06, 0);
    jamaicaPlinth.userData = { type: 'audio_station', stationId: 'jamaica_city_station' };
    jamaicaStationGroup.add(jamaicaPlinth);
    pickableObjects.push(jamaicaPlinth);

    const jamaicaBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(3.68, 0.05, 12, 48),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.5,
        metalness: 0.85,
        roughness: 0.25,
      })
    );
    jamaicaBrassRim.rotation.x = Math.PI / 2;
    jamaicaBrassRim.position.set(0, 0.12, 0);
    jamaicaStationGroup.add(jamaicaBrassRim);

    // 2B. Acoustic Teak Wood DJ Workstation Console with Golden Brass Corner Brackets
    const jamaicaConsole = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.88, 1.0),
      new THREE.MeshStandardMaterial({
        map: woodDeckTex,
        color: '#92400e',
        roughness: 0.45,
        metalness: 0.2,
      })
    );
    jamaicaConsole.position.set(0, 0.52, 0);
    jamaicaConsole.castShadow = true;
    jamaicaConsole.userData = { type: 'audio_station', stationId: 'jamaica_city_station' };
    jamaicaStationGroup.add(jamaicaConsole);
    pickableObjects.push(jamaicaConsole);

    // Warm Golden Brass Console Trim
    const jamaicaConsoleTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.34, 0.04, 1.04),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#f59e0b',
        emissiveIntensity: 0.45,
        metalness: 0.8,
        roughness: 0.3,
      })
    );
    jamaicaConsoleTrim.position.set(0, 0.96, 0);
    jamaicaStationGroup.add(jamaicaConsoleTrim);

    // Vintage Vinyl Turntables with Golden Center Labels & Tone Arms
    for (const jx of [-0.68, 0.68]) {
      const turntable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31, 0.31, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: '#1c1917',
          roughness: 0.2,
          metalness: 0.3,
        })
      );
      turntable.position.set(jx, 0.98, 0.05);
      jamaicaStationGroup.add(turntable);

      // Gold Center Label
      const goldLabel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16),
        new THREE.MeshStandardMaterial({
          color: '#fbbf24',
          emissive: '#d97706',
          emissiveIntensity: 0.4,
          metalness: 0.8,
        })
      );
      goldLabel.position.set(jx, 0.99, 0.05);
      jamaicaStationGroup.add(goldLabel);

      // Tone Arm
      const toneArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.26, 8),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.2 })
      );
      toneArm.rotation.z = Math.PI / 2.8;
      toneArm.position.set(jx + 0.26, 1.02, -0.06);
      jamaicaStationGroup.add(toneArm);
    }

    // Analog Wood-Framed Warm Equalizer Display & 7 Animated Bars
    const jamaicaEqScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.44, 0.04),
      new THREE.MeshStandardMaterial({
        color: '#1c1917',
        roughness: 0.3,
        emissive: '#451a03',
        emissiveIntensity: 0.35,
      })
    );
    jamaicaEqScreen.position.set(0, 1.25, -0.32);
    jamaicaEqScreen.rotation.x = -0.25;
    jamaicaStationGroup.add(jamaicaEqScreen);

    // 7 Warm Golden/Amber Equalizer Bars
    const jamaicaEqBarColors = ['#f59e0b', '#fbbf24', '#fde047', '#34d399', '#fde047', '#fbbf24', '#f59e0b'];
    for (let bIdx = 0; bIdx < 7; bIdx++) {
      const bx = -0.48 + bIdx * 0.16;
      const barMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.03),
        new THREE.MeshStandardMaterial({
          color: jamaicaEqBarColors[bIdx],
          emissive: jamaicaEqBarColors[bIdx],
          emissiveIntensity: 0.95,
        })
      );
      barMesh.position.set(bx, 1.25, -0.29);
      barMesh.rotation.x = -0.25;
      jamaicaStationGroup.add(barMesh);

      stationEqualizerBars.push({
        mesh: barMesh,
        baseY: 1.25,
        maxHeight: 0.28,
        speed: 2.4 + (bIdx % 3) * 1.1,
        phase: bIdx * 0.8 + 1.2,
      });
    }

    // 2C. Dual Studio Monitor Tower Speakers (Handcrafted Wood Cabinets)
    for (const sx of [-2.05, 2.05]) {
      const woodSpeaker = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.85, 0.55),
        new THREE.MeshStandardMaterial({
          map: woodDeckTex,
          color: '#5c2b09',
          roughness: 0.5,
          metalness: 0.1,
        })
      );
      woodSpeaker.position.set(sx, 0.93, -0.15);
      woodSpeaker.castShadow = true;
      jamaicaStationGroup.add(woodSpeaker);

      // Gold acoustic driver cones
      for (const sy of [0.55, 1.3]) {
        const goldCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.13, 0.06, 16),
          new THREE.MeshStandardMaterial({
            color: '#fbbf24',
            emissive: '#b45309',
            emissiveIntensity: 0.35,
            metalness: 0.75,
            roughness: 0.3,
          })
        );
        goldCone.rotation.x = Math.PI / 2;
        goldCone.position.set(sx, sy, 0.14);
        jamaicaStationGroup.add(goldCone);
      }
    }

    // 2D. Carved Teak Wood Overhead Station Sign
    for (const px of [-1.15, 1.15]) {
      const brassPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 2.45, 12),
        new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.8, roughness: 0.3 })
      );
      brassPole.position.set(px, 1.25, -0.42);
      jamaicaStationGroup.add(brassPole);
    }
    const jamaicaSignBeam = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 0.28, 0.08),
      new THREE.MeshStandardMaterial({
        map: woodDeckTex,
        color: '#b45309',
        roughness: 0.4,
        emissive: '#78350f',
        emissiveIntensity: 0.4,
      })
    );
    jamaicaSignBeam.position.set(0, 2.48, -0.42);
    jamaicaSignBeam.userData = { type: 'audio_station', stationId: 'jamaica_city_station' };
    jamaicaStationGroup.add(jamaicaSignBeam);
    pickableObjects.push(jamaicaSignBeam);

    // 2E. Physical Relaxation & Listening Area in front of Console (x: -8, z: 8.2)
    // 2 Cozy Teak Lounge Armchairs with plush cushions
    for (const [cx, cz, rotY] of [
      [-1.25, 2.2, 0.2],
      [1.25, 2.2, -0.2],
    ]) {
      const chairGroup = new THREE.Group();
      chairGroup.position.set(cx, 0, cz);
      chairGroup.rotation.y = rotY;
      jamaicaStationGroup.add(chairGroup);

      const seatPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.15, 0.8),
        new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.7, metalness: 0.05 })
      );
      seatPad.position.set(0, 0.35, 0);
      seatPad.castShadow = true;
      chairGroup.add(seatPad);
      seatPad.userData = {
        type: 'audio_station_chair',
        chairTarget: { x: -8 + cx, z: 6 + cz },
      };
      pickableObjects.push(seatPad);

      const chairFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.1, 0.86),
        new THREE.MeshStandardMaterial({ map: woodDeckTex, color: '#78350f', roughness: 0.5 })
      );
      chairFrame.position.set(0, 0.25, 0);
      chairGroup.add(chairFrame);

      const backRest = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 0.12),
        new THREE.MeshStandardMaterial({
          map: woodDeckTex,
          color: '#78350f',
          roughness: 0.5,
        })
      );
      backRest.position.set(0, 0.72, 0.38);
      backRest.rotation.x = -0.12;
      backRest.castShadow = true;
      chairGroup.add(backRest);
      backRest.userData = {
        type: 'audio_station_chair',
        chairTarget: { x: -8 + cx, z: 6 + cz },
      };
      pickableObjects.push(backRest);
    }

    // Low Teak Coffee Table with Tropical Drink & Ambient Candle Lantern
    const jamaicaTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.06, 24),
      new THREE.MeshStandardMaterial({ map: woodDeckTex, color: '#92400e', roughness: 0.5 })
    );
    jamaicaTable.position.set(0, 0.38, 2.2);
    jamaicaStationGroup.add(jamaicaTable);

    const jamaicaTableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.14, 0.38, 16),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    jamaicaTableLeg.position.set(0, 0.19, 2.2);
    jamaicaStationGroup.add(jamaicaTableLeg);

    const lanternGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#f59e0b', emissiveIntensity: 1.0 })
    );
    lanternGlobe.position.set(0, 0.52, 2.2);
    jamaicaStationGroup.add(lanternGlobe);

    // Terracotta Planters with Lush Tropical Green Palms / Ferns
    const jamaicaPlanter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.24, 0.44, 16),
      new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.75 })
    );
    jamaicaPlanter.position.set(2.4, 0.22, 1.8);
    jamaicaStationGroup.add(jamaicaPlanter);

    const palmBush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.38, 1),
      new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.65 })
    );
    palmBush.position.set(2.4, 0.62, 1.8);
    jamaicaStationGroup.add(palmBush);

    const createDetailedBuilding = (b: BuildingInfo) => {
      if (b.id === 'park' || b.id === 'neo_plaza') return;

      const group = new THREE.Group();
      group.position.set(b.position[0], 0, b.position[2]);
      group.userData = { type: 'building', buildingId: b.id };

      const [w, h, d] = b.size;
      addContactShadow(group, w + 3.8, d + 3.8, 0.68);

      const facadeStyle =
        b.id === 'school' || b.id === 'cafe'
          ? 'brick'
          : b.id === 'lin_cottage'
          ? 'siding'
          : 'stucco';
      const wallTex = createFacadeTexture(b.wallColor, facadeStyle);
      const roofTex = createRoofTileTexture(b.roofColor);

      // Architectural Stone Foundation Plinth
      const plinthMat = new THREE.MeshStandardMaterial({
        map: cliffRockTex,
        color: '#64748b',
        roughness: 0.82,
      });
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.72, 0.28, d + 0.72),
        plinthMat
      );
      plinth.position.y = 0.14;
      plinth.receiveShadow = true;
      plinth.userData = { type: 'building', buildingId: b.id };
      group.add(plinth);
      pickableObjects.push(plinth);

      // Walkable Warm Hardwood Plank Interior Floor
      const interiorFloor = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.3, 0.08, d - 0.3),
        new THREE.MeshStandardMaterial({
          map: woodDeckTex,
          color: b.category === 'residence' ? '#d97706' : '#f59e0b',
          roughness: 0.42,
          metalness: 0.08,
        })
      );
      interiorFloor.position.y = 0.28;
      interiorFloor.receiveShadow = true;
      interiorFloor.userData = { type: 'ground' };
      group.add(interiorFloor);
      pickableObjects.push(interiorFloor);

      const faceSign = b.position[2] < 0 ? 1 : -1;
      const wallThick = 0.3;
      const wallMat = new THREE.MeshStandardMaterial({
        map: wallTex,
        color: '#ffffff',
        roughness: 0.68,
      });
      const frontUpperWallMat = wallMat.clone();
      frontUpperWallMat.transparent = true;

      // Back Wall
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallThick), wallMat);
      backWall.position.set(0, h / 2 + 0.26, -faceSign * (d / 2 - wallThick / 2));
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      backWall.userData = { type: 'building', buildingId: b.id };
      group.add(backWall);
      pickableObjects.push(backWall);

      // Left & Right Side Walls
      for (const sideX of [-1, 1]) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, d), wallMat);
        sideWall.position.set(sideX * (w / 2 - wallThick / 2), h / 2 + 0.26, 0);
        sideWall.castShadow = true;
        sideWall.receiveShadow = true;
        sideWall.userData = { type: 'building', buildingId: b.id };
        group.add(sideWall);
        pickableObjects.push(sideWall);
      }

      // Architectural Corner Trim Pilasters / Stone Quoins
      const trimMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.52 });
      for (const cx of [-1, 1]) {
        for (const cz of [-1, 1]) {
          const pilaster = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, h + 0.06, 0.36),
            trimMat
          );
          pilaster.position.set(cx * (w / 2 - 0.08), h / 2 + 0.26, cz * (d / 2 - 0.08));
          pilaster.castShadow = true;
          group.add(pilaster);
        }
      }

      // Front Wall Left & Right Sections leaving a wide accessible doorway in the center
      const doorOpeningW = 1.85;
      const frontSideW = (w - doorOpeningW) / 2;
      for (const sideX of [-1, 1]) {
        const fWall = new THREE.Mesh(
          new THREE.BoxGeometry(frontSideW, h * 0.52, wallThick),
          wallMat
        );
        fWall.position.set(
          sideX * (doorOpeningW / 2 + frontSideW / 2),
          (h * 0.52) / 2 + 0.26,
          faceSign * (d / 2 - wallThick / 2)
        );
        fWall.castShadow = true;
        fWall.receiveShadow = true;
        fWall.userData = { type: 'building', buildingId: b.id };
        group.add(fWall);
        pickableObjects.push(fWall);
      }

      // Upper Front Wall (Fades out smoothly when viewing inside the house!)
      const frontUpperWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, h * 0.48, wallThick),
        frontUpperWallMat
      );
      frontUpperWall.position.set(
        0,
        h * 0.52 + (h * 0.48) / 2 + 0.26,
        faceSign * (d / 2 - wallThick / 2)
      );
      frontUpperWall.castShadow = true;
      frontUpperWall.userData = { type: 'building', buildingId: b.id };
      group.add(frontUpperWall);
      pickableObjects.push(frontUpperWall);

      // Rich Multi-Room Interior Furnishings
      const interiorGroup = new THREE.Group();
      interiorGroup.position.y = 0.32;
      group.add(interiorGroup);

      // Woven Center Area Rug
      const rug = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 0.03, 24),
        new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.88 })
      );
      rug.position.set(0, 0.02, 0);
      interiorGroup.add(rug);

      if (b.category === 'residence') {
        // Cozy Bed with Timber Headboard & Pillows in Back-Left Corner
        const bedFrame = new THREE.Mesh(
          new THREE.BoxGeometry(1.75, 0.36, 2.2),
          new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.68 })
        );
        bedFrame.position.set(-w * 0.28, 0.18, -faceSign * (d * 0.24));
        interiorGroup.add(bedFrame);

        const headboard = new THREE.Mesh(
          new THREE.BoxGeometry(1.75, 0.95, 0.14),
          new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.65 })
        );
        headboard.position.set(-w * 0.28, 0.48, -faceSign * (d * 0.24 + 1.02));
        interiorGroup.add(headboard);

        const mattress = new THREE.Mesh(
          new THREE.BoxGeometry(1.62, 0.22, 2.05),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.85 })
        );
        mattress.position.set(-w * 0.28, 0.38, -faceSign * (d * 0.24));
        interiorGroup.add(mattress);

        const blanket = new THREE.Mesh(
          new THREE.BoxGeometry(1.64, 0.24, 1.32),
          new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.8 })
        );
        blanket.position.set(-w * 0.28, 0.39, -faceSign * (d * 0.11));
        interiorGroup.add(blanket);

        // Tall Wooden Bookshelf with Colorful Books along Side Wall
        const bookshelf = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 1.85, 1.4),
          new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.68 })
        );
        bookshelf.position.set(-w * 0.42, 0.92, faceSign * (d * 0.12));
        interiorGroup.add(bookshelf);

        // Creative Desk & Glowing Studio Workstation in Back-Right Corner
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 0.74, 0.88),
          new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.65 })
        );
        desk.position.set(w * 0.26, 0.37, -faceSign * (d * 0.28));
        interiorGroup.add(desk);

        const monitor = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.5, 0.08),
          new THREE.MeshStandardMaterial({
            color: '#0f172a',
            emissive: '#38bdf8',
            emissiveIntensity: 0.68,
          })
        );
        monitor.position.set(w * 0.26, 0.98, -faceSign * (d * 0.32));
        interiorGroup.add(monitor);

        // Cozy Lounge Sofa & Coffee Table
        const sofa = new THREE.Mesh(
          new THREE.BoxGeometry(1.95, 0.58, 0.86),
          new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 })
        );
        sofa.position.set(w * 0.24, 0.29, faceSign * (d * 0.14));
        interiorGroup.add(sofa);

        // Warm Interior Floor Lamp
        const lampStand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.16, 1.55, 10),
          ironMat
        );
        lampStand.position.set(w * 0.4, 0.78, 0);
        interiorGroup.add(lampStand);
        const lampShade = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 0.38, 14),
          new THREE.MeshStandardMaterial({
            color: '#fef3c7',
            emissive: '#f59e0b',
            emissiveIntensity: 0.75,
          })
        );
        lampShade.position.set(w * 0.4, 1.6, 0);
        interiorGroup.add(lampShade);
      } else {
        // Café / Academy Interior Counter & Study Tables
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.55, 0.95, 0.95),
          new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.55 })
        );
        counter.position.set(0, 0.48, -faceSign * (d * 0.26));
        interiorGroup.add(counter);
      }

      // Realistic Architectural Pitched Gable Roof, Eaves, Dormers & Chimney (Cutaway-capable!)
      const roofGroup = new THREE.Group();
      group.add(roofGroup);

      const corniceMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.55 });
      const midBelt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, 0.18, d + 0.28), corniceMat);
      midBelt.position.y = h * 0.52 + 0.26;
      roofGroup.add(midBelt);

      const topCornice = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.56, 0.24, d + 0.56),
        corniceMat
      );
      topCornice.position.y = h + 0.26;
      topCornice.castShadow = true;
      roofGroup.add(topCornice);

      const roofMat = new THREE.MeshStandardMaterial({
        map: roofTex,
        color: '#ffffff',
        roughness: 0.54,
        transparent: true,
      });

      // True Architectural Gabled Roof Slopes (Left & Right Pitched Roof Planes with Overhanging Eaves)
      const roofPeakH = 2.45;
      const overhangW = w / 2 + 0.58;
      const overhangD = d + 0.85;
      const slopeLen = Math.hypot(overhangW, roofPeakH);
      const slopeAngle = Math.atan2(roofPeakH, overhangW);

      for (const sideX of [-1, 1]) {
        const slopeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(slopeLen, 0.2, overhangD),
          roofMat
        );
        slopeMesh.position.set(
          sideX * (overhangW / 2 - 0.06),
          h + 0.28 + roofPeakH / 2,
          0
        );
        slopeMesh.rotation.z = -sideX * slopeAngle;
        slopeMesh.castShadow = true;
        slopeMesh.receiveShadow = true;
        slopeMesh.userData = { type: 'building', buildingId: b.id };
        roofGroup.add(slopeMesh);
        pickableObjects.push(slopeMesh);
      }

      // Timber Ridge Cap Beam running along the peak of the roof
      const ridgeCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.26, overhangD + 0.1),
        new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.65 })
      );
      ridgeCap.position.set(0, h + 0.3 + roofPeakH, 0);
      ridgeCap.castShadow = true;
      roofGroup.add(ridgeCap);

      // Front & Back Triangular Gable Pediment Walls with Circular Attic Louver Vent
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-w / 2, 0);
      gableShape.lineTo(w / 2, 0);
      gableShape.lineTo(0, roofPeakH);
      gableShape.closePath();
      const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
        depth: wallThick,
        bevelEnabled: false,
      });
      for (const sideZ of [-1, 1]) {
        const gableMesh = new THREE.Mesh(gableGeo, wallMat);
        gableMesh.position.set(
          0,
          h + 0.26,
          sideZ * (d / 2 - wallThick / 2) - wallThick / 2
        );
        gableMesh.castShadow = true;
        gableMesh.receiveShadow = true;
        gableMesh.userData = { type: 'building', buildingId: b.id };
        roofGroup.add(gableMesh);
        pickableObjects.push(gableMesh);

        // Decorative Circular Attic Vent Window & Timber Gable Bargeboard Trim in Gable Peak
        const vent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.44, 0.44, 0.16, 18),
          corniceMat
        );
        vent.rotation.x = Math.PI / 2;
        vent.position.set(0, h + 0.26 + roofPeakH * 0.52, sideZ * (d / 2 + 0.03));
        roofGroup.add(vent);

        const ventGlass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16),
          new THREE.MeshStandardMaterial({
            color: '#bae6fd',
            emissive: '#fbbf24',
            emissiveIntensity: 0.35,
            roughness: 0.15,
          })
        );
        ventGlass.rotation.x = Math.PI / 2;
        ventGlass.position.set(0, h + 0.26 + roofPeakH * 0.52, sideZ * (d / 2 + 0.03));
        roofGroup.add(ventGlass);
      }

      // Architectural Rooftop Dormer Window on the Front Roof Slope
      const dormerGroup = new THREE.Group();
      dormerGroup.position.set(-w * 0.22, h + 0.26 + roofPeakH * 0.42, faceSign * (d * 0.28));
      const dormerBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 1.15, 1.35),
        wallMat
      );
      dormerBody.castShadow = true;
      dormerGroup.add(dormerBody);
      const dormerRoof = new THREE.Mesh(
        new THREE.ConeGeometry(1.18, 0.72, 4),
        roofMat
      );
      dormerRoof.position.y = 0.88;
      dormerRoof.rotation.y = Math.PI / 4;
      dormerGroup.add(dormerRoof);
      const dormerPane = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.72, 0.1),
        new THREE.MeshStandardMaterial({
          color: '#e0f2fe',
          emissive: '#fbbf24',
          emissiveIntensity: 0.42,
          roughness: 0.12,
        })
      );
      dormerPane.position.set(0, 0.02, faceSign * 0.66);
      dormerGroup.add(dormerPane);
      roofGroup.add(dormerGroup);

      // Brick Masonry Chimney with Stepped Cap & Clay Flue Pots
      const chimneyGroup = new THREE.Group();
      chimneyGroup.position.set(w * 0.3, h + 1.55, -d * 0.22);
      const chimneyShaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 2.2, 0.78),
        new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.82 })
      );
      chimneyShaft.castShadow = true;
      chimneyGroup.add(chimneyShaft);
      const chimneyCrown = new THREE.Mesh(
        new THREE.BoxGeometry(0.94, 0.18, 0.94),
        corniceMat
      );
      chimneyCrown.position.y = 1.12;
      chimneyGroup.add(chimneyCrown);
      for (const potX of [-0.18, 0.18]) {
        const fluePot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.13, 0.38, 12),
          new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.7 })
        );
        fluePot.position.set(potX, 1.35, 0);
        chimneyGroup.add(fluePot);
      }
      roofGroup.add(chimneyGroup);

      buildingCutawayRefs[b.id] = {
        roofGroup,
        frontUpperWall,
        roofMat,
        wallMat: frontUpperWallMat,
      };

      // Framed Windows with Louvered Exterior Shutters, Mullions, Sills & Flower Planter Boxes
      const winGlassMat = new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#f59e0b',
        emissiveIntensity: 0.18,
        roughness: 0.1,
        metalness: 0.38,
      });
      windowMaterials.push(winGlassMat);
      const frameMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.48 });
      const shutterMat = new THREE.MeshStandardMaterial({
        color: b.roofColor,
        roughness: 0.62,
      });

      const cols = Math.max(2, Math.floor(w / 2.6));
      for (let c = 0; c < cols; c++) {
        const wx = (c - (cols - 1) / 2) * 2.35;
        for (const wy of [1.68, 3.65]) {
          if (wy + 0.65 > h) continue;
          if (wy < 2.5 && Math.abs(wx) < 1.3) continue;

          for (const side of [1, -1]) {
            const wz = side * (d / 2 + 0.02);
            const winGroup = new THREE.Group();
            winGroup.position.set(wx, wy, wz);

            // Outer Window Casement Frame & Stone Header Lintel
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.24, 0.1), frameMat);
            winGroup.add(frame);

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.14, 0.18), corniceMat);
            lintel.position.set(0, 0.64, side * 0.04);
            winGroup.add(lintel);

            const sill = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.1, 0.24), corniceMat);
            sill.position.set(0, -0.6, side * 0.05);
            winGroup.add(sill);

            // Left & Right Louvered Architectural Shutters
            for (const shSide of [-1, 1]) {
              const shutter = new THREE.Mesh(
                new THREE.BoxGeometry(0.28, 1.18, 0.08),
                shutterMat
              );
              shutter.position.set(shSide * 0.72, 0, side * 0.03);
              winGroup.add(shutter);
            }

            // Colorful Window Flower Planter Box on lower windows
            if (wy < 2.2) {
              const planter = new THREE.Mesh(
                new THREE.BoxGeometry(1.14, 0.2, 0.26),
                new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.85 })
              );
              planter.position.set(0, -0.7, side * 0.13);
              winGroup.add(planter);

              const blooms = new THREE.Mesh(
                new THREE.BoxGeometry(1.06, 0.16, 0.22),
                new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.68 })
              );
              blooms.position.set(0, -0.55, side * 0.13);
              winGroup.add(blooms);
            }

            const pane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.04, 0.12), winGlassMat);
            winGroup.add(pane);

            const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.06, 0.14), frameMat);
            winGroup.add(vBar);
            const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.05, 0.14), frameMat);
            winGroup.add(hBar);

            if (wy > 2.5 && side === faceSign) {
              roofGroup.add(winGroup);
            } else {
              group.add(winGroup);
            }
          }
        }
      }

      // Covered Timber Front Porch / Veranda, Steps, Balustrade Railings & Coach Lantern
      const doorZ = faceSign * (d / 2 + 0.04);
      const porchW = Math.min(w - 0.8, 4.8);
      const porchD = 1.65;

      // Raised Porch Deck & Stone Steps
      const porchDeck = new THREE.Mesh(
        new THREE.BoxGeometry(porchW, 0.26, porchD),
        new THREE.MeshStandardMaterial({
          map: woodDeckTex,
          color: '#92400e',
          roughness: 0.72,
        })
      );
      porchDeck.position.set(0, 0.13, doorZ + faceSign * (porchD / 2));
      porchDeck.receiveShadow = true;
      porchDeck.userData = { type: 'ground' };
      group.add(porchDeck);
      pickableObjects.push(porchDeck);

      const steps = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.16, 0.68),
        plinthMat
      );
      steps.position.set(0, 0.08, doorZ + faceSign * (porchD + 0.28));
      steps.receiveShadow = true;
      steps.userData = { type: 'ground' };
      group.add(steps);
      pickableObjects.push(steps);

      // Swung-Open Solid Wood Panel Door with Brass Handle
      const openDoor = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 2.18, 0.12),
        new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.58 })
      );
      openDoor.position.set(-0.78, 1.32, doorZ + faceSign * 0.42);
      openDoor.rotation.y = faceSign * 1.15;
      group.add(openDoor);

      // Warm Glowing Brass Coach Lantern beside the Front Door
      const coachLantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.1, 0.32, 8),
        winGlassMat
      );
      coachLantern.position.set(1.18, 1.85, doorZ + faceSign * 0.12);
      group.add(coachLantern);

      // Pitched Porch Roof Awning
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(porchW + 0.3, 0.22, porchD + 0.25),
        roofMat
      );
      awning.position.set(0, 2.68, doorZ + faceSign * (porchD / 2));
      awning.rotation.x = faceSign * 0.14;
      awning.castShadow = true;
      group.add(awning);

      // Turned Porch Columns & Wooden Balustrade Railings
      const colPositions = [-porchW / 2 + 0.22, -1.05, 1.05, porchW / 2 - 0.22];
      colPositions.forEach((cx) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.45, 12), frameMat);
        col.position.set(cx, 1.42, doorZ + faceSign * (porchD - 0.14));
        col.castShadow = true;
        group.add(col);
      });

      // Left & Right Front Porch Handrails
      for (const rSide of [-1, 1]) {
        const railSpan = (porchW / 2 - 1.25);
        if (railSpan > 0.3) {
          const railX = rSide * (1.05 + railSpan / 2);
          const topRail = new THREE.Mesh(
            new THREE.BoxGeometry(railSpan, 0.08, 0.08),
            frameMat
          );
          topRail.position.set(railX, 0.92, doorZ + faceSign * (porchD - 0.14));
          group.add(topRail);
        }
      }

      // Private Yard Garden Fence, Manicured Hedges & Cobblestone Walkway for Residences
      if (b.category === 'residence') {
        const hedgeMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.85 });
        for (const sideX of [-1, 1]) {
          const hedge = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.68, 0.62),
            hedgeMat
          );
          hedge.position.set(sideX * (w * 0.34), 0.34, doorZ + faceSign * 1.95);
          hedge.castShadow = true;
          group.add(hedge);

          // Stone Entry Gate Pillar with Glowing Lantern Cap
          const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 1.05, 0.42),
            corniceMat
          );
          pillar.position.set(sideX * 1.18, 0.52, doorZ + faceSign * 2.15);
          pillar.castShadow = true;
          group.add(pillar);

          const pillarOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 12, 10),
            winGlassMat
          );
          pillarOrb.position.set(sideX * 1.18, 1.14, doorZ + faceSign * 2.15);
          group.add(pillarOrb);
        }

        // Climbing Botanical Ivy & Rose Trellis on Side Facade
        const trellisMat = new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.75 });
        const trellisFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 2.6, 1.4),
          trellisMat
        );
        trellisFrame.position.set(w / 2 + 0.04, 1.55, 0);
        group.add(trellisFrame);

        const ivyFoliage = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 2.2, 1.15),
          hedgeMat
        );
        ivyFoliage.position.set(w / 2 + 0.08, 1.5, 0);
        group.add(ivyFoliage);
      }

      // Architectural Ashlar Corner Stone Quoins along all 4 vertical corners of the building
      for (const qx of [-1, 1]) {
        for (const qz of [-1, 1]) {
          for (let qy = 0.65; qy < h - 0.3; qy += 0.72) {
            const quoin = new THREE.Mesh(
              new THREE.BoxGeometry(0.34, 0.32, 0.34),
              corniceMat
            );
            quoin.position.set(qx * (w / 2 - 0.08), qy, qz * (d / 2 - 0.08));
            group.add(quoin);
          }
        }
      }

      // Exposed Timber Eaves Brackets (Corbels) under the pitched roof overhang
      const corbelMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.68 });
      for (let bz = -d / 2 + 0.8; bz <= d / 2 - 0.8; bz += 1.6) {
        for (const sideX of [-1, 1]) {
          const corbel = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.24, 0.14),
            corbelMat
          );
          corbel.position.set(sideX * (w / 2 + 0.18), h + 0.16, bz);
          roofGroup.add(corbel);
        }
      }

      // Upper-Floor Wrought-Iron Juliet Balcony above the Front Porch
      if (h >= 3.8) {
        const julietDeck = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.14, 0.68),
          corniceMat
        );
        julietDeck.position.set(0, 3.05, doorZ + faceSign * 0.28);
        roofGroup.add(julietDeck);

        const julietRail = new THREE.Mesh(
          new THREE.BoxGeometry(2.16, 0.68, 0.08),
          ironMat
        );
        julietRail.position.set(0, 3.44, doorZ + faceSign * 0.58);
        roofGroup.add(julietRail);
      }

      // Stepping-Stone Garden Walkway leading from the Porch to the Avenue
      for (let p = 1; p <= 5; p++) {
        const stone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.52, 0.55, 0.06, 12),
          new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.75 })
        );
        stone.position.set(
          p % 2 === 0 ? 0.16 : -0.16,
          0.04,
          doorZ + faceSign * (1.85 + p * 0.95)
        );
        stone.receiveShadow = true;
        group.add(stone);
      }

      // Landmark-Specific Architectural Additions
      if (b.id === 'solaris_house') {
        const solarMat = new THREE.MeshStandardMaterial({
          color: '#0284c7',
          metalness: 0.78,
          roughness: 0.16,
        });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.8), solarMat);
        panel.position.set(-1.6, h + 1.45, 0.2);
        panel.rotation.z = slopeAngle;
        roofGroup.add(panel);
      } else if (b.id === 'lin_cottage') {
        const glassHouse = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 3.0, 3.8),
          new THREE.MeshStandardMaterial({
            color: '#a7f3d0',
            transparent: true,
            opacity: 0.58,
            roughness: 0.14,
            metalness: 0.22,
          })
        );
        glassHouse.position.set(-w / 2 - 1.2, 1.65, 0);
        group.add(glassHouse);
      } else if (b.id === 'school') {
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(2.9, 4.0, 2.9),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 })
        );
        tower.position.set(0, h + 2.1, 0);
        tower.castShadow = true;
        roofGroup.add(tower);

        const clockFace = new THREE.Mesh(
          new THREE.CylinderGeometry(0.88, 0.88, 0.16, 24),
          winGlassMat
        );
        clockFace.rotation.x = Math.PI / 2;
        clockFace.position.set(0, h + 2.6, 1.46);
        roofGroup.add(clockFace);

        const handMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
        const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.04), handMat);
        hourHand.position.set(0, h + 2.75, 1.56);
        roofGroup.add(hourHand);

        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(2.25, 2.6, 4),
          new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.5 })
        );
        spire.position.set(0, h + 5.2, 0);
        spire.rotation.y = Math.PI / 4;
        roofGroup.add(spire);
      } else if (b.id === 'cafe') {
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.92, 0.65, 1.2, 20),
          new THREE.MeshStandardMaterial({ color: '#fff7ed', roughness: 0.25 })
        );
        cup.position.set(0, h + 2.85, 0);
        roofGroup.add(cup);

        const patioOffsets = [
          [5.4, -3.4],
          [5.4, 0.8],
          [5.4, 4.2],
        ];
        patioOffsets.forEach(([px, pz]) => {
          const table = new THREE.Mesh(
            new THREE.CylinderGeometry(0.98, 0.98, 0.08, 18),
            new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.4 })
          );
          table.position.set(px, 0.78, pz);
          table.castShadow = true;
          group.add(table);

          const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 0.76, 10), ironMat);
          ped.position.set(px, 0.38, pz);
          group.add(ped);

          const umbrella = new THREE.Mesh(
            new THREE.ConeGeometry(1.68, 0.68, 12),
            new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.55 })
          );
          umbrella.position.set(px, 2.18, pz);
          umbrella.castShadow = true;
          group.add(umbrella);
        });
      } else if (b.id === 'alie_villa') {
        // Alie's Cyber-Solar Villa: Glowing Cyan Solar Array & Quantum Dish
        const cyberSolarMat = new THREE.MeshStandardMaterial({
          color: '#06b6d4',
          emissive: '#0891b2',
          emissiveIntensity: 0.55,
          metalness: 0.82,
          roughness: 0.15,
        });
        const solarWing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 2.0), cyberSolarMat);
        solarWing.position.set(-1.5, h + 1.48, 0);
        solarWing.rotation.z = slopeAngle;
        roofGroup.add(solarWing);

        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 0.45, 18),
          cyberSolarMat
        );
        dish.position.set(1.4, h + 2.4, 0.4);
        dish.rotation.x = -0.35;
        roofGroup.add(dish);
      } else if (b.id === 'joseph_loft') {
        // Joseph's Synth-Wave Loft: Neon Violet Acoustic Beacon & Soundwave Rings
        const synthMat = new THREE.MeshStandardMaterial({
          color: '#a855f7',
          emissive: '#9333ea',
          emissiveIntensity: 0.75,
          roughness: 0.2,
        });
        const soundSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 2.2, 16), synthMat);
        soundSpire.position.set(0, h + 2.6, 0);
        roofGroup.add(soundSpire);
        const soundRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 12, 24), synthMat);
        soundRing.position.set(0, h + 3.1, 0);
        soundRing.rotation.x = Math.PI / 3;
        roofGroup.add(soundRing);
      } else if (b.id === 'iysha_bungalow') {
        // Iysha's Bioluminescent Bungalow: Glowing Emerald Botanical Conservatory Dome
        const bioDome = new THREE.Mesh(
          new THREE.SphereGeometry(1.95, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: '#34d399',
            emissive: '#059669',
            emissiveIntensity: 0.45,
            transparent: true,
            opacity: 0.68,
            roughness: 0.12,
          })
        );
        bioDome.position.set(-w / 2 - 1.35, 0.2, 0);
        group.add(bioDome);
      } else if (b.id === 'amie_manor') {
        // Amie's Holo-Couture Manor: Rose-Gold Holographic Prism Crown
        const coutureMat = new THREE.MeshStandardMaterial({
          color: '#f472b6',
          emissive: '#db2777',
          emissiveIntensity: 0.72,
          metalness: 0.65,
          roughness: 0.18,
        });
        const prismCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), coutureMat);
        prismCrown.position.set(0, h + 3.2, 0);
        roofGroup.add(prismCrown);
      } else if (b.id === 'hawa_sanctuary') {
        // Hawa's Starlight Sanctuary: Golden Dream Observatory Dome & Celestial Lens
        const starDome = new THREE.Mesh(
          new THREE.SphereGeometry(1.45, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: '#fbbf24',
            emissive: '#d97706',
            emissiveIntensity: 0.52,
            metalness: 0.6,
            roughness: 0.2,
          })
        );
        starDome.position.set(0, h + 1.85, 0);
        roofGroup.add(starDome);
      }

      worldGroup.add(group);
    };

    Object.values(CITY_BUILDINGS).forEach(createDetailedBuilding);

    // 7B. Realistic Coastal Sailboats & Yachts (⛵ 10 Detailed 3D Sailboats with Mainsail, Jib, Teak Deck, Portholes & Wake!)
    const harborBoats: THREE.Group[] = [];
    const boatCoords: [number, number, number, string, number][] = [
      [-80, -0.76, 34, '#f97316', 0.4],
      [84, -0.76, -28, '#38bdf8', -0.6],
      [18, -0.76, 84, '#10b981', 1.2],
      [-22, -0.76, 82, '#f43f5e', 0.9],
      [-86, -0.76, -34, '#a855f7', -0.3],
      [78, -0.76, 52, '#eab308', 2.1],
      [48, -0.76, 74, '#06b6d4', 0.75],
      [-56, -0.76, 68, '#fb7185', 1.45],
    ];
    const boatHullWhiteMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.28,
      metalness: 0.12,
    });
    const boatTeakDeckMat = new THREE.MeshStandardMaterial({
      map: woodDeckTex,
      color: '#d97706',
      roughness: 0.62,
    });
    const boatWakeMat = new THREE.MeshBasicMaterial({
      color: '#f0f9ff',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    boatCoords.forEach(([bx, by, bz, sailColor, rotY]) => {
      const boat = new THREE.Group();
      boat.position.set(bx, by, bz);
      boat.rotation.y = rotY;

      // Foaming water wake ring beneath sailboat hull
      const wakeRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.45, 24), boatWakeMat);
      wakeRing.rotation.x = -Math.PI / 2;
      wakeRing.scale.set(1.65, 0.85, 1);
      wakeRing.position.y = -0.04;
      boat.add(wakeRing);

      // Sculpted center hull + tapered bow & stern cones
      const hullCenter = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.68, 1.52),
        boatHullWhiteMat
      );
      hullCenter.position.y = 0.22;
      hullCenter.castShadow = true;
      boat.add(hullCenter);

      const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.76, 1.45, 4),
        boatHullWhiteMat
      );
      bow.rotation.z = -Math.PI / 2;
      bow.rotation.x = Math.PI / 4;
      bow.position.set(2.05, 0.24, 0);
      boat.add(bow);

      // Painted waterline stripe
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.95, 0.14, 1.58),
        new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.35 })
      );
      stripe.position.y = 0.08;
      boat.add(stripe);

      // Teak wood deck
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(2.72, 0.08, 1.44),
        boatTeakDeckMat
      );
      deck.position.y = 0.57;
      boat.add(deck);

      // Yacht cabin house & glowing porthole windows
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.48, 1.02),
        boatHullWhiteMat
      );
      cabin.position.set(-0.22, 0.82, 0);
      cabin.castShadow = true;
      boat.add(cabin);

      const cabinRoof = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.08, 1.1),
        boatTeakDeckMat
      );
      cabinRoof.position.set(-0.22, 1.08, 0);
      boat.add(cabinRoof);

      for (const sideZ of [-0.52, 0.52]) {
        const porthole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12),
          new THREE.MeshStandardMaterial({
            color: '#bae6fd',
            emissive: '#38bdf8',
            emissiveIntensity: 0.5,
          })
        );
        porthole.rotation.x = Math.PI / 2;
        porthole.position.set(-0.2, 0.84, sideZ);
        boat.add(porthole);
      }

      // Tall timber mast & horizontal boom
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.08, 4.6, 10),
        woodSlatsMat
      );
      mast.position.set(0.25, 2.8, 0);
      mast.castShadow = true;
      boat.add(mast);

      const boom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 2.15, 8),
        woodSlatsMat
      );
      boom.rotation.z = Math.PI / 2;
      boom.position.set(-0.78, 1.32, 0);
      boat.add(boom);

      // Billowing Main Sail (Cream/White canvas with vibrant accent trim)
      const mainSailMat = new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        roughness: 0.52,
        side: THREE.DoubleSide,
      });
      const mainSail = new THREE.Mesh(new THREE.ConeGeometry(1.28, 3.45, 3), mainSailMat);
      mainSail.position.set(-0.48, 3.08, 0.08);
      mainSail.scale.set(1.0, 1.0, 0.22);
      mainSail.rotation.y = 0.12;
      mainSail.castShadow = true;
      boat.add(mainSail);

      // Vibrant Colored Front Spinnaker / Jib Sail (⛵)
      const jibSailMat = new THREE.MeshStandardMaterial({
        color: sailColor,
        roughness: 0.48,
        side: THREE.DoubleSide,
      });
      const jibSail = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.85, 3), jibSailMat);
      jibSail.position.set(1.05, 2.55, -0.06);
      jibSail.scale.set(0.92, 1.0, 0.24);
      jibSail.rotation.z = -0.18;
      jibSail.castShadow = true;
      boat.add(jibSail);

      // Masthead Pennant Flag
      const pennant = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.18, 0.04),
        jibSailMat
      );
      pennant.position.set(0.0, 5.05, 0);
      boat.add(pennant);

      worldGroup.add(boat);
      harborBoats.push(boat);
    });

    // Park Pergola / Music Pavilion & Flower Beds
    const gazeboGroup = new THREE.Group();
    gazeboGroup.position.set(-5.2, 0.06, 1.0);
    addContactShadow(gazeboGroup, 3.2, 3.2, 0.4);
    for (const [gx, gz] of [
      [-1.0, -1.0],
      [1.0, -1.0],
      [-1.0, 1.0],
      [1.0, 1.0],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.3, 10), woodSlatsMat);
      post.position.set(gx, 1.15, gz);
      post.castShadow = true;
      gazeboGroup.add(post);
    }
    const gazeboRoof = new THREE.Mesh(
      new THREE.ConeGeometry(1.85, 0.75, 6),
      new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.6 })
    );
    gazeboRoof.position.y = 2.55;
    gazeboRoof.castShadow = true;
    gazeboGroup.add(gazeboRoof);
    worldGroup.add(gazeboGroup);

    // Dynamic 3D AI-Created Objects Layer (Autonomous Resident Inventions & Creations!)
    const createdObjectsGroup = new THREE.Group();
    worldGroup.add(createdObjectsGroup);
    const createdMeshesById: Record<string, THREE.Group> = {};

    const buildCreatedObjectMesh = (obj: CreatedWorldObject): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(obj.position.x, 0.06, obj.position.z);
      g.userData = { type: 'created_object', objectId: obj.id };
      addContactShadow(g, 2.2, 2.2, 0.45);

      const pMat = new THREE.MeshStandardMaterial({
        color: obj.primaryColor,
        roughness: 0.35,
        metalness: 0.3,
      });
      const aMat = new THREE.MeshStandardMaterial({
        color: obj.accentColor,
        emissive: obj.accentColor,
        emissiveIntensity: 0.42,
        roughness: 0.2,
        metalness: 0.45,
      });

      // Base pedestal disk
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.98, 0.14, 20),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6, metalness: 0.3 })
      );
      base.position.y = 0.07;
      base.castShadow = true;
      base.userData = { type: 'created_object', objectId: obj.id };
      g.add(base);
      pickableObjects.push(base);

      if (obj.category === 'lantern_arch') {
        for (const sx of [-0.62, 0.62]) {
          const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 12), pMat);
          pillarMesh.position.set(sx, 1.15, 0);
          pillarMesh.castShadow = true;
          pillarMesh.userData = { type: 'created_object', objectId: obj.id };
          g.add(pillarMesh);
          pickableObjects.push(pillarMesh);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.18, 0.28), pMat);
        beam.position.set(0, 2.25, 0);
        beam.castShadow = true;
        g.add(beam);
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 1), aMat);
        orb.position.set(0, 1.78, 0);
        orb.name = 'spin_part';
        g.add(orb);
      } else if (obj.category === 'solar_bot') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.52, 0.92), pMat);
        body.position.y = 0.52;
        body.castShadow = true;
        body.userData = { type: 'created_object', objectId: obj.id };
        g.add(body);
        pickableObjects.push(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), aMat);
        head.position.set(0, 1.02, 0);
        head.name = 'spin_part';
        g.add(head);

        for (const wx of [-0.46, 0.46]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14), ironMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.26, 0);
          g.add(wheel);
        }
      } else if (obj.category === 'sound_sculpture') {
        const frameRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 12, 28), pMat);
        frameRing.position.y = 1.25;
        frameRing.castShadow = true;
        frameRing.userData = { type: 'created_object', objectId: obj.id };
        g.add(frameRing);
        pickableObjects.push(frameRing);

        for (let i = -2; i <= 2; i++) {
          const chime = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.95 - Math.abs(i) * 0.12, 10),
            aMat
          );
          chime.position.set(i * 0.18, 1.2, 0);
          g.add(chime);
        }
      } else if (obj.category === 'espresso_cart') {
        const cart = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 0.78), pMat);
        cart.position.y = 0.52;
        cart.castShadow = true;
        cart.userData = { type: 'created_object', objectId: obj.id };
        g.add(cart);
        pickableObjects.push(cart);

        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.48, 10), aMat);
        canopy.position.y = 1.82;
        canopy.name = 'spin_part';
        g.add(canopy);
      } else {
        // story_easel or holo_globe
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.15, 12), pMat);
        stand.position.y = 0.65;
        stand.castShadow = true;
        stand.userData = { type: 'created_object', objectId: obj.id };
        g.add(stand);
        pickableObjects.push(stand);

        const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), aMat);
        crystal.position.y = 1.48;
        crystal.name = 'spin_part';
        g.add(crystal);
      }

      return g;
    };

    // 8. Lush Multi-Species 3D Forest Belt, Evergreen Spruce Pines (🎄), Broadleaf Oaks & Sakura Groves (105+ Realistic Textured Trees!)
    type TreeSpecies = 'pine' | 'oak' | 'sakura';
    const forestTrees: THREE.Group[] = [];
    const treeSpecs: [number, number, TreeSpecies, number][] = [
      // Central Park Sakura, Evergreen Pine (🎄) & Oak Sanctuary
      [-6.2, -5.2, 'sakura', 1.08],
      [6.2, -5.2, 'sakura', 1.08],
      [-6.2, 5.8, 'sakura', 1.05],
      [6.2, 5.8, 'sakura', 1.05],
      [-7.8, 0.8, 'pine', 1.18],
      [7.8, 0.8, 'pine', 1.18],
      [-4.8, -7.8, 'pine', 1.15],
      [4.8, -7.8, 'pine', 1.15],
      // Avenue & Neighborhood Shade Trees & Evergreen Pines (🎄)
      [-15, -6, 'oak', 1.05],
      [-15, 6, 'pine', 1.14],
      [15, -6, 'sakura', 1.05],
      [15, 6, 'pine', 1.14],
      [-14, -22, 'pine', 1.22],
      [14, -22, 'pine', 1.22],
      [-8, 22, 'pine', 1.18],
      [8, 22, 'pine', 1.18],
      [-16, 22, 'oak', 1.12],
      [16, 22, 'oak', 1.12],
      [30, 18, 'sakura', 1.12],
      [-30, -18, 'pine', 1.24],
      // Northern Whispering Pine & Alpine Forest Woods (🎄)
      [-28, -36, 'pine', 1.34],
      [-22, -40, 'pine', 1.26],
      [-16, -34, 'oak', 1.18],
      [-8, -42, 'pine', 1.38],
      [-3, -35, 'pine', 1.22],
      [4, -36, 'pine', 1.25],
      [9, -43, 'pine', 1.36],
      [16, -34, 'oak', 1.15],
      [22, -40, 'pine', 1.28],
      [29, -35, 'sakura', 1.18],
      // Eastern Sakura & Botanical Woodland Grove
      [33, -26, 'sakura', 1.22],
      [40, -19, 'oak', 1.25],
      [32, -11, 'sakura', 1.14],
      [41, -7.2, 'pine', 1.28],
      [33, 7.2, 'sakura', 1.18],
      [41, 11, 'oak', 1.22],
      [33, 24, 'pine', 1.24],
      [39, 30, 'oak', 1.18],
      // Western Sunset Pine & Oak Forest Ridge (🎄)
      [-33, -27, 'pine', 1.28],
      [-40, -19, 'pine', 1.34],
      [-32, -11, 'oak', 1.18],
      [-41, -3, 'pine', 1.28],
      [-33, 5, 'oak', 1.16],
      [-41, 12, 'pine', 1.32],
      [-32, 25, 'oak', 1.2],
      [-39, 31, 'pine', 1.26],
      // Southern Coastal Groves flanking Harbor Promenade
      [-26, 36, 'oak', 1.18],
      [-18, 41, 'pine', 1.26],
      [-10, 35, 'sakura', 1.1],
      [10, 35, 'sakura', 1.1],
      [19, 41, 'pine', 1.26],
      [27, 36, 'oak', 1.2],
      [-6.5, 48, 'pine', 1.22],
      [6.5, 48, 'pine', 1.22],
    ];

    // Add outer perimeter forest belt ring (radius 46m to 58m) leaving road, bridge & harbor channels open
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * Math.PI * 2;
      const deg = ((ang * 180) / Math.PI + 360) % 360;
      // Leave South Harbor Pier promenade (deg ~ 80..100) and East Bridge Highway (deg ~ 0) open
      if ((deg > 78 && deg < 102) || deg < 14 || deg > 346) continue;
      const rad = 47 + (i % 4) * 3.1;
      const fx = Math.cos(ang) * rad;
      const fz = Math.sin(ang) * rad;
      const sp: TreeSpecies = i % 2 === 0 ? 'pine' : i % 4 === 1 ? 'oak' : 'sakura';
      const sc = 1.1 + (i % 5) * 0.08;
      treeSpecs.push([fx, fz, sp, sc]);
    }

    const barkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      color: '#ffffff',
      roughness: 0.88,
    });
    const pineBarkMat = new THREE.MeshStandardMaterial({
      map: pineBarkTex,
      color: '#ffffff',
      roughness: 0.9,
    });
    const pineLeafMats = [
      new THREE.MeshStandardMaterial({
        map: pineFoliageTex,
        color: '#10b981',
        roughness: 0.76,
      }),
      new THREE.MeshStandardMaterial({
        map: pineFoliageTex,
        color: '#22c55e',
        roughness: 0.74,
      }),
      new THREE.MeshStandardMaterial({
        map: pineFoliageTex,
        color: '#34d399',
        roughness: 0.72,
      }),
    ];
    const oakLeafMats = [
      new THREE.MeshStandardMaterial({
        map: oakFoliageTex,
        color: '#22c55e',
        roughness: 0.76,
      }),
      new THREE.MeshStandardMaterial({
        map: oakFoliageTex,
        color: '#4ade80',
        roughness: 0.74,
      }),
      new THREE.MeshStandardMaterial({
        map: oakFoliageTex,
        color: '#16a34a',
        roughness: 0.78,
      }),
    ];
    const sakuraLeafMats = [
      new THREE.MeshStandardMaterial({
        map: sakuraFoliageTex,
        color: '#fbcfe8',
        roughness: 0.74,
      }),
      new THREE.MeshStandardMaterial({
        map: sakuraFoliageTex,
        color: '#f9a8d4',
        roughness: 0.72,
      }),
      new THREE.MeshStandardMaterial({
        map: sakuraFoliageTex,
        color: '#f472b6',
        roughness: 0.75,
      }),
    ];
    const treeFairyLightMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#fbbf24',
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });

    treeSpecs.forEach(([tx, tz, species, scale], idx) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      tree.scale.setScalar(scale);
      addContactShadow(tree, 3.8, 3.8, 0.42);

      if (species === 'pine') {
        // Realistic Sculpted 6-Tier Evergreen Spruce / Pine Tree (🎄) with Root Buttresses, Textured Bark & Layered Needle Boughs
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.44, 2.45, 14),
          pineBarkMat
        );
        trunk.position.y = 1.18;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Organic Root Flares anchoring trunk into the forest floor
        for (let r = 0; r < 3; r++) {
          const rAng = (r / 3) * Math.PI * 2 + idx * 0.5;
          const rootFlare = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.18, 0.55, 8),
            pineBarkMat
          );
          rootFlare.position.set(Math.cos(rAng) * 0.22, 0.22, Math.sin(rAng) * 0.22);
          rootFlare.rotation.z = -Math.cos(rAng) * 0.48;
          rootFlare.rotation.x = Math.sin(rAng) * 0.48;
          tree.add(rootFlare);
        }

        const tiers: [number, number, number][] = [
          [1.88, 1.85, 1.62],
          [1.62, 1.75, 2.32],
          [1.34, 1.62, 2.98],
          [1.06, 1.48, 3.58],
          [0.78, 1.35, 4.14],
          [0.48, 1.18, 4.65],
        ];
        tiers.forEach(([coneR, coneH, coneY], tIdx) => {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(coneR, coneH, 16),
            pineLeafMats[tIdx % pineLeafMats.length]
          );
          cone.position.y = coneY;
          cone.rotation.y = tIdx * 0.42;
          cone.castShadow = true;
          cone.receiveShadow = true;
          tree.add(cone);
        });

        // Subtle warm starlight fairy-bulbs on scenic park & avenue evergreens (🎄)
        if (Math.hypot(tx, tz) < 28) {
          for (let g = 0; g < 8; g++) {
            const gAng = (g / 8) * Math.PI * 3.5;
            const gY = 1.35 + g * 0.36;
            const gR = Math.max(0.25, 1.55 - (gY - 1.2) * 0.38);
            const bulb = new THREE.Mesh(
              new THREE.SphereGeometry(0.085, 8, 8),
              treeFairyLightMat
            );
            bulb.position.set(Math.cos(gAng) * gR, gY, Math.sin(gAng) * gR);
            tree.add(bulb);
          }
        }
      } else {
        // Ancient Spreading Broadleaf Oak or Blooming Sakura Tree with Root Buttresses, Textured Bark & Forked Limbs
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.21, 0.48, 2.1, 14),
          barkMat
        );
        trunk.position.y = 1.02;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Organic Root Buttresses at trunk base
        for (let r = 0; r < 4; r++) {
          const rAng = (r / 4) * Math.PI * 2 + idx * 0.3;
          const rootFlare = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.2, 0.6, 8),
            barkMat
          );
          rootFlare.position.set(Math.cos(rAng) * 0.25, 0.22, Math.sin(rAng) * 0.25);
          rootFlare.rotation.z = -Math.cos(rAng) * 0.52;
          rootFlare.rotation.x = Math.sin(rAng) * 0.52;
          tree.add(rootFlare);
        }

        // Angled Primary & Secondary Timber Branch Limbs
        for (const [bx, bz, rotZ, rotX] of [
          [-0.4, 0.18, 0.54, -0.22],
          [0.42, -0.18, -0.5, 0.24],
          [0.0, 0.38, 0.12, 0.48],
          [-0.18, -0.36, 0.28, -0.44],
        ]) {
          const limb = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085, 0.165, 1.22, 10),
            barkMat
          );
          limb.position.set(bx, 1.82, bz);
          limb.rotation.set(rotX, 0, rotZ);
          limb.castShadow = true;
          tree.add(limb);
        }

        const leafMats = species === 'sakura' ? sakuraLeafMats : oakLeafMats;
        const clusters: [number, number, number, number, number][] = [
          [0, 2.75, 0, 1.52, 0],
          [-0.92, 2.35, 0.5, 1.14, 1],
          [0.94, 2.4, -0.46, 1.16, 2],
          [-0.52, 2.48, -0.8, 1.06, 2],
          [0.54, 2.5, 0.8, 1.08, 1],
          [-0.82, 2.65, -0.28, 0.98, 0],
          [0.82, 2.68, 0.32, 0.98, 2],
          [0.1, 3.48, 0.12, 1.24, 0],
        ];
        clusters.forEach(([cx, cy, cz, cr, cIdx]) => {
          const foliage = new THREE.Mesh(
            new THREE.IcosahedronGeometry(cr, 2),
            leafMats[cIdx % leafMats.length]
          );
          foliage.position.set(cx, cy, cz);
          foliage.scale.set(1.16, 0.88, 1.16);
          foliage.castShadow = true;
          foliage.receiveShadow = true;
          tree.add(foliage);
        });
      }

      // Forest Undergrowth Shrub & Mossy Stone at base of every 2nd tree
      if (idx % 2 === 0) {
        const bush = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.58, 1),
          oakLeafMats[(idx + 1) % oakLeafMats.length]
        );
        bush.position.set(0.65, 0.32, 0.45);
        bush.scale.set(1.2, 0.75, 1.1);
        bush.castShadow = true;
        tree.add(bush);
      }

      worldGroup.add(tree);
      forestTrees.push(tree);
    });

    // 9. Wrought-Iron Streetlamps with Curved Arms & Warm Lanterns across the Expanded Island
    const lampBulbMats: THREE.MeshStandardMaterial[] = [];
    const lampCoords: [number, number][] = [
      [-7.5, -7.5],
      [7.5, -7.5],
      [-7.5, 7.5],
      [7.5, 7.5],
      [-13.5, -12.5],
      [13.5, -12.5],
      [-13.5, 12.5],
      [13.5, 12.5],
      [-13.5, -26],
      [13.5, -26],
      [-13.5, 26],
      [13.5, 26],
      [-2.8, 48],
      [2.8, 48],
    ];

    lampCoords.forEach(([lx, lz]) => {
      const lamp = new THREE.Group();
      lamp.position.set(lx, 0, lz);
      addContactShadow(lamp, 1.1, 1.1, 0.35);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 10), ironMat);
      base.position.y = 0.225;
      lamp.add(base);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 3.4, 10), ironMat);
      pole.position.y = 1.85;
      pole.castShadow = true;
      lamp.add(pole);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.24, 8), ironMat);
      cap.position.y = 3.88;
      lamp.add(cap);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.2,
        roughness: 0.2,
      });
      lampBulbMats.push(bulbMat);

      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 8), bulbMat);
      lantern.position.y = 3.62;
      lamp.add(lantern);

      worldGroup.add(lamp);
    });

    // =========================================================================================
    // 9A-2. GOLDEN HORIZON SUSPENSION BRIDGE (🌉) & SECOND CITY: NEO-HORIZON METROPOLIS (🏙️)
    //       Connected along the East Axis (Bridge: x = 58..140, Second City Center: x = 198, z = 0)
    //       100% Explorer-Exclusive District with Futuristic Cyber-Sunset & Neon-Glass Vibes!
    // =========================================================================================
    const bridgeAndSecondCityGroup = new THREE.Group();
    worldGroup.add(bridgeAndSecondCityGroup);

    const neoPulseMats: THREE.MeshStandardMaterial[] = [];
    const neoSpinningObjects: { mesh: THREE.Object3D; speedY: number; speedX?: number; baseY?: number; bobAmp?: number }[] = [];

    const cyberCyanMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#06b6d4',
      emissiveIntensity: 1.05,
      roughness: 0.15,
      metalness: 0.4,
    });
    const cyberMagentaMat = new THREE.MeshStandardMaterial({
      color: '#f472b6',
      emissive: '#ec4899',
      emissiveIntensity: 1.05,
      roughness: 0.15,
      metalness: 0.4,
    });
    const cyberVioletMat = new THREE.MeshStandardMaterial({
      color: '#c084fc',
      emissive: '#9333ea',
      emissiveIntensity: 0.95,
      roughness: 0.18,
      metalness: 0.45,
    });
    const cyberGoldMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 1.0,
      roughness: 0.16,
      metalness: 0.5,
    });
    neoPulseMats.push(cyberCyanMat, cyberMagentaMat, cyberVioletMat, cyberGoldMat);

    // --- PART 1: GOLDEN HORIZON SUSPENSION BRIDGE (x = 58 to x = 140, z = 0) ---
    const bridgeGroup = new THREE.Group();
    bridgeAndSecondCityGroup.add(bridgeGroup);

    const bridgeSteelMat = new THREE.MeshStandardMaterial({
      color: '#ea580c', // Iconic International Sunset Crimson-Orange Bridge Steel
      roughness: 0.36,
      metalness: 0.62,
    });
    const bridgeDarkSteelMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.38,
      metalness: 0.72,
    });
    const bridgeConcreteMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.78,
      metalness: 0.15,
    });
    const bridgeCableMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.28,
      metalness: 0.82,
    });

    // West & East Bridge Entry Plazas (x = 58 and x = 140)
    for (const anchorX of [58.5, 139.5]) {
      const anchorPlaza = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.8, 0.24, 28),
        plazaMat
      );
      anchorPlaza.position.set(anchorX, 0.08, 0);
      anchorPlaza.receiveShadow = true;
      anchorPlaza.userData = { type: 'ground' };
      bridgeGroup.add(anchorPlaza);
      pickableObjects.push(anchorPlaza);

      // Massive Concrete Cable Anchorage Blocks flanking the bridge entrance
      for (const sideZ of [-5.2, 5.2]) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(5.6, 3.2, 1.6),
          bridgeConcreteMat
        );
        block.position.set(anchorX, 1.4, sideZ);
        block.castShadow = true;
        block.receiveShadow = true;
        block.userData = { type: 'bridge_interaction', part: 'anchorage' };
        bridgeGroup.add(block);
        pickableObjects.push(block);

        const capGlow = new THREE.Mesh(
          new THREE.BoxGeometry(5.8, 0.22, 1.7),
          anchorX < 100 ? cyberGoldMat : cyberCyanMat
        );
        capGlow.position.set(anchorX, 3.05, sideZ);
        capGlow.userData = { type: 'bridge_interaction', part: 'anchorage' };
        bridgeGroup.add(capGlow);
        pickableObjects.push(capGlow);
      }
    }

    // Walkable Multi-Lane Suspension Bridge Highway Deck (x = 58..140, length = 82m, width = 11.4m)
    const bridgeDeckStructural = new THREE.Mesh(
      new THREE.BoxGeometry(82, 0.52, 11.4),
      bridgeDarkSteelMat
    );
    bridgeDeckStructural.position.set(99, -0.08, 0);
    bridgeDeckStructural.castShadow = true;
    bridgeDeckStructural.receiveShadow = true;
    bridgeDeckStructural.userData = { type: 'ground' };
    bridgeGroup.add(bridgeDeckStructural);
    pickableObjects.push(bridgeDeckStructural);

    const bridgeRoadway = new THREE.Mesh(
      new THREE.BoxGeometry(82, 0.12, 7.2),
      roadMat
    );
    bridgeRoadway.position.set(99, 0.16, 0);
    bridgeRoadway.receiveShadow = true;
    bridgeRoadway.userData = { type: 'ground' };
    bridgeGroup.add(bridgeRoadway);
    pickableObjects.push(bridgeRoadway);

    // Raised Pedestrian & Explorer Skywalks on North & South edges of Bridge Deck
    for (const sideZ of [-4.5, 4.5]) {
      const walkway = new THREE.Mesh(
        new THREE.BoxGeometry(82, 0.22, 2.1),
        sidewalkMat
      );
      walkway.position.set(99, 0.2, sideZ);
      walkway.receiveShadow = true;
      walkway.userData = { type: 'ground' };
      bridgeGroup.add(walkway);
      pickableObjects.push(walkway);

      // Glowing Neon LED Guide Strip along the inner curb of each skywalk
      const curbGlow = new THREE.Mesh(
        new THREE.BoxGeometry(81.5, 0.06, 0.14),
        sideZ < 0 ? cyberCyanMat : cyberMagentaMat
      );
      curbGlow.position.set(99, 0.32, sideZ > 0 ? 3.42 : -3.42);
      bridgeGroup.add(curbGlow);

      // Protective Steel & Glass Guardrails along outer edges (z = ±5.45)
      const railZ = sideZ > 0 ? 5.42 : -5.42;
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(82, 0.12, 0.14),
        bridgeSteelMat
      );
      topRail.position.set(99, 1.32, railZ);
      topRail.castShadow = true;
      bridgeGroup.add(topRail);

      const midGlowRail = new THREE.Mesh(
        new THREE.BoxGeometry(82, 0.06, 0.08),
        sideZ < 0 ? cyberCyanMat : cyberGoldMat
      );
      midGlowRail.position.set(99, 0.85, railZ);
      bridgeGroup.add(midGlowRail);
    }

    // Dashed Golden Center Line along the 82m Bridge Highway
    for (let bx = 61; bx <= 137; bx += 3.6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 0.14), centerLineMat);
      dash.position.set(bx, 0.23, 0);
      bridgeGroup.add(dash);
    }

    // Guardrail Stanchion Posts & Under-Deck Steel Cross-Girders every 4m
    for (let bx = 60; bx <= 138; bx += 4) {
      for (const railZ of [-5.42, 5.42]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 1.18, 0.18),
          bridgeSteelMat
        );
        post.position.set(bx, 0.78, railZ);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
      const crossGirder = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.65, 11.2),
        bridgeDarkSteelMat
      );
      crossGirder.position.set(bx, -0.52, 0);
      bridgeGroup.add(crossGirder);
    }

    // Twin Monumental Suspension Bridge Towers (West Tower at x = 78, East Tower at x = 120, height = 29m)
    const towerXCoords = [78, 120];
    towerXCoords.forEach((tx) => {
      // Deep-Sea Concrete Foundation Pier & Fender Ring rooted in the Ocean Seabed
      const seaPier = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 6.8, 14.2),
        bridgeConcreteMat
      );
      seaPier.position.set(tx, -3.3, 0);
      seaPier.castShadow = true;
      seaPier.receiveShadow = true;
      bridgeGroup.add(seaPier);

      const pierFender = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 1.2, 15.0),
        bridgeDarkSteelMat
      );
      pierFender.position.set(tx, -0.45, 0);
      bridgeGroup.add(pierFender);

      // Twin Vertical H-Frame Steel Tower Legs (z = -5.2 and z = +5.2)
      for (const tz of [-5.2, 5.2]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(1.75, 29.0, 1.75),
          bridgeSteelMat
        );
        leg.position.set(tx, 14.2, tz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        leg.userData = { type: 'bridge_interaction', part: 'tower' };
        bridgeGroup.add(leg);
        pickableObjects.push(leg);

        // Glowing Vertical Neon Accent Strip on Tower Leg
        const legNeon = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 26.5, 1.82),
          tx < 100 ? cyberGoldMat : cyberCyanMat
        );
        legNeon.position.set(tx, 14.2, tz);
        legNeon.userData = { type: 'bridge_interaction', part: 'tower' };
        bridgeGroup.add(legNeon);
        pickableObjects.push(legNeon);

        // Aviation & Cyber Sky-Beacon atop each Tower Peak
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.52, 14, 14),
          cyberMagentaMat
        );
        beacon.position.set(tx, 29.1, tz);
        bridgeGroup.add(beacon);
      }

      // 3 Monumental Horizontal Cross-Struts above the Bridge Roadway (y = 9.5m, 18.5m, 27.2m)
      for (const beamY of [9.5, 18.5, 27.2]) {
        const crossBeam = new THREE.Mesh(
          new THREE.BoxGeometry(1.45, 1.35, 11.8),
          bridgeSteelMat
        );
        crossBeam.position.set(tx, beamY, 0);
        crossBeam.castShadow = true;
        crossBeam.userData = { type: 'bridge_interaction', part: 'tower_beam' };
        bridgeGroup.add(crossBeam);
        pickableObjects.push(crossBeam);

        const beamLight = new THREE.Mesh(
          new THREE.BoxGeometry(1.52, 0.18, 8.8),
          beamY > 20 ? cyberCyanMat : cyberGoldMat
        );
        beamLight.position.set(tx, beamY - 0.6, 0);
        beamLight.userData = { type: 'bridge_interaction', part: 'tower_beam' };
        bridgeGroup.add(beamLight);
        pickableObjects.push(beamLight);
      }
    });

    // Interactive Bridge Hyper-Transit Portals & 5 Speed-Boost Energy Rings along the Bridge Span
    const bridgeSpeedRings: THREE.Mesh[] = [];
    const speedRingXCoords = [66, 82, 99, 116, 132];
    speedRingXCoords.forEach((rx, idx) => {
      const ringMat = idx % 2 === 0 ? cyberGoldMat : cyberCyanMat;
      const speedRing = new THREE.Mesh(
        new THREE.TorusGeometry(3.5, 0.12, 12, 36),
        ringMat
      );
      speedRing.position.set(rx, 2.35, 0);
      speedRing.rotation.y = Math.PI / 2;
      speedRing.userData = {
        type: 'bridge_interaction',
        part: idx === 0 ? 'west_portal' : idx === 4 ? 'east_portal' : 'speed_ring',
      };
      bridgeGroup.add(speedRing);
      pickableObjects.push(speedRing);
      bridgeSpeedRings.push(speedRing);

      // Interactive Horizon Reflection & Fast-Travel Kiosk Pedestals at West Gate (60), Mid-Span (99), East Gate (138)
      if (idx === 0 || idx === 2 || idx === 4) {
        const kioskX = idx === 0 ? 60.2 : idx === 2 ? 99.0 : 137.8;
        const kioskZ = -4.35;
        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.58, 1.15, 16),
          bridgeDarkSteelMat
        );
        pedestal.position.set(kioskX, 0.82, kioskZ);
        pedestal.castShadow = true;
        pedestal.userData = {
          type: 'bridge_interaction',
          part: idx === 0 ? 'west_kiosk' : idx === 2 ? 'mid_kiosk' : 'east_kiosk',
        };
        bridgeGroup.add(pedestal);
        pickableObjects.push(pedestal);

        const holoOrb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          idx === 0 ? cyberGoldMat : idx === 2 ? cyberMagentaMat : cyberCyanMat
        );
        holoOrb.position.set(kioskX, 1.78, kioskZ);
        holoOrb.userData = {
          type: 'bridge_interaction',
          part: idx === 0 ? 'west_kiosk' : idx === 2 ? 'mid_kiosk' : 'east_kiosk',
        };
        bridgeGroup.add(holoOrb);
        pickableObjects.push(holoOrb);
        neoSpinningObjects.push({
          mesh: holoOrb,
          speedY: 1.8,
          speedX: 0.9,
          baseY: 1.78,
          bobAmp: 0.12,
        });
      }
    });

    // Parabolic Catenary Main Suspension Cables & Vertical Steel Suspender Cables
    const getBridgeCableHeight = (x: number): number => {
      if (x <= 78) {
        // West approach span (x = 58..78, 20m)
        const t = (x - 58) / 20;
        return 2.4 + Math.pow(t, 1.55) * 25.8;
      } else if (x <= 120) {
        // Main center ocean span (x = 78..120, 42m, midpoint at x = 99)
        const u = (x - 99) / 21; // -1 to +1
        return 6.4 + u * u * 21.8;
      } else {
        // East approach span (x = 120..140, 20m)
        const t = (140 - x) / 20;
        return 2.4 + Math.pow(t, 1.55) * 25.8;
      }
    };

    const cableStepX = 2.0;
    for (const cableZ of [-5.2, 5.2]) {
      for (let x = 58; x < 140; x += cableStepX) {
        const y1 = getBridgeCableHeight(x);
        const y2 = getBridgeCableHeight(x + cableStepX);
        const segLen = Math.hypot(cableStepX, y2 - y1);
        const midX = x + cableStepX * 0.5;
        const midY = (y1 + y2) * 0.5;
        const angleZ = Math.atan2(y2 - y1, cableStepX);

        const mainCableSeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, segLen + 0.08, 10),
          bridgeCableMat
        );
        mainCableSeg.position.set(midX, midY, cableZ);
        mainCableSeg.rotation.z = angleZ - Math.PI / 2;
        mainCableSeg.castShadow = true;
        bridgeGroup.add(mainCableSeg);

        // Necklace Festival Node Light every 4m along the main catenary cables
        if (Math.round(x) % 4 === 0) {
          const necklaceOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 10, 10),
            cableZ < 0 ? cyberCyanMat : cyberGoldMat
          );
          necklaceOrb.position.set(x, y1 - 0.15, cableZ);
          bridgeGroup.add(necklaceOrb);

          // Vertical High-Tensile Steel Suspender Dropper Cable down to Bridge Deck
          if (x > 60 && x < 138 && Math.abs(x - 78) > 1.5 && Math.abs(x - 120) > 1.5) {
            const dropH = Math.max(0.5, y1 - 0.3);
            const dropper = new THREE.Mesh(
              new THREE.CylinderGeometry(0.045, 0.045, dropH, 8),
              bridgeCableMat
            );
            dropper.position.set(x, 0.3 + dropH * 0.5, cableZ);
            bridgeGroup.add(dropper);
          }
        }
      }
    }

    // --- PART 2: SECOND CITY — "NEO-HORIZON CYBER-METROPOLIS" (🏙️ Center: x = 198, z = 0, Radius = 60m) ---
    // Uninhabited Explorer-Only Futuristic City with Neon-Glass Skyscrapers, Bio-Dome & Anti-Gravity Plaza!
    const secondCityX = 198;
    const secondCityGroup = new THREE.Group();
    secondCityGroup.position.set(secondCityX, 0, 0);
    bridgeAndSecondCityGroup.add(secondCityGroup);

    // 1. Coastal Granite & Limestone Submarine Island Foundation for Second City
    const neoBedrockMat = new THREE.MeshStandardMaterial({
      map: cliffRockTex,
      color: '#94a3b8',
      roughness: 0.8,
      metalness: 0.1,
    });
    const neoDeepBedrock = new THREE.Mesh(
      new THREE.CylinderGeometry(66.5, 79, 5.6, 64),
      neoBedrockMat
    );
    neoDeepBedrock.position.set(0, -3.65, 0);
    neoDeepBedrock.receiveShadow = true;
    secondCityGroup.add(neoDeepBedrock);

    // Bioluminescent Cyan Lagoon Shelf & Animated Shoreline Wave Rings around Second City
    const neoLagoon = new THREE.Mesh(
      new THREE.CylinderGeometry(72, 84, 1.4, 64),
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        map: waterNormalTex,
        emissive: '#06b6d4',
        emissiveIntensity: 0.24,
        roughness: 0.2,
        transparent: true,
        opacity: 0.68,
      })
    );
    neoLagoon.position.set(0, -1.52, 0);
    secondCityGroup.add(neoLagoon);

    const neoFoamRing1 = new THREE.Mesh(
      new THREE.RingGeometry(64.2, 65.5, 64),
      foamRingMat1
    );
    neoFoamRing1.rotation.x = -Math.PI / 2;
    neoFoamRing1.position.y = -0.75;
    secondCityGroup.add(neoFoamRing1);

    // Sculpted Coastal Seawall & Sandy Cove Rim (Positioned at y = -0.82 so its top is -0.095, cleanly below neoGroundMesh!)
    const neoSeawall = new THREE.Mesh(
      new THREE.CylinderGeometry(60.6, 64.5, 1.45, 64),
      beachMat
    );
    neoSeawall.position.set(0, -0.82, 0);
    neoSeawall.receiveShadow = true;
    neoSeawall.userData = { type: 'ground' };
    secondCityGroup.add(neoSeawall);
    pickableObjects.push(neoSeawall);

    const neoRimGlowRing = new THREE.Mesh(
      new THREE.RingGeometry(59.6, 60.2, 64),
      cyberCyanMat
    );
    neoRimGlowRing.rotation.x = -Math.PI / 2;
    neoRimGlowRing.position.y = 0.04;
    secondCityGroup.add(neoRimGlowRing);

    // Main Second City Botanical & Pearl-Stone Urban Terrace Deck (Bright, Realistic & Lush — Never Black!)
    const neoGroundMat = new THREE.MeshStandardMaterial({
      map: neoCityGroundTex,
      color: '#ffffff',
      roughness: 0.68,
      metalness: 0.06,
    });
    const neoGroundMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(60.0, 60.4, 0.52, 64),
      neoGroundMat
    );
    neoGroundMesh.position.set(0, -0.24, 0);
    neoGroundMesh.receiveShadow = true;
    neoGroundMesh.userData = { type: 'ground' };
    secondCityGroup.add(neoGroundMesh);
    pickableObjects.push(neoGroundMesh);

    // 2. Neon Boulevard Grid & Central Anti-Gravity Cyber-Core Plaza
    const createNeoBoulevard = (
      bx: number,
      bz: number,
      w: number,
      l: number,
      isNS: boolean,
      neonMat: THREE.MeshStandardMaterial
    ) => {
      const roadBase = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.6, 0.09, l + 1.6),
        sidewalkMat
      );
      roadBase.position.set(bx, 0.03, bz);
      roadBase.receiveShadow = true;
      roadBase.userData = { type: 'ground' };
      secondCityGroup.add(roadBase);
      pickableObjects.push(roadBase);

      const asphaltStrip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), roadMat);
      asphaltStrip.position.set(bx, 0.045, bz);
      asphaltStrip.receiveShadow = true;
      asphaltStrip.userData = { type: 'ground' };
      secondCityGroup.add(asphaltStrip);
      pickableObjects.push(asphaltStrip);

      // Dual Neon Edge Light Strips
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(isNS ? 0.14 : w, 0.03, isNS ? l : 0.14),
          neonMat
        );
        edge.position.set(
          isNS ? bx + side * (w * 0.5 + 0.15) : bx,
          0.095,
          isNS ? bz : bz + side * (l * 0.5 + 0.15)
        );
        secondCityGroup.add(edge);
      }
    };

    // Main East-West Neon Horizon Avenue (connects East Bridge Landing at local x = -58 straight to East Ocean Overlook at local x = +54)
    createNeoBoulevard(-3, 0, 108, 5.2, false, cyberCyanMat);
    // Main North-South Synthwave Boulevard
    createNeoBoulevard(0, 0, 5.2, 96, true, cyberMagentaMat);
    // West & East Inner District Avenues
    createNeoBoulevard(-24, 0, 4.0, 72, true, cyberVioletMat);
    createNeoBoulevard(24, 0, 4.0, 72, true, cyberGoldMat);

    // Central Cyber-Core Plaza & Levitating Anti-Gravity Gyroscope Fountain (Local 0, 0 -> World x = 198, z = 0)
    const neoPlazaDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 11.8, 0.14, 36),
      plazaMat
    );
    neoPlazaDisc.position.set(0, 0.05, 0);
    neoPlazaDisc.receiveShadow = true;
    neoPlazaDisc.userData = { type: 'ground' };
    secondCityGroup.add(neoPlazaDisc);
    pickableObjects.push(neoPlazaDisc);

    const neoPlazaRing = new THREE.Mesh(
      new THREE.RingGeometry(10.6, 11.2, 36),
      cyberMagentaMat
    );
    neoPlazaRing.rotation.x = -Math.PI / 2;
    neoPlazaRing.position.y = 0.13;
    secondCityGroup.add(neoPlazaRing);

    // Anti-Gravity Energy Basin & Counter-Rotating Hologram Rings
    const coreBasin = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.8, 0.68, 24),
      bridgeDarkSteelMat
    );
    coreBasin.position.set(0, 0.36, 0);
    coreBasin.castShadow = true;
    secondCityGroup.add(coreBasin);

    const corePool = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.0, 0.72, 24),
      cyberCyanMat
    );
    corePool.position.set(0, 0.37, 0);
    secondCityGroup.add(corePool);

    const gyroRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.1, 14, 36),
      cyberCyanMat
    );
    gyroRing1.position.set(0, 3.6, 0);
    secondCityGroup.add(gyroRing1);
    neoSpinningObjects.push({ mesh: gyroRing1, speedY: 1.2, speedX: 0.7 });

    const gyroRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.09, 14, 32),
      cyberMagentaMat
    );
    gyroRing2.position.set(0, 3.6, 0);
    secondCityGroup.add(gyroRing2);
    neoSpinningObjects.push({ mesh: gyroRing2, speedY: -1.6, speedX: -0.9 });

    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.05, 1),
      cyberGoldMat
    );
    coreCrystal.position.set(0, 3.6, 0);
    secondCityGroup.add(coreCrystal);
    neoSpinningObjects.push({ mesh: coreCrystal, speedY: 2.1, baseY: 3.6, bobAmp: 0.32 });

    // 3. Futuristic Skyscrapers & Architectural Landmarks of Neo-Horizon City (Explorer-Only 🏙️)
    const neoGlassDarkMat = new THREE.MeshStandardMaterial({
      map: glassCurtainTex,
      color: '#e0f2fe',
      roughness: 0.18,
      metalness: 0.35,
    });
    const neoTitaniumMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.32,
      metalness: 0.42,
    });

    // Helper to build illuminated Cyber-Glass Skyscrapers with Neon Light Fins & Rooftop Features
    const buildCyberSkyscraper = (
      lx: number,
      lz: number,
      w: number,
      h: number,
      d: number,
      neonMat: THREE.MeshStandardMaterial,
      secondaryMat: THREE.MeshStandardMaterial,
      hasSpire = true
    ) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(lx, 0, lz);
      addContactShadow(bGroup, w + 3.2, d + 3.2, 0.62);

      // Podium lobby base
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.4, 2.6, d + 1.4),
        neoTitaniumMat
      );
      podium.position.y = 1.3;
      podium.castShadow = true;
      podium.receiveShadow = true;
      bGroup.add(podium);

      // Main reflective glass tower shaft
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        neoGlassDarkMat
      );
      shaft.position.y = h * 0.5;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      bGroup.add(shaft);

      // Horizontal glowing floor-plate bands every 3.2m
      for (let fy = 3.2; fy < h - 1.0; fy += 3.2) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.18, 0.14, d + 0.18),
          Math.round(fy) % 6 === 0 ? secondaryMat : neonMat
        );
        band.position.y = fy;
        bGroup.add(band);
      }

      // 4 Vertical Corner Neon Light Fins
      for (const cx of [-w * 0.5, w * 0.5]) {
        for (const cz of [-d * 0.5, d * 0.5]) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, h + 0.4, 0.22),
            neonMat
          );
          fin.position.set(cx, h * 0.5, cz);
          bGroup.add(fin);
        }
      }

      // Upper Crown Tier & Spire
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.72, 2.8, d * 0.72),
        neoGlassDarkMat
      );
      crown.position.y = h + 1.4;
      crown.castShadow = true;
      bGroup.add(crown);

      const crownRim = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.76, 0.24, d * 0.76),
        secondaryMat
      );
      crownRim.position.y = h + 2.8;
      bGroup.add(crownRim);

      if (hasSpire) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.32, 6.5, 12),
          neoTitaniumMat
        );
        spire.position.y = h + 6.0;
        bGroup.add(spire);

        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(1.65, 0.09, 12, 28),
          neonMat
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = h + 5.2;
        bGroup.add(halo);
        neoSpinningObjects.push({ mesh: halo, speedY: 1.5 });
      }

      secondCityGroup.add(bGroup);
      return bGroup;
    };

    // Landmark 1: Aether Spire Megatower (Northeast Quadrant: local x = 28, z = -22, height = 34m)
    buildCyberSkyscraper(28, -22, 10.5, 34, 10.5, cyberCyanMat, cyberMagentaMat, true);

    // Landmark 2: Prism Twin Sky-Bridge Towers (Northwest Quadrant: local x = -32 & -16, z = -22)
    buildCyberSkyscraper(-32, -22, 8.8, 26, 8.8, cyberMagentaMat, cyberCyanMat, true);
    buildCyberSkyscraper(-16, -22, 8.4, 22, 8.4, cyberVioletMat, cyberGoldMat, false);

    // High-Altitude Glass Sky-Bridge connecting the Prism Twin Towers at y = 14.5m
    const skyBridge = new THREE.Mesh(
      new THREE.BoxGeometry(16.0, 2.4, 3.6),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.62,
        roughness: 0.12,
        metalness: 0.5,
      })
    );
    skyBridge.position.set(-24, 14.5, -22);
    skyBridge.castShadow = true;
    secondCityGroup.add(skyBridge);

    const skyBridgeFloorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(15.8, 0.18, 3.8),
      cyberCyanMat
    );
    skyBridgeFloorGlow.position.set(-24, 13.25, -22);
    secondCityGroup.add(skyBridgeFloorGlow);

    // Landmark 3: Solstice Geodesic Bio-Dome Conservatory (Southwest Quadrant: local x = -28, z = 24)
    const bioDomeGroup = new THREE.Group();
    bioDomeGroup.position.set(-28, 0, 24);
    addContactShadow(bioDomeGroup, 21, 21, 0.55);

    const domeBaseRing = new THREE.Mesh(
      new THREE.CylinderGeometry(10.2, 10.8, 1.2, 32),
      neoTitaniumMat
    );
    domeBaseRing.position.y = 0.6;
    domeBaseRing.castShadow = true;
    bioDomeGroup.add(domeBaseRing);

    const domeGlass = new THREE.Mesh(
      new THREE.SphereGeometry(9.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: '#2dd4bf',
        emissive: '#0d9488',
        emissiveIntensity: 0.28,
        transparent: true,
        opacity: 0.52,
        roughness: 0.14,
        metalness: 0.35,
      })
    );
    domeGlass.position.y = 1.1;
    bioDomeGroup.add(domeGlass);

    const domeWireframe = new THREE.Mesh(
      new THREE.SphereGeometry(9.88, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5eead4', wireframe: true, transparent: true, opacity: 0.45 })
    );
    domeWireframe.position.y = 1.1;
    bioDomeGroup.add(domeWireframe);

    const domeInnerCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.1, 0),
      cyberGoldMat
    );
    domeInnerCrystal.position.y = 5.2;
    bioDomeGroup.add(domeInnerCrystal);
    neoSpinningObjects.push({ mesh: domeInnerCrystal, speedY: 1.4, baseY: 5.2, bobAmp: 0.4 });
    secondCityGroup.add(bioDomeGroup);

    // Landmark 4: Nova Synth-Pyramid & Laser Arena (Southeast Quadrant: local x = 28, z = 24)
    const pyramidGroup = new THREE.Group();
    pyramidGroup.position.set(28, 0, 24);
    addContactShadow(pyramidGroup, 20, 20, 0.6);

    const pyrTiers: [number, number, number][] = [
      [15.0, 2.4, 1.2],
      [12.2, 2.4, 3.6],
      [9.4, 2.4, 6.0],
      [6.6, 2.4, 8.4],
      [3.8, 2.4, 10.8],
    ];
    pyrTiers.forEach(([sizeXZ, tierH, tierY], idx) => {
      const stepBox = new THREE.Mesh(
        new THREE.BoxGeometry(sizeXZ, tierH, sizeXZ),
        neoGlassDarkMat
      );
      stepBox.position.y = tierY;
      stepBox.castShadow = true;
      stepBox.receiveShadow = true;
      pyramidGroup.add(stepBox);

      const stepNeon = new THREE.Mesh(
        new THREE.BoxGeometry(sizeXZ + 0.2, 0.16, sizeXZ + 0.2),
        idx % 2 === 0 ? cyberMagentaMat : cyberGoldMat
      );
      stepNeon.position.y = tierY + tierH * 0.5;
      pyramidGroup.add(stepNeon);
    });

    const pyramidApex = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 3.6, 4),
      cyberCyanMat
    );
    pyramidApex.position.y = 14.8;
    pyramidApex.rotation.y = Math.PI / 4;
    pyramidGroup.add(pyramidApex);
    neoSpinningObjects.push({ mesh: pyramidApex, speedY: -1.8, baseY: 14.8, bobAmp: 0.35 });
    secondCityGroup.add(pyramidGroup);

    // Landmark 5: North & South Cyber-Towers flanking the Boulevard
    buildCyberSkyscraper(12, -34, 7.6, 20, 7.6, cyberGoldMat, cyberCyanMat, false);
    buildCyberSkyscraper(-12, 34, 7.8, 19, 7.8, cyberCyanMat, cyberVioletMat, false);
    buildCyberSkyscraper(12, 34, 8.2, 23, 8.2, cyberMagentaMat, cyberGoldMat, true);

    // Landmark 6: Eastern Horizon Ocean Overlook Deck & Neon Gateway Arch (local x = 52, z = 0)
    const overlookDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.2, 0.32, 28),
      neoTitaniumMat
    );
    overlookDeck.position.set(52, 0.1, 0);
    overlookDeck.receiveShadow = true;
    overlookDeck.userData = { type: 'ground' };
    secondCityGroup.add(overlookDeck);
    pickableObjects.push(overlookDeck);

    const gatewayArch = new THREE.Mesh(
      new THREE.TorusGeometry(6.2, 0.42, 14, 36, Math.PI),
      cyberMagentaMat
    );
    gatewayArch.rotation.y = Math.PI / 2;
    gatewayArch.position.set(-54, 0.2, 0); // Welcoming Neon Arch at East End of Bridge!
    secondCityGroup.add(gatewayArch);

    const eastOverlookArch = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.38, 14, 36, Math.PI),
      cyberCyanMat
    );
    eastOverlookArch.rotation.y = -Math.PI / 2;
    eastOverlookArch.position.set(54, 0.2, 0);
    secondCityGroup.add(eastOverlookArch);

    // 4. Bioluminescent Evergreen Pines (🎄), Crystal-Sakura & Botanical Trees across Neo-Horizon City
    const neoTreeCoords: [number, number, number][] = [
      [-14, -12, 1.15],
      [14, -12, 1.15],
      [-14, 12, 1.15],
      [14, 12, 1.15],
      [-38, -8, 1.22],
      [-38, 8, 1.22],
      [38, -8, 1.22],
      [38, 8, 1.22],
      [-8, -42, 1.18],
      [8, -42, 1.18],
      [-8, 44, 1.18],
      [8, 44, 1.18],
      [-44, -26, 1.25],
      [44, -26, 1.25],
      [-44, 26, 1.25],
      [44, 26, 1.25],
    ];
    neoTreeCoords.forEach(([ntx, ntz, nScale], idx) => {
      const nTree = new THREE.Group();
      nTree.position.set(ntx, 0, ntz);
      nTree.scale.setScalar(nScale);
      addContactShadow(nTree, 2.8, 2.8, 0.4);

      const nTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.34, 2.2, 10),
        barkMat
      );
      nTrunk.position.y = 1.1;
      nTrunk.castShadow = true;
      nTree.add(nTrunk);

      if (idx % 2 === 0) {
        // Textured Evergreen Pine Tree (🎄) with glowing cyan/gold fairy lights
        const tiers: [number, number, number][] = [
          [1.65, 1.75, 1.65],
          [1.35, 1.6, 2.45],
          [1.02, 1.45, 3.18],
          [0.65, 1.25, 3.82],
        ];
        tiers.forEach(([coneR, coneH, coneY], tIdx) => {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(coneR, coneH, 12),
            pineLeafMats[tIdx % pineLeafMats.length]
          );
          cone.position.y = coneY;
          cone.castShadow = true;
          nTree.add(cone);
        });
      } else {
        for (const [cx, cy, cz, cr] of [
          [0, 2.8, 0, 1.3],
          [-0.75, 2.35, 0.4, 0.96],
          [0.75, 2.4, -0.4, 0.98],
        ]) {
          const crystalCanopy = new THREE.Mesh(
            new THREE.IcosahedronGeometry(cr, 2),
            sakuraLeafMats[idx % sakuraLeafMats.length]
          );
          crystalCanopy.position.set(cx, cy, cz);
          crystalCanopy.scale.set(1.12, 0.84, 1.12);
          crystalCanopy.castShadow = true;
          nTree.add(crystalCanopy);
        }
      }

      secondCityGroup.add(nTree);
      forestTrees.push(nTree);
    });

    // Futuristic Hydro-Yacht Sailboats (⛵) floating off the Neo-Horizon Coast & under the Suspension Bridge
    const neoBoatCoords: [number, number, number, string][] = [
      [99, -0.76, -24, '#22d3ee'],
      [99, -0.76, 26, '#ec4899'],
      [272, -0.76, -18, '#a855f7'],
      [268, -0.76, 22, '#f59e0b'],
    ];
    neoBoatCoords.forEach(([bx, by, bz, sailCol]) => {
      const boat = new THREE.Group();
      boat.position.set(bx, by, bz);

      const wakeRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.45, 24), boatWakeMat);
      wakeRing.rotation.x = -Math.PI / 2;
      wakeRing.scale.set(1.65, 0.85, 1);
      wakeRing.position.y = -0.04;
      boat.add(wakeRing);

      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.65, 1.5),
        boatHullWhiteMat
      );
      hull.position.y = 0.22;
      boat.add(hull);
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 0.08, 1.42),
        boatTeakDeckMat
      );
      deck.position.y = 0.57;
      boat.add(deck);
      const neonTrim = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.12, 1.56),
        new THREE.MeshStandardMaterial({ color: sailCol, emissive: sailCol, emissiveIntensity: 0.9 })
      );
      neonTrim.position.y = 0.22;
      boat.add(neonTrim);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 4.4, 8), neoTitaniumMat);
      mast.position.set(0.2, 2.6, 0);
      boat.add(mast);
      const mainSail = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, 3.3, 3),
        new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.45, side: THREE.DoubleSide })
      );
      mainSail.position.set(-0.45, 2.9, 0.06);
      mainSail.scale.set(1, 1, 0.22);
      boat.add(mainSail);
      const jibSail = new THREE.Mesh(
        new THREE.ConeGeometry(0.92, 2.75, 3),
        new THREE.MeshStandardMaterial({ color: sailCol, emissive: sailCol, emissiveIntensity: 0.35, roughness: 0.35, side: THREE.DoubleSide })
      );
      jibSail.position.set(1.0, 2.45, -0.05);
      jibSail.scale.set(0.92, 1, 0.22);
      jibSail.rotation.z = -0.18;
      boat.add(jibSail);
      worldGroup.add(boat);
      harborBoats.push(boat);
    });

    // 5. Autonomous Inter-City Cyberpunk Supercar ("Cyber-Valkyrie GT" / Dream Cruiser 🚗)
    //    Built with local +Z as Forward Nose, -Z as Rear Spoiler/Diffuser, ±X as Left/Right Wheels
    //    Parked initially at (10.5, 0.05, 5.2) in Gemini City so Player can easily sit inside!
    const dreamCruiserGroup = new THREE.Group();
    dreamCruiserGroup.position.set(10.5, 0.05, 5.2);
    dreamCruiserGroup.rotation.y = 0;
    addContactShadow(dreamCruiserGroup, 2.8, 5.2, 0.72);

    const carChassisGroup = new THREE.Group();
    dreamCruiserGroup.add(carChassisGroup);

    const carCarbonMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.88,
      roughness: 0.16,
    });
    const carMetallicPaintMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.92,
      roughness: 0.11,
    });
    const carSilverBladeMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.88,
      roughness: 0.18,
    });
    const carCanopyMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.42,
      roughness: 0.06,
      metalness: 0.55,
      depthWrite: false,
    });
    const carInteriorLeatherMat = new THREE.MeshStandardMaterial({
      color: '#be123c',
      roughness: 0.42,
      metalness: 0.12,
    });
    const carAlcantaraDarkMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.68,
      metalness: 0.08,
    });
    const carCaliperRedMat = new THREE.MeshStandardMaterial({
      color: '#e11d48',
      emissive: '#9f1239',
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.65,
    });
    const tireTreadMat = new THREE.MeshStandardMaterial({
      map: tireTreadTex,
      color: '#e2e8f0',
      roughness: 0.82,
      metalness: 0.08,
    });

    // 1) Low-Slung Carbon-Fiber Aerodynamic Floor Splitter, Front Canards & Rear Diffuser Strakes
    const splitterBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.16, 0.12, 4.78),
      carCarbonMat
    );
    splitterBase.position.set(0, 0.24, 0);
    splitterBase.castShadow = true;
    splitterBase.userData = { type: 'cyber_car' };
    carChassisGroup.add(splitterBase);
    pickableObjects.push(splitterBase);

    // Neon Cyan Underglow Strips along Left/Right Side Skirts & Front/Rear Diffuser
    for (const sideX of [-1.07, 1.07]) {
      const sideGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.06, 4.48),
        cyberCyanMat
      );
      sideGlow.position.set(sideX, 0.22, 0);
      carChassisGroup.add(sideGlow);
    }

    // 2) Sculpted Supercar Main Lower Body & Sloped Aerodynamic Front Hood (+Z Front)
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.44, 4.48),
      carMetallicPaintMat
    );
    lowerBody.position.set(0, 0.5, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    lowerBody.userData = { type: 'cyber_car' };
    carChassisGroup.add(lowerBody);
    pickableObjects.push(lowerBody);

    const slopedFrontHood = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.24, 1.52),
      carSilverBladeMat
    );
    slopedFrontHood.position.set(0, 0.66, 1.42);
    slopedFrontHood.rotation.x = 0.16;
    slopedFrontHood.castShadow = true;
    slopedFrontHood.userData = { type: 'cyber_car' };
    carChassisGroup.add(slopedFrontHood);
    pickableObjects.push(slopedFrontHood);

    // Dual Carbon Front Hood Aero Extractor Vents
    for (const vx of [-0.42, 0.42]) {
      const hoodVent = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.05, 0.52),
        carCarbonMat
      );
      hoodVent.position.set(vx, 0.76, 1.48);
      hoodVent.rotation.x = 0.16;
      carChassisGroup.add(hoodVent);
    }

    // 3) 4 Muscular Flared Fender Wheel Arches & Side Aero Intake Scoops
    const fenderCoords: [number, number][] = [
      [-0.97, 1.38],
      [0.97, 1.38],
      [-0.99, -1.36],
      [0.99, -1.36],
    ];
    fenderCoords.forEach(([fx, fz]) => {
      const fenderArch = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.44, 1.04),
        carMetallicPaintMat
      );
      fenderArch.position.set(fx, 0.58, fz);
      fenderArch.castShadow = true;
      fenderArch.userData = { type: 'cyber_car' };
      carChassisGroup.add(fenderArch);
      pickableObjects.push(fenderArch);
    });

    for (const sideX of [-1.03, 1.03]) {
      const sideIntake = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.3, 1.28),
        carCarbonMat
      );
      sideIntake.position.set(sideX, 0.54, -0.15);
      carChassisGroup.add(sideIntake);

      const intakeAccent = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.05, 1.2),
        cyberCyanMat
      );
      intakeAccent.position.set(sideX, 0.56, -0.15);
      carChassisGroup.add(intakeAccent);
    }

    // 4) Detailed Supercar Cockpit Interior: Quilted Bucket Seats, Harnesses, Center Tunnel, Pedals, Dual OLED Screens & Rotating Steering Yoke
    const cockpitFloorTub = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.06, 1.92),
      carAlcantaraDarkMat
    );
    cockpitFloorTub.position.set(0, 0.56, -0.05);
    carChassisGroup.add(cockpitFloorTub);

    // Center Transmission Console Tunnel with Illuminated P/R/N/D Drive Selector & Armrest
    const centerTunnel = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 1.68),
      carCarbonMat
    );
    centerTunnel.position.set(0, 0.68, 0.02);
    carChassisGroup.add(centerTunnel);

    const driveSelectorPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.03, 0.42),
      cyberCyanMat
    );
    driveSelectorPad.position.set(0, 0.81, 0.25);
    carChassisGroup.add(driveSelectorPad);

    // Twin Quilted Crimson & Carbon Racing Bucket Seats with Side Bolsters, Headrests & 4-Point Harnesses
    for (const seatX of [-0.42, 0.42]) {
      const seatGrp = new THREE.Group();
      seatGrp.position.set(seatX, 0.6, -0.18);

      const seatCushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.1, 0.48),
        carInteriorLeatherMat
      );
      seatCushion.position.set(0, 0.05, 0.04);
      seatGrp.add(seatCushion);

      const seatBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.52, 0.11),
        carInteriorLeatherMat
      );
      seatBack.position.set(0, 0.28, -0.18);
      seatBack.rotation.x = -0.18;
      seatGrp.add(seatBack);

      const headrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.18, 0.1),
        carCarbonMat
      );
      headrest.position.set(0, 0.58, -0.24);
      seatGrp.add(headrest);

      for (const bx of [-0.21, 0.21]) {
        const bolster = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.42, 0.16),
          carAlcantaraDarkMat
        );
        bolster.position.set(bx, 0.26, -0.14);
        bolster.rotation.x = -0.18;
        seatGrp.add(bolster);
      }

      // Racing harness straps
      for (const hx of [-0.09, 0.09]) {
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.46, 0.03),
          cyberGoldMat
        );
        strap.position.set(hx, 0.28, -0.12);
        strap.rotation.x = -0.18;
        seatGrp.add(strap);
      }

      carChassisGroup.add(seatGrp);
    }

    // Wraparound Carbon Dashboard, Dual OLED Instrument Displays & Footwell Pedals
    const carDashBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.54, 0.22, 0.46),
      carAlcantaraDarkMat
    );
    carDashBoard.position.set(0, 0.84, 0.64);
    carChassisGroup.add(carDashBoard);

    const driverOledCluster = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.14, 0.03),
      cyberCyanMat
    );
    driverOledCluster.position.set(-0.42, 0.96, 0.52);
    driverOledCluster.rotation.x = -0.22;
    carChassisGroup.add(driverOledCluster);

    const centerInfotainmentScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.18, 0.03),
      cyberMagentaMat
    );
    centerInfotainmentScreen.position.set(0, 0.92, 0.48);
    centerInfotainmentScreen.rotation.x = -0.25;
    centerInfotainmentScreen.rotation.y = -0.15;
    carChassisGroup.add(centerInfotainmentScreen);

    // Aluminum Accelerator & Brake Pedals in Driver Footwell
    for (const [px, pw] of [
      [-0.34, 0.06],
      [-0.48, 0.09],
    ]) {
      const pedal = new THREE.Mesh(
        new THREE.BoxGeometry(pw, 0.14, 0.03),
        carSilverBladeMat
      );
      pedal.position.set(px, 0.64, 0.72);
      pedal.rotation.x = 0.45;
      carChassisGroup.add(pedal);
    }

    // Articulated Steering Column & Rotating Butterfly Steering Yoke
    const carSteeringYokeGroup = new THREE.Group();
    carSteeringYokeGroup.position.set(-0.42, 0.88, 0.36);
    carSteeringYokeGroup.rotation.x = -0.38;
    const steeringYokeRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.025, 10, 20, Math.PI * 1.45),
      cyberCyanMat
    );
    carSteeringYokeGroup.add(steeringYokeRim);
    const steeringHub = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.04),
      carCarbonMat
    );
    carSteeringYokeGroup.add(steeringHub);
    carChassisGroup.add(carSteeringYokeGroup);

    // 5) Panoramic Teardrop Glass Cockpit Canopy, Articulated Gullwing Doors, Windshield & Side Mirrors
    const cockpitCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.64, 0.48, 2.15),
      carCanopyMat
    );
    cockpitCanopy.position.set(0, 0.94, -0.08);
    cockpitCanopy.userData = { type: 'cyber_car' };
    carChassisGroup.add(cockpitCanopy);
    pickableObjects.push(cockpitCanopy);

    // Articulated Left & Right Gullwing Scissor Doors that lift open when boarding/exiting or toggled
    const leftGullwingPivot = new THREE.Group();
    leftGullwingPivot.position.set(-0.24, 1.18, -0.08);
    const leftGullwingDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.05, 1.45),
      carSilverBladeMat
    );
    leftGullwingDoor.position.set(-0.38, 0, 0);
    leftGullwingDoor.userData = { type: 'cyber_car' };
    leftGullwingPivot.add(leftGullwingDoor);
    pickableObjects.push(leftGullwingDoor);
    const leftDoorSidePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.38, 1.38),
      carMetallicPaintMat
    );
    leftDoorSidePanel.position.set(-0.74, -0.19, 0);
    leftDoorSidePanel.userData = { type: 'cyber_car' };
    leftGullwingPivot.add(leftDoorSidePanel);
    pickableObjects.push(leftDoorSidePanel);
    carChassisGroup.add(leftGullwingPivot);

    const rightGullwingPivot = new THREE.Group();
    rightGullwingPivot.position.set(0.24, 1.18, -0.08);
    const rightGullwingDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.05, 1.45),
      carSilverBladeMat
    );
    rightGullwingDoor.position.set(0.38, 0, 0);
    rightGullwingDoor.userData = { type: 'cyber_car' };
    rightGullwingPivot.add(rightGullwingDoor);
    pickableObjects.push(rightGullwingDoor);
    const rightDoorSidePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.38, 1.38),
      carMetallicPaintMat
    );
    rightDoorSidePanel.position.set(0.74, -0.19, 0);
    rightDoorSidePanel.userData = { type: 'cyber_car' };
    rightGullwingPivot.add(rightDoorSidePanel);
    pickableObjects.push(rightDoorSidePanel);
    carChassisGroup.add(rightGullwingPivot);
    let carGullwingOpenAmount = 0;

    const windshieldSlope = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.44, 0.95),
      carCanopyMat
    );
    windshieldSlope.position.set(0, 0.88, 0.82);
    windshieldSlope.rotation.x = 0.42;
    windshieldSlope.userData = { type: 'cyber_car' };
    carChassisGroup.add(windshieldSlope);
    pickableObjects.push(windshieldSlope);

    const roofSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 1.95),
      carSilverBladeMat
    );
    roofSpine.position.set(0, 1.19, -0.12);
    carChassisGroup.add(roofSpine);

    for (const sideX of [-0.98, 0.98]) {
      const sideMirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.09, 0.16),
        carSilverBladeMat
      );
      sideMirror.position.set(sideX, 0.84, 0.68);
      carChassisGroup.add(sideMirror);
    }

    // 6) Rear Engine Louvers, Active Aerodynamic Carbon GT Rear Wing & Twin Plasma Exhausts (-Z Rear)
    for (let l = 0; l < 4; l++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(1.28, 0.04, 0.18),
        carCarbonMat
      );
      louver.position.set(0, 0.82 - l * 0.04, -1.28 - l * 0.22);
      louver.rotation.x = -0.25;
      carChassisGroup.add(louver);
    }

    // Active Aerodynamic GT Rear Spoiler Wing Group (Rises & tilts at speed / airbrakes on deceleration!)
    const gtWingGroup = new THREE.Group();
    gtWingGroup.position.set(0, 0.88, -2.06);
    for (const pylonX of [-0.58, 0.58]) {
      const wingPylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.34, 0.32),
        carCarbonMat
      );
      wingPylon.position.set(pylonX, 0, 0.04);
      wingPylon.rotation.x = -0.22;
      gtWingGroup.add(wingPylon);
    }
    const gtWingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(2.08, 0.07, 0.42),
      carCarbonMat
    );
    gtWingBlade.position.set(0, 0.18, -0.04);
    gtWingBlade.rotation.x = 0.12;
    gtWingBlade.castShadow = true;
    gtWingGroup.add(gtWingBlade);

    for (const sideX of [-1.06, 1.06]) {
      const wingEndplate = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.24, 0.48),
        cyberMagentaMat
      );
      wingEndplate.position.set(sideX, 0.18, -0.04);
      gtWingGroup.add(wingEndplate);
    }
    carChassisGroup.add(gtWingGroup);

    // Full-Width Front Matrix LED Headlight Blade (+Z) & Rear Crimson Laser Tail-Light Bar (-Z)
    const carHeadlightMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 2.2,
    });
    const headlightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.11, 0.12),
      carHeadlightMat
    );
    headlightBar.position.set(0, 0.52, 2.24);
    carChassisGroup.add(headlightBar);

    const carTaillightMat = new THREE.MeshStandardMaterial({
      color: '#fecdd3',
      emissive: '#f43f5e',
      emissiveIntensity: 2.0,
    });
    const taillightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.12, 0.12),
      carTaillightMat
    );
    taillightBar.position.set(0, 0.58, -2.24);
    carChassisGroup.add(taillightBar);

    // Twin Plasma Afterburner Exhaust Thrusters
    const carExhaustFlames: THREE.Mesh[] = [];
    for (const ex of [-0.46, 0.46]) {
      const exhaustPipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.26, 14),
        carSilverBladeMat
      );
      exhaustPipe.rotation.x = Math.PI / 2;
      exhaustPipe.position.set(ex, 0.34, -2.28);
      carChassisGroup.add(exhaustPipe);

      const exhaustFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.28, 12),
        cyberCyanMat
      );
      exhaustFlame.rotation.x = -Math.PI / 2;
      exhaustFlame.position.set(ex, 0.34, -2.42);
      carChassisGroup.add(exhaustFlame);
      carExhaustFlames.push(exhaustFlame);
    }

    // 7) 4 Realistic Treaded Cyber-Alloy Wheels (Steerable Knuckle + Fixed Brembo Caliper + Spinning Treaded Tire & Slotted Rotor)
    const carSteerGroups: THREE.Group[] = [];
    const carWheelGroups: THREE.Group[] = [];
    const tireGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.3, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = tireTreadMat;
    const discGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.31, 20);
    discGeo.rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.32, 0.48, 0.055);
    const carTreadLugGeo = new THREE.BoxGeometry(0.31, 0.04, 0.09);

    const wheelPositions: [number, number][] = [
      [-1.02, 1.38],  // 0: Front-Left (Steerable)
      [1.02, 1.38],   // 1: Front-Right (Steerable)
      [-1.04, -1.36], // 2: Rear-Left
      [1.04, -1.36],  // 3: Rear-Right
    ];
    wheelPositions.forEach(([wx, wz]) => {
      // Steering Knuckle Group (Rotates around Y for front-wheel steering; holds non-spinning brake caliper!)
      const steerGrp = new THREE.Group();
      steerGrp.position.set(wx, 0.39, wz);

      // Fixed Crimson Brembo Brake Caliper on the knuckle
      const caliper = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.22, 0.14),
        carCaliperRedMat
      );
      caliper.position.set(wx < 0 ? -0.08 : 0.08, 0.06, -0.18);
      steerGrp.add(caliper);

      // Spinning Wheel Hub Group (Rotates around X as the car rolls!)
      const wGroup = new THREE.Group();
      steerGrp.add(wGroup);

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      tire.userData = { type: 'cyber_car' };
      wGroup.add(tire);
      pickableObjects.push(tire);

      // 10 Sculpted 3D Rubber Tread Blocks around tire circumference so tire rotation looks ultra-realistic!
      for (let t = 0; t < 10; t++) {
        const ang = (t / 10) * Math.PI * 2;
        const lug = new THREE.Mesh(carTreadLugGeo, carCarbonMat);
        lug.position.set(0, Math.cos(ang) * 0.385, Math.sin(ang) * 0.385);
        lug.rotation.x = -ang;
        wGroup.add(lug);
      }

      const brakeDisc = new THREE.Mesh(discGeo, carSilverBladeMat);
      wGroup.add(brakeDisc);

      // 5 Forged Twin-Spoke Alloy Blades + Center Lock Nut
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(spokeGeo, carSilverBladeMat);
        spoke.rotation.x = (s / 5) * Math.PI;
        wGroup.add(spoke);
      }

      const rimGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.29, 0.024, 10, 24),
        cyberCyanMat
      );
      rimGlow.rotation.y = Math.PI / 2;
      rimGlow.position.x = wx < 0 ? -0.155 : 0.155;
      wGroup.add(rimGlow);

      dreamCruiserGroup.add(steerGrp);
      carSteerGroups.push(steerGrp);
      carWheelGroups.push(wGroup);
    });

    // Rooftop Holographic Navigation Crystal
    const cruiserBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), cyberGoldMat);
    cruiserBeacon.position.set(0, 1.48, -0.15);
    carChassisGroup.add(cruiserBeacon);
    neoSpinningObjects.push({ mesh: cruiserBeacon, speedY: 2.8, baseY: 1.48, bobAmp: 0.06 });

    // Expanded Whole-Map Grand Tour Highway Waypoints so the Cyberpunk Supercar drives everywhere across Gemini City, the Bridge & Cyber Horizon!
    const carHighwayWaypoints: [number, number][] = [
      [10.5, -10.5], // 0: North-East Blossom & Conservatory Avenue
      [-10.5, -10.5],// 1: North-West Solaris & Academy Boulevard
      [-10.5, 10.5], // 2: South-West Sunbeam Café & Silverbrook River Boulevard
      [10.5, 10.5],  // 3: South-East Hearthstone & Harbor Boulevard
      [10.5, 1.65],  // 4: Merge onto Eastbound Bridge Highway
      [58, 1.65],    // 5: West Bridge Portal Eastbound
      [99, 1.65],    // 6: Golden Horizon Suspension Bridge Eastbound
      [140, 1.65],   // 7: East Bridge Portal
      [182, 1.65],   // 8: Cyber-Horizon Central Plaza
      [196, -10.5],  // 9: Cyber-Horizon North Starlight Loop
      [206, 0.0],    // 10: Cyber-Horizon East Ocean Overlook
      [196, 10.5],   // 11: Cyber-Horizon South Astral Lagoon Loop
      [182, -1.65],  // 12: Cyber-Horizon Avenue Westbound
      [140, -1.65],  // 13: East Bridge Portal Westbound
      [99, -1.65],   // 14: Golden Horizon Suspension Bridge Mid-Span
      [58, -1.65],   // 15: West Bridge Portal
      [10.5, -1.65], // 16: Gemini City East Highway Approach
    ];
    let carWaypointIndex = 0;
    let carCurrentSpeed = 0;
    let carPrevSpeed = 0;
    let carPitch = 0;
    let carRoll = 0;
    let carSteerAngle = 0;

    // Wire up Cyber-Valkyrie GT Boarding, Exiting, Summoning & Move Toggle Actions!
    boardCyberCarActionRef.current = (companionOverride?: string | null) => {
      const compId =
        companionOverride !== undefined ? companionOverride : cyberCarCompanionIdRef.current;
      if (companionOverride !== undefined) {
        setCyberCarCompanionId(compId);
        cyberCarCompanionIdRef.current = compId;
      }

      // Exit bus or bench if currently seated there
      setIsRidingBus(false);
      isRidingBusRef.current = false;
      callbacksRef.current.onPlayerStandUp?.();
      callbacksRef.current.onClearCameraOverride();

      // Sit inside the Cyber Car in PARKED state first — Car ONLY moves when user presses Move!
      setIsRidingCyberCar(true);
      isRidingCyberCarRef.current = true;
      setIsCyberCarMoving(false);
      isCyberCarMovingRef.current = false;
      AudioManager.enterVehicle('cyber_car');
      setIsVehiclePanelCollapsed(false);
      setIsTransitMenuOpen(false);
      setCyberCarDestLabel('Seated in Cockpit (PARKED) — Press [▶️ Move Car] to Drive!');
      setCyberCarTelemetry({ speedKmh: 0, gear: 'P', trafficLightWait: false });

      // Trigger Gullwing Scissor Door opening animation
      carGullwingOpenAmount = 1.0;
      carCurrentSpeed = 0;
      carPrevSpeed = 0;
      playerState.hasTapTarget = false;

      const boardedIds = compId ? [compId] : [];
      if (boardedIds.length > 0) {
        callbacksRef.current.onVehicleTransitEvent?.({
          vehicle: 'cyber_car',
          action: 'board',
          characterIds: boardedIds,
          x: dreamCruiserGroup.position.x,
          z: dreamCruiserGroup.position.z,
          locationLabel: 'Cyber-Valkyrie GT Supercar Cockpit',
        });
      }
    };

    exitCyberCarActionRef.current = () => {
      if (!isRidingCyberCarRef.current) return;
      const carX = dreamCruiserGroup.position.x;
      const carZ = dreamCruiserGroup.position.z;
      const carYaw = dreamCruiserGroup.rotation.y;
      const cosY = Math.cos(carYaw);
      const sinY = Math.sin(carYaw);

      // Stop & Park the Cyber Car immediately when stepping out
      setIsCyberCarMoving(false);
      isCyberCarMovingRef.current = false;
      setIsRidingCyberCar(false);
      isRidingCyberCarRef.current = false;
      AudioManager.exitVehicle();
      setCyberCarDestLabel('Parked — Sit Inside & Press Move to Drive');
      setCyberCarTelemetry({ speedKmh: 0, gear: 'P', trafficLightWait: false });
      carCurrentSpeed = 0;
      carPrevSpeed = 0;
      carGullwingOpenAmount = 1.0;

      // Place Player cleanly beside the Left Driver Gullwing Door
      const exitPlayer = clampToWalkableWorld(carX - cosY * 1.95, carZ + sinY * 1.95);
      playerState.x = exitPlayer.x;
      playerState.z = exitPlayer.z;
      playerState.y = 0;
      playerState.vx = 0;
      playerState.vz = 0;
      playerState.hasTapTarget = false;

      // Place Companion beside the Right Passenger Gullwing Door if one was riding
      const compId = cyberCarCompanionIdRef.current;
      if (compId) {
        const exitComp = clampToWalkableWorld(carX + cosY * 1.95, carZ - sinY * 1.95);
        if (aiRigs[compId]) {
          aiRigs[compId].group.position.set(
            exitComp.x,
            getBridgeSurfaceElevation(exitComp.x, exitComp.z),
            exitComp.z
          );
          aiRigs[compId].group.rotation.x = 0;
          aiRigs[compId].group.rotation.z = 0;
        }
        callbacksRef.current.onVehicleTransitEvent?.({
          vehicle: 'cyber_car',
          action: 'exit',
          characterIds: [compId],
          x: exitComp.x,
          z: exitComp.z,
          locationLabel: 'Cyber-Valkyrie GT Parking Spot',
        });
      }
    };

    toggleCyberCarMoveRef.current = (forceMove?: boolean) => {
      if (!isRidingCyberCarRef.current) {
        boardCyberCarActionRef.current?.();
      }
      const nextMoving = forceMove !== undefined ? forceMove : !isCyberCarMovingRef.current;
      setIsCyberCarMoving(nextMoving);
      isCyberCarMovingRef.current = nextMoving;
      if (nextMoving) {
        setCyberCarDoorsOpen(false);
        cyberCarDoorsOpenRef.current = false;
        setCyberCarDestLabel(
          cyberCarDriveModeRef.current === 'manual'
            ? 'Driving Enabled — Use Joystick / WASD or Pick Auto-Tour!'
            : 'Driving Active — Cruising Across Map!'
        );
      } else {
        carCurrentSpeed = 0;
        setCyberCarDestLabel('Car Stopped & Parked (Gear: P) — Press Move to Drive');
        setCyberCarTelemetry({ speedKmh: 0, gear: 'P', trafficLightWait: false });
      }
    };

    summonCyberCarRef.current = () => {
      const nearPos = clampToWalkableWorld(playerState.x + 2.4, playerState.z + 1.2);
      const surfElev = getBridgeSurfaceElevation(nearPos.x, nearPos.z);
      dreamCruiserGroup.position.set(nearPos.x, surfElev + 0.05, nearPos.z);
      dreamCruiserGroup.rotation.y = playerState.rotationY;
      carCurrentSpeed = 0;
      carPrevSpeed = 0;
      carGullwingOpenAmount = 1.0;
      setIsCyberCarMoving(false);
      isCyberCarMovingRef.current = false;
    };

    worldGroup.add(dreamCruiserGroup);

    // =========================================================================================
    // 5A-NINJA. NORTHERN SHINOBI HIGHWAY & HIDDEN LEAF NINJA VILLAGE (z = -38.5 to -448)
    // =========================================================================================
    const ninjaVillageBuild = buildNinjaVillageAndHighway();
    worldGroup.add(ninjaVillageBuild.group);
    ninjaVillageBuild.buildingPickMeshes.forEach((entry) => {
      pickableObjects.push(...entry.meshes);
    });
    ninjaVillageBuild.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData?.type) {
        child.userData = { type: 'ground' };
        pickableObjects.push(child);
      }
    });

    // =========================================================================================
    // 5B. 5-PASSENGER AUTONOMOUS INTER-CITY LUXURY BUS ("HORIZON GRAND 5-SEATER COACH" 🚌)
    //     + 6 PHYSICAL 3D BUS STOP SHELTERS & TOGGLEABLE 3D BUS STOP MARKERS ACROSS THE MAP
    // =========================================================================================
    const BUS_STOPS = BUS_STOP_STATIONS;

    // Build 3D Glass-Canopy Bus Stop Shelters, Waiting Benches & Toggleable 3D Bus Stop Markers
    const shelterGlassMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.52,
      roughness: 0.12,
      metalness: 0.4,
    });
    const shelterFrameMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.3,
      metalness: 0.8,
    });
    const busTotemGlowMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#f59e0b',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    // Dedicated Toggleable 3D Bus Stop Markers & Route Visualizer Group
    const busStopVisualizerGroup = new THREE.Group();
    busStopVisualizerGroup.visible = showBusStopMarkersRef.current;
    worldGroup.add(busStopVisualizerGroup);

    const busStopMarkerVisuals: {
      stop: BusStopStationDef;
      bayRing: THREE.Mesh;
      bayRingMat: THREE.MeshBasicMaterial;
      diamondBeacon: THREE.Mesh;
      beaconPillar: THREE.Mesh;
      beaconMat: THREE.MeshStandardMaterial;
    }[] = [];

    BUS_STOPS.forEach((stop) => {
      const stopElev = stop.x > 55 && stop.x < 143 ? 0.22 : 0;
      const stopGroup = new THREE.Group();
      stopGroup.position.set(stop.shelterX, stopElev, stop.shelterZ);
      stopGroup.rotation.y = stop.shelterRotY;
      addContactShadow(stopGroup, 3.6, 1.8, 0.48);

      // Shelter platform
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.08, 1.5),
        plazaMat
      );
      pad.position.y = 0.04;
      pad.receiveShadow = true;
      pad.userData = { type: 'bus_stop_marker', stopId: stop.id };
      stopGroup.add(pad);
      pickableObjects.push(pad);

      // Shelter waiting bench inside the canopy
      const benchSeat = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 0.08, 0.44),
        new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.55 })
      );
      benchSeat.position.set(0, 0.48, -0.22);
      benchSeat.castShadow = true;
      stopGroup.add(benchSeat);

      // 2 Rear Pillars + Glass Back Wall + Cantilevered Glass Roof
      for (const px of [-1.35, 1.35]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 2.35, 10),
          shelterFrameMat
        );
        post.position.set(px, 1.18, -0.55);
        post.castShadow = true;
        stopGroup.add(post);
      }
      const backGlass = new THREE.Mesh(
        new THREE.BoxGeometry(2.65, 1.85, 0.04),
        shelterGlassMat
      );
      backGlass.position.set(0, 1.15, -0.55);
      stopGroup.add(backGlass);

      const roofCanopy = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 0.08, 1.45),
        shelterGlassMat
      );
      roofCanopy.position.set(0, 2.36, -0.05);
      roofCanopy.rotation.x = -0.06;
      roofCanopy.castShadow = true;
      roofCanopy.userData = { type: 'bus_stop_marker', stopId: stop.id };
      stopGroup.add(roofCanopy);
      pickableObjects.push(roofCanopy);

      // Totem Sign Pole & Illuminated Bus Stop Sign
      const totemPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 2.5, 10),
        shelterFrameMat
      );
      totemPole.position.set(1.75, 1.25, 0.25);
      stopGroup.add(totemPole);

      const totemBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.58, 0.16),
        busTotemGlowMat
      );
      totemBeacon.position.set(1.75, 2.35, 0.25);
      totemBeacon.userData = { type: 'bus_stop_marker', stopId: stop.id };
      stopGroup.add(totemBeacon);
      pickableObjects.push(totemBeacon);

      worldGroup.add(stopGroup);

      // --- TOGGLEABLE 3D BUS STOP MARKERS (Roadside Stopping Bay + Floating Holographic Pin + Beacon Beam) ---
      const markerGrp = new THREE.Group();
      markerGrp.position.set(stop.x, stopElev, stop.z);

      const bayRingMat = new THREE.MeshBasicMaterial({
        color: stop.accentColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const bayRing = new THREE.Mesh(
        new THREE.RingGeometry(1.65, 2.15, 36),
        bayRingMat
      );
      bayRing.rotation.x = -Math.PI / 2;
      bayRing.position.y = 0.08;
      bayRing.userData = { type: 'bus_stop_marker', stopId: stop.id };
      markerGrp.add(bayRing);
      pickableObjects.push(bayRing);

      // Curbside dashed boarding zone frame
      const bayBox = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.04, 6.8),
        new THREE.MeshBasicMaterial({
          color: stop.accentColor,
          transparent: true,
          opacity: 0.2,
        })
      );
      bayBox.position.y = 0.06;
      bayBox.userData = { type: 'bus_stop_marker', stopId: stop.id };
      markerGrp.add(bayBox);
      pickableObjects.push(bayBox);

      // Vertical Holographic Light Pillar above Shelter & Stopping Bay
      const beaconMat = new THREE.MeshStandardMaterial({
        color: stop.accentColor,
        emissive: stop.accentColor,
        emissiveIntensity: 1.45,
        transparent: true,
        opacity: 0.78,
        roughness: 0.15,
      });
      const beaconPillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.45, 3.8, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: stop.accentColor,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beaconPillar.position.y = 1.95;
      markerGrp.add(beaconPillar);

      const diamondBeacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        beaconMat
      );
      diamondBeacon.position.y = 4.15;
      diamondBeacon.userData = { type: 'bus_stop_marker', stopId: stop.id };
      markerGrp.add(diamondBeacon);
      pickableObjects.push(diamondBeacon);

      busStopVisualizerGroup.add(markerGrp);
      busStopMarkerVisuals.push({
        stop,
        bayRing,
        bayRingMat,
        diamondBeacon,
        beaconPillar,
        beaconMat,
      });
    });

    // Build the 3D 5-Passenger Luxury Panoramic Coach Bus ("Horizon Grand 5-Seater Coach")
    // Local +Z is Forward Front Windshield, -Z is Rear Tail, ±X is Left/Right Sides
    const busGroup = new THREE.Group();
    busGroup.position.set(-10.5, 0.04, -4.0);
    busGroup.rotation.y = 0;
    addContactShadow(busGroup, 3.2, 8.4, 0.72);
    worldGroup.add(busGroup);

    // Suspended Chassis Group (Pitches on Braking/Acceleration, Rolls in Corners & Kneels at Stops/Depot!)
    const busChassisGroup = new THREE.Group();
    busGroup.add(busChassisGroup);

    const busPearlWhiteMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.16,
      metalness: 0.38,
    });
    const busRoyalBlueMat = new THREE.MeshStandardMaterial({
      color: '#0284c7',
      roughness: 0.2,
      metalness: 0.72,
    });
    const busDarkTrimMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.28,
      metalness: 0.78,
    });
    const busChromeMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.14,
      metalness: 0.92,
    });
    const busWindowGlassMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.26,
      roughness: 0.05,
      metalness: 0.35,
      depthWrite: false,
    });
    const busSeatPlushMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.42,
      metalness: 0.1,
    });
    const busSeatBolsterMat = new THREE.MeshStandardMaterial({
      color: '#92400e',
      roughness: 0.38,
      metalness: 0.12,
    });
    const busSeatHeadrestMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      roughness: 0.35,
    });
    const busBrakeLightMat = new THREE.MeshStandardMaterial({
      color: '#fecdd3',
      emissive: '#f43f5e',
      emissiveIntensity: 1.4,
    });
    const busBlinkerMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 1.2,
    });
    const busSafetyYellowMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#eab308',
      emissiveIntensity: 0.45,
      roughness: 0.32,
      metalness: 0.25,
    });

    // 1) Lower Coach Floor Deck, Underbody Air Diffuser & Aerodynamic Wheel Arch Skirts (z: -3.7 to +3.7, width: 2.44m)
    const busFloorDeck = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 0.32, 7.4),
      busDarkTrimMat
    );
    busFloorDeck.position.set(0, 0.42, 0);
    busFloorDeck.castShadow = true;
    busFloorDeck.receiveShadow = true;
    busFloorDeck.userData = { type: 'bus_interaction' };
    busChassisGroup.add(busFloorDeck);
    pickableObjects.push(busFloorDeck);

    // Interior Warm Wood-Teak Aisle Runner Floor + Non-Slip Tactile Strips + LED Aisle Guide Lighting
    const busAisleFloor = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 0.05, 7.1),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.48, metalness: 0.08 })
    );
    busAisleFloor.position.set(0, 0.59, 0);
    busChassisGroup.add(busAisleFloor);

    // Illuminated Cyan Aisle LED Floor Guide Strips along both sides of center walkway
    for (const aisleX of [-0.26, 0.26]) {
      const aisleLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.012, 5.8),
        cyberCyanMat
      );
      aisleLed.position.set(aisleX, 0.62, -0.2);
      busChassisGroup.add(aisleLed);
    }

    // Extendable Yellow Wheelchair / Curbside Boarding Ramp (Slides out from right doorway when bus stops/parks!)
    const busBoardingRamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.045, 0.96),
      busSafetyYellowMat
    );
    busBoardingRamp.position.set(0.92, 0.43, 1.78);
    busChassisGroup.add(busBoardingRamp);

    // 2) Lower Side Bodywork Panels (Left solid panel + Right panel with doorway opening at z = +1.35..+2.25)
    const leftSideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, 7.36),
      busPearlWhiteMat
    );
    leftSideWall.position.set(-1.16, 0.92, 0);
    leftSideWall.castShadow = true;
    leftSideWall.userData = { type: 'bus_interaction' };
    busChassisGroup.add(leftSideWall);
    pickableObjects.push(leftSideWall);

    const rightRearWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, 4.95),
      busPearlWhiteMat
    );
    rightRearWall.position.set(1.16, 0.92, -1.2);
    rightRearWall.castShadow = true;
    rightRearWall.userData = { type: 'bus_interaction' };
    busChassisGroup.add(rightRearWall);
    pickableObjects.push(rightRearWall);

    const rightFrontNoseWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, 1.25),
      busPearlWhiteMat
    );
    rightFrontNoseWall.position.set(1.16, 0.92, 3.05);
    rightFrontNoseWall.castShadow = true;
    busChassisGroup.add(rightFrontNoseWall);

    // Sapphire-Blue & Gold Livery Stripes + Brushed Chrome Rub-Rails along both sides
    for (const sideX of [-1.225, 1.225]) {
      const blueStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.26, sideX < 0 ? 7.32 : 4.9),
        busRoyalBlueMat
      );
      blueStripe.position.set(sideX, 0.88, sideX < 0 ? 0 : -1.2);
      busChassisGroup.add(blueStripe);

      const chromeRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.045, sideX < 0 ? 7.34 : 4.92),
        busChromeMat
      );
      chromeRail.position.set(sideX, 0.68, sideX < 0 ? 0 : -1.2);
      busChassisGroup.add(chromeRail);

      const neonBeltline = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.05, sideX < 0 ? 7.34 : 4.92),
        cyberCyanMat
      );
      neonBeltline.position.set(sideX, 1.26, sideX < 0 ? 0 : -1.2);
      busChassisGroup.add(neonBeltline);
    }

    // Front Nose Lower Dashboard Bumper, Chrome Grille & Rear Engine Louver Tail Panel
    const busFrontLower = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 0.76, 0.28),
      busRoyalBlueMat
    );
    busFrontLower.position.set(0, 0.9, 3.62);
    busFrontLower.castShadow = true;
    busFrontLower.userData = { type: 'bus_interaction' };
    busChassisGroup.add(busFrontLower);
    pickableObjects.push(busFrontLower);

    // Front Horizontal Chrome Intake Grille Bars
    for (let g = 0; g < 3; g++) {
      const grilleBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.032, 0.04),
        busChromeMat
      );
      grilleBar.position.set(0, 0.56 + g * 0.08, 3.76);
      busChassisGroup.add(grilleBar);
    }

    const busRearWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 2.15, 0.24),
      busPearlWhiteMat
    );
    busRearWall.position.set(0, 1.58, -3.62);
    busRearWall.castShadow = true;
    busRearWall.userData = { type: 'bus_interaction' };
    busChassisGroup.add(busRearWall);
    pickableObjects.push(busRearWall);

    // Rear Tinted Observation Window & Engine Cooling Vents
    const busRearWindow = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.88, 0.06),
      busWindowGlassMat
    );
    busRearWindow.position.set(0, 1.98, -3.72);
    busChassisGroup.add(busRearWindow);

    // 3) 5 Physical 3D Luxury Quilted Passenger Seats + Fold-Out Tray Tables, Armrests & Safety Grab Poles Inside Cabin!
    //    Arranged with wide panoramic legroom so up to 5 NPCs sit comfortably inside!
    const BUS_SEAT_OFFSETS: { x: number; y: number; z: number; label: string }[] = [
      { x: -0.66, y: 0.35, z: 1.45, label: 'Seat 1 (Front-Left Window)' },
      { x: 0.66, y: 0.35, z: 0.25, label: 'Seat 2 (Mid-Right Panoramic)' },
      { x: -0.66, y: 0.35, z: -0.35, label: 'Seat 3 (Mid-Left Panoramic)' },
      { x: -0.66, y: 0.35, z: -1.85, label: 'Seat 4 (Rear-Left Lounge)' },
      { x: 0.66, y: 0.35, z: -1.85, label: 'Seat 5 (Rear-Right Lounge)' },
    ];

    BUS_SEAT_OFFSETS.forEach((s) => {
      const seatGrp = new THREE.Group();
      seatGrp.position.set(s.x, 0.6, s.z);

      // Anodized Aluminum Seat Pedestal + Under-Seat Footrest Bar
      const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.22, 0.42),
        busDarkTrimMat
      );
      pedestal.position.y = 0.11;
      seatGrp.add(pedestal);

      // Ergonomic Contoured Cushion + Side Thigh Bolsters
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.12, 0.56),
        busSeatPlushMat
      );
      cushion.position.y = 0.26;
      cushion.castShadow = true;
      seatGrp.add(cushion);

      for (const bx of [-0.27, 0.27]) {
        const bolster = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.15, 0.54),
          busSeatBolsterMat
        );
        bolster.position.set(bx, 0.3, 0);
        seatGrp.add(bolster);

        // Padded Folding Armrests
        const armrest = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.05, 0.42),
          busDarkTrimMat
        );
        armrest.position.set(bx, 0.52, 0.02);
        seatGrp.add(armrest);
      }

      // Reclined Quilted Backrest + Cream Leather Headrest + Rear Fold-Down Tray Table
      const backrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.64, 0.12),
        busSeatPlushMat
      );
      backrest.position.set(0, 0.6, -0.22);
      backrest.rotation.x = -0.12;
      backrest.castShadow = true;
      seatGrp.add(backrest);

      const headrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.2, 0.14),
        busSeatHeadrestMat
      );
      headrest.position.set(0, 0.95, -0.26);
      seatGrp.add(headrest);

      const trayTable = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.24, 0.03),
        busChromeMat
      );
      trayTable.position.set(0, 0.58, -0.29);
      trayTable.rotation.x = -0.12;
      seatGrp.add(trayTable);

      busChassisGroup.add(seatGrp);
    });

    // Interior Brushed-Steel Vertical Handrail Grab Poles, Overhead Grab Rails & Red "STOP" Request Buttons
    const poleCoords: [number, number][] = [
      [-0.32, 1.85],
      [0.32, 1.05],
      [-0.32, -0.85],
      [0.32, -1.45],
    ];
    poleCoords.forEach(([px, pz]) => {
      const grabPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 2.02, 10),
        busChromeMat
      );
      grabPole.position.set(px, 1.62, pz);
      busChassisGroup.add(grabPole);

      // Red "STOP" Request Bell Button mounted on each handrail pole
      const stopBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.09, 0.06),
        busBrakeLightMat
      );
      stopBtn.position.set(px, 1.48, pz);
      busChassisGroup.add(stopBtn);
    });

    // Overhead Translucent Blue Luggage Racks & Warm Cabin LED Ceiling Strips
    for (const rackX of [-0.78, 0.78]) {
      const luggageRack = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.04, 5.6),
        shelterGlassMat
      );
      luggageRack.position.set(rackX, 2.42, -0.35);
      busChassisGroup.add(luggageRack);

      const ceilingLightBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.03, 5.8),
        new THREE.MeshStandardMaterial({
          color: '#fffbeb',
          emissive: '#fef08a',
          emissiveIntensity: 1.1,
        })
      );
      ceilingLightBar.position.set(rackX * 0.55, 2.58, -0.2);
      busChassisGroup.add(ceilingLightBar);
    }

    // Driver Cockpit Wrap-Around Console, Captain Seat, Contactless NFC Farebox & Animated Steering Wheel
    const busDashConsole = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.48, 0.58),
      busDarkTrimMat
    );
    busDashConsole.position.set(-0.52, 0.85, 3.15);
    busChassisGroup.add(busDashConsole);

    // Illuminated Driver Telemetry & Route GPS Screen on Dashboard
    const busDriverScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.04),
      cyberCyanMat
    );
    busDriverScreen.position.set(-0.42, 1.15, 3.05);
    busDriverScreen.rotation.x = -0.32;
    busChassisGroup.add(busDriverScreen);

    // Contactless NFC Transit Fare Reader Pedestal beside the Front Boarding Door
    const fareboxPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.92, 12),
      busDarkTrimMat
    );
    fareboxPillar.position.set(0.55, 1.04, 2.42);
    busChassisGroup.add(fareboxPillar);

    const fareboxTapPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16),
      new THREE.MeshStandardMaterial({
        color: '#34d399',
        emissive: '#10b981',
        emissiveIntensity: 1.5,
      })
    );
    fareboxTapPad.position.set(0.55, 1.52, 2.42);
    fareboxTapPad.rotation.x = -0.45;
    busChassisGroup.add(fareboxTapPad);

    const busSteeringWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.032, 10, 24),
      cyberCyanMat
    );
    busSteeringWheel.position.set(-0.65, 1.2, 2.88);
    busSteeringWheel.rotation.x = -0.65;
    busChassisGroup.add(busSteeringWheel);

    // 4) Panoramic Window Pillars, Sculpted Coach Roof & Route Sign
    const pillarZCoords = [-3.5, -1.75, 0.0, 1.2, 2.35, 3.5];
    pillarZCoords.forEach((pz) => {
      for (const sideX of [-1.16, 1.16]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 1.38, 0.12),
          busDarkTrimMat
        );
        pillar.position.set(sideX, 1.96, pz);
        busChassisGroup.add(pillar);
      }
    });

    // Crystal-Clear Tinted Panoramic Side Windows & Curved Front Windshield
    const leftPanoramaGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.32, 7.1),
      busWindowGlassMat
    );
    leftPanoramaGlass.position.set(-1.16, 1.95, 0);
    busChassisGroup.add(leftPanoramaGlass);

    const rightPanoramaGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.32, 4.75),
      busWindowGlassMat
    );
    rightPanoramaGlass.position.set(1.16, 1.95, -1.2);
    busChassisGroup.add(rightPanoramaGlass);

    const frontWindshieldGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 1.36, 0.06),
      busWindowGlassMat
    );
    frontWindshieldGlass.position.set(0, 1.94, 3.64);
    frontWindshieldGlass.rotation.x = 0.08;
    busChassisGroup.add(frontWindshieldGlass);

    // Dual Animated Windshield Wipers on Front Glass (Sweep during rainy weather!)
    const busWiperPivots: THREE.Group[] = [];
    for (const wx of [-0.52, 0.52]) {
      const wiperPivot = new THREE.Group();
      wiperPivot.position.set(wx, 1.32, 3.69);
      const wiperBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.68, 0.03),
        busDarkTrimMat
      );
      wiperBlade.position.y = 0.32;
      wiperPivot.add(wiperBlade);
      busChassisGroup.add(wiperPivot);
      busWiperPivots.push(wiperPivot);
    }

    // Animated Sliding Bi-Fold Passenger Entry Doors on Right Side (x = +1.18, z = 1.25..2.32)
    const busDoorFrontLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.92, 0.52),
      busWindowGlassMat
    );
    busDoorFrontLeaf.position.set(1.18, 1.56, 2.04);
    busChassisGroup.add(busDoorFrontLeaf);

    const busDoorRearLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.92, 0.52),
      busWindowGlassMat
    );
    busDoorRearLeaf.position.set(1.18, 1.56, 1.52);
    busChassisGroup.add(busDoorRearLeaf);

    const busBoardingStepGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.06, 1.08),
      busBlinkerMat
    );
    busBoardingStepGlow.position.set(1.12, 0.45, 1.78);
    busChassisGroup.add(busBoardingStepGlow);

    // Aerodynamic Coach Roof Cap, Solar/HVAC Pods & Illuminated LED Route Destination Matrix
    const busRoof = new THREE.Mesh(
      new THREE.BoxGeometry(2.44, 0.22, 7.48),
      busPearlWhiteMat
    );
    busRoof.position.set(0, 2.72, 0);
    busRoof.castShadow = true;
    busRoof.userData = { type: 'bus_interaction' };
    busChassisGroup.add(busRoof);
    pickableObjects.push(busRoof);

    const busRoofPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.18, 3.6),
      busRoyalBlueMat
    );
    busRoofPod.position.set(0, 2.9, -0.3);
    busChassisGroup.add(busRoofPod);

    const busRouteDestinationSign = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.26, 0.08),
      busTotemGlowMat
    );
    busRouteDestinationSign.position.set(0, 2.68, 3.72);
    busChassisGroup.add(busRouteDestinationSign);

    // Side-View Coach Mirrors (Left & Right)
    for (const sideX of [-1.32, 1.32]) {
      const mirrorArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.06, 0.08),
        busDarkTrimMat
      );
      mirrorArm.position.set(sideX, 2.15, 3.55);
      busChassisGroup.add(mirrorArm);

      const mirrorHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.34, 0.16),
        busRoyalBlueMat
      );
      mirrorHead.position.set(sideX * 1.06, 2.02, 3.62);
      busChassisGroup.add(mirrorHead);
    }

    // Front Xenon Headlights, Fog Lamps, Rear Brake Light Bar & 4 Corner Amber Turn/Stop Blinkers
    const busHeadlightBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.18, 0.14, 0.08),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#38bdf8',
        emissiveIntensity: 2.2,
      })
    );
    busHeadlightBar.position.set(0, 0.72, 3.75);
    busChassisGroup.add(busHeadlightBar);

    const busRearBrakeBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 0.18, 0.08),
      busBrakeLightMat
    );
    busRearBrakeBar.position.set(0, 0.88, -3.73);
    busChassisGroup.add(busRearBrakeBar);

    for (const [bx, bz] of [
      [-1.12, 3.74],
      [1.12, 3.74],
      [-1.12, -3.73],
      [1.12, -3.73],
    ]) {
      const blinker = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.08),
        busBlinkerMat
      );
      blinker.position.set(bx, 1.12, bz);
      busChassisGroup.add(blinker);
    }

    // 5) 6 Realistic Heavy-Duty Radial Coach Tires (🛞) with Steering Knuckles, 3D Sculpted Tread Blocks, Brake Rotors & Chrome Hubs!
    const busSteerGroups: THREE.Group[] = [];
    const busWheelGroups: THREE.Group[] = [];
    const busTireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.36, 28);
    busTireGeo.rotateZ(Math.PI / 2);
    const busDiscGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.37, 20);
    busDiscGeo.rotateZ(Math.PI / 2);
    const busHubCapGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.39, 14);
    busHubCapGeo.rotateZ(Math.PI / 2);
    const busSpokeGeo = new THREE.BoxGeometry(0.38, 0.56, 0.07);
    const busTreadLugGeo = new THREE.BoxGeometry(0.37, 0.045, 0.11);

    const busWheelCoords: [number, number][] = [
      [-1.22, 2.35],  // 0: Front-Left (Steerable)
      [1.22, 2.35],   // 1: Front-Right (Steerable)
      [-1.24, -1.45], // 2: Mid-Rear-Left (Dual Drive Axle)
      [1.24, -1.45],  // 3: Mid-Rear-Right (Dual Drive Axle)
      [-1.24, -2.55], // 4: Back-Rear-Left (Tag Axle)
      [1.24, -2.55],  // 5: Back-Rear-Right (Tag Axle)
    ];
    busWheelCoords.forEach(([wx, wz]) => {
      // Steering Knuckle Group (Rotates around Y for front steering; holds non-spinning heavy brake caliper!)
      const steerGrp = new THREE.Group();
      steerGrp.position.set(wx, 0.46, wz);

      // Fixed Heavy-Duty Amber/Gold Air-Disc Brake Caliper
      const busCaliper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.24, 0.16),
        new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.3, metalness: 0.7 })
      );
      busCaliper.position.set(wx < 0 ? -0.09 : 0.09, 0.07, -0.2);
      steerGrp.add(busCaliper);

      // Spinning Wheel Hub Group (Rotates cleanly around X without gimbal wobble!)
      const wGrp = new THREE.Group();
      steerGrp.add(wGrp);

      const tire = new THREE.Mesh(busTireGeo, tireMat);
      tire.castShadow = true;
      tire.userData = { type: 'bus_interaction' };
      wGrp.add(tire);
      pickableObjects.push(tire);

      // 12 Sculpted 3D Heavy-Duty Rubber Tread Blocks around tire circumference
      for (let t = 0; t < 12; t++) {
        const ang = (t / 12) * Math.PI * 2;
        const lug = new THREE.Mesh(busTreadLugGeo, busDarkTrimMat);
        lug.position.set(0, Math.cos(ang) * 0.455, Math.sin(ang) * 0.455);
        lug.rotation.x = -ang;
        wGrp.add(lug);
      }

      const rim = new THREE.Mesh(busDiscGeo, busChromeMat);
      wGrp.add(rim);

      const hubCap = new THREE.Mesh(busHubCapGeo, busRoyalBlueMat);
      wGrp.add(hubCap);

      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(busSpokeGeo, busChromeMat);
        spoke.rotation.x = (s / 5) * Math.PI;
        wGrp.add(spoke);
      }

      busGroup.add(steerGrp);
      busSteerGroups.push(steerGrp);
      busWheelGroups.push(wGrp);
    });

    // Closed-Loop Inter-City Bus Route Waypoints (Connecting all 6 Bus Stops across Gemini City, Bridge & Cyber Horizon!)
    const busRouteWaypoints: [number, number][] = [
      [182, -1.65],   // 0: Depart Cyber-Horizon Westbound
      [140, -1.65],   // 1: East Bridge Portal
      [99, -1.65],    // 2: Golden Horizon Bridge Mid-Span
      [58, -1.65],    // 3: West Bridge Portal
      [10.5, -1.65],  // 4: Gemini East Boulevard
      [-10.5, -10.5], // 5: STOP 1 — North Academy & Solaris Bus Stop
      [-10.5, 10.5],  // 6: STOP 2 — Sunbeam Café & River Bus Stop
      [10.5, 10.5],   // 7: STOP 3 — Central Starlight Park & Harbor Stop
      [10.5, 1.65],   // 8: Merge onto Eastbound Bridge Highway
      [58, 1.65],     // 9: West Bridge Portal Eastbound
      [99, 1.65],     // 10: Golden Horizon Bridge Eastbound
      [140, 1.65],    // 11: East Bridge Portal Eastbound
      [182, 1.65],    // 12: STOP 4 — Cyber-Horizon Grand Plaza Station
      [194, 0.0],     // 13: Cyber-Horizon Plaza Turnaround Loop
    ];
    let busWaypointIndex = 6;
    let busCurrentSpeed = 5.5;
    let busPrevSpeed = 5.5;
    let busPitch = 0;
    let busRoll = 0;
    let busKneelOffset = 0;
    let busStopTimer = 0;
    let busDoorOpenProgress = 0;
    let busStopHandledForCurrentHalt = false;
    let busLastStoppedWaypoint = -1;
    let busRideStopsCountByChar: Record<string, number> = {
      aria: 0,
      leo: 1,
      maya: 0,
    };

    // Build 3D Illuminated Bus Route Loop Path Line inside busStopVisualizerGroup
    const routePts = busRouteWaypoints.map(
      ([wx, wz]) => new THREE.Vector3(wx, (wx > 55 && wx < 143 ? 0.22 : 0) + 0.16, wz)
    );
    routePts.push(routePts[0].clone());
    const busRouteLineGeo = new THREE.BufferGeometry().setFromPoints(routePts);
    const busRouteLineMat = new THREE.LineBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.65,
    });
    const busRouteLine = new THREE.Line(busRouteLineGeo, busRouteLineMat);
    busStopVisualizerGroup.add(busRouteLine);

    // Helper to get a character's live 3D distance to the bus (strict proximity check!)
    const getCharacterDistToBus = (charId: string, fallbackPos: { x: number; z: number }): number => {
      const liveRig = aiRigs[charId];
      const cx = liveRig ? liveRig.group.position.x : fallbackPos.x;
      const cz = liveRig ? liveRig.group.position.z : fallbackPos.z;
      return Math.hypot(cx - busGroup.position.x, cz - busGroup.position.z);
    };

    triggerBusStopNowRef.current = () => {
      busStopTimer = 8.0;
      busCurrentSpeed = 0;
      busStopHandledForCurrentHalt = false;
      setBusUiStatus((prev) => ({
        ...prev,
        phase: 'doors_open',
        stopName: 'Stopped on Demand (Doors & Ramp Open)',
        speedKmh: 0,
      }));
    };

    // Stop & Hold Bus in Place until user turns Engine ON!
    stopAndParkBusRef.current = () => {
      setIsBusParked(true);
      isBusParkedRef.current = true;
      setIsBusEngineOn(false);
      isBusEngineOnRef.current = false;
      busCurrentSpeed = 0;
      busPrevSpeed = 0;
      busStopTimer = 0;
      busStopHandledForCurrentHalt = false;
      setBusUiStatus((prev) => ({
        ...prev,
        phase: 'parked_depot',
        stopName: 'Bus Stopped & Parked (Engine OFF — Press Turn Bus ON to Move)',
        speedKmh: 0,
      }));
    };

    // Park the Bus inside the Dedicated 3D Bus Parking Bay (-15.4, -2.0) and Turn Engine OFF until user starts it!
    parkBusAtDepotRef.current = () => {
      busGroup.position.set(BUS_DEPOT_COORDS.x, 0.04, BUS_DEPOT_COORDS.z);
      busGroup.rotation.y = 0;
      busCurrentSpeed = 0;
      busPrevSpeed = 0;
      busStopTimer = 0;
      busStopHandledForCurrentHalt = false;
      setIsBusParked(true);
      isBusParkedRef.current = true;
      setIsBusEngineOn(false);
      isBusEngineOnRef.current = false;
      setBusUiStatus((prev) => ({
        ...prev,
        phase: 'parked_depot',
        activeStopId: null,
        stopName: 'Parked at Bus Depot Bay (Engine OFF — Turn ON to Depart)',
        speedKmh: 0,
      }));
    };

    // Turn Bus Engine ON and depart from Parking Bay / Stop!
    startBusEngineRef.current = () => {
      setIsBusParked(false);
      isBusParkedRef.current = false;
      setIsBusEngineOn(true);
      isBusEngineOnRef.current = true;
      busStopTimer = 0;
      // If departing from the West Grand Ave Bus Parking Bay (-15.4, -2.0), merge smoothly onto West Grand Ave (-10.5)
      if (
        Math.hypot(
          busGroup.position.x - BUS_DEPOT_COORDS.x,
          busGroup.position.z - BUS_DEPOT_COORDS.z
        ) < 5.5
      ) {
        busWaypointIndex = 6; // Head south toward Sunbeam Café & River Stop
      }
      const upcomingStop =
        BUS_STOPS.find((s) => s.waypointIdx >= busWaypointIndex) || BUS_STOPS[0];
      setBusUiStatus((prev) => ({
        ...prev,
        phase: 'driving',
        activeStopId: null,
        nextStopId: upcomingStop.id,
        stopName: `Engine ON · En Route → ${upcomingStop.shortName}`,
        speedKmh: 42,
      }));
    };

    // STRICT PROXIMITY BOARDING: NPCs can ONLY get in the bus if they are close to the bus (<= 6.8m)!
    boardAllFiveBusRef.current = () => {
      const currentStaying = [...busPassengersRef.current];
      const seatsLeft = 5 - currentStaying.length;
      if (seatsLeft <= 0) return;

      const nearbyCandidates = charactersRef.current
        .filter((c) => {
          if (currentStaying.includes(c.id)) return false;
          if (isRidingCyberCarRef.current && c.id === cyberCarCompanionIdRef.current) return false;
          const distToBus = getCharacterDistToBus(c.id, c.currentPosition);
          return distToBus <= 6.8; // STRICT PROXIMITY CHECK: Must be within 6.8m of the bus!
        })
        .sort(
          (a, b) =>
            getCharacterDistToBus(a.id, a.currentPosition) -
            getCharacterDistToBus(b.id, b.currentPosition)
        )
        .slice(0, seatsLeft)
        .map((c) => c.id);

      if (nearbyCandidates.length === 0) {
        // Open doors & halt briefly so nearby pedestrians can walk closer to board
        busStopTimer = Math.max(busStopTimer, 6.0);
        setBusUiStatus((prev) => ({
          ...prev,
          stopName: 'Doors Open — Waiting for NPCs within 6.8m to Board!',
        }));
        return;
      }

      const nextList = [...currentStaying, ...nearbyCandidates].slice(0, 5);
      busPassengersRef.current = nextList;
      nearbyCandidates.forEach((id) => {
        busRideStopsCountByChar[id] = 0;
      });
      setBusUiStatus((prev) => ({
        ...prev,
        passengerIds: nextList,
        stopName: `Boarded ${nearbyCandidates.length} Nearby NPC(s) (<6.8m)!`,
      }));
      callbacksRef.current.onVehicleTransitEvent?.({
        vehicle: 'bus',
        action: 'board',
        characterIds: nearbyCandidates,
        x: busGroup.position.x,
        z: busGroup.position.z,
        locationLabel: 'Horizon Grand Coach Bus',
      });
    };

    dispatchBusToStopRef.current = (stopId: string, instantPause = true) => {
      const targetStop = BUS_STOPS.find((s) => s.id === stopId);
      if (!targetStop) return;
      setIsBusParked(false);
      isBusParkedRef.current = false;
      setIsBusEngineOn(true);
      isBusEngineOnRef.current = true;
      busWaypointIndex = targetStop.waypointIdx;
      busLastStoppedWaypoint = -1;
      if (instantPause) {
        const stopElev = targetStop.x > 55 && targetStop.x < 143 ? 0.22 : 0;
        busGroup.position.set(targetStop.x, stopElev + 0.04, targetStop.z);
        busCurrentSpeed = 0;
        busPrevSpeed = 0;
        busStopTimer = 6.5;
        busStopHandledForCurrentHalt = false;
        busLastStoppedWaypoint = targetStop.waypointIdx;
      }
    };

    // 9B. Ambient Weather & Time-of-Day Particle Systems (Falling Park Leaves/Petals, Morning Mist, Evening Fireflies & Rain)
    // Helper to generate soft circular/organic sprite textures for particles
    const createSoftParticleTexture = (kind: 'mist' | 'leaf' | 'glow'): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      if (kind === 'leaf') {
        ctx.translate(32, 32);
        ctx.rotate(Math.PI / 4);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.92)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'mist') {
        const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
        grad.addColorStop(0.55, 'rgba(241, 245, 249, 0.22)');
        grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      } else {
        const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.4, 'rgba(254, 240, 138, 0.75)');
        grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const leafSpriteTex = createSoftParticleTexture('leaf');
    const mistSpriteTex = createSoftParticleTexture('mist');
    const glowSpriteTex = createSoftParticleTexture('glow');

    // 1) Falling Leaves & Sakura Petals in the Park & Woodland Groves (Sunny / Daytime Weather)
    const leafCount = 150;
    const leafGeo = new THREE.BufferGeometry();
    const leafPositions = new Float32Array(leafCount * 3);
    const leafColors = new Float32Array(leafCount * 3);
    const leafSeeds = new Float32Array(leafCount * 4); // [phaseOffset, fallSpeed, driftAmp, anchorZone]
    const leafPalette = [
      new THREE.Color('#f472b6'), // Sakura Pink
      new THREE.Color('#fbcfe8'), // Soft Blossom White-Pink
      new THREE.Color('#fbbf24'), // Sunlit Golden Leaf
      new THREE.Color('#f97316'), // Warm Maple Amber
      new THREE.Color('#4ade80'), // Fresh Park Emerald Leaf
    ];

    const resetLeafParticle = (i: number, randomHeight = false) => {
      // 65% concentrated in Central Starlight Park & Sakura avenues, 35% across outer woodland groves
      const inCentralPark = i % 10 < 6;
      const radius = inCentralPark ? 3.5 + Math.random() * 14 : 22 + Math.random() * 34;
      const angle = Math.random() * Math.PI * 2;
      leafPositions[i * 3] = Math.cos(angle) * radius;
      leafPositions[i * 3 + 1] = randomHeight
        ? 0.4 + Math.random() * 6.5
        : 4.2 + Math.random() * 3.4;
      leafPositions[i * 3 + 2] = Math.sin(angle) * radius + (inCentralPark ? 1.0 : 0);
    };

    for (let i = 0; i < leafCount; i++) {
      resetLeafParticle(i, true);
      const col = leafPalette[i % leafPalette.length];
      leafColors[i * 3] = col.r;
      leafColors[i * 3 + 1] = col.g;
      leafColors[i * 3 + 2] = col.b;
      leafSeeds[i * 4] = Math.random() * Math.PI * 2;
      leafSeeds[i * 4 + 1] = 0.55 + Math.random() * 0.55; // fall speed
      leafSeeds[i * 4 + 2] = 0.65 + Math.random() * 0.85; // breeze sway amplitude
      leafSeeds[i * 4 + 3] = (Math.random() - 0.5) * 0.8;
    }
    leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
    leafGeo.setAttribute('color', new THREE.BufferAttribute(leafColors, 3));
    const leafMat = new THREE.PointsMaterial({
      map: leafSpriteTex,
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaTest: 0.05,
    });
    const fallingLeaves = new THREE.Points(leafGeo, leafMat);
    worldGroup.add(fallingLeaves);

    // 2) Gentle Morning & Dawn Mist / Ground Fog Wisps
    const mistCount = 95;
    const mistGeo = new THREE.BufferGeometry();
    const mistPositions = new Float32Array(mistCount * 3);
    const mistBaseXZ = new Float32Array(mistCount * 3); // [baseX, baseY, baseZ]
    for (let i = 0; i < mistCount; i++) {
      // Cluster mist wisps in the park, around the fountain, and along woodland/coastal valleys
      const isParkMist = i < 40;
      const r = isParkMist ? Math.random() * 18 : 18 + Math.random() * 44;
      const ang = Math.random() * Math.PI * 2;
      const mx = Math.cos(ang) * r;
      const my = 0.45 + Math.random() * 2.1;
      const mz = Math.sin(ang) * r;
      mistPositions[i * 3] = mx;
      mistPositions[i * 3 + 1] = my;
      mistPositions[i * 3 + 2] = mz;
      mistBaseXZ[i * 3] = mx;
      mistBaseXZ[i * 3 + 1] = my;
      mistBaseXZ[i * 3 + 2] = mz;
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    const mistMat = new THREE.PointsMaterial({
      map: mistSpriteTex,
      color: '#f1f5f9',
      size: 5.8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const morningMist = new THREE.Points(mistGeo, mistMat);
    morningMist.visible = false;
    worldGroup.add(morningMist);

    // 3) Evening & Night Starlight Fireflies
    const particleCount = 90;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 82;
      particlePositions[i * 3 + 1] = 0.8 + Math.random() * 5.8;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 82;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      map: glowSpriteTex,
      color: '#fde047',
      size: 0.52,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const fireflies = new THREE.Points(particleGeo, particleMat);
    worldGroup.add(fireflies);

    // 4) 3D Rain Fall Streaks System (Active during rainy weather across the expanded island)
    const rainCount = 520;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per rain streak
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 88;
      const ry = Math.random() * 26;
      const rz = (Math.random() - 0.5) * 88;
      rainPositions[i * 6] = rx;
      rainPositions[i * 6 + 1] = ry;
      rainPositions[i * 6 + 2] = rz;
      rainPositions[i * 6 + 3] = rx - 0.14;
      rainPositions[i * 6 + 4] = ry - 0.92;
      rainPositions[i * 6 + 5] = rz;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;
    worldGroup.add(rainLines);

    // 10. Create Articulated Humanoid Characters (Player + AI Residents)
    const playerRig = createHumanoidRig({
      id: 'player',
      isPlayer: true,
      outfitColor: explorerRef.current.outfitColor || '#f59e0b',
      accentColor: explorerRef.current.secondaryColor || '#38bdf8',
      hairColor: explorerRef.current.hairColor || '#1e293b',
      skinColor: explorerRef.current.skinColor || '#e5b887',
      scale: 1.0,
      aoTexture: aoShadowTex,
    });
    scene.add(playerRig.group);
    pickableObjects.push(...playerRig.pickMeshes);

    const playerState = {
      x: 0,
      y: 0,
      z: 6.2,
      vx: 0,
      vy: 0,
      vz: 0,
      isJumping: false,
      jumpsRemaining: 2,
      slideTimer: 0,
      slideCooldown: 0,
      slideDirX: 0,
      slideDirZ: 1,
      turnBankAngle: 0,
      squashY: 1,
      targetX: 0,
      targetZ: 6.2,
      hasTapTarget: false,
      lastReachedAutoKey: '',
      rotationY: Math.PI,
      fastTravel: {
        active: false,
        progress: 0,
        duration: 2.35,
        startX: 56,
        startZ: 0,
        endX: 184,
        endZ: 0,
        destinationLabel: '',
        lastRingIdx: -1,
      },
    };
    playerRig.group.position.set(playerState.x, 0, playerState.z);
    playerRig.animState.lastWorldX = playerState.x;
    playerRig.animState.lastWorldZ = playerState.z;

    // 10B. 3D Jump Shockwave Ring & Slide/Sprint Dust Trail Particles
    const jumpRingGeo = new THREE.RingGeometry(0.28, 0.52, 32);
    const jumpRingMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const jumpRingMesh = new THREE.Mesh(jumpRingGeo, jumpRingMat);
    jumpRingMesh.rotation.x = -Math.PI / 2;
    jumpRingMesh.position.y = 0.06;
    scene.add(jumpRingMesh);
    let jumpRingScale = 1;

    const spawnJumpShockwave = (wx: number, wy: number, wz: number, colorHex: string) => {
      jumpRingMesh.position.set(wx, Math.max(0.06, wy + 0.05), wz);
      jumpRingMat.color.set(colorHex);
      jumpRingMat.opacity = 0.92;
      jumpRingScale = 0.65;
      jumpRingMesh.scale.setScalar(jumpRingScale);
    };

    const dustPoolCount = 42;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustPoolCount * 3);
    const dustVelocities = new Float32Array(dustPoolCount * 3);
    const dustLife = new Float32Array(dustPoolCount);
    for (let i = 0; i < dustPoolCount; i++) {
      dustPositions[i * 3 + 1] = -999;
      dustLife[i] = 0;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      map: mistSpriteTex,
      color: '#fde68a',
      size: 0.95,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const locomotionDust = new THREE.Points(dustGeo, dustMat);
    scene.add(locomotionDust);
    let nextDustIdx = 0;

    const emitLocomotionDust = (wx: number, wy: number, wz: number, count: number, spread = 0.35) => {
      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let c = 0; c < count; c++) {
        const idx = nextDustIdx % dustPoolCount;
        nextDustIdx++;
        arr[idx * 3] = wx + (Math.random() - 0.5) * spread;
        arr[idx * 3 + 1] = Math.max(0.08, wy + 0.1 + Math.random() * 0.18);
        arr[idx * 3 + 2] = wz + (Math.random() - 0.5) * spread;
        dustVelocities[idx * 3] = (Math.random() - 0.5) * 1.4;
        dustVelocities[idx * 3 + 1] = 0.7 + Math.random() * 1.1;
        dustVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 1.4;
        dustLife[idx] = 1.0;
      }
      posAttr.needsUpdate = true;
    };

    const triggerPlayerJump = () => {
      if (playerState.jumpsRemaining <= 0) return;
      const isFirstJump = !playerState.isJumping;
      playerState.isJumping = true;
      playerState.jumpsRemaining -= 1;
      // Combine with slide for a Super Long-Jump!
      if (playerState.slideTimer > 0) {
        playerState.vy = 9.4;
        playerState.vx = playerState.slideDirX * 10.5;
        playerState.vz = playerState.slideDirZ * 10.5;
        playerState.slideTimer = 0;
      } else {
        playerState.vy = isFirstJump ? 8.8 : 7.8;
      }
      playerState.squashY = 1.22;
      spawnJumpShockwave(
        playerState.x,
        playerState.y,
        playerState.z,
        isFirstJump ? '#fbbf24' : '#38bdf8'
      );
      emitLocomotionDust(playerState.x, playerState.y, playerState.z, 7, 0.55);
    };

    const triggerPlayerSlide = () => {
      if (playerState.slideCooldown > 0) return;
      playerState.slideTimer = 0.62;
      playerState.slideCooldown = 0.82;
      playerState.hasTapTarget = false;
      tapMarkerMat.opacity = 0;

      const curSpeed = Math.hypot(playerState.vx, playerState.vz);
      if (curSpeed > 0.4) {
        playerState.slideDirX = playerState.vx / curSpeed;
        playerState.slideDirZ = playerState.vz / curSpeed;
        playerState.rotationY = Math.atan2(playerState.slideDirX, playerState.slideDirZ);
      } else {
        playerState.slideDirX = Math.sin(playerState.rotationY);
        playerState.slideDirZ = Math.cos(playerState.rotationY);
      }
      playerState.vx = playerState.slideDirX * 12.2;
      playerState.vz = playerState.slideDirZ * 12.2;
      playerState.squashY = 0.78;
      spawnJumpShockwave(playerState.x, playerState.y, playerState.z, '#f59e0b');
      emitLocomotionDust(playerState.x, playerState.y, playerState.z, 9, 0.6);
    };

    triggerJumpRef.current = triggerPlayerJump;
    triggerSlideRef.current = triggerPlayerSlide;

    // Tap-to-move destination marker ring on ground
    const tapMarkerGeo = new THREE.RingGeometry(0.3, 0.48, 28);
    const tapMarkerMat = new THREE.MeshBasicMaterial({
      color: '#fbbf24',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const tapMarker = new THREE.Mesh(tapMarkerGeo, tapMarkerMat);
    tapMarker.rotation.x = -Math.PI / 2;
    tapMarker.position.y = 0.08;
    scene.add(tapMarker);

    const aiRigs: Record<string, HumanoidRig> = {};
    charactersRef.current.forEach((c) => {
      const rig = createHumanoidRig({
        id: c.id,
        isPlayer: false,
        outfitColor: c.outfitColor,
        accentColor: c.accentColor,
        hairColor: c.hairColor,
        skinColor: c.skinColor,
        scale: c.scale,
        aoTexture: aoShadowTex,
      });
      rig.group.position.set(c.currentPosition.x, 0, c.currentPosition.z);
      rig.animState.lastWorldX = c.currentPosition.x;
      rig.animState.lastWorldZ = c.currentPosition.z;
      scene.add(rig.group);
      pickableObjects.push(...rig.pickMeshes);
      aiRigs[c.id] = rig;
    });

    // 11. Camera Orbit, Beautiful Screen View Modes, Pinch-to-Zoom & Keyboard State
    const CAMERA_PRESETS: Record<
      CameraViewMode,
      { polar: number; distance: number; lookAtY: number; fov: number }
    > = {
      chase: { polar: 1.04, distance: 15.5, lookAtY: 1.38, fov: 45 },
      action: { polar: 1.23, distance: 9.2, lookAtY: 1.52, fov: 52 },
      panoramic: { polar: 0.84, distance: 23.5, lookAtY: 1.18, fov: 42 },
      sky: { polar: 0.54, distance: 39.0, lookAtY: 0.9, fov: 40 },
    };

    const camOrbit = {
      azimuth: 0.0,
      targetAzimuth: 0.0,
      polar: CAMERA_PRESETS.chase.polar,
      targetPolar: CAMERA_PRESETS.chase.polar,
      distance: CAMERA_PRESETS.chase.distance,
      targetDistance: CAMERA_PRESETS.chase.distance,
      lookAtY: CAMERA_PRESETS.chase.lookAtY,
      targetLookAtY: CAMERA_PRESETS.chase.lookAtY,
      fov: CAMERA_PRESETS.chase.fov,
      targetFov: CAMERA_PRESETS.chase.fov,
      focusX: 0,
      focusZ: 6.2,
      lookAheadX: 0,
      lookAheadZ: 0,
      lastManualRotateTime: 0,
    };

    const applyCameraViewPreset = (mode: CameraViewMode) => {
      const preset = CAMERA_PRESETS[mode];
      camOrbit.targetPolar = preset.polar;
      camOrbit.targetDistance = preset.distance;
      camOrbit.targetLookAtY = preset.lookAtY;
      camOrbit.targetFov = preset.fov;
    };
    applyCameraViewPresetRef.current = applyCameraViewPreset;

    const snapCameraBehindPlayer = () => {
      // Position camera directly behind the character's facing direction
      const desiredBehindAzimuth = playerState.rotationY + Math.PI;
      const diff =
        ((desiredBehindAzimuth - camOrbit.targetAzimuth + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      camOrbit.targetAzimuth += diff;
    };
    snapBehindPlayerRef.current = snapCameraBehindPlayer;

    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      keysPressed[key] = true;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) triggerPlayerJump();
      } else if ((e.key === 'Shift' || key === 'c') && !e.repeat) {
        triggerPlayerSlide();
      } else if (key === 'r' && !e.repeat) {
        snapCameraBehindPlayer();
      } else if (key === 'v' && !e.repeat) {
        const order: CameraViewMode[] = ['chase', 'action', 'panoramic', 'sky'];
        const nextMode = order[(order.indexOf(cameraViewModeRef.current) + 1) % order.length];
        setCameraViewMode(nextMode);
        applyCameraViewPreset(nextMode);
      } else if (key === 'e' && !e.repeat) {
        const distCyber = Math.hypot(playerState.x - 198, playerState.z - 8);
        const distJamaica = Math.hypot(playerState.x - -8, playerState.z - 6);
        if (distCyber <= 5.5) {
          AudioManager.openStationModal('cyber_city_station');
        } else if (distJamaica <= 5.5) {
          AudioManager.openStationModal('jamaica_city_station');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Helper to clamp any target or player position to Gemini City, Bridge, Neo-Horizon, Extended 750m Northern Shinobi Highway & Hidden Leaf Ninja Village
    const clampToWalkableWorld = (rawX: number, rawZ: number): { x: number; z: number } => {
      // 0A. Hidden Leaf Ninja Village Sanctuary (Center: 0, -854, Radius: 94m)
      const distNinjaVillage = Math.hypot(rawX, rawZ - -854);
      if (distNinjaVillage <= 94) {
        return { x: rawX, z: rawZ };
      }
      // 0B. Extended 750m Northern Shinobi Highway & Scenic Corridor (z = -35 to -794, x = -46 to +46)
      if (rawZ <= -35 && rawZ >= -794 && Math.abs(rawX) <= 46) {
        return { x: rawX, z: rawZ };
      }
      // 1. South Harbor Boardwalk Pier on Gemini City
      if (Math.abs(rawX) < 2.6 && rawZ >= 55 && rawZ <= 79) {
        return { x: rawX, z: rawZ };
      }
      // 2. Golden Horizon Suspension Bridge Corridor (x = 55..143, z = -5.0..5.0)
      if (rawX >= 55 && rawX <= 143 && Math.abs(rawZ) <= 5.0) {
        return { x: rawX, z: rawZ };
      }
      // 3. Gemini City Island (Center: 0, 0, Radius: 63.5m)
      const distCity1 = Math.hypot(rawX, rawZ);
      if (distCity1 <= 63.5) {
        return { x: rawX, z: rawZ };
      }
      // 4. Neo-Horizon Second City Island (Center: 198, 0, Radius: 58.8m)
      const distCity2 = Math.hypot(rawX - 198, rawZ);
      if (distCity2 <= 58.8) {
        return { x: rawX, z: rawZ };
      }
      // If slightly outside the Extended Northern Shinobi Highway guardrails, clamp to the highway corridor
      if (rawZ < -55 && rawZ > -785) {
        return {
          x: THREE.MathUtils.clamp(rawX, -46, 46),
          z: rawZ,
        };
      }
      // If outside Ninja Village boundary in the far north, clamp radially to Ninja Village
      if (rawZ <= -785) {
        const ang3 = Math.atan2(rawZ - -854, rawX);
        return {
          x: Math.cos(ang3) * 94,
          z: -854 + Math.sin(ang3) * 94,
        };
      }
      // If slightly outside the bridge guardrails while over the ocean channel, slide along the bridge railing!
      if (rawX > 58 && rawX < 140 && Math.abs(rawZ) < 18) {
        return {
          x: rawX,
          z: THREE.MathUtils.clamp(rawZ, -4.95, 4.95),
        };
      }
      // Otherwise clamp radially to whichever island is closer
      if (rawX >= 100) {
        const ang2 = Math.atan2(rawZ, rawX - 198);
        return {
          x: 198 + Math.cos(ang2) * 58.8,
          z: Math.sin(ang2) * 58.8,
        };
      }
      const ang1 = Math.atan2(rawZ, rawX);
      return {
        x: Math.cos(ang1) * 63.5,
        z: Math.sin(ang1) * 63.5,
      };
    };

    const getBridgeSurfaceElevation = (px: number, pz: number): number => {
      if (px > 55 && px < 143 && Math.abs(pz) <= 5.6) {
        if (px < 60) return ((px - 55) / 5) * 0.22;
        if (px > 138) return ((143 - px) / 5) * 0.22;
        return 0.22;
      }
      return 0;
    };

    travelToSpotRef.current = (destX: number, destZ: number, walkThere = false) => {
      const clamped = clampToWalkableWorld(destX, destZ);
      callbacksRef.current.onClearCameraOverride();
      playerState.fastTravel.active = false;
      setFastTravelStatus(null);
      if (walkThere) {
        playerState.targetX = clamped.x;
        playerState.targetZ = clamped.z;
        playerState.hasTapTarget = true;
        tapMarker.position.set(clamped.x, 0.12, clamped.z);
        tapMarkerMat.opacity = 0.92;
      } else {
        playerState.x = clamped.x;
        playerState.z = clamped.z;
        playerState.targetX = clamped.x;
        playerState.targetZ = clamped.z;
        playerState.vx = 0;
        playerState.vz = 0;
        playerState.hasTapTarget = false;
        playerState.rotationY = destX > 90 ? Math.PI / 2 : -Math.PI / 2;
        camOrbit.focusX = clamped.x;
        camOrbit.focusZ = clamped.z;
      }
    };

    // Unique 3D Bridge Hyper-Glide Fast Travel Animation across the 82m Golden Horizon Suspension Bridge
    triggerBridgeFastTravelRef.current = (targetCity?: 'neo_horizon' | 'gemini_city') => {
      const goingToNeo =
        targetCity === 'neo_horizon'
          ? true
          : targetCity === 'gemini_city'
          ? false
          : playerState.x < 105;

      const startX = goingToNeo ? 54 : 144;
      const startZ = 0;
      const endX = goingToNeo ? 184 : 36;
      const endZ = 0;
      const destinationLabel = goingToNeo
        ? 'Neo-Horizon Cyber-Metropolis (🏙️)'
        : 'Gemini City Central Avenue (🏡)';

      callbacksRef.current.onClearCameraOverride();
      playerState.hasTapTarget = false;
      tapMarkerMat.opacity = 0;
      playerState.x = startX;
      playerState.z = startZ;
      playerState.y = 0.8;
      playerState.vx = 0;
      playerState.vz = 0;
      playerState.vy = 0;
      playerState.rotationY = goingToNeo ? Math.PI / 2 : -Math.PI / 2;
      playerState.fastTravel = {
        active: true,
        progress: 0,
        duration: 2.35,
        startX,
        startZ,
        endX,
        endZ,
        destinationLabel,
        lastRingIdx: -1,
      };
      setFastTravelStatus({
        active: true,
        destinationLabel,
        progress: 0,
      });

      // Align camera for a sweeping cinematic bridge flight
      camOrbit.targetAzimuth = goingToNeo ? -Math.PI * 0.42 : Math.PI * 0.42;
      camOrbit.targetPolar = 1.02;
      camOrbit.targetDistance = 17.5;
      spawnJumpShockwave(startX, 0.25, startZ, goingToNeo ? '#22d3ee' : '#fbbf24');
      emitLocomotionDust(startX, 0.35, startZ, 12, 0.8);

      // Broadcast resident AI dialogue reflections about the crossing!
      callbacksRef.current.onTriggerBridgeReflections?.(
        'envoy',
        goingToNeo ? 'to_neo_horizon' : 'to_gemini_city'
      );
    };

    const activePointers = new Map<number, { x: number; y: number }>();
    let pointerDownPos = { x: 0, y: 0, time: 0 };
    let isDraggingCamera = false;
    let prevPinchDist = 0;

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
        isDraggingCamera = false;
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = activePointers.get(e.pointerId);
      if (!prev) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        const rawDx = e.clientX - prev.x;
        const rawDy = e.clientY - prev.y;
        const rot = screenRotationRef.current;
        const dx = rot === 90 ? rawDy : rot === -90 ? -rawDy : rawDx;
        const dy = rot === 90 ? -rawDx : rot === -90 ? rawDx : rawDy;

        if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 8) {
          isDraggingCamera = true;
        }
        if (isDraggingCamera) {
          camOrbit.targetAzimuth -= dx * 0.008;
          camOrbit.targetPolar = Math.max(
            0.38,
            Math.min(1.36, camOrbit.targetPolar + dy * 0.006)
          );
          camOrbit.lastManualRotateTime = performance.now();
        }
      } else if (activePointers.size === 2) {
        isDraggingCamera = true;
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (prevPinchDist > 0) {
          const delta = prevPinchDist - dist;
          camOrbit.targetDistance = Math.max(
            6.5,
            Math.min(68, camOrbit.targetDistance + delta * 0.05)
          );
        }
        prevPinchDist = dist;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) prevPinchDist = 0;

      const elapsed = performance.now() - pointerDownPos.time;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);

      if (!isDraggingCamera && elapsed < 420 && moveDist < 12) {
        const rect = renderer.domElement.getBoundingClientRect();
        const rot = screenRotationRef.current;
        if (rot === 90) {
          const u = (e.clientY - rect.top) / Math.max(1, rect.height);
          const v = (rect.right - e.clientX) / Math.max(1, rect.width);
          pointerNDC.x = u * 2 - 1;
          pointerNDC.y = 1 - v * 2;
        } else if (rot === -90) {
          const u = (rect.bottom - e.clientY) / Math.max(1, rect.height);
          const v = (e.clientX - rect.left) / Math.max(1, rect.width);
          pointerNDC.x = u * 2 - 1;
          pointerNDC.y = 1 - v * 2;
        } else {
          pointerNDC.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
          pointerNDC.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        }

        raycaster.setFromCamera(pointerNDC, camera);
        const hits = raycaster.intersectObjects(pickableObjects, false);

        if (hits.length > 0) {
          const hit = hits[0];
          const data = hit.object.userData;

          if (data.type === 'player') {
            callbacksRef.current.onSelectExplorer?.();
            return;
          }

          if (data.type === 'character' && data.characterId) {
            // NPC-to-Player communication is completely disabled.
            return;
          }

          if (data.type === 'created_object' && data.objectId) {
            const foundObj = createdObjectsRef.current.find((o) => o.id === data.objectId);
            if (foundObj) {
              callbacksRef.current.onSelectCreatedObject?.(foundObj);
              playerState.targetX = foundObj.position.x;
              playerState.targetZ = foundObj.position.z + 1.4;
              playerState.hasTapTarget = true;
              tapMarker.position.set(playerState.targetX, 0.08, playerState.targetZ);
              tapMarkerMat.opacity = 0.9;
            }
            return;
          }

          if (data.type === 'cyber_car') {
            boardCyberCarActionRef.current?.();
            return;
          }

          if (data.type === 'audio_station' && data.stationId) {
            AudioManager.openStationModal(data.stationId);
            return;
          }

          if (data.type === 'audio_station_chair' && data.chairTarget) {
            travelToSpotRef.current?.(data.chairTarget.x, data.chairTarget.z, true);
            return;
          }

          if (data.type === 'bus_depot_interaction' || data.type === 'bus_depot') {
            setIsBusStopVisualizerOpen(true);
            if (isBusParkedRef.current || !isBusEngineOnRef.current) {
              startBusEngineRef.current?.();
            } else {
              parkBusAtDepotRef.current?.();
            }
            return;
          }

          if (data.type === 'bus_interaction') {
            triggerBusStopNowRef.current?.();
            return;
          }

          if (data.type === 'bus_stop_marker' && data.stopId) {
            const clickedStop = BUS_STOP_STATIONS.find((s) => s.id === data.stopId);
            if (clickedStop) {
              setIsBusStopVisualizerOpen(true);
              playerState.targetX = clickedStop.shelterX;
              playerState.targetZ = clickedStop.shelterZ;
              playerState.hasTapTarget = true;
              tapMarker.position.set(clickedStop.shelterX, 0.08, clickedStop.shelterZ);
              tapMarkerMat.opacity = 0.9;
              callbacksRef.current.onClearCameraOverride();
            }
            return;
          }

          if (data.type === 'two_place_spot' && data.spotId) {
            const spot = TWO_PLACE_SPOTS[data.spotId as TwoPlaceSpotId];
            if (spot) {
              const choice = (data.seatingChoice as 'bench' | 'chairs') || 'bench';
              callbacksRef.current.onSelectTwoPlaceSpot?.(spot.id, choice);
              const seatTarget = choice === 'chairs' ? spot.chairB : spot.seatB;
              playerState.targetX = seatTarget.x;
              playerState.targetZ = seatTarget.z;
              playerState.hasTapTarget = true;
              tapMarker.position.set(seatTarget.x, 0.08, seatTarget.z);
              tapMarkerMat.opacity = 0.9;
              callbacksRef.current.onClearCameraOverride();
            }
            return;
          }

          if (data.type === 'building' && data.buildingId) {
            const b = CITY_BUILDINGS[data.buildingId as BuildingId];
            if (b) {
              callbacksRef.current.onSelectBuilding(b.id);
              // Walk right inside the house if interiorSpots exist, or to entrance!
              const targetSpot =
                b.interiorSpots && b.interiorSpots.length > 0
                  ? b.interiorSpots[0]
                  : [b.entrance[0], b.entrance[2]];
              playerState.targetX = targetSpot[0];
              playerState.targetZ = targetSpot[1];
              playerState.hasTapTarget = true;
              tapMarker.position.set(targetSpot[0], 0.08, targetSpot[1]);
              tapMarkerMat.opacity = 0.9;
              callbacksRef.current.onClearCameraOverride();
            }
            return;
          }

          if (data.type === 'bridge_interaction') {
            setIsBridgeHubOpen(true);
            callbacksRef.current.onTriggerBridgeReflections?.(
              bridgeReflectionThemeRef.current,
              playerState.x < 105 ? 'to_neo_horizon' : 'to_gemini_city'
            );
            if (
              data.part === 'west_portal' ||
              data.part === 'east_portal' ||
              data.part === 'speed_ring'
            ) {
              triggerBridgeFastTravelRef.current?.();
            }
            return;
          }

          if (data.type === 'ground') {
            const pt = hit.point;
            const clamped = clampToWalkableWorld(pt.x, pt.z);
            playerState.targetX = clamped.x;
            playerState.targetZ = clamped.z;
            playerState.hasTapTarget = true;
            tapMarker.position.set(
              playerState.targetX,
              0.08 + getBridgeSurfaceElevation(playerState.targetX, playerState.targetZ),
              playerState.targetZ
            );
            tapMarkerMat.opacity = 0.9;
            callbacksRef.current.onClearCameraOverride();

            // If clicking directly on the Golden Horizon Suspension Bridge deck, reveal the Bridge Interaction Hub!
            if (clamped.x >= 56 && clamped.x <= 142 && Math.abs(clamped.z) <= 5.6) {
              setIsBridgeHubOpen(true);
              callbacksRef.current.onTriggerBridgeReflections?.(
                bridgeReflectionThemeRef.current,
                playerState.x < 105 ? 'to_neo_horizon' : 'to_gemini_city'
              );
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camOrbit.targetDistance = Math.max(
        6.5,
        Math.min(68, camOrbit.targetDistance + e.deltaY * 0.018)
      );
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointercancel', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    let cachedViewportW = Math.max(1, container.clientWidth);
    let cachedViewportH = Math.max(1, container.clientHeight);

    const handleResize = () => {
      if (!container) return;
      cachedViewportW = Math.max(1, container.clientWidth);
      cachedViewportH = Math.max(1, container.clientHeight);
      camera.aspect = cachedViewportW / cachedViewportH;
      camera.updateProjectionMatrix();
      renderer.setSize(cachedViewportW, cachedViewportH);
      renderer.shadowMap.needsUpdate = true;
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    // 12. Main 60FPS Render & Simulation Loop
    let animFrameId = 0;
    let frameCounter = 0;
    const clock = new THREE.Clock();
    const tempVec = new THREE.Vector3();
    let lastReportTime = 0;
    let lastShadowUpdateTime = -1;
    let lastShadowFocusX = 9999;
    let lastShadowFocusZ = 9999;

    const skyColors: Record<TimePhase, THREE.Color> = {
      dawn: new THREE.Color('#e8998d'),
      morning: new THREE.Color('#68a8e8'),
      afternoon: new THREE.Color('#4a90d9'),
      sunset: new THREE.Color('#d97757'),
      night: new THREE.Color('#0c1428'),
    };
    const cloudySkyColors: Record<TimePhase, THREE.Color> = {
      dawn: new THREE.Color('#94a3b8'),
      morning: new THREE.Color('#7c98b6'),
      afternoon: new THREE.Color('#64748b'),
      sunset: new THREE.Color('#78716c'),
      night: new THREE.Color('#0f172a'),
    };
    const rainySkyColors: Record<TimePhase, THREE.Color> = {
      dawn: new THREE.Color('#475569'),
      morning: new THREE.Color('#475c7a'),
      afternoon: new THREE.Color('#334155'),
      sunset: new THREE.Color('#334155'),
      night: new THREE.Color('#090d16'),
    };
    const sunColors: Record<TimePhase, THREE.Color> = {
      dawn: new THREE.Color('#fde68a'),
      morning: new THREE.Color('#fffbeb'),
      afternoon: new THREE.Color('#fff7ed'),
      sunset: new THREE.Color('#fb923c'),
      night: new THREE.Color('#818cf8'),
    };
    const cloudSunnyColor = new THREE.Color('#ffffff');
    const cloudOvercastColor = new THREE.Color('#cbd5e1');
    const cloudRainyColor = new THREE.Color('#64748b');

    const normalizeAngle = (a: number) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

    const projectToDOM = (
      worldX: number,
      worldY: number,
      worldZ: number,
      el: HTMLDivElement | null,
      maxDistFromFocus = 76
    ) => {
      if (!el) return;
      const distFromFocus = Math.hypot(worldX - camOrbit.focusX, worldZ - camOrbit.focusZ);
      if (distFromFocus > maxDistFromFocus) {
        if (el.dataset.vis !== '0') {
          el.dataset.vis = '0';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
        return;
      }

      tempVec.set(worldX, worldY, worldZ);
      tempVec.project(camera);

      if (tempVec.z > 1 || tempVec.x < -1.15 || tempVec.x > 1.15 || tempVec.y < -1.15 || tempVec.y > 1.15) {
        if (el.dataset.vis !== '0') {
          el.dataset.vis = '0';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
        return;
      }

      const halfW = cachedViewportW * 0.5;
      const halfH = cachedViewportH * 0.5;
      const screenX = tempVec.x * halfW + halfW;
      const screenY = -(tempVec.y * halfH) + halfH;

      if (el.dataset.vis !== '1') {
        el.dataset.vis = '1';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      }
      const qx = Math.round(screenX * 2) * 0.5;
      const qy = Math.round(screenY * 2) * 0.5;
      const prevQx = Number(el.dataset.qx || -9999);
      const prevQy = Number(el.dataset.qy || -9999);
      if (qx !== prevQx || qy !== prevQy) {
        el.dataset.qx = String(qx);
        el.dataset.qy = String(qy);
        el.style.transform = `translate3d(${qx}px, ${qy}px, 0) translate(-50%, -100%)`;
      }
    };

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      frameCounter++;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      // A. Update Day/Night Sky, Weather Atmosphere, Sun/Moon Trajectory, Clouds & Lighting
      const phase = timePhaseRef.current;
      const currentWeather = weatherRef.current;
      const targetSky =
        currentWeather === 'rainy'
          ? rainySkyColors[phase]
          : currentWeather === 'cloudy'
          ? cloudySkyColors[phase]
          : skyColors[phase];
      const targetSun = sunColors[phase];

      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(targetSky, 0.04);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(targetSky, 0.04);
        const targetFogDensity =
          currentWeather === 'rainy' ? 0.0052 : currentWeather === 'cloudy' ? 0.0038 : 0.0024;
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFogDensity, 0.04);
      }
      dirLight.color.lerp(targetSun, 0.04);
      celestialOrbMat.color.lerp(targetSun, 0.05);
      celestialOrb.visible = currentWeather !== 'rainy';

      const sunAngle = ((gameHourRef.current - 6) / 24) * Math.PI * 2;
      const sunX = Math.cos(sunAngle) * 58;
      const sunY = Math.max(9, Math.sin(sunAngle) * 52 + 14);
      celestialOrb.position.set(camOrbit.focusX + sunX * 1.5, sunY * 1.2, -78);

      // Smart Shadow Map Caching: Update directional shadow camera & shadow map at 7Hz or when camera moves >0.4m (eliminates mobile GPU overheating)
      const shadowFocusMoved =
        Math.hypot(camOrbit.focusX - lastShadowFocusX, camOrbit.focusZ - lastShadowFocusZ) > 0.42;
      if (shadowFocusMoved || elapsed - lastShadowUpdateTime > 0.14) {
        lastShadowUpdateTime = elapsed;
        lastShadowFocusX = camOrbit.focusX;
        lastShadowFocusZ = camOrbit.focusZ;
        dirLight.position.set(camOrbit.focusX + sunX, sunY, camOrbit.focusZ + 26);
        dirLight.target.position.set(camOrbit.focusX, 0, camOrbit.focusZ);
        dirLight.target.updateMatrixWorld();
        if (renderer.shadowMap.enabled) {
          renderer.shadowMap.needsUpdate = true;
        }
      }

      // Gentle cloud drift & weather cloud styling
      cloudsGroup.rotation.y =
        elapsed * (currentWeather === 'rainy' ? 0.016 : currentWeather === 'cloudy' ? 0.012 : 0.008);
      const targetCloudColor =
        currentWeather === 'rainy'
          ? cloudRainyColor
          : currentWeather === 'cloudy'
          ? cloudOvercastColor
          : cloudSunnyColor;
      cloudMat.color.lerp(targetCloudColor, 0.05);
      cloudMat.opacity = THREE.MathUtils.lerp(
        cloudMat.opacity,
        currentWeather === 'rainy' ? 0.96 : currentWeather === 'cloudy' ? 0.92 : 0.85,
        0.05
      );

      // Wet surface reflections when raining
      const targetRoadRoughness = currentWeather === 'rainy' ? 0.32 : 0.85;
      const targetPlazaRoughness = currentWeather === 'rainy' ? 0.28 : 0.74;
      roadMat.roughness = THREE.MathUtils.lerp(roadMat.roughness, targetRoadRoughness, 0.05);
      plazaMat.roughness = THREE.MathUtils.lerp(plazaMat.roughness, targetPlazaRoughness, 0.05);

      const isNightOrSunset = phase === 'night' || phase === 'sunset';
      const weatherLightFactor =
        currentWeather === 'rainy' ? 0.55 : currentWeather === 'cloudy' ? 0.78 : 1.0;
      const baseDirIntensity = phase === 'night' ? 0.42 : phase === 'sunset' ? 0.92 : 1.48;
      dirLight.intensity = THREE.MathUtils.lerp(
        dirLight.intensity,
        baseDirIntensity * weatherLightFactor,
        0.05
      );
      hemiLight.intensity = THREE.MathUtils.lerp(
        hemiLight.intensity,
        (phase === 'night' ? 0.38 : 0.85) * (currentWeather === 'rainy' ? 0.75 : 1.0),
        0.05
      );

      const targetEmissive =
        phase === 'night'
          ? 1.25
          : phase === 'sunset' || currentWeather === 'rainy'
          ? 0.82
          : currentWeather === 'cloudy'
          ? 0.28
          : 0.12;
      windowMaterials.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, targetEmissive, 0.05);
      });
      lampBulbMats.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, targetEmissive * 1.25, 0.05);
      });

      // 1) Animate Evening & Night Fireflies
      particleMat.opacity = THREE.MathUtils.lerp(
        particleMat.opacity,
        isNightOrSunset && currentWeather !== 'rainy' && qualityRef.current !== 'low' ? 0.88 : 0,
        0.04
      );
      if (particleMat.opacity > 0.02) {
        const ffAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
        const ffArr = ffAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          ffArr[i * 3 + 1] += Math.sin(elapsed * 2.2 + i * 0.9) * 0.006;
          ffArr[i * 3] += Math.cos(elapsed * 1.5 + i * 0.7) * 0.004;
        }
        ffAttr.needsUpdate = true;
      }

      // 2) Animate Falling Leaves & Sakura Petals in the Park during Sunny (and Breezy) Weather
      const targetLeafOpacity =
        currentWeather === 'sunny' && phase !== 'night'
          ? 0.94
          : currentWeather === 'cloudy' && phase !== 'night'
          ? 0.48
          : 0;
      leafMat.opacity = THREE.MathUtils.lerp(leafMat.opacity, targetLeafOpacity, 0.05);
      fallingLeaves.visible = leafMat.opacity > 0.02 && qualityRef.current !== 'low';
      if (fallingLeaves.visible) {
        const lAttr = leafGeo.getAttribute('position') as THREE.BufferAttribute;
        const lArr = lAttr.array as Float32Array;
        for (let i = 0; i < leafCount; i++) {
          const seed = leafSeeds[i * 4];
          const fallSpd = leafSeeds[i * 4 + 1];
          const swayAmp = leafSeeds[i * 4 + 2];
          const zDrift = leafSeeds[i * 4 + 3];

          lArr[i * 3] += Math.sin(elapsed * 1.8 + seed) * swayAmp * dt + 0.22 * dt;
          lArr[i * 3 + 1] -= fallSpd * dt;
          lArr[i * 3 + 2] += Math.cos(elapsed * 1.5 + seed) * swayAmp * 0.7 * dt + zDrift * dt;

          if (lArr[i * 3 + 1] < 0.08) {
            resetLeafParticle(i, false);
          }
        }
        lAttr.needsUpdate = true;
      }

      // 3) Animate Gentle Morning & Dawn Mist (plus soft mist during Cloudy/Rainy hours)
      const isMorningOrDawn = phase === 'dawn' || phase === 'morning';
      const targetMistOpacity =
        isMorningOrDawn && currentWeather === 'sunny'
          ? phase === 'dawn'
            ? 0.52
            : 0.36
          : isMorningOrDawn
          ? 0.58
          : currentWeather === 'cloudy' || currentWeather === 'rainy'
          ? 0.26
          : 0;
      mistMat.opacity = THREE.MathUtils.lerp(mistMat.opacity, targetMistOpacity, 0.04);
      morningMist.visible = mistMat.opacity > 0.015 && qualityRef.current !== 'low';
      if (morningMist.visible) {
        const mAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
        const mArr = mAttr.array as Float32Array;
        for (let i = 0; i < mistCount; i++) {
          const bx = mistBaseXZ[i * 3];
          const by = mistBaseXZ[i * 3 + 1];
          const bz = mistBaseXZ[i * 3 + 2];
          mArr[i * 3] = bx + Math.sin(elapsed * 0.35 + i * 0.8) * 1.85;
          mArr[i * 3 + 1] = by + Math.cos(elapsed * 0.5 + i * 0.6) * 0.22;
          mArr[i * 3 + 2] = bz + Math.cos(elapsed * 0.32 + i * 0.9) * 1.85;
        }
        mAttr.needsUpdate = true;
      }

      // 4) Animate 3D Rain Streaks when weather is rainy
      const targetRainOpacity = currentWeather === 'rainy' ? 0.58 : 0;
      rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, targetRainOpacity, 0.08);
      rainLines.visible = rainMat.opacity > 0.02;
      if (rainLines.visible) {
        const posAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const fallStep = 24 * dt;
        for (let i = 0; i < rainCount; i++) {
          let yTop = arr[i * 6 + 1] - fallStep;
          if (yTop < 0.2) {
            yTop = 22 + Math.random() * 4;
          }
          arr[i * 6 + 1] = yTop;
          arr[i * 6 + 4] = yTop - 0.92;
        }
        posAttr.needsUpdate = true;
      }
      crystalSpire.rotation.y = elapsed * 0.7;
      crystalSpire.position.y = 2.32 + Math.sin(elapsed * 2.4) * 0.08;

      // B. Player Locomotion, Jump & Slide Physics, Turn Banking & Animation Blending
      const liveJoy = joystickInputRef?.current || joystickRef.current;
      let moveX = liveJoy.x;
      let moveY = liveJoy.y;

      if (keysPressed['w'] || keysPressed['arrowup']) moveY -= 1.25;
      if (keysPressed['s'] || keysPressed['arrowdown']) moveY += 1.25;
      if (keysPressed['a'] || keysPressed['arrowleft']) moveX -= 1.25;
      if (keysPressed['d'] || keysPressed['arrowright']) moveX += 1.25;

      // Keyboard & HUD Screen Rotation (Q / E or on-screen Rotate Pad/Buttons)
      if (keysPressed['q']) {
        camOrbit.targetAzimuth += 1.95 * dt;
        camOrbit.lastManualRotateTime = performance.now();
      }
      if (keysPressed['e']) {
        camOrbit.targetAzimuth -= 1.95 * dt;
        camOrbit.lastManualRotateTime = performance.now();
      }
      if (continuousRotateDirRef.current !== 0) {
        camOrbit.targetAzimuth += continuousRotateDirRef.current * 2.1 * dt;
        camOrbit.lastManualRotateTime = performance.now();
      }
      if (
        Math.abs(rotateDeltaRef.current.dAzimuth) > 0.0001 ||
        Math.abs(rotateDeltaRef.current.dPolar) > 0.0001
      ) {
        camOrbit.targetAzimuth += rotateDeltaRef.current.dAzimuth;
        camOrbit.targetPolar = Math.max(
          0.38,
          Math.min(1.36, camOrbit.targetPolar + rotateDeltaRef.current.dPolar)
        );
        rotateDeltaRef.current.dAzimuth = 0;
        rotateDeltaRef.current.dPolar = 0;
        camOrbit.lastManualRotateTime = performance.now();
      }

      const baseWalkSpeed = 6.6;
      const sprintBonus = keysPressed['shift'] ? 1.35 : 1.0;
      let desiredVx = 0;
      let desiredVz = 0;
      const autoTarget = playerAutoTargetRef.current;

      if (playerState.slideCooldown > 0) {
        playerState.slideCooldown = Math.max(0, playerState.slideCooldown - dt);
      }

      if (playerState.fastTravel.active) {
        // Active 3D Bridge Hyper-Glide Fast Travel Animation across the Golden Horizon Suspension Bridge!
        const ft = playerState.fastTravel;
        const prevProg = ft.progress;
        ft.progress = Math.min(1, ft.progress + dt / ft.duration);
        const easeT =
          ft.progress < 0.5
            ? 4 * ft.progress * ft.progress * ft.progress
            : 1 - Math.pow(-2 * ft.progress + 2, 3) / 2;

        const prevX = playerState.x;
        const prevZ = playerState.z;
        playerState.x = THREE.MathUtils.lerp(ft.startX, ft.endX, easeT);
        playerState.z =
          THREE.MathUtils.lerp(ft.startZ, ft.endZ, easeT) +
          Math.sin(ft.progress * Math.PI * 2) * 0.55;
        playerState.y = Math.sin(ft.progress * Math.PI) * 2.85 + 0.35;
        playerState.vx = (playerState.x - prevX) / Math.max(0.001, dt);
        playerState.vz = (playerState.z - prevZ) / Math.max(0.001, dt);
        playerState.rotationY = ft.endX > ft.startX ? Math.PI / 2 : -Math.PI / 2;
        playerState.isJumping = true;
        playerState.vy = Math.cos(ft.progress * Math.PI) * 4.5;

        if (Math.random() < 0.85) {
          emitLocomotionDust(
            playerState.x,
            getBridgeSurfaceElevation(playerState.x, playerState.z) + playerState.y * 0.4,
            playerState.z,
            2,
            0.55
          );
        }

        // Trigger speed-ring shockwave bursts as Johnny streaks through each bridge portal ring
        speedRingXCoords.forEach((rx, rIdx) => {
          if (Math.abs(playerState.x - rx) < 3.4 && ft.lastRingIdx !== rIdx) {
            ft.lastRingIdx = rIdx;
            spawnJumpShockwave(
              rx,
              getBridgeSurfaceElevation(rx, 0) + 0.1,
              0,
              rIdx % 2 === 0 ? '#fbbf24' : '#22d3ee'
            );
          }
        });

        if (ft.progress >= 1) {
          ft.active = false;
          playerState.x = ft.endX;
          playerState.z = ft.endZ;
          playerState.y = 0;
          playerState.vx = 0;
          playerState.vz = 0;
          playerState.vy = 0;
          playerState.isJumping = false;
          playerState.squashY = 0.78;
          spawnJumpShockwave(ft.endX, 0.08, ft.endZ, '#22d3ee');
          emitLocomotionDust(ft.endX, 0.1, ft.endZ, 12, 0.75);
          setFastTravelStatus(null);
        } else if (Math.round(ft.progress * 20) !== Math.round(prevProg * 20)) {
          setFastTravelStatus({
            active: true,
            destinationLabel: ft.destinationLabel,
            progress: Math.round(ft.progress * 100),
          });
        }
      } else if (playerState.slideTimer > 0) {
        // Active Ground Slide / Parkour Dash
        playerState.slideTimer = Math.max(0, playerState.slideTimer - dt);
        const slideDecay = THREE.MathUtils.lerp(7.2, 12.2, playerState.slideTimer / 0.62);
        desiredVx = playerState.slideDirX * slideDecay;
        desiredVz = playerState.slideDirZ * slideDecay;
        playerState.rotationY = Math.atan2(playerState.slideDirX, playerState.slideDirZ);
        if (Math.random() < 0.65) {
          emitLocomotionDust(playerState.x, playerState.y, playerState.z, 1, 0.38);
        }
      } else if (Math.hypot(moveX, moveY) > 0.06) {
        playerState.hasTapTarget = false;
        playerState.lastReachedAutoKey = '';
        tapMarkerMat.opacity = 0;
        if (cameraOverrideRef.current) {
          callbacksRef.current.onClearCameraOverride();
        }

        const inputAngle = Math.atan2(moveX, moveY) + camOrbit.azimuth;
        const rawMag = Math.hypot(moveX, moveY) * sprintBonus;
        const clampedMag = Math.min(1.38, rawMag);
        desiredVx = Math.sin(inputAngle) * baseWalkSpeed * clampedMag;
        desiredVz = Math.cos(inputAngle) * baseWalkSpeed * clampedMag;
        playerState.rotationY = inputAngle;

        // Auto-follow camera smoothly rotates behind the player when moving forward/turning
        const timeSinceManual = performance.now() - camOrbit.lastManualRotateTime;
        if (
          autoFollowCameraRef.current &&
          !isDraggingCamera &&
          timeSinceManual > 1400 &&
          cameraViewModeRef.current !== 'sky'
        ) {
          const behindAzimuth = inputAngle + Math.PI;
          const azDiff = normalizeAngle(behindAzimuth - camOrbit.targetAzimuth);
          // Gently align behind character, stronger when turning left/right
          camOrbit.targetAzimuth += azDiff * Math.min(1, dt * 1.85);
        }
      } else if (autoTarget) {
        // Auto-Explore Navigation: smoothly steer toward the target resident's live 3D position
        let destX = autoTarget.x;
        let destZ = autoTarget.z;
        let lookAtX = destX;
        let lookAtZ = destZ;

        if (autoTarget.targetId) {
          const targetRig = aiRigs[autoTarget.targetId];
          const targetChar = charactersRef.current.find((c) => c.id === autoTarget.targetId);
          if (targetRig) {
            lookAtX = targetRig.group.position.x;
            lookAtZ = targetRig.group.position.z;
          } else if (targetChar) {
            lookAtX = targetChar.currentPosition.x;
            lookAtZ = targetChar.currentPosition.z;
          }
          const angleFromTarget = Math.atan2(playerState.x - lookAtX, playerState.z - lookAtZ);
          destX = lookAtX + Math.sin(angleFromTarget) * 1.55;
          destZ = lookAtZ + Math.cos(angleFromTarget) * 1.55;
        }

        tapMarker.position.set(lookAtX, 0.08, lookAtZ);
        tapMarkerMat.opacity = 0.85;
        tapMarker.scale.setScalar(1 + Math.sin(elapsed * 7) * 0.14);

        const dx = destX - playerState.x;
        const dz = destZ - playerState.z;
        const dist = Math.hypot(dx, dz);
        const autoKey =
          autoTarget.targetId || `${Math.round(autoTarget.x)}_${Math.round(autoTarget.z)}`;

        if (dist > 0.35) {
          const arrivalFactor = THREE.MathUtils.clamp(dist / 1.4, 0.3, 1.0);
          const targetSpeed = baseWalkSpeed * 0.92 * arrivalFactor;
          desiredVx = (dx / dist) * targetSpeed;
          desiredVz = (dz / dist) * targetSpeed;
          playerState.rotationY = Math.atan2(dx, dz);
        } else {
          // Face the resident upon arrival and notify App.tsx
          playerState.rotationY = Math.atan2(lookAtX - playerState.x, lookAtZ - playerState.z);
          if (playerState.lastReachedAutoKey !== autoKey) {
            playerState.lastReachedAutoKey = autoKey;
            callbacksRef.current.onPlayerAutoTargetReached?.(autoTarget.targetId);
          }
        }
      } else if (playerState.hasTapTarget) {
        playerState.lastReachedAutoKey = '';
        // Automatically route across the Golden Horizon Suspension Bridge if tapping from one city to the other!
        let stepTargetX = playerState.targetX;
        let stepTargetZ = playerState.targetZ;
        if (playerState.x < 58 && playerState.targetX > 64 && Math.abs(playerState.z) > 4.2) {
          stepTargetX = 58;
          stepTargetZ = 0;
        } else if (playerState.x >= 56 && playerState.x < 138 && playerState.targetX > 140) {
          stepTargetX = 142;
          stepTargetZ = THREE.MathUtils.clamp(playerState.targetZ, -3.6, 3.6);
        } else if (playerState.x > 140 && playerState.targetX < 134 && Math.abs(playerState.z) > 4.2) {
          stepTargetX = 140;
          stepTargetZ = 0;
        } else if (playerState.x <= 142 && playerState.x > 60 && playerState.targetX < 56) {
          stepTargetX = 55;
          stepTargetZ = THREE.MathUtils.clamp(playerState.targetZ, -3.6, 3.6);
        }

        const dx = stepTargetX - playerState.x;
        const dz = stepTargetZ - playerState.z;
        const dist = Math.hypot(dx, dz);
        const totalDist = Math.hypot(playerState.targetX - playerState.x, playerState.targetZ - playerState.z);
        if (totalDist > 0.18 && dist > 0.05) {
          // Smooth arrival slowdown within the final 1.2m radius
          const arrivalFactor = THREE.MathUtils.clamp(totalDist / 1.2, 0.22, 1.0);
          const targetSpeed = baseWalkSpeed * arrivalFactor;
          desiredVx = (dx / dist) * targetSpeed;
          desiredVz = (dz / dist) * targetSpeed;
          playerState.rotationY = Math.atan2(dx, dz);
          tapMarker.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.12);
        } else {
          playerState.hasTapTarget = false;
          tapMarkerMat.opacity = 0;
        }
      } else {
        tapMarkerMat.opacity = THREE.MathUtils.lerp(tapMarkerMat.opacity, 0, 0.1);
      }

      const sitTarget = playerSittingSpotRef.current;
      let playerIsSittingNow = false;
      let playerLookDelta: number | null = null;
      const playerRidingVehicle = isRidingCyberCarRef.current || isRidingBusRef.current;

      if (
        !playerRidingVehicle &&
        (Math.hypot(moveX, moveY) > 0.08 || playerState.isJumping || playerState.slideTimer > 0)
      ) {
        if (sitTarget) {
          callbacksRef.current.onPlayerStandUp?.();
        }
      }

      if (
        !playerRidingVehicle &&
        sitTarget &&
        !playerState.fastTravel.active &&
        Math.hypot(moveX, moveY) <= 0.08 &&
        !playerState.isJumping &&
        playerState.slideTimer <= 0
      ) {
        const dxSit = sitTarget.x - playerState.x;
        const dzSit = sitTarget.z - playerState.z;
        const distSit = Math.hypot(dxSit, dzSit);
        if (distSit > 0.24) {
          const arrivalFactor = THREE.MathUtils.clamp(distSit / 1.2, 0.28, 1.0);
          const targetSpeed = baseWalkSpeed * 0.9 * arrivalFactor;
          desiredVx = (dxSit / distSit) * targetSpeed;
          desiredVz = (dzSit / distSit) * targetSpeed;
          playerState.rotationY = Math.atan2(dxSit, dzSit);
        } else {
          playerState.x = THREE.MathUtils.lerp(playerState.x, sitTarget.x, 1 - Math.exp(-14 * dt));
          playerState.z = THREE.MathUtils.lerp(playerState.z, sitTarget.z, 1 - Math.exp(-14 * dt));
          playerState.vx = 0;
          playerState.vz = 0;
          playerState.hasTapTarget = false;
          tapMarkerMat.opacity = 0;
          playerState.rotationY = sitTarget.rotationY;
          playerIsSittingNow = true;
        }
      }

      // Exponential velocity damping so character accelerates and decelerates realistically
      if (!playerState.fastTravel.active && !playerIsSittingNow && !playerRidingVehicle) {
        const accelRate = playerState.slideTimer > 0 ? 18 : playerState.isJumping ? 8.5 : 13.5;
        const velSmooth = 1 - Math.exp(-accelRate * dt);
        playerState.vx = THREE.MathUtils.lerp(playerState.vx, desiredVx, velSmooth);
        playerState.vz = THREE.MathUtils.lerp(playerState.vz, desiredVz, velSmooth);
      }

      const playerSpeed = Math.hypot(playerState.vx, playerState.vz);
      if (!playerState.fastTravel.active && !playerRidingVehicle && playerSpeed > 0.02) {
        const nextX = playerState.x + playerState.vx * dt;
        const nextZ = playerState.z + playerState.vz * dt;
        const clampedNext = clampToWalkableWorld(nextX, nextZ);
        playerState.x = clampedNext.x;
        playerState.z = clampedNext.z;

        // Subtle footstep dust when sprinting fast on the ground
        if (!playerState.isJumping && playerSpeed > 7.4 && Math.random() < 0.28) {
          emitLocomotionDust(
            playerState.x,
            getBridgeSurfaceElevation(playerState.x, playerState.z),
            playerState.z,
            1,
            0.25
          );
        }
      }

      // Track which district Johnny is currently exploring (Gemini City, Bridge, Neo-Horizon, Shinobi Highway, or Hidden Leaf Ninja Village)
      const nextZone:
        | 'gemini_city'
        | 'suspension_bridge'
        | 'neo_horizon'
        | 'shinobi_highway'
        | 'ninja_village' =
        playerState.z < -782
          ? 'ninja_village'
          : playerState.z < -52
          ? 'shinobi_highway'
          : playerState.x > 136
          ? 'neo_horizon'
          : playerState.x >= 56
          ? 'suspension_bridge'
          : 'gemini_city';
      if (nextZone !== explorerZoneRef.current) {
        explorerZoneRef.current = nextZone;
        setExplorerZone(nextZone);
      }

      ninjaVillageBuild.updateAnimations(elapsed, phase === 'night');

      // Vertical Jump & Gravity Physics (Skipped while in controlled 3D Bridge Hyper-Glide Fast Travel)
      if (
        !playerState.fastTravel.active &&
        (playerState.isJumping || playerState.y > 0 || playerState.vy !== 0)
      ) {
        playerState.y += playerState.vy * dt;
        playerState.vy -= 22.0 * dt; // Crisp athletic gravity
        if (playerState.y <= 0) {
          playerState.y = 0;
          playerState.vy = 0;
          playerState.isJumping = false;
          playerState.jumpsRemaining = 2;
          playerState.squashY = 0.82; // Landing compression spring
          spawnJumpShockwave(playerState.x, 0, playerState.z, '#fbbf24');
          emitLocomotionDust(playerState.x, 0, playerState.z, 6, 0.48);
        }
      }

      // Animate Jump Shockwave Ring & Locomotion Dust Trail
      if (jumpRingMat.opacity > 0.01) {
        jumpRingScale += dt * 4.2;
        jumpRingMesh.scale.setScalar(jumpRingScale);
        jumpRingMat.opacity = Math.max(0, jumpRingMat.opacity - dt * 2.4);
      }
      const dAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      const dArr = dAttr.array as Float32Array;
      let dustUpdated = false;
      for (let i = 0; i < dustPoolCount; i++) {
        if (dustLife[i] > 0) {
          dustLife[i] -= dt * 2.1;
          if (dustLife[i] <= 0) {
            dArr[i * 3 + 1] = -999;
          } else {
            dArr[i * 3] += dustVelocities[i * 3] * dt;
            dArr[i * 3 + 1] += dustVelocities[i * 3 + 1] * dt;
            dArr[i * 3 + 2] += dustVelocities[i * 3 + 2] * dt;
          }
          dustUpdated = true;
        }
      }
      if (dustUpdated) dAttr.needsUpdate = true;

      // Squash & Stretch recovery + Realistic Turn Banking
      playerState.squashY = THREE.MathUtils.lerp(playerState.squashY, 1.0, 1 - Math.exp(-14 * dt));
      const playerMoveIntensity = THREE.MathUtils.clamp(playerSpeed / baseWalkSpeed, 0, 1.38);
      const playerIsMoving = playerSpeed > 0.18;

      const bridgeSurfaceY = getBridgeSurfaceElevation(playerState.x, playerState.z);
      playerRig.group.position.set(playerState.x, bridgeSurfaceY + playerState.y, playerState.z);
      const playerRotDiff = normalizeAngle(playerState.rotationY - playerRig.group.rotation.y);
      playerRig.group.rotation.y += playerRotDiff * (1 - Math.exp(-13 * dt));

      // Bank/Lean character body into turns proportionally to turn rate & speed
      const targetBank = THREE.MathUtils.clamp(
        -playerRotDiff * (playerSpeed / baseWalkSpeed) * 0.24,
        -0.22,
        0.22
      );
      playerState.turnBankAngle = THREE.MathUtils.lerp(
        playerState.turnBankAngle,
        targetBank,
        1 - Math.exp(-10 * dt)
      );
      playerRig.group.rotation.z = playerState.turnBankAngle;
      playerRig.pelvisGroup.scale.set(
        1 / Math.sqrt(playerState.squashY),
        playerState.squashY,
        1 / Math.sqrt(playerState.squashY)
      );

      const sitPartnerId = playerSittingSpotRef.current?.partnerId;
      if (playerIsSittingNow && sitPartnerId && aiRigs[sitPartnerId]) {
        const partnerPos = aiRigs[sitPartnerId].group.position;
        const angToPartner = Math.atan2(
          partnerPos.x - playerRig.group.position.x,
          partnerPos.z - playerRig.group.position.z
        );
        playerLookDelta = normalizeAngle(angToPartner - playerRig.group.rotation.y);
      }

      animateHumanoidRig({
        rig: playerRig,
        isMoving: playerIsMoving && !playerIsSittingNow,
        moveIntensity: playerIsSittingNow ? 0 : playerMoveIntensity,
        isJumping: playerState.isJumping,
        verticalVelocity: playerState.vy,
        isSliding: playerState.slideTimer > 0,
        isTalking: Boolean(playerActiveBubbleRef.current),
        isSitting: playerIsSittingNow,
        lookTargetAngleDelta: playerLookDelta,
        elapsedTime: elapsed,
        deltaTime: dt,
        isSelected: false,
        emote: playerEmoteRef.current,
      });
      updateHumanoidRigAppearance(playerRig, {
        skinColor: explorerRef.current.skinColor,
        outfitColor: explorerRef.current.outfitColor,
        accentColor: explorerRef.current.secondaryColor || '#38bdf8',
        pantsColor: explorerRef.current.pantsColor || '#0f172a',
        shoesColor: explorerRef.current.shoesColor || '#f59e0b',
        hairColor: explorerRef.current.hairColor,
        outfitStyle: explorerRef.current.outfitStyle || 'cyber_explorer',
        headgear: explorerRef.current.headgear || 'visor',
        backGear: explorerRef.current.backGear || 'jetpack',
      });
      projectToDOM(
        playerState.x,
        2.58 + bridgeSurfaceY + playerState.y,
        playerState.z,
        playerLabelRef.current
      );

      // B2. Animate Floating Sea Water Waves, Flowing Scenic Rivers, Shoreline Foam, Harbor Sailboats & Forest Breeze
      waterNormalTex.offset.x = (elapsed * 0.024) % 1;
      waterNormalTex.offset.y = (elapsed * 0.018) % 1;
      riverWaterTex.offset.y = -(elapsed * 0.16) % 1;
      riverWaterTex.offset.x = Math.sin(elapsed * 0.8) * 0.04;
      if (frameCounter % 2 === 0) {
        for (let i = 0; i < waterPosAttr.count; i++) {
          const wx = waterBaseXZ[i * 2];
          const wz = waterBaseXZ[i * 2 + 1];
          waterPosArr[i * 3 + 1] =
            Math.sin(wx * 0.08 + elapsed * 1.6) * 0.14 +
            Math.cos(wz * 0.07 + elapsed * 1.3) * 0.12;
        }
        waterPosAttr.needsUpdate = true;
      }

      // Shoreline white sea-foam rings washing in and out against the beach
      const foamWave1 = Math.sin(elapsed * 1.7);
      const foamWave2 = Math.cos(elapsed * 1.7);
      foamRing1.scale.setScalar(1 + foamWave1 * 0.012);
      foamRingMat1.opacity = 0.42 + (foamWave1 + 1) * 0.18;
      foamRing2.scale.setScalar(1 + foamWave2 * 0.014);
      foamRingMat2.opacity = 0.28 + (foamWave2 + 1) * 0.15;
      neoFoamRing1.scale.setScalar(1 + foamWave1 * 0.012);

      // Animate Bridge Speed-Boost Energy Rings & Project Clickable 3D Bridge Tag
      bridgeSpeedRings.forEach((ring, rIdx) => {
        const distToPlayer = Math.abs(playerState.x - ring.position.x);
        const targetScale =
          playerState.fastTravel.active && distToPlayer < 14
            ? 1.28 + Math.sin(elapsed * 14 + rIdx) * 0.12
            : 1.0 + Math.sin(elapsed * 2.5 + rIdx * 0.9) * 0.04;
        ring.scale.setScalar(THREE.MathUtils.lerp(ring.scale.x, targetScale, 0.16));
      });
      const bridgeAnchorX =
        playerState.x < 55 ? 60.5 : playerState.x > 142 ? 137.5 : 99.0;
      projectToDOM(bridgeAnchorX, 5.2, 0, bridgeLabelRef.current);

      // Animate Second City (Neo-Horizon) Holographic Gyroscopes, Floating Crystals & Synthwave Pulse
      const neoPulse = 0.88 + Math.sin(elapsed * 2.6) * 0.24;
      neoPulseMats.forEach((m, idx) => {
        m.emissiveIntensity =
          (isNightOrSunset ? 1.35 : 0.95) * (0.85 + Math.sin(elapsed * 2.2 + idx * 0.8) * 0.2);
      });
      neoSpinningObjects.forEach((item, idx) => {
        item.mesh.rotation.y += item.speedY * dt;
        if (item.speedX) {
          item.mesh.rotation.x += item.speedX * dt;
        }
        if (item.baseY !== undefined && item.bobAmp !== undefined) {
          item.mesh.position.y = item.baseY + Math.sin(elapsed * 2.1 + idx) * item.bobAmp * neoPulse;
        }
      });

      // Harbor Sailboats floating & pitching gently on the sea waves
      harborBoats.forEach((boat, idx) => {
        boat.position.y = -0.76 + Math.sin(elapsed * 1.8 + idx * 1.4) * 0.12;
        boat.rotation.z = Math.sin(elapsed * 1.4 + idx) * 0.05;
        boat.rotation.x = Math.cos(elapsed * 1.2 + idx) * 0.035;
      });

      // =======================================================================================
      // 5A-LIGHTS. ANIMATE 3D TRAFFIC LIGHTS 🚦⛔ & INTERSECTION RED-LIGHT VEHICLE STOPPING
      // =======================================================================================
      const trafficCycle = elapsed % 26.0;
      const currentTrafficPhase: 'ns_green' | 'ns_yellow' | 'ew_green' | 'ew_yellow' =
        trafficCycle < 10.0
          ? 'ns_green'
          : trafficCycle < 13.0
          ? 'ns_yellow'
          : trafficCycle < 23.0
          ? 'ew_green'
          : 'ew_yellow';

      if (currentTrafficPhase !== trafficSignalPhaseRef.current) {
        trafficSignalPhaseRef.current = currentTrafficPhase;
        setTrafficSignalPhase(currentTrafficPhase);
      }

      for (let tIdx = 0; tIdx < trafficSignalVisuals.length; tIdx++) {
        const tl = trafficSignalVisuals[tIdx];
        const isGreen =
          (tl.axis === 'ns' && currentTrafficPhase === 'ns_green') ||
          (tl.axis === 'ew' && currentTrafficPhase === 'ew_green');
        const isYellow =
          (tl.axis === 'ns' && currentTrafficPhase === 'ns_yellow') ||
          (tl.axis === 'ew' && currentTrafficPhase === 'ew_yellow');
        const isRed = !isGreen && !isYellow;

        tl.redLensMat.emissiveIntensity = isRed ? 2.8 : 0.08;
        tl.yellowLensMat.emissiveIntensity = isYellow ? 2.6 : 0.08;
        tl.greenLensMat.emissiveIntensity = isGreen ? 2.8 : 0.08;
        tl.pedSignalMat.emissiveIntensity = isRed ? 2.2 : 0.15;
      }

      // Helper: Returns true if a vehicle at (vx, vz) heading along (dirX, dirZ) should halt at a Red/Yellow 3D Traffic Light Stop Bar!
      const shouldVehicleStopForTrafficLight = (
        vx: number,
        vz: number,
        dirX: number,
        dirZ: number
      ): boolean => {
        const isMovingNS = Math.abs(dirZ) >= Math.abs(dirX);
        const lightIsRedOrYellow = isMovingNS
          ? currentTrafficPhase !== 'ns_green'
          : currentTrafficPhase !== 'ew_green';
        if (!lightIsRedOrYellow) return false;

        for (let i = 0; i < signalIntersections.length; i++) {
          const inter = signalIntersections[i];
          const toIntX = inter.x - vx;
          const toIntZ = inter.z - vz;
          const distToCenter = Math.hypot(toIntX, toIntZ);
          // Check if vehicle is 3.1m..7.8m upstream of the intersection center and heading toward it
          if (distToCenter > 3.1 && distToCenter < 7.8) {
            const dotForward = (toIntX * dirX + toIntZ * dirZ) / distToCenter;
            if (dotForward > 0.78) {
              return true;
            }
          }
        }
        return false;
      };

      // =======================================================================================
      // 5A-CAR. ANIMATE CYBERPUNK SUPERCAR ("CYBER-VALKYRIE GT" 🏎️)
      //         CRITICAL RULE: Car ONLY moves when Player sits inside it AND presses Move!
      // =======================================================================================
      const targetGullwingOpen =
        cyberCarDoorsOpenRef.current || (!isCyberCarMovingRef.current && carGullwingOpenAmount > 0.05)
          ? cyberCarDoorsOpenRef.current
            ? 1.0
            : 0.0
          : 0.0;
      carGullwingOpenAmount = THREE.MathUtils.lerp(
        carGullwingOpenAmount,
        targetGullwingOpen,
        1 - Math.exp(-3.5 * dt)
      );
      leftGullwingPivot.rotation.z = -carGullwingOpenAmount * 1.15;
      rightGullwingPivot.rotation.z = carGullwingOpenAmount * 1.15;
      carCanopyMat.opacity = isRidingCyberCarRef.current ? 0.32 : 0.68;

      carPrevSpeed = carCurrentSpeed;
      let carWaitingAtTrafficLight = false;

      // The Cyber Car ONLY moves if the player is seated inside AND has pressed the Move button!
      const canCyberCarMoveNow =
        isRidingCyberCarRef.current && isCyberCarMovingRef.current;

      const isManualCarSteer =
        canCyberCarMoveNow &&
        (Math.hypot(moveX, moveY) > 0.08 || cyberCarDriveModeRef.current === 'manual');

      if (!canCyberCarMoveNow) {
        // Car is PARKED / STOPPED — smoothly brake to 0 and hold position!
        carCurrentSpeed = THREE.MathUtils.lerp(carCurrentSpeed, 0, 1 - Math.exp(-10 * dt));
        carSteerAngle = THREE.MathUtils.lerp(carSteerAngle, 0, 1 - Math.exp(-8 * dt));
      } else if (isManualCarSteer) {
        const hasStickInput = Math.hypot(moveX, moveY) > 0.08;
        if (hasStickInput && cyberCarDriveModeRef.current !== 'manual') {
          cyberCarDriveModeRef.current = 'manual';
          setCyberCarDriveMode('manual');
          setCyberCarDestLabel('Manual Steering (Joystick / WASD Active)');
        }
        if (hasStickInput) {
          const steerInputAngle = Math.atan2(moveX, moveY) + camOrbit.azimuth;
          const throttleMag = Math.min(1.4, Math.hypot(moveX, moveY) * sprintBonus);
          const targetManualSpeed = 15.6 * throttleMag;
          carCurrentSpeed = THREE.MathUtils.lerp(
            carCurrentSpeed,
            targetManualSpeed,
            1 - Math.exp(-6.5 * dt)
          );
          const stepMove = carCurrentSpeed * dt;
          const nextCarX =
            dreamCruiserGroup.position.x + Math.sin(steerInputAngle) * stepMove;
          const nextCarZ =
            dreamCruiserGroup.position.z + Math.cos(steerInputAngle) * stepMove;
          const clampedCar = clampToWalkableWorld(nextCarX, nextCarZ);

          dreamCruiserGroup.position.x = clampedCar.x;
          dreamCruiserGroup.position.z = clampedCar.z;
          dreamCruiserGroup.position.y =
            getBridgeSurfaceElevation(clampedCar.x, clampedCar.z) + 0.05;

          const yawDiff = normalizeAngle(steerInputAngle - dreamCruiserGroup.rotation.y);
          dreamCruiserGroup.rotation.y += yawDiff * (1 - Math.exp(-8.5 * dt));
          carSteerAngle = THREE.MathUtils.lerp(
            carSteerAngle,
            THREE.MathUtils.clamp(yawDiff * 0.75, -0.48, 0.48),
            1 - Math.exp(-10 * dt)
          );
          carRoll = THREE.MathUtils.lerp(
            carRoll,
            THREE.MathUtils.clamp(-yawDiff * 0.16, -0.09, 0.09),
            1 - Math.exp(-9 * dt)
          );
        } else {
          // Manual mode with no stick input -> smooth coasting deceleration
          carCurrentSpeed = THREE.MathUtils.lerp(carCurrentSpeed, 0, 1 - Math.exp(-7 * dt));
          carSteerAngle = THREE.MathUtils.lerp(carSteerAngle, 0, 1 - Math.exp(-8 * dt));
          if (carCurrentSpeed > 0.08) {
            const stepMove = carCurrentSpeed * dt;
            const clampedCar = clampToWalkableWorld(
              dreamCruiserGroup.position.x + Math.sin(dreamCruiserGroup.rotation.y) * stepMove,
              dreamCruiserGroup.position.z + Math.cos(dreamCruiserGroup.rotation.y) * stepMove
            );
            dreamCruiserGroup.position.x = clampedCar.x;
            dreamCruiserGroup.position.z = clampedCar.z;
          }
        }
      } else {
        // Player is Seated Inside + Move Button ON + Auto-Cruise Mode (Whole-Map Grand Tour or Destination)
        let targetWp: [number, number] = carHighwayWaypoints[carWaypointIndex];
        const customDest = cyberCarTargetPointRef.current;

        if (customDest) {
          const cx = dreamCruiserGroup.position.x;
          const cz = dreamCruiserGroup.position.z;
          // Routing to Hidden Leaf Ninja Village (z < -100) via the Extended 750m Northern Shinobi Highway (x = 0)
          if (customDest[1] < -100) {
            if (cx > 55) {
              // First cross Golden Horizon Bridge back to Gemini City
              targetWp = Math.abs(cz) > 3.2 ? [140, -1.65] : [10.5, -1.65];
            } else if (cz > -38 && Math.abs(cx) > 3.5) {
              // Align with North Avenue entrance at (0, -38.5)
              targetWp = [0, -38.5];
            } else if (cz > -792) {
              // Cruise straight north along the 750m scenic Shinobi Highway through the Great Gate!
              targetWp = [0, -796];
            } else {
              targetWp = customDest;
            }
          } else if (cz < -52 && customDest[1] >= -52) {
            // Returning South from Hidden Leaf Ninja Village / Shinobi Highway to Gemini City or City 2
            if (cz < -792 && Math.abs(cx) > 4.5) {
              targetWp = [0, -794];
            } else {
              targetWp = [0, -36];
            }
          } else if (cx < 56 && customDest[0] > 62 && Math.abs(cz) > 3.2) {
            targetWp = [56, 1.65];
          } else if (cx >= 54 && cx < 138 && customDest[0] > 140) {
            targetWp = [142, 1.65];
          } else if (cx > 140 && customDest[0] < 134 && Math.abs(cz) > 3.2) {
            targetWp = [140, -1.65];
          } else if (cx <= 142 && cx > 58 && customDest[0] < 54) {
            targetWp = [54, -1.65];
          } else {
            targetWp = customDest;
          }
        }

        const carDx = targetWp[0] - dreamCruiserGroup.position.x;
        const carDz = targetWp[1] - dreamCruiserGroup.position.z;
        const carDist = Math.hypot(carDx, carDz);

        if (carDist < 1.8) {
          if (customDest) {
            const distToFinal = Math.hypot(
              customDest[0] - dreamCruiserGroup.position.x,
              customDest[1] - dreamCruiserGroup.position.z
            );
            if (distToFinal < 2.2) {
              // Arrived at chosen destination -> automatically park & stop the car!
              cyberCarTargetPointRef.current = null;
              setIsCyberCarMoving(false);
              isCyberCarMovingRef.current = false;
              carCurrentSpeed = 0;
              setCyberCarDestLabel('Arrived & Parked — Press Move to Drive Again!');
            }
          } else {
            carWaypointIndex = (carWaypointIndex + 1) % carHighwayWaypoints.length;
          }
        } else {
          const dirX = carDx / carDist;
          const dirZ = carDz / carDist;
          carWaitingAtTrafficLight = shouldVehicleStopForTrafficLight(
            dreamCruiserGroup.position.x,
            dreamCruiserGroup.position.z,
            dirX,
            dirZ
          );

          const isBridgeSpan =
            dreamCruiserGroup.position.x > 52 && dreamCruiserGroup.position.x < 144;
          const isShinobiHighway = dreamCruiserGroup.position.z < -42;
          const desiredCruiseSpeed = carWaitingAtTrafficLight
            ? 0
            : isShinobiHighway
            ? 24.5
            : isBridgeSpan
            ? 15.2
            : 11.4;

          carCurrentSpeed = THREE.MathUtils.lerp(
            carCurrentSpeed,
            desiredCruiseSpeed,
            1 - Math.exp((carWaitingAtTrafficLight ? -8.5 : -5.0) * dt)
          );

          const stepMove = Math.min(carDist, carCurrentSpeed * dt);
          dreamCruiserGroup.position.x += dirX * stepMove;
          dreamCruiserGroup.position.z += dirZ * stepMove;
          dreamCruiserGroup.position.y =
            getBridgeSurfaceElevation(
              dreamCruiserGroup.position.x,
              dreamCruiserGroup.position.z
            ) + 0.05;

          const desiredCarYaw = Math.atan2(dirX, dirZ);
          const yawDiff = normalizeAngle(desiredCarYaw - dreamCruiserGroup.rotation.y);
          if (carCurrentSpeed > 0.25) {
            dreamCruiserGroup.rotation.y += yawDiff * (1 - Math.exp(-7.5 * dt));
          }
          carSteerAngle = THREE.MathUtils.lerp(
            carSteerAngle,
            THREE.MathUtils.clamp(yawDiff * 0.72, -0.45, 0.45),
            1 - Math.exp(-9 * dt)
          );
          carRoll = THREE.MathUtils.lerp(
            carRoll,
            THREE.MathUtils.clamp(-yawDiff * 0.14, -0.08, 0.08),
            1 - Math.exp(-8 * dt)
          );
        }
      }

      // Apply Realistic Cyber Car Suspension Pitch, Roll, Wheel Spin, Front Steering Knuckles, Steering Yoke & Active Aero Spoiler!
      const carAccel = (carCurrentSpeed - carPrevSpeed) / Math.max(0.001, dt);
      const targetCarPitch = THREE.MathUtils.clamp(-carAccel * 0.009, -0.04, 0.045);
      carPitch = THREE.MathUtils.lerp(carPitch, targetCarPitch, 1 - Math.exp(-9 * dt));
      if (carCurrentSpeed < 0.2) {
        carRoll = THREE.MathUtils.lerp(carRoll, 0, 1 - Math.exp(-8 * dt));
      }
      carChassisGroup.rotation.x = carPitch;
      carChassisGroup.rotation.z = carRoll;

      // Steer front knuckles & cockpit butterfly yoke
      carSteerGroups[0].rotation.y = carSteerAngle;
      carSteerGroups[1].rotation.y = carSteerAngle;
      carSteeringYokeGroup.rotation.z = -carSteerAngle * 1.65;

      // Spin all 4 treaded wheels proportionally to actual speed
      const carWheelSpinDelta = (carCurrentSpeed * dt) / 0.39;
      for (let w = 0; w < carWheelGroups.length; w++) {
        carWheelGroups[w].rotation.x += carWheelSpinDelta;
      }

      // Active Rear Spoiler Wing deploys at speed (> 6 m/s) or when manually toggled
      const shouldDeployWing = cyberCarWingDeployedRef.current || carCurrentSpeed > 6.5;
      gtWingGroup.position.y = THREE.MathUtils.lerp(
        gtWingGroup.position.y,
        shouldDeployWing ? 0.99 : 0.88,
        1 - Math.exp(-6 * dt)
      );
      gtWingBlade.rotation.x = THREE.MathUtils.lerp(
        gtWingBlade.rotation.x,
        carAccel < -1.2 ? 0.38 : shouldDeployWing ? 0.18 : 0.12,
        1 - Math.exp(-8 * dt)
      );

      // Taillight braking glow & Twin Plasma Exhaust Flames
      const isCarBraking = carAccel < -0.5 || !canCyberCarMoveNow || carWaitingAtTrafficLight;
      carTaillightMat.emissiveIntensity = isCarBraking ? 3.2 : 1.5;
      const flameScale = THREE.MathUtils.clamp(carCurrentSpeed / 11.0, 0.01, 1.35);
      carExhaustFlames.forEach((flame, fIdx) => {
        flame.visible = canCyberCarMoveNow && carCurrentSpeed > 0.4;
        flame.scale.set(
          1,
          flameScale * (0.85 + Math.sin(elapsed * 28 + fIdx) * 0.25),
          1
        );
      });

      // Throttled Telemetry UI sync for Cyber Car Cockpit
      if (isRidingCyberCarRef.current && frameCounter % 10 === 0) {
        const kmh = Math.round(carCurrentSpeed * 6.8);
        const gear: 'P' | 'D' | 'S+' | 'R' = !isCyberCarMovingRef.current
          ? 'P'
          : kmh > 65
          ? 'S+'
          : 'D';
        setCyberCarTelemetry({
          speedKmh: kmh,
          gear,
          trafficLightWait: carWaitingAtTrafficLight,
        });
      }

      // If Player is Riding Inside the Cyberpunk Supercar, lock Player into Left Driver Bucket Seat!
      if (isRidingCyberCarRef.current) {
        const carX = dreamCruiserGroup.position.x;
        const carY = dreamCruiserGroup.position.y;
        const carZ = dreamCruiserGroup.position.z;
        const carYaw = dreamCruiserGroup.rotation.y;
        const cosY = Math.cos(carYaw);
        const sinY = Math.sin(carYaw);

        // Left Driver Bucket Seat: local (-0.42, 0.24, -0.18)
        const seatWorldX = carX + -0.42 * cosY + -0.18 * sinY;
        const seatWorldZ = carZ - -0.42 * sinY + -0.18 * cosY;

        playerState.x = seatWorldX;
        playerState.z = seatWorldZ;
        playerState.y = 0.24;
        playerState.vx = Math.sin(carYaw) * carCurrentSpeed;
        playerState.vz = Math.cos(carYaw) * carCurrentSpeed;
        playerState.rotationY = carYaw;
        playerIsSittingNow = true;

        playerRig.group.position.set(seatWorldX, carY + 0.24, seatWorldZ);
        playerRig.group.rotation.y = carYaw;
        playerRig.group.rotation.x = carPitch;
        playerRig.group.rotation.z = carRoll;
        animateHumanoidRig({
          rig: playerRig,
          isMoving: false,
          moveIntensity: 0,
          isJumping: false,
          verticalVelocity: 0,
          isSliding: false,
          isTalking: Boolean(playerActiveBubbleRef.current),
          isSitting: true,
          lookTargetAngleDelta: cyberCarCompanionIdRef.current ? -0.35 : 0,
          elapsedTime: elapsed,
          deltaTime: dt,
          isSelected: false,
          emote: playerEmoteRef.current,
        });
      }

      // =======================================================================================
      // 5B-ANIM. ANIMATE 5-PASSENGER LUXURY TRANSIT BUS (STOP & PARK AT DEPOT, ENGINE ON/OFF,
      //          TRAFFIC LIGHT STOPPING, KNEELING SUSPENSION & STRICT <6.8M NPC BOARDING!)
      // =======================================================================================
      const currentBusWp = busRouteWaypoints[busWaypointIndex];
      const busDx = currentBusWp[0] - busGroup.position.x;
      const busDz = currentBusWp[1] - busGroup.position.z;
      const busDist = Math.hypot(busDx, busDz);
      const matchingBusStop = BUS_STOPS.find((s) => s.waypointIdx === busWaypointIndex);

      // Sync & Animate 3D Bus Stop Visualizer Markers across the 3D Map
      busStopVisualizerGroup.visible = showBusStopMarkersRef.current;
      if (showBusStopMarkersRef.current) {
        for (let mIdx = 0; mIdx < busStopMarkerVisuals.length; mIdx++) {
          const mv = busStopMarkerVisuals[mIdx];
          const distBusToStop = Math.hypot(
            busGroup.position.x - mv.stop.x,
            busGroup.position.z - mv.stop.z
          );
          const isBusAtThisStop = distBusToStop < 5.5 && (busStopTimer > 0 || isBusParkedRef.current);
          const isBusApproachingThisStop =
            matchingBusStop?.id === mv.stop.id && distBusToStop < 16;

          mv.diamondBeacon.rotation.y =
            elapsed * (isBusAtThisStop ? 3.2 : 1.4) + mIdx * 0.8;
          mv.diamondBeacon.position.y =
            4.15 + Math.sin(elapsed * 2.6 + mIdx) * 0.22;
          const ringScale = isBusAtThisStop
            ? 1.12 + Math.sin(elapsed * 7.5) * 0.12
            : isBusApproachingThisStop
            ? 1.05 + Math.sin(elapsed * 4.5) * 0.07
            : 1.0 + Math.sin(elapsed * 2.2 + mIdx) * 0.03;
          mv.bayRing.scale.set(ringScale, ringScale, 1);
          mv.bayRingMat.opacity = isBusAtThisStop
            ? 0.95
            : isBusApproachingThisStop
            ? 0.82
            : 0.58;
          mv.beaconMat.emissiveIntensity = isBusAtThisStop ? 2.4 : 1.35;
        }
      }

      // Trigger bus stop halt when arriving at any of the 6 official Bus Stops
      if (
        !isBusParkedRef.current &&
        isBusEngineOnRef.current &&
        matchingBusStop &&
        busDist < 1.35 &&
        busLastStoppedWaypoint !== busWaypointIndex &&
        busStopTimer <= 0
      ) {
        busLastStoppedWaypoint = busWaypointIndex;
        busStopTimer = 6.2;
        busStopHandledForCurrentHalt = false;
      }

      busPrevSpeed = busCurrentSpeed;
      let busWaitingAtTrafficLight = false;

      // Helper to execute strict-proximity NPC Boarding & Alighting when bus is stopped/parked with doors open
      const runBusStopBoardingAndAlighting = () => {
        const stopInfo =
          matchingBusStop ||
          BUS_STOPS.reduce((best, s) =>
            Math.hypot(s.x - busGroup.position.x, s.z - busGroup.position.z) <
            Math.hypot(best.x - busGroup.position.x, best.z - busGroup.position.z)
              ? s
              : best
          );

        const currentPassengers = [...busPassengersRef.current];
        const exitingIds: string[] = [];
        const stayingIds: string[] = [];

        currentPassengers.forEach((cid) => {
          busRideStopsCountByChar[cid] = (busRideStopsCountByChar[cid] || 0) + 1;
          if (
            busRideStopsCountByChar[cid] >= 2 ||
            (currentPassengers.length >= 4 && exitingIds.length < 2)
          ) {
            exitingIds.push(cid);
            delete busRideStopsCountByChar[cid];
          } else {
            stayingIds.push(cid);
          }
        });

        // Place exiting NPCs right outside the bus door on the sidewalk!
        if (exitingIds.length > 0) {
          const busYaw = busGroup.rotation.y;
          const rightNormalX = Math.cos(busYaw);
          const rightNormalZ = -Math.sin(busYaw);

          exitingIds.forEach((cid, eIdx) => {
            const exitWorld = clampToWalkableWorld(
              busGroup.position.x + rightNormalX * (2.4 + eIdx * 0.75),
              busGroup.position.z + rightNormalZ * (2.4 + eIdx * 0.75) + (eIdx - 0.5) * 0.9
            );
            if (aiRigs[cid]) {
              aiRigs[cid].group.position.set(
                exitWorld.x,
                getBridgeSurfaceElevation(exitWorld.x, exitWorld.z),
                exitWorld.z
              );
              aiRigs[cid].group.rotation.x = 0;
              aiRigs[cid].group.rotation.z = 0;
            }
          });

          callbacksRef.current.onVehicleTransitEvent?.({
            vehicle: 'bus',
            action: 'exit',
            characterIds: exitingIds,
            x: busGroup.position.x + rightNormalX * 2.5,
            z: busGroup.position.z + rightNormalZ * 2.5,
            locationLabel: stopInfo.name,
          });
        }

        // STRICT PROXIMITY CHECK: NPCs can ONLY board the bus if they are physically close to the bus (<= 6.8m)!
        const seatsAvailable = 5 - stayingIds.length;
        const newlyBoarded: string[] = [];
        if (seatsAvailable > 0) {
          const candidates = charactersRef.current
            .filter((c) => {
              if (stayingIds.includes(c.id) || exitingIds.includes(c.id)) return false;
              if (c.id === selectedCharIdRef.current) return false;
              if (isRidingCyberCarRef.current && c.id === cyberCarCompanionIdRef.current)
                return false;
              const distToBus = getCharacterDistToBus(c.id, c.currentPosition);
              return distToBus <= 6.8; // Must be within 6.8m of the bus to board!
            })
            .sort(
              (a, b) =>
                getCharacterDistToBus(a.id, a.currentPosition) -
                getCharacterDistToBus(b.id, b.currentPosition)
            );

          for (let k = 0; k < Math.min(seatsAvailable, candidates.length); k++) {
            const boardChar = candidates[k];
            newlyBoarded.push(boardChar.id);
            busRideStopsCountByChar[boardChar.id] = 0;
          }
        }

        const updatedPassengerList = [...stayingIds, ...newlyBoarded].slice(0, 5);
        busPassengersRef.current = updatedPassengerList;

        if (newlyBoarded.length > 0) {
          callbacksRef.current.onVehicleTransitEvent?.({
            vehicle: 'bus',
            action: 'board',
            characterIds: newlyBoarded,
            x: busGroup.position.x,
            z: busGroup.position.z,
            locationLabel: stopInfo.name,
          });
        }

        const stopIdxInList = BUS_STOPS.findIndex((s) => s.id === stopInfo.id);
        const nextStopObj =
          BUS_STOPS[(stopIdxInList + 1 + BUS_STOPS.length) % BUS_STOPS.length];

        setBusUiStatus({
          passengerIds: updatedPassengerList,
          phase: isBusParkedRef.current ? 'parked_depot' : 'doors_open',
          stopName: isBusParkedRef.current
            ? 'Parked (Engine OFF — Turn ON to Move)'
            : `Stopped at ${stopInfo.name}`,
          activeStopId: isBusParkedRef.current ? null : stopInfo.id,
          nextStopId: nextStopObj?.id || null,
          speedKmh: 0,
        });
      };

      // Case 1: Bus is Parked at Depot or Stopped with Engine OFF -> Hold stationary until user turns Engine ON!
      if (isBusParkedRef.current || !isBusEngineOnRef.current) {
        busCurrentSpeed = THREE.MathUtils.lerp(busCurrentSpeed, 0, 1 - Math.exp(-9 * dt));
        busDoorOpenProgress = THREE.MathUtils.lerp(
          busDoorOpenProgress,
          1,
          1 - Math.exp(-7 * dt)
        );
        busSteerGroups[0].rotation.y = THREE.MathUtils.lerp(busSteerGroups[0].rotation.y, 0, 0.1);
        busSteerGroups[1].rotation.y = THREE.MathUtils.lerp(busSteerGroups[1].rotation.y, 0, 0.1);
        busSteeringWheel.rotation.z = THREE.MathUtils.lerp(busSteeringWheel.rotation.z, 0, 0.1);
        if (!busStopHandledForCurrentHalt && busDoorOpenProgress > 0.6) {
          busStopHandledForCurrentHalt = true;
          runBusStopBoardingAndAlighting();
        }
      } else if (busStopTimer > 0) {
        // Case 2: Bus is temporarily halted at a Bus Stop or on-demand stop
        busStopTimer = Math.max(0, busStopTimer - dt);
        busCurrentSpeed = THREE.MathUtils.lerp(busCurrentSpeed, 0, 1 - Math.exp(-8 * dt));
        busDoorOpenProgress = THREE.MathUtils.lerp(
          busDoorOpenProgress,
          busStopTimer > 0.7 ? 1 : 0,
          1 - Math.exp(-7 * dt)
        );

        // Gently guide any nearby idle NPC within 14m toward the bus doorway so they can walk close enough (<6.8m) to board!
        if (busPassengersRef.current.length < 5) {
          const busYaw = busGroup.rotation.y;
          const doorWorldX = busGroup.position.x + Math.cos(busYaw) * 2.1 + Math.sin(busYaw) * 1.75;
          const doorWorldZ = busGroup.position.z - Math.sin(busYaw) * 2.1 + Math.cos(busYaw) * 1.75;
          charactersRef.current.forEach((c) => {
            if (busPassengersRef.current.includes(c.id)) return;
            if (c.id === selectedCharIdRef.current) return;
            const rig = aiRigs[c.id];
            if (!rig) return;
            const distToDoor = Math.hypot(
              rig.group.position.x - doorWorldX,
              rig.group.position.z - doorWorldZ
            );
            if (distToDoor > 2.2 && distToDoor < 13.5 && !c.isSitting) {
              const stepWalk = Math.min(distToDoor - 1.8, 2.2 * dt);
              rig.group.position.x += ((doorWorldX - rig.group.position.x) / distToDoor) * stepWalk;
              rig.group.position.z += ((doorWorldZ - rig.group.position.z) / distToDoor) * stepWalk;
            }
          });
        }

        if (!busStopHandledForCurrentHalt && busDoorOpenProgress > 0.55) {
          busStopHandledForCurrentHalt = true;
          runBusStopBoardingAndAlighting();
        }

        if (busStopTimer <= 0.05) {
          busWaypointIndex = (busWaypointIndex + 1) % busRouteWaypoints.length;
          const upcomingStop =
            BUS_STOPS.find((s) => s.waypointIdx >= busWaypointIndex) || BUS_STOPS[0];
          setBusUiStatus((prev) => ({
            ...prev,
            phase: 'driving',
            activeStopId: null,
            nextStopId: upcomingStop.id,
            stopName: `En Route → ${upcomingStop.shortName}`,
            speedKmh: 48,
          }));
        }
      } else if (
        isRidingBusRef.current &&
        (busDriveModeRef.current === 'manual' || Math.hypot(moveX, moveY) > 0.08)
      ) {
        // Case 3: Player is Riding Inside the Bus and Driving Manually with Joystick / WASD!
        if (Math.hypot(moveX, moveY) > 0.08 && busDriveModeRef.current !== 'manual') {
          busDriveModeRef.current = 'manual';
          setBusDriveMode('manual');
        }
        busDoorOpenProgress = THREE.MathUtils.lerp(busDoorOpenProgress, 0, 1 - Math.exp(-8 * dt));
        if (Math.hypot(moveX, moveY) > 0.08) {
          const steerInputAngle = Math.atan2(moveX, moveY) + camOrbit.azimuth;
          const throttleMag = Math.min(1.25, Math.hypot(moveX, moveY) * sprintBonus);
          busCurrentSpeed = THREE.MathUtils.lerp(
            busCurrentSpeed,
            9.2 * throttleMag,
            1 - Math.exp(-4.8 * dt)
          );
          const stepMove = busCurrentSpeed * dt;
          const nextBus = clampToWalkableWorld(
            busGroup.position.x + Math.sin(steerInputAngle) * stepMove,
            busGroup.position.z + Math.cos(steerInputAngle) * stepMove
          );
          busGroup.position.x = nextBus.x;
          busGroup.position.z = nextBus.z;
          busGroup.position.y = getBridgeSurfaceElevation(nextBus.x, nextBus.z) + 0.04;

          const busYawDiff = normalizeAngle(steerInputAngle - busGroup.rotation.y);
          busGroup.rotation.y += busYawDiff * (1 - Math.exp(-5.0 * dt));
          const frontSteerAngle = THREE.MathUtils.clamp(busYawDiff * 0.68, -0.44, 0.44);
          busSteerGroups[0].rotation.y = frontSteerAngle;
          busSteerGroups[1].rotation.y = frontSteerAngle;
          busSteeringWheel.rotation.z = -frontSteerAngle * 1.8;

          const busWheelSpin = stepMove / 0.46;
          for (let w = 0; w < busWheelGroups.length; w++) {
            busWheelGroups[w].rotation.x += busWheelSpin;
          }
          busRoll = THREE.MathUtils.lerp(
            busRoll,
            THREE.MathUtils.clamp(-busYawDiff * 0.14, -0.08, 0.08),
            1 - Math.exp(-6.5 * dt)
          );
        } else {
          busCurrentSpeed = THREE.MathUtils.lerp(busCurrentSpeed, 0, 1 - Math.exp(-6 * dt));
          busSteerGroups[0].rotation.y = THREE.MathUtils.lerp(busSteerGroups[0].rotation.y, 0, 0.12);
          busSteerGroups[1].rotation.y = THREE.MathUtils.lerp(busSteerGroups[1].rotation.y, 0, 0.12);
          busSteeringWheel.rotation.z = THREE.MathUtils.lerp(busSteeringWheel.rotation.z, 0, 0.12);
        }
      } else {
        // Case 4: Autonomous Inter-City Bus Route Loop (Obeys Red 3D Traffic Lights 🚦⛔!)
        busDoorOpenProgress = THREE.MathUtils.lerp(
          busDoorOpenProgress,
          0,
          1 - Math.exp(-8 * dt)
        );

        if (busDist < 1.35) {
          busLastStoppedWaypoint = -1;
          busWaypointIndex = (busWaypointIndex + 1) % busRouteWaypoints.length;
        } else {
          const dirX = busDx / busDist;
          const dirZ = busDz / busDist;
          busWaitingAtTrafficLight = shouldVehicleStopForTrafficLight(
            busGroup.position.x,
            busGroup.position.z,
            dirX,
            dirZ
          );

          const isBridgeSegment = busGroup.position.x > 52 && busGroup.position.x < 144;
          const isApproachingStop = Boolean(matchingBusStop && busDist < 9.5);
          const targetBusSpeed = busWaitingAtTrafficLight
            ? 0
            : isApproachingStop
            ? THREE.MathUtils.clamp((busDist / 9.5) * 6.5, 1.4, 6.5)
            : isBridgeSegment
            ? 8.8
            : 6.4;

          busCurrentSpeed = THREE.MathUtils.lerp(
            busCurrentSpeed,
            targetBusSpeed,
            1 - Math.exp((busWaitingAtTrafficLight ? -7.5 : -4.2) * dt)
          );
          const stepMove = Math.min(busDist, busCurrentSpeed * dt);

          busGroup.position.x += dirX * stepMove;
          busGroup.position.z += dirZ * stepMove;
          busGroup.position.y =
            getBridgeSurfaceElevation(busGroup.position.x, busGroup.position.z) + 0.04;

          const desiredBusYaw = Math.atan2(dirX, dirZ);
          const busYawDiff = normalizeAngle(desiredBusYaw - busGroup.rotation.y);
          if (busCurrentSpeed > 0.2) {
            busGroup.rotation.y += busYawDiff * (1 - Math.exp(-5.2 * dt));
          }

          // Steer front coach steering knuckles & interior driver steering wheel cleanly without wheel wobble!
          const frontSteerAngle = THREE.MathUtils.clamp(busYawDiff * 0.65, -0.42, 0.42);
          busSteerGroups[0].rotation.y = frontSteerAngle;
          busSteerGroups[1].rotation.y = frontSteerAngle;
          busSteeringWheel.rotation.z = -frontSteerAngle * 1.8;

          // Spin all 6 heavy-duty treaded bus wheels proportionally to distance traveled
          const busWheelSpin = stepMove / 0.46;
          for (let w = 0; w < busWheelGroups.length; w++) {
            busWheelGroups[w].rotation.x += busWheelSpin;
          }

          // Realistic Air-Suspension Body Roll in corners
          const targetBusRoll = THREE.MathUtils.clamp(
            -busYawDiff * (busCurrentSpeed / 8.0) * 0.16,
            -0.085,
            0.085
          );
          busRoll = THREE.MathUtils.lerp(busRoll, targetBusRoll, 1 - Math.exp(-6.5 * dt));
        }
      }

      // Realistic Pneumatic Kneeling Air-Suspension (Kneels toward right curb when stopped/parked!)
      const shouldKneelBus =
        busDoorOpenProgress > 0.25 || isBusParkedRef.current || !isBusEngineOnRef.current;
      busKneelOffset = THREE.MathUtils.lerp(
        busKneelOffset,
        shouldKneelBus ? 1.0 : 0.0,
        1 - Math.exp(-5.5 * dt)
      );

      // Realistic Air-Suspension Longitudinal Pitch (Nose-Dive when Braking, Squat when Accelerating, Pneumatic Settle)
      const busLongitudinalAccel = (busCurrentSpeed - busPrevSpeed) / Math.max(0.001, dt);
      const pneumaticSettle =
        busStopTimer > 4.2
          ? Math.sin((6.2 - busStopTimer) * 7.5) * 0.018 * Math.exp(-(6.2 - busStopTimer) * 1.5)
          : 0;
      const roadMicroWave =
        Math.sin(elapsed * 8.5) * 0.004 * THREE.MathUtils.clamp(busCurrentSpeed / 6.0, 0, 1);
      const targetBusPitch =
        THREE.MathUtils.clamp(-busLongitudinalAccel * 0.011, -0.042, 0.052) +
        pneumaticSettle +
        roadMicroWave;
      busPitch = THREE.MathUtils.lerp(busPitch, targetBusPitch, 1 - Math.exp(-7.5 * dt));

      if (busStopTimer > 0 || isBusParkedRef.current || !isBusEngineOnRef.current) {
        busRoll = THREE.MathUtils.lerp(
          busRoll,
          -busKneelOffset * 0.045, // Gentle pneumatic curb-kneel tilt toward the right doorway!
          1 - Math.exp(-6 * dt)
        );
      }

      busChassisGroup.rotation.x = busPitch;
      busChassisGroup.rotation.z = busRoll;
      busChassisGroup.position.y =
        -busKneelOffset * 0.075 +
        Math.abs(pneumaticSettle) * 0.8 +
        Math.sin(elapsed * 6.2) * 0.008 * THREE.MathUtils.clamp(busCurrentSpeed / 6.0, 0, 1);

      // Animate Bi-Fold Sliding Glass Entry Doors & Extendable Yellow Curbside Boarding Ramp!
      busDoorFrontLeaf.position.z = 2.04 + busDoorOpenProgress * 0.42;
      busDoorFrontLeaf.position.x = 1.18 + busDoorOpenProgress * 0.08;
      busDoorRearLeaf.position.z = 1.52 - busDoorOpenProgress * 0.42;
      busDoorRearLeaf.position.x = 1.18 + busDoorOpenProgress * 0.08;
      busBoardingRamp.position.x = 0.92 + busDoorOpenProgress * 0.54;
      busBoardingRamp.rotation.z = -busDoorOpenProgress * 0.12;

      // Animate Windshield Wipers during Rainy Weather
      const wiperAngle =
        currentWeather === 'rainy' ? Math.sin(elapsed * 6.5) * 0.58 : 0;
      busWiperPivots.forEach((wp) => {
        wp.rotation.z = THREE.MathUtils.lerp(wp.rotation.z, wiperAngle, 0.2);
      });

      const isBusBrakingOrStopped =
        busLongitudinalAccel < -0.4 ||
        busStopTimer > 0 ||
        isBusParkedRef.current ||
        !isBusEngineOnRef.current ||
        busWaitingAtTrafficLight;
      busBrakeLightMat.emissiveIntensity = isBusBrakingOrStopped ? 2.8 : 1.1;
      busBlinkerMat.emissiveIntensity =
        busStopTimer > 0 ||
        isBusParkedRef.current ||
        (matchingBusStop && busDist < 8.5)
          ? Math.sin(elapsed * 10) > 0
            ? 2.6
            : 0.2
          : 0.85;

      // If Player is Riding Inside the 5-Passenger Bus, place Player in Front Co-Pilot Panoramic Seat!
      if (isRidingBusRef.current) {
        const bX = busGroup.position.x;
        const bY = busGroup.position.y + busChassisGroup.position.y;
        const bZ = busGroup.position.z;
        const bYaw = busGroup.rotation.y;
        const cosB = Math.cos(bYaw);
        const sinB = Math.sin(bYaw);

        const pBusX = bX + 0.62 * cosB + 2.35 * sinB;
        const pBusZ = bZ - 0.62 * sinB + 2.35 * cosB;

        playerState.x = pBusX;
        playerState.z = pBusZ;
        playerState.y = 0.35;
        playerState.vx = Math.sin(bYaw) * busCurrentSpeed;
        playerState.vz = Math.cos(bYaw) * busCurrentSpeed;
        playerState.rotationY = bYaw;
        playerIsSittingNow = true;

        playerRig.group.position.set(pBusX, bY + 0.35, pBusZ);
        playerRig.group.rotation.y = bYaw;
        playerRig.group.rotation.x = busPitch;
        playerRig.group.rotation.z = busRoll;
        animateHumanoidRig({
          rig: playerRig,
          isMoving: false,
          moveIntensity: 0,
          isJumping: false,
          verticalVelocity: 0,
          isSliding: false,
          isTalking: Boolean(playerActiveBubbleRef.current),
          isSitting: true,
          lookTargetAngleDelta: 0,
          elapsedTime: elapsed,
          deltaTime: dt,
          isSelected: false,
          emote: playerEmoteRef.current,
        });
      } else if (!isRidingCyberCarRef.current) {
        playerRig.group.rotation.x = 0;
      }

      // Gentle sea-breeze sway on nearby 3D Forest Trees (throttled to 30Hz & distance-culled)
      if (frameCounter % 2 === 1) {
        for (let idx = 0; idx < forestTrees.length; idx++) {
          const tree = forestTrees[idx];
          if (Math.abs(tree.position.x - camOrbit.focusX) < 75) {
            tree.rotation.z = Math.sin(elapsed * 1.3 + idx * 0.7) * 0.016;
          }
        }
      }

      if (frameCounter % 4 === 0) {
        Object.values(CITY_BUILDINGS).forEach((b) => {
          if (b.id === 'park') return;
          const cutaway = buildingCutawayRefs[b.id];
          if (!cutaway) return;

          const playerDistToHouse = Math.hypot(
            playerState.x - b.position[0],
            playerState.z - b.position[2]
          );
          const isPlayerInsideThisHouse =
            playerDistToHouse < Math.max(b.size[0], b.size[2]) * 0.58;
          const isSelectedHouse = selectedBuildingIdRef.current === b.id;
          const hasSelectedResidentInside = charactersRef.current.some(
            (c) =>
              c.id === selectedCharIdRef.current &&
              c.currentLocationId === b.id &&
              c.isInsideHouse
          );
          const hasAnyResidentInside = charactersRef.current.some(
            (c) => c.currentLocationId === b.id && c.isInsideHouse
          );

          const shouldOpenRoof =
            insideHouseModeRef.current ||
            isPlayerInsideThisHouse ||
            isSelectedHouse ||
            hasSelectedResidentInside ||
            (hasAnyResidentInside && b.category === 'residence');

          if (cutaway.roofGroup.visible === shouldOpenRoof) {
            cutaway.roofGroup.visible = !shouldOpenRoof;
            cutaway.frontUpperWall.visible = !shouldOpenRoof;
            renderer.shadowMap.needsUpdate = true;
          }
        });
      }

      // Sync & Animate AI-Created 3D World Objects (No floating text labels; tap object to inspect)
      createdObjectsRef.current.forEach((obj, idx) => {
        let meshGroup = createdMeshesById[obj.id];
        if (!meshGroup) {
          meshGroup = buildCreatedObjectMesh(obj);
          createdObjectsGroup.add(meshGroup);
          createdMeshesById[obj.id] = meshGroup;
          renderer.shadowMap.needsUpdate = true;
        }
        if (Math.abs(obj.position.x - camOrbit.focusX) < 72) {
          const spinPart = meshGroup.getObjectByName('spin_part');
          if (spinPart) {
            spinPart.rotation.y = elapsed * 1.6 + idx;
            spinPart.position.y =
              (obj.category === 'solar_bot' ? 1.02 : 1.55) + Math.sin(elapsed * 2.5 + idx) * 0.08;
          }
        }
      });

      // C. Update AI Residents Positions (True 60FPS Continuous Velocity Steering & Turn Banking), Live Appearance Edits & Player Look-At
      let closestCharId: string | null = null;
      let closestDist = 4.6;
      const nowPerfMs = Date.now();

      charactersRef.current.forEach((char) => {
        let rig = aiRigs[char.id];
        if (!rig) {
          rig = createHumanoidRig({
            id: char.id,
            isPlayer: false,
            outfitColor: char.outfitColor,
            accentColor: char.accentColor,
            hairColor: char.hairColor,
            skinColor: char.skinColor,
            scale: char.scale,
            aoTexture: aoShadowTex,
          });
          rig.group.position.set(char.currentPosition.x, 0, char.currentPosition.z);
          rig.animState.lastWorldX = char.currentPosition.x;
          rig.animState.lastWorldZ = char.currentPosition.z;
          scene.add(rig.group);
          pickableObjects.push(...rig.pickMeshes);
          aiRigs[char.id] = rig;
        }

        const activeWardrobe = getResidentWeatherWardrobe(char, weatherRef.current);
        updateHumanoidRigAppearance(rig, {
          skinColor: char.skinColor,
          outfitColor: activeWardrobe.outfitColor,
          accentColor: activeWardrobe.accentColor,
          pantsColor: activeWardrobe.pantsColor,
          shoesColor: activeWardrobe.shoesColor,
          hairColor: char.hairColor,
          scale: char.scale,
          weather: weatherRef.current,
        });

        const prevX = rig.group.position.x;
        const prevZ = rig.group.position.z;

        // Check if this NPC is currently seated inside the Cyberpunk Supercar (with Player) OR inside one of the 5 Bus Seats!
        const isCarPassenger =
          isRidingCyberCarRef.current && cyberCarCompanionIdRef.current === char.id;
        const busSeatIdx = busPassengersRef.current.indexOf(char.id);
        const isBusPassenger = !isCarPassenger && busSeatIdx !== -1 && busSeatIdx < 5;

        if (isCarPassenger) {
          const carX = dreamCruiserGroup.position.x;
          const carY = dreamCruiserGroup.position.y;
          const carZ = dreamCruiserGroup.position.z;
          const carYaw = dreamCruiserGroup.rotation.y;
          const cosY = Math.cos(carYaw);
          const sinY = Math.sin(carYaw);

          // Right Passenger Bucket Seat inside Cyber-Valkyrie GT: local (+0.42, 0.24, -0.18)
          const compX = carX + 0.42 * cosY + -0.18 * sinY;
          const compZ = carZ - 0.42 * sinY + -0.18 * cosY;

          rig.group.position.set(compX, carY + 0.24, compZ);
          rig.group.rotation.y = carYaw;
          rig.group.rotation.x = 0;
          rig.group.rotation.z = dreamCruiserGroup.rotation.z;
          rig.animState.smoothedSpeed = 0;

          animateHumanoidRig({
            rig,
            isMoving: false,
            moveIntensity: 0,
            isTalking: true,
            isSitting: true,
            lookTargetAngleDelta: 0.42, // Look warmly toward John in the driver seat!
            elapsedTime: elapsed,
            deltaTime: dt,
            isSelected: selectedCharIdRef.current === char.id,
            emotion: 'Affection',
            emotionIntensity: 95,
            emote: 'none',
            isDistant: false,
          });

          projectToDOM(
            rig.group.position.x,
            2.48 * char.scale + rig.group.position.y,
            rig.group.position.z,
            charLabelRefs.current[char.id] || null,
            120
          );
          return;
        }

        if (isBusPassenger) {
          const seatDef = BUS_SEAT_OFFSETS[busSeatIdx];
          const bX = busGroup.position.x;
          const bY = busGroup.position.y + busChassisGroup.position.y;
          const bZ = busGroup.position.z;
          const bYaw = busGroup.rotation.y;
          const cosB = Math.cos(bYaw);
          const sinB = Math.sin(bYaw);

          const seatWorldX = bX + seatDef.x * cosB + seatDef.z * sinB;
          const seatWorldZ = bZ - seatDef.x * sinB + seatDef.z * cosB;

          rig.group.position.set(seatWorldX, bY + seatDef.y, seatWorldZ);
          rig.group.rotation.y = bYaw;
          rig.group.rotation.x = busPitch;
          rig.group.rotation.z = busRoll;
          rig.animState.smoothedSpeed = 0;

          const isSel = selectedCharIdRef.current === char.id;
          animateHumanoidRig({
            rig,
            isMoving: false,
            moveIntensity: 0,
            isTalking: char.isTalking || isSel || busStopTimer > 0,
            isSitting: true,
            lookTargetAngleDelta: seatDef.x < 0 ? -0.25 : 0.25,
            elapsedTime: elapsed,
            deltaTime: dt,
            isSelected: isSel,
            emotion: char.emotionalState?.primary || 'Happiness',
            emotionIntensity: 82,
            emote: 'none',
            isDistant: false,
          });

          projectToDOM(
            rig.group.position.x,
            2.55 * char.scale + rig.group.position.y,
            rig.group.position.z,
            charLabelRefs.current[char.id] || null,
            isSel ? 300 : 85
          );
          return;
        }

        rig.group.rotation.x = 0;

        // Smooth 60FPS continuous steering toward target/waypoint so residents never stutter or step discretely
        const goalX = char.isMoving && char.targetPosition ? char.targetPosition.x : char.currentPosition.x;
        const goalZ = char.isMoving && char.targetPosition ? char.targetPosition.z : char.currentPosition.z;
        const toWayX = char.currentPosition.x - prevX;
        const toWayZ = char.currentPosition.z - prevZ;
        const distToWaypoint = Math.hypot(toWayX, toWayZ);

        let nextX = prevX;
        let nextZ = prevZ;

        if (distToWaypoint > 18) {
          // Instant teleport if resident was reset or jumped across cities via modal action
          nextX = char.currentPosition.x;
          nextZ = char.currentPosition.z;
        } else if (distToWaypoint > 0.015) {
          const isBridgeCruising =
            (prevX > 50 && prevX < 148) ||
            char.dreamState?.carTripStatus === 'visiting_gemini';
          const maxAiSpeed = isBridgeCruising ? 6.2 : 2.35;
          const desiredStep = Math.min(
            distToWaypoint,
            Math.max(distToWaypoint * 5.2, Math.min(maxAiSpeed, distToWaypoint * 2.8)) * dt
          );
          nextX = prevX + (toWayX / distToWaypoint) * desiredStep;
          nextZ = prevZ + (toWayZ / distToWaypoint) * desiredStep;
        } else if (char.isMoving) {
          const dxG = goalX - prevX;
          const dzG = goalZ - prevZ;
          const dGoal = Math.hypot(dxG, dzG);
          if (dGoal > 0.25) {
            const glideSpeed = Math.min(1.85, dGoal * 1.4) * dt;
            nextX = prevX + (dxG / dGoal) * glideSpeed;
            nextZ = prevZ + (dzG / dGoal) * glideSpeed;
          }
        }

        // Funnel AI residents cleanly across the Golden Horizon Bridge when traversing between City 1 and City 2
        if (nextX > 52 && nextX < 146) {
          nextZ = THREE.MathUtils.clamp(nextZ, -2.6, 2.6);
        }

        // Verify physical 3D seat under the character before allowing sitting (NEVER sit in thin air!)
        const verifiedSeat =
          char.isSitting && !char.isMoving
            ? findNearestSeatForPosition(char.currentPosition.x, char.currentPosition.z, 1.55)
            : null;
        if (verifiedSeat && Math.hypot(verifiedSeat.x - nextX, verifiedSeat.z - nextZ) < 0.85) {
          nextX = THREE.MathUtils.lerp(nextX, verifiedSeat.x, 1 - Math.exp(-14 * dt));
          nextZ = THREE.MathUtils.lerp(nextZ, verifiedSeat.z, 1 - Math.exp(-14 * dt));
        }

        const aiBridgeY = getBridgeSurfaceElevation(nextX, nextZ);
        rig.group.position.set(nextX, aiBridgeY, nextZ);

        // Compute real-time world velocity for smooth walk-to-idle blend weight
        const frameSpeed = Math.hypot(nextX - prevX, nextZ - prevZ) / Math.max(0.001, dt);
        rig.animState.smoothedSpeed = THREE.MathUtils.lerp(
          rig.animState.smoothedSpeed,
          frameSpeed,
          1 - Math.exp(-11 * dt)
        );
        const aiMoveIntensity = THREE.MathUtils.clamp(rig.animState.smoothedSpeed / 2.05, 0, 1.15);
        const aiActuallyMoving =
          !verifiedSeat &&
          (rig.animState.smoothedSpeed > 0.12 || (char.isMoving && distToWaypoint > 0.08));

        const dToPlayer = Math.hypot(
          rig.group.position.x - playerState.x,
          rig.group.position.z - playerState.z
        );
        if (dToPlayer < closestDist) {
          closestDist = dToPlayer;
          closestCharId = char.id;
        }

        const isSel = selectedCharIdRef.current === char.id;
        const isCloseToPlayer = dToPlayer < 5.2 || isSel;
        const dToFocus = Math.hypot(
          rig.group.position.x - camOrbit.focusX,
          rig.group.position.z - camOrbit.focusZ
        );

        // Orient toward movement velocity when walking, seat forward angle when sitting, or partner/player when standing
        let targetBodyRotY = verifiedSeat
          ? verifiedSeat.rotationY
          : rig.animState.smoothedSpeed > 0.18
          ? Math.atan2(nextX - prevX, nextZ - prevZ)
          : char.rotationY;
        let headLookDelta: number | null = null;

        const partnerRig =
          char.conversingWithId && char.conversingWithId !== 'player'
            ? aiRigs[char.conversingWithId]
            : null;

        if (verifiedSeat) {
          // While seated on a 3D bench/chair, keep body/legs facing forward on the seat and turn head/upper torso toward partner or John!
          if (partnerRig) {
            const angleToPartner = Math.atan2(
              partnerRig.group.position.x - rig.group.position.x,
              partnerRig.group.position.z - rig.group.position.z
            );
            headLookDelta = normalizeAngle(angleToPartner - rig.group.rotation.y);
          } else if (dToPlayer < 6.5 || char.conversingWithId === 'player') {
            const angleToPlayer = Math.atan2(
              playerState.x - rig.group.position.x,
              playerState.z - rig.group.position.z
            );
            headLookDelta = normalizeAngle(angleToPlayer - rig.group.rotation.y);
          }
        } else if (partnerRig && !aiActuallyMoving) {
          const angleToPartner = Math.atan2(
            partnerRig.group.position.x - rig.group.position.x,
            partnerRig.group.position.z - rig.group.position.z
          );
          targetBodyRotY = angleToPartner;
          headLookDelta = normalizeAngle(angleToPartner - rig.group.rotation.y);
        }

        const rotDiff = normalizeAngle(targetBodyRotY - rig.group.rotation.y);
        rig.group.rotation.y += rotDiff * (1 - Math.exp(-10 * dt));

        // Subtle realistic turn-banking on AI residents while walking around corners
        const aiBank = THREE.MathUtils.clamp(-rotDiff * aiMoveIntensity * 0.16, -0.14, 0.14);
        rig.group.rotation.z = THREE.MathUtils.lerp(
          rig.group.rotation.z,
          aiActuallyMoving ? aiBank : 0,
          1 - Math.exp(-9 * dt)
        );

        const activeCharEmote: EmoteType =
          char.activeEmote && char.activeEmote.expiresAt > nowPerfMs
            ? char.activeEmote.type
            : 'none';

        animateHumanoidRig({
          rig,
          isMoving: aiActuallyMoving,
          moveIntensity: aiMoveIntensity,
          isTalking: char.isTalking || isSel,
          isSitting: Boolean(
            verifiedSeat &&
              !aiActuallyMoving &&
              activeCharEmote !== 'dance' &&
              activeCharEmote !== 'cheer'
          ),
          lookTargetAngleDelta: headLookDelta,
          elapsedTime: elapsed,
          deltaTime: dt,
          isSelected: isSel,
          emotion: char.emotionalState?.primary || char.currentMood,
          emotionIntensity: char.emotionalState?.intensity ?? 68,
          emote: activeCharEmote,
          isDistant: dToFocus > 55,
        });

        projectToDOM(
          rig.group.position.x,
          2.58 * char.scale + rig.group.position.y,
          rig.group.position.z,
          charLabelRefs.current[char.id] || null,
          isSel ? 300 : 72
        );
      });

      // Project clickable Two-Place Sanctuary floating badges (only when nearby or Map Markers ON)
      Object.values(TWO_PLACE_SPOTS).forEach((spot) => {
        projectToDOM(
          spot.center.x,
          2.72,
          spot.center.z - 0.5,
          twoPlaceLabelRefs.current[spot.id] || null,
          showBusStopMarkersRef.current ? 55 : 22
        );
      });

      // Project clickable Cyberpunk Supercar & 5-Passenger Bus floating badges (only when nearby or Map Markers ON)
      projectToDOM(
        dreamCruiserGroup.position.x,
        2.15 + dreamCruiserGroup.position.y,
        dreamCruiserGroup.position.z,
        cyberCarLabelRef.current,
        showBusStopMarkersRef.current ? 140 : 28
      );
      projectToDOM(
        busGroup.position.x,
        3.65 + busGroup.position.y,
        busGroup.position.z,
        busLabelRef.current,
        showBusStopMarkersRef.current ? 150 : 28
      );

      // Project Physical Audio Station Interactive Prompts (Visible ONLY when player is within 5.5m)
      projectToDOM(
        198,
        2.25,
        8,
        cyberStationLabelRef.current,
        5.5
      );
      projectToDOM(
        -8,
        2.25,
        6,
        jamaicaStationLabelRef.current,
        5.5
      );

      // Animate Physical Audio Station Equalizer Bars
      for (let eqIdx = 0; eqIdx < stationEqualizerBars.length; eqIdx++) {
        const bar = stationEqualizerBars[eqIdx];
        const barWave = Math.abs(Math.sin(elapsed * bar.speed + bar.phase));
        const barH = 0.05 + barWave * bar.maxHeight;
        bar.mesh.scale.y = Math.max(0.2, barH / 0.1);
        bar.mesh.position.y = bar.baseY + barH * 0.45;
      }

      // Project toggleable 3D Bus Stop Markers across Gemini City, Bridge & Cyber Horizon
      BUS_STOP_STATIONS.forEach((stop) => {
        const stopEl = busStopLabelRefs.current[stop.id] || null;
        if (!stopEl) return;
        if (!showBusStopMarkersRef.current) {
          stopEl.style.opacity = '0';
          stopEl.style.pointerEvents = 'none';
          return;
        }
        const stopElev = stop.x > 55 && stop.x < 143 ? 0.22 : 0;
        projectToDOM(
          stop.x,
          4.95 + stopElev,
          stop.z,
          stopEl,
          155
        );
      });

      if (elapsed - lastReportTime > 0.2) {
        lastReportTime = elapsed;
        AudioManager.updateSpatialState({
          playerX: playerState.x,
          playerZ: playerState.z,
          isRidingCar: isRidingCyberCarRef.current,
          isRidingBus: isRidingBusRef.current,
          carX: dreamCruiserGroup.position.x,
          carZ: dreamCruiserGroup.position.z,
          busX: busGroup.position.x,
          busZ: busGroup.position.z,
        });
        callbacksRef.current.onPlayerPositionChange(
          { x: Number(playerState.x.toFixed(2)), z: Number(playerState.z.toFixed(2)) },
          closestCharId
        );
      }

      // D. Smooth Camera Follow, Screen Rotation Damping, Velocity Look-Ahead & Dynamic FOV
      let desiredFocusX = playerState.x;
      let desiredFocusZ = playerState.z;

      if (selectedCharIdRef.current) {
        const selRig = aiRigs[selectedCharIdRef.current];
        if (selRig) {
          desiredFocusX = selRig.group.position.x;
          desiredFocusZ = selRig.group.position.z;
        }
      } else if (cameraOverrideRef.current) {
        desiredFocusX = cameraOverrideRef.current.x;
        desiredFocusZ = cameraOverrideRef.current.z;
      } else {
        // Subtle velocity look-ahead when controlling character in Chase or Close Action view
        const lookAheadMult =
          cameraViewModeRef.current === 'action'
            ? 0.28
            : cameraViewModeRef.current === 'chase'
            ? 0.22
            : 0.08;
        camOrbit.lookAheadX = THREE.MathUtils.lerp(
          camOrbit.lookAheadX,
          playerState.vx * lookAheadMult,
          1 - Math.exp(-5.5 * dt)
        );
        camOrbit.lookAheadZ = THREE.MathUtils.lerp(
          camOrbit.lookAheadZ,
          playerState.vz * lookAheadMult,
          1 - Math.exp(-5.5 * dt)
        );
        desiredFocusX += camOrbit.lookAheadX;
        desiredFocusZ += camOrbit.lookAheadZ;
      }

      const camSmooth = 1 - Math.exp(-10.5 * dt);
      camOrbit.azimuth = THREE.MathUtils.lerp(
        camOrbit.azimuth,
        camOrbit.targetAzimuth,
        camSmooth
      );
      camOrbit.polar = THREE.MathUtils.lerp(camOrbit.polar, camOrbit.targetPolar, camSmooth);
      camOrbit.distance = THREE.MathUtils.lerp(
        camOrbit.distance,
        camOrbit.targetDistance,
        camSmooth
      );
      camOrbit.lookAtY = THREE.MathUtils.lerp(
        camOrbit.lookAtY,
        camOrbit.targetLookAtY + playerState.y * 0.45,
        camSmooth
      );

      // Dynamic FOV boost when sprinting, sliding, or streaking across the Bridge in Fast Travel!
      const speedFovBoost = playerState.fastTravel.active
        ? 10.5
        : playerState.slideTimer > 0
        ? 5.5
        : playerSpeed > 7.2
        ? 3.5
        : 0;
      const nextFov = THREE.MathUtils.lerp(
        camera.fov,
        camOrbit.targetFov + speedFovBoost,
        1 - Math.exp(-7 * dt)
      );
      if (Math.abs(nextFov - camera.fov) > 0.02) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      const focusLerp = 1 - Math.exp(-8.5 * dt);
      camOrbit.focusX = THREE.MathUtils.lerp(camOrbit.focusX, desiredFocusX, focusLerp);
      camOrbit.focusZ = THREE.MathUtils.lerp(camOrbit.focusZ, desiredFocusZ, focusLerp);

      const horizDist = Math.sin(camOrbit.polar) * camOrbit.distance;
      const camX = camOrbit.focusX + Math.sin(camOrbit.azimuth) * horizDist;
      const camZ = camOrbit.focusZ + Math.cos(camOrbit.azimuth) * horizDist;
      const camY = Math.max(1.25, Math.cos(camOrbit.polar) * camOrbit.distance + playerState.y * 0.35);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(camOrbit.focusX, camOrbit.lookAtY, camOrbit.focusZ);

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  const nowMs = Date.now();

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Small Right-Edge Collapsible Tabs (Minimal footprint when closed so the 3D world is clearly visible!) */}
      {!hideActionHud && !isGamepadMode && (
        <div className="fixed top-3 right-0 z-25 flex flex-col items-end gap-1.5 pointer-events-auto">
          {/* 1. Small Edge Tab: Transit, Bridge & Vehicles Side Panel Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsTransitMenuOpen((prev) => {
                const next = !prev;
                if (next) {
                  setIsBusStopVisualizerOpen(false);
                  setIsBridgeHubOpen(false);
                }
                return next;
              });
            }}
            className={`px-2.5 py-1.5 rounded-l-xl border border-r-0 text-[11px] font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-xl transition active:scale-95 ${
              isTransitMenuOpen
                ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                : 'bg-slate-950/88 hover:bg-slate-900 text-cyan-200 border-cyan-400/45'
            }`}
            title="Tap to open or collapse the Transit, Bridge, Vehicles & Cities Side Panel"
          >
            <span>{isTransitMenuOpen ? '▸' : '◂'}</span>
            <span>🧭 Transit &amp; Cities</span>
          </button>

          {/* 2. Small Edge Tab: 3D Bus Stop Markers Quick Toggle & Station Map */}
          <div className="flex items-center rounded-l-xl overflow-hidden border border-r-0 border-emerald-400/45 bg-slate-950/88 backdrop-blur-xl shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBusStopMarkers((prev) => {
                  const next = !prev;
                  showBusStopMarkersRef.current = next;
                  return next;
                });
              }}
              className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
                showBusStopMarkers
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-emerald-200 hover:bg-white/10'
              }`}
              title="Toggle 3D Bus Stop Markers, Holographic Beacons & Route Line across the 3D Map"
            >
              <span>🚏 Stops: {showBusStopMarkers ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsBusStopVisualizerOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsTransitMenuOpen(false);
                    setIsBridgeHubOpen(false);
                  }
                  return next;
                });
              }}
              className={`px-2 py-1 text-[10px] font-bold border-l border-emerald-400/35 transition ${
                isBusStopVisualizerOpen
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-emerald-200 hover:bg-emerald-500/25'
              }`}
              title="Open or collapse the 6 Bus Stops Side Panel"
            >
              <span>{isBusStopVisualizerOpen ? '▸' : '◂'} Map</span>
            </button>
          </div>

          {/* 3. Small Edge Tab: Quick Cyber Car & Ninja Village Road Trip Access when walking */}
          {!isRidingCyberCar && !isRidingBus && (
            <div className="flex items-center rounded-l-xl overflow-hidden border border-r-0 border-amber-400/50 bg-slate-950/90 backdrop-blur-xl shadow-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  boardCyberCarActionRef.current?.(cyberCarCompanionId || 'hawa');
                }}
                className="px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20 flex items-center gap-1 transition active:scale-95"
                title="Sit inside the Cyber-Valkyrie GT Supercar"
              >
                <span>🏎️ Sit in Car</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const goingToNinja = explorerZone !== 'ninja_village';
                  summonCyberCarRef.current?.();
                  boardCyberCarActionRef.current?.(cyberCarCompanionId || 'hawa');
                  cyberCarTargetPointRef.current = goingToNinja ? [0, -852] : [0, -10.5];
                  cyberCarDriveModeRef.current = 'destination';
                  setCyberCarDriveMode('destination');
                  toggleCyberCarMoveRef.current?.(true);
                  setCyberCarDestLabel(
                    goingToNinja
                      ? '🍥 Road Trip → Hidden Leaf Ninja Village'
                      : '🏡 Road Trip → Gemini City'
                  );
                }}
                className="px-2 py-1 text-[10px] font-bold border-l border-white/15 text-orange-300 hover:bg-orange-500/20 flex items-center gap-1 transition active:scale-95"
                title="Hop in the Cyber-Valkyrie GT Supercar and drive the scenic Northern Shinobi Highway to the Hidden Leaf Ninja Village!"
              >
                <span>
                  {explorerZone === 'ninja_village'
                    ? '🏡 Drive → Gemini City'
                    : '🍥 Drive → Ninja Village'}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBusParked || !isBusEngineOn) {
                    startBusEngineRef.current?.();
                  } else {
                    parkBusAtDepotRef.current?.();
                  }
                }}
                className={`px-2 py-1 text-[10px] font-bold border-l border-white/15 flex items-center gap-1 transition active:scale-95 ${
                  isBusParked || !isBusEngineOn
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-amber-300 hover:bg-amber-500/20'
                }`}
                title={
                  isBusParked || !isBusEngineOn
                    ? 'Turn Bus Engine ON & Depart Parking Bay'
                    : 'Stop & Park Bus in the 3D Bus Parking Bay until turned ON'
                }
              >
                <span>{isBusParked || !isBusEngineOn ? '🔑 Start Bus' : '🚏 Park Bus'}</span>
              </button>
            </div>
          )}

          {/* 4. Small Edge Tab when Riding Cyberpunk Supercar (Never blocks center screen!) */}
          {isRidingCyberCar && (
            <div className="flex items-center rounded-l-xl overflow-hidden border border-r-0 border-cyan-400/60 bg-slate-950/92 backdrop-blur-xl shadow-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVehiclePanelCollapsed((prev) => !prev);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-white/10 flex items-center gap-1 transition"
                title="Open or collapse Cyber-Valkyrie GT Cockpit Controls"
              >
                <span>
                  {isVehiclePanelCollapsed ? '◂' : '▸'} 🏎️ Car ({cyberCarTelemetry.gear} ·{' '}
                  {cyberCarTelemetry.speedKmh} km/h)
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCyberCarMoveRef.current?.();
                }}
                className={`px-2 py-1 text-[10px] font-extrabold transition ${
                  isCyberCarMoving
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                }`}
                title={
                  isCyberCarMoving
                    ? 'Stop & Park the Cyber Car'
                    : 'Press to Move the Cyber Car'
                }
              >
                {isCyberCarMoving ? '🛑 Stop' : '▶️ Move'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  exitCyberCarActionRef.current?.();
                }}
                className="px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-bold transition"
                title="Step out of the Cyberpunk Supercar"
              >
                🚪 Exit
              </button>
            </div>
          )}

          {/* 5. Small Edge Tab when Riding 5-Passenger Bus (Never blocks center screen!) */}
          {isRidingBus && !isRidingCyberCar && (
            <div className="flex items-center rounded-l-xl overflow-hidden border border-r-0 border-amber-400/60 bg-slate-950/92 backdrop-blur-xl shadow-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVehiclePanelCollapsed((prev) => !prev);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1 transition"
                title="Open or collapse 5-Passenger Bus Controls"
              >
                <span>
                  {isVehiclePanelCollapsed ? '◂' : '▸'} 🚌 Bus ({busUiStatus.passengerIds.length}/5)
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBusParked || !isBusEngineOn) {
                    startBusEngineRef.current?.();
                  } else {
                    stopAndParkBusRef.current?.();
                  }
                }}
                className={`px-2 py-1 text-[10px] font-extrabold transition ${
                  isBusParked || !isBusEngineOn
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                {isBusParked || !isBusEngineOn ? '🔑 Turn ON' : '🛑 Stop/Park'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRidingBus(false);
                  isRidingBusRef.current = false;
                }}
                className="px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-bold transition"
                title="Exit the 5-Passenger Bus"
              >
                🚪 Exit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Slide-Out Right Side Panel: Transit, Bridge, Vehicles & Cities (Opens when [🧭 Transit & Cities] tab is tapped) */}
      {isTransitMenuOpen && !hideActionHud && (
        <div className="fixed top-14 right-0 z-30 w-[86vw] max-w-[340px] max-h-[80dvh] rounded-l-2xl bg-slate-950/95 backdrop-blur-xl border border-r-0 border-cyan-400/50 shadow-2xl text-slate-100 flex flex-col overflow-hidden pointer-events-auto">
          <div className="px-3.5 py-2.5 border-b border-white/10 bg-slate-900/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                {explorerZone === 'ninja_village'
                  ? '🍥 Hidden Leaf Ninja Village'
                  : explorerZone === 'shinobi_highway'
                  ? '🛣️ Northern Shinobi Highway'
                  : explorerZone === 'neo_horizon'
                  ? '🏙️ Neo-Horizon City'
                  : explorerZone === 'suspension_bridge'
                  ? '🌉 Golden Horizon Bridge'
                  : '🏡 Gemini City'}
              </div>
              <h3 className="font-display text-xs font-bold text-white truncate">
                Transit, Bridge &amp; Vehicles
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsTransitMenuOpen(false)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-cyan-300 flex items-center gap-1 transition"
              title="Collapse Side Panel"
            >
              <span>Collapse ▸</span>
            </button>
          </div>

          <div className="p-3 space-y-2.5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  travelToSpotRef.current?.(99, 0, true);
                  setIsTransitMenuOpen(false);
                  setIsBridgeHubOpen(true);
                  onTriggerBridgeReflections?.(
                    bridgeReflectionTheme,
                    explorerZone === 'neo_horizon' ? 'to_gemini_city' : 'to_neo_horizon'
                  );
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-orange-200 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95"
              >
                <span>🌉 Bridge</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  triggerBridgeFastTravelRef.current?.();
                }}
                className="p-2 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 hover:from-amber-300 hover:to-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 stroke-[2.6]" />
                <span>Fast Travel</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  setIsBridgeHubOpen(true);
                  onTriggerBridgeReflections?.(
                    bridgeReflectionTheme,
                    explorerZone === 'neo_horizon' ? 'to_gemini_city' : 'to_neo_horizon'
                  );
                }}
                className="p-2 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>AI Reflections</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  if (explorerZone === 'neo_horizon') {
                    travelToSpotRef.current?.(188, 0, true);
                  } else {
                    travelToSpotRef.current?.(184, 0, false);
                  }
                }}
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95"
              >
                <span>🏙️ 2nd City</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  travelToSpotRef.current?.(0, 6, false);
                }}
                className="p-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 col-span-2"
              >
                <span>🏡 Return to Gemini City Park</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  summonCyberCarRef.current?.();
                  boardCyberCarActionRef.current?.(cyberCarCompanionId || 'hawa');
                  cyberCarTargetPointRef.current = [0, -852];
                  cyberCarDriveModeRef.current = 'destination';
                  setCyberCarDriveMode('destination');
                  toggleCyberCarMoveRef.current?.(true);
                  setCyberCarDestLabel('🍥 Road Trip → Hidden Leaf Ninja Village');
                }}
                className="p-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 col-span-2"
              >
                <span>🍥 Road Trip by Car → Hidden Leaf Ninja Village</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Vehicles, Parking &amp; Traffic Lights</span>
                <span className="text-emerald-300 font-mono">
                  🚦{' '}
                  {trafficSignalPhase === 'ns_green'
                    ? 'NS 🟢 / EW 🔴'
                    : trafficSignalPhase === 'ns_yellow'
                    ? 'NS 🟡 / EW 🔴'
                    : trafficSignalPhase === 'ew_green'
                    ? 'NS 🔴 / EW 🟢'
                    : 'NS 🔴 / EW 🟡'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTransitMenuOpen(false);
                    setIsVehiclePanelCollapsed(false);
                    if (isRidingCyberCar) {
                      exitCyberCarActionRef.current?.();
                    } else {
                      boardCyberCarActionRef.current?.(cyberCarCompanionId || 'hawa');
                    }
                  }}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
                    isRidingCyberCar
                      ? 'bg-rose-500 text-white'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950'
                  }`}
                >
                  <span>{isRidingCyberCar ? '🏎️ Exit Car 🚪' : '🏎️ Sit in Cyber Car'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTransitMenuOpen(false);
                    setIsVehiclePanelCollapsed(false);
                    if (isRidingBus) {
                      setIsRidingBus(false);
                      isRidingBusRef.current = false;
                    } else {
                      setIsRidingCyberCar(false);
                      isRidingCyberCarRef.current = false;
                      setIsRidingBus(true);
                      isRidingBusRef.current = true;
                    }
                  }}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
                    isRidingBus
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-500/20 border border-amber-400/45 text-amber-200'
                  }`}
                >
                  <span>🚌 Sit in Bus ({busUiStatus.passengerIds.length}/5)</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    parkBusAtDepotRef.current?.();
                  }}
                  className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
                >
                  <span>🅿️ Park Bus at Depot</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isBusParked || !isBusEngineOn) {
                      startBusEngineRef.current?.();
                    } else {
                      stopAndParkBusRef.current?.();
                    }
                  }}
                  className={`p-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
                    isBusParked || !isBusEngineOn
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-rose-500/25 border border-rose-400/40 text-rose-200'
                  }`}
                >
                  <span>
                    {isBusParked || !isBusEngineOn ? '🔑 Turn Bus ON' : '🛑 Stop Bus Engine'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTransitMenuOpen(false);
                  setIsBusStopVisualizerOpen(true);
                }}
                className="w-full p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>🚏 Open 6 Bus Stops &amp; Bus Parking Bay Control</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Bus Stop Markers, Bus Parking Bay & Transit Network Control Side Panel (Slides from Right Edge) */}
      {isBusStopVisualizerOpen && !hideActionHud && (
        <div className="fixed top-14 right-0 w-[88vw] max-w-[380px] max-h-[80dvh] z-30 rounded-l-2xl bg-slate-950/95 backdrop-blur-xl border border-r-0 border-emerald-400/50 shadow-2xl text-slate-100 flex flex-col overflow-hidden pointer-events-auto">
          <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-slate-900 to-amber-500/20 flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                <span>🚏 3D Bus &amp; Parking Depot</span>
                <span>·</span>
                <span className="text-amber-300">
                  Engine: {isBusEngineOn && !isBusParked ? '🟢 ON' : '🔴 PARKED / OFF'}
                </span>
              </div>
              <h3 className="font-display text-sm font-bold text-white mt-0.5">
                Bus Stop / Park Depot &amp; Proximity Boarding
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsBusStopVisualizerOpen(false)}
              className="px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-emerald-300 flex items-center gap-1 transition"
              title="Collapse Bus Stops Panel to Side"
            >
              <span>▸</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bus Stop / Park Depot & Engine Master Controls */}
          <div className="p-3 border-b border-white/10 bg-slate-900/75 space-y-2">
            <div className="text-[11px] text-slate-300">
              🚌 Status:{' '}
              <strong className="text-amber-300">{busUiStatus.stopName}</strong> (
              {busUiStatus.passengerIds.length}/5 seats · NPCs must be &lt;6.8m to board)
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (isBusParked || !isBusEngineOn) {
                    startBusEngineRef.current?.();
                  } else {
                    stopAndParkBusRef.current?.();
                  }
                }}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-md transition active:scale-95 ${
                  isBusParked || !isBusEngineOn
                    ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950'
                    : 'bg-rose-500 hover:bg-rose-400 text-white'
                }`}
              >
                <span>
                  {isBusParked || !isBusEngineOn
                    ? '🔑 Turn Bus ON & Move'
                    : '🛑 Stop & Park Bus Here'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => parkBusAtDepotRef.current?.()}
                className="py-1.5 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1 shadow-md transition active:scale-95"
                title="Park the Bus inside the 3D Bus Parking Bay on West Grand Ave until you turn it ON"
              >
                <span>🅿️ Park at Bus Depot</span>
              </button>

              <button
                type="button"
                onClick={() => triggerBusStopNowRef.current?.()}
                className="py-1 px-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 text-[11px] font-bold transition"
              >
                🚏 Stop 8s (Open Doors)
              </button>

              <button
                type="button"
                onClick={() => boardAllFiveBusRef.current?.()}
                className="py-1 px-2 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold transition"
                title="Only NPCs within 6.8m of the bus can board!"
              >
                👥 Board Close NPCs (&lt;6.8m)
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="text-[11px] font-semibold text-slate-300">
                3D Bus Stop Beacons &amp; Route Line
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBusStopMarkers((prev) => {
                    const next = !prev;
                    showBusStopMarkersRef.current = next;
                    return next;
                  });
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  showBusStopMarkers
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-white/15'
                }`}
              >
                {showBusStopMarkers ? '👁️ ON' : '🙈 OFF'}
              </button>
            </div>
          </div>

          {/* List of all 6 3D Bus Stops across Gemini City, Bridge & Cyber Horizon */}
          <div className="p-3 space-y-2 overflow-y-auto">
            {BUS_STOP_STATIONS.map((stop) => {
              const isBusStoppedHere = busUiStatus.activeStopId === stop.id;
              const isNextStop = !isBusStoppedHere && busUiStatus.nextStopId === stop.id;
              return (
                <div
                  key={stop.id}
                  className={`p-2.5 rounded-xl border transition ${
                    isBusStoppedHere
                      ? 'bg-emerald-950/60 border-emerald-400/70 shadow-md'
                      : isNextStop
                      ? 'bg-amber-950/40 border-amber-400/50'
                      : 'bg-slate-900/90 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-extrabold text-slate-950 shrink-0"
                        style={{ backgroundColor: stop.accentColor }}
                      >
                        STOP {stop.code}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {stop.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {stop.zone} · ({stop.x.toFixed(0)}, {stop.z.toFixed(0)})
                        </div>
                      </div>
                    </div>

                    {isBusStoppedHere ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                        🚌 Doors Open
                      </span>
                    ) : isNextStop ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-400/50 text-amber-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
                        🔜 Next Stop
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        travelToSpotRef.current?.(stop.shelterX, stop.shelterZ, true);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-semibold transition active:scale-95"
                    >
                      🚶 Walk to Shelter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dispatchBusToStopRef.current?.(stop.id, true);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-[10px] font-bold transition active:scale-95"
                      title="Summon & pause the 5-passenger bus at this stop for resident pickup/drop-off"
                    >
                      🚌 Pause Bus Here (Pickup/Drop)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cyberpunk Supercar Interactive Cockpit Side Panel (Slides from Right Edge when not collapsed!) */}
      {isRidingCyberCar && !isVehiclePanelCollapsed && !hideActionHud && (
        <div className="fixed top-28 right-0 z-30 w-[88vw] max-w-[360px] p-3 rounded-l-2xl bg-slate-950/95 backdrop-blur-xl border border-r-0 border-cyan-400/60 shadow-2xl text-white pointer-events-auto space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-display font-bold text-cyan-300 truncate">
                <span>🏎️ CYBER-VALKYRIE GT COCKPIT</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 border border-cyan-400/50 text-[10px] font-mono text-cyan-200">
                  GEAR {cyberCarTelemetry.gear} · {cyberCarTelemetry.speedKmh} KM/H
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                {cyberCarDestLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVehiclePanelCollapsed(true)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-cyan-300 shrink-0 transition"
              title="Collapse cockpit panel to right edge"
            >
              Collapse ▸
            </button>
          </div>

          {/* Primary Move / Stop Ignition Button — Car ONLY moves when seated inside and this button is pressed! */}
          <button
            type="button"
            onClick={() => toggleCyberCarMoveRef.current?.()}
            className={`w-full py-2.5 px-3 rounded-xl font-display font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition active:scale-95 ${
              isCyberCarMoving
                ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950'
                : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 text-slate-950 animate-pulse'
            }`}
          >
            <span>
              {isCyberCarMoving
                ? '🛑 STOP & PARK CYBER CAR (GEAR: P)'
                : '▶️ PRESS TO MOVE CYBER CAR (START DRIVING)'}
            </span>
          </button>

          {/* Gullwing Doors, Active Aero Spoiler & Companion Controls */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCyberCarDoorsOpen((prev) => !prev);
              }}
              className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition active:scale-95 ${
                cyberCarDoorsOpen
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-white/10 text-cyan-200 border-white/15'
              }`}
            >
              🚪 Doors: {cyberCarDoorsOpen ? 'OPEN' : 'SHUT'}
            </button>

            <button
              type="button"
              onClick={() => {
                setCyberCarWingDeployed((prev) => !prev);
              }}
              className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition active:scale-95 ${
                cyberCarWingDeployed
                  ? 'bg-fuchsia-400 text-slate-950 border-fuchsia-300'
                  : 'bg-white/10 text-fuchsia-200 border-white/15'
              }`}
            >
              🪽 Wing: {cyberCarWingDeployed ? 'UP' : 'AUTO'}
            </button>

            <button
              type="button"
              onClick={() => exitCyberCarActionRef.current?.()}
              className="px-2 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display font-bold text-[10px] shadow-md transition active:scale-95"
            >
              🚪 Step Out
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const companionOrder = ['hawa', 'amie', 'iysha', 'sana', 'maya', 'aria', null];
                const curIdx = companionOrder.indexOf(cyberCarCompanionId);
                const nextComp = companionOrder[(curIdx + 1) % companionOrder.length];
                setCyberCarCompanionId(nextComp);
                cyberCarCompanionIdRef.current = nextComp;
              }}
              className="flex-1 px-2.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-[11px] font-bold transition active:scale-95"
              title="Choose who sits beside you in the passenger bucket seat"
            >
              ❤️ Co-Pilot Seat:{' '}
              {cyberCarCompanionId
                ? characters.find((c) => c.id === cyberCarCompanionId)?.name || 'Hawa'
                : 'Solo (No Passenger)'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = null;
                cyberCarDriveModeRef.current = 'manual';
                setCyberCarDriveMode('manual');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Manual Steering — Use Joystick / WASD!');
              }}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                cyberCarDriveMode === 'manual'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-white/10 hover:bg-white/20 text-emerald-200'
              }`}
            >
              🕹️ Manual Drive
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = null;
                cyberCarDriveModeRef.current = 'grand_tour';
                setCyberCarDriveMode('grand_tour');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Whole-Map Auto Tour (All Cities)');
              }}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                cyberCarDriveMode === 'grand_tour'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-white/10 hover:bg-white/20 text-cyan-200'
              }`}
            >
              🌍 Auto-Cruise Tour
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [184, 1.65];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Driving → Cyber Horizon (City 2)');
              }}
              className="px-2 py-1.5 rounded-lg bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/40 text-fuchsia-200 text-[11px] font-bold transition"
            >
              🏙️ Cyber Horizon
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [99, 1.65];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Driving → Golden Horizon Bridge');
              }}
              className="px-2 py-1.5 rounded-lg bg-orange-500/25 hover:bg-orange-500/40 border border-orange-400/40 text-orange-200 text-[11px] font-bold transition"
            >
              🌉 Bridge Mid-Span
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [10.5, 5.2];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Driving → Gemini Central Park');
              }}
              className="px-2 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold transition"
            >
              ⛲ Gemini Park
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [-10.5, 10.5];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('Driving → Sunbeam Espresso Café');
              }}
              className="px-2 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/40 text-amber-200 text-[11px] font-bold transition"
            >
              ☕ Sunbeam Café
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [0, -852];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('🍥 Road Trip → Hidden Leaf Ninja Village');
              }}
              className="px-2 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/35 to-red-500/35 hover:from-orange-500/50 hover:to-red-500/50 border border-orange-400/50 text-orange-200 text-[11px] font-extrabold transition"
            >
              🍥 Ninja Village
            </button>
            <button
              type="button"
              onClick={() => {
                cyberCarTargetPointRef.current = [18, -822];
                cyberCarDriveModeRef.current = 'destination';
                setCyberCarDriveMode('destination');
                toggleCyberCarMoveRef.current?.(true);
                setCyberCarDestLabel('🍜 Driving → Ichiraku Ramen (Hidden Leaf)');
              }}
              className="px-2 py-1.5 rounded-lg bg-red-500/25 hover:bg-red-500/40 border border-red-400/40 text-red-200 text-[11px] font-bold transition"
            >
              🍜 Ichiraku Ramen
            </button>
          </div>
        </div>
      )}

      {/* 5-Passenger Autonomous Bus Interactive Side Panel (Slides from Right Edge when not collapsed!) */}
      {isRidingBus && !isRidingCyberCar && !isVehiclePanelCollapsed && !hideActionHud && (
        <div className="fixed top-28 right-0 z-30 w-[88vw] max-w-[360px] p-3 rounded-l-2xl bg-slate-950/95 backdrop-blur-xl border border-r-0 border-amber-400/60 shadow-2xl text-white pointer-events-auto space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-amber-300 truncate">
                🚌 5-PASSENGER LUXURY COACH ({busUiStatus.passengerIds.length}/5)
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                {busUiStatus.stopName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVehiclePanelCollapsed(true)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-amber-300 shrink-0 transition"
              title="Collapse bus panel to right edge"
            >
              Collapse ▸
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isBusParked || !isBusEngineOn) {
                  startBusEngineRef.current?.();
                } else {
                  stopAndParkBusRef.current?.();
                }
              }}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-extrabold transition active:scale-95 ${
                isBusParked || !isBusEngineOn
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {isBusParked || !isBusEngineOn
                ? '🔑 Turn Bus ON & Move'
                : '🛑 Stop & Park Bus'}
            </button>

            <button
              type="button"
              onClick={() => parkBusAtDepotRef.current?.()}
              className="px-2 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold transition active:scale-95"
            >
              🅿️ Park at Depot Bay
            </button>

            <button
              type="button"
              onClick={() => triggerBusStopNowRef.current?.()}
              className="px-2 py-1.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 text-[11px] font-bold transition active:scale-95"
            >
              🚏 Kneel &amp; Open Doors
            </button>

            <button
              type="button"
              onClick={() => boardAllFiveBusRef.current?.()}
              className="px-2 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold transition active:scale-95"
              title="Only NPCs within 6.8m of the bus can board!"
            >
              👥 Board Nearby (&lt;6.8m)
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMode = busDriveMode === 'manual' ? 'auto_route' : 'manual';
                busDriveModeRef.current = nextMode;
                setBusDriveMode(nextMode);
                if (isBusParked || !isBusEngineOn) {
                  startBusEngineRef.current?.();
                }
              }}
              className={`col-span-2 px-2 py-1.5 rounded-xl text-[11px] font-bold border transition active:scale-95 ${
                busDriveMode === 'manual'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-white/10 text-cyan-200 border-white/15'
              }`}
            >
              {busDriveMode === 'manual'
                ? '🕹️ Manual Bus Driving Active (Tap for Auto-Route)'
                : '🔄 Auto-Route Loop Active (Tap to Drive Bus Manually)'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-300 pt-1 border-t border-white/10">
            <span className="text-slate-400">Seated:</span>
            {busUiStatus.passengerIds.map((pid, idx) => {
              const pChar = characters.find((c) => c.id === pid);
              return (
                <span key={pid} className="text-amber-200 font-semibold">
                  {idx > 0 ? ' · ' : ''}#{idx + 1} {pChar?.name || pid}
                </span>
              );
            })}
            {busUiStatus.passengerIds.length === 0 && (
              <span className="italic text-slate-400">
                Waiting for nearby NPCs (&lt;6.8m) to board
              </span>
            )}
          </div>
        </div>
      )}

      {/* Active 3D Bridge Hyper-Glide Fast Travel Progress Pill (Compact right-edge pill) */}
      {fastTravelStatus && fastTravelStatus.active && (
        <div className="fixed bottom-16 right-3 z-30 pointer-events-none px-3 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-cyan-400/60 shadow-2xl flex items-center gap-2.5 text-xs text-white">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <div>
            <div className="font-display font-bold text-cyan-300 text-[11px]">
              ⚡ Hyper-Glide → {fastTravelStatus.destinationLabel}
            </div>
            <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-cyan-400 to-fuchsia-400 transition-all duration-75"
                style={{ width: `${fastTravelStatus.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Clickable Golden Horizon Bridge Interactive Hub & Resident AI Reflections Side Panel */}
      {isBridgeHubOpen && !hideActionHud && (
        <div className="fixed top-14 right-0 w-[88vw] max-w-[390px] max-h-[80dvh] z-30 rounded-l-2xl bg-slate-950/95 backdrop-blur-xl border border-r-0 border-orange-400/45 shadow-2xl text-slate-100 flex flex-col overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-orange-500/20 via-slate-900 to-cyan-500/20 flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-300">
                <span>🌉 Golden Horizon Suspension Bridge</span>
                <span>·</span>
                <span className="text-cyan-300">82m Ocean Span</span>
              </div>
              <h3 className="font-display text-sm font-bold text-white mt-0.5">
                Fast Travel & Resident AI Reflections on Neo-Horizon
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsBridgeHubOpen(false)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              title="Close Bridge Interaction Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Fast Travel Action Controls */}
          <div className="p-3.5 border-b border-white/10 bg-slate-900/65 space-y-2">
            <div className="text-[11px] text-slate-300 leading-snug">
              Launch a high-speed <span className="text-amber-300 font-semibold">3D Jetpack Hyper-Glide</span> through the bridge’s 5 energy rings while residents reflect from Gemini City:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerBridgeFastTravelRef.current?.('neo_horizon');
                }}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-400 hover:from-cyan-300 hover:to-fuchsia-300 text-slate-950 font-display font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Glide → 2nd City 🏙️</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerBridgeFastTravelRef.current?.('gemini_city');
                }}
                className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Glide → Gemini City 🏡</span>
              </button>
            </div>
          </div>

          {/* 2. Resident AI Dialogue Reflections Theme Selector */}
          <div className="px-3.5 pt-2.5 pb-2 border-b border-white/10 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
              {(
                [
                  { id: 'architecture', label: '01. Skyline & Bridge' },
                  { id: 'mystery', label: '02. Explorer-Only' },
                  { id: 'envoy', label: '03. Envoy Wishes' },
                ] as { id: BridgeReflectionTheme; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setBridgeReflectionTheme(tab.id);
                    onTriggerBridgeReflections?.(
                      tab.id,
                      explorerZone === 'neo_horizon' ? 'to_gemini_city' : 'to_neo_horizon'
                    );
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                    bridgeReflectionTheme === tab.id
                      ? 'bg-orange-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onTriggerBridgeReflections?.(
                  bridgeReflectionTheme,
                  explorerZone === 'neo_horizon' ? 'to_gemini_city' : 'to_neo_horizon'
                );
              }}
              className="px-2.5 py-1.5 rounded-xl bg-fuchsia-500/25 hover:bg-fuchsia-500/35 border border-fuchsia-400/40 text-fuchsia-200 text-[10px] font-bold flex items-center gap-1 shrink-0 transition active:scale-95"
              title="Broadcast all residents' reflections as live 3D speech bubbles & memories"
            >
              <Sparkles className="w-3 h-3 text-fuchsia-300" />
              <span>Speak in 3D</span>
            </button>
          </div>

          {/* 3. Scrollable List of Resident AI Reflections about Neo-Horizon City */}
          <div className="p-3.5 space-y-2.5 overflow-y-auto">
            {characters.map((char) => {
              const refData = getResidentBridgeReflection(
                char,
                explorerProfile.name || 'Johnny',
                bridgeReflectionTheme
              );
              return (
                <div
                  key={char.id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-display font-bold text-xs shrink-0"
                        style={{ backgroundColor: char.avatarColor }}
                      >
                        {char.name[0]}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {char.name}{' '}
                          <span className="font-normal text-[11px] text-slate-400">
                            · {char.role.split('&')[0].trim()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-cyan-300 font-medium shrink-0">
                      {refData.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-100 leading-relaxed">
                    “{refData.quote}”
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-slate-400 italic truncate">
                      Thought: {refData.thought}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBridgeHubOpen(false);
                        onSelectCharacter(char.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-amber-300 shrink-0 transition"
                    >
                      Chat with {char.name} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Semantic Projected 3D Overlay Layer (Clean & Unobtrusive: Only Compact Names & Speech Bubbles on Heads) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {/* Projected 3D Clickable Golden Horizon Bridge Interaction Tag */}
        <div
          ref={bridgeLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-orange-400/50 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerBridgeFastTravelRef.current?.();
              }}
              className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-slate-950 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
              title="Launch 3D Hyper-Glide Fast Travel across the Golden Horizon Bridge"
            >
              <Zap className="w-3 h-3 stroke-[2.5]" />
              <span>🌉 Fast Travel</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsBridgeHubOpen((prev) => !prev);
                onTriggerBridgeReflections?.(
                  bridgeReflectionTheme,
                  explorerZone === 'neo_horizon' ? 'to_gemini_city' : 'to_neo_horizon'
                );
              }}
              className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
              title="Open Resident AI Dialogue Reflections about Neo-Horizon City"
            >
              <MessageSquare className="w-2.5 h-2.5 text-cyan-300" />
              <span>AI Reflections</span>
            </button>
          </div>
        </div>

        {/* Projected 3D Two-Place Bench & Lounge Chairs Interactive Badges (2 in Gemini City + 2 in Second City) */}
        {Object.values(TWO_PLACE_SPOTS).map((spot) => (
          <div
            key={spot.id}
            ref={(el) => {
              twoPlaceLabelRefs.current[spot.id] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
          >
            <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-rose-400/45 shadow-lg">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTwoPlaceSpot?.(spot.id, 'bench');
                  travelToSpotRef.current?.(spot.seatB.x, spot.seatB.z, true);
                }}
                className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-rose-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title={`Walk to ${spot.name} and sit on the Two-Place Bench with your loved one or best friend`}
              >
                <span>🪑 Two-Place Bench ❤️</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTwoPlaceSpot?.(spot.id, 'chairs');
                  travelToSpotRef.current?.(spot.chairB.x, spot.chairB.z, true);
                }}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-200 text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title={`Sit on the Two Companion Lounge Chairs at ${spot.name}`}
              >
                <span>☕ 2 Chairs</span>
              </button>
            </div>
          </div>
        ))}

        {/* Projected 3D Cyber City Audio Station Interactive Prompt (Visible ONLY within 5.5m) */}
        <div
          ref={cyberStationLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-cyan-400/60 shadow-xl shadow-cyan-500/20">
            <div className="text-[10px] font-display font-extrabold text-cyan-300 flex items-center gap-1 uppercase tracking-wider">
              <span>🎵 MUSIC STATION</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  AudioManager.openStationModal('cyber_city_station');
                }}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 text-xs font-display font-extrabold shadow-md flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title="Open Cyber City Audio Station [E]"
              >
                <span>Interact [E]</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  travelToSpotRef.current?.(196.8, 10.2, true);
                }}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-200 text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title="Sit in Cyber Lounge Chair"
              >
                <span>🪑 Sit & Listen</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projected 3D Jamaica City Audio Station Interactive Prompt (Visible ONLY within 5.5m) */}
        <div
          ref={jamaicaStationLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-amber-400/60 shadow-xl shadow-amber-500/20">
            <div className="text-[10px] font-display font-extrabold text-amber-300 flex items-center gap-1 uppercase tracking-wider">
              <span>🎵 MUSIC STATION</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  AudioManager.openStationModal('jamaica_city_station');
                }}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 text-xs font-display font-extrabold shadow-md flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title="Open Jamaica City Audio Station [E]"
              >
                <span>Interact [E]</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  travelToSpotRef.current?.(-9.2, 8.2, true);
                }}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-[10px] font-semibold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                title="Sit in Teak Lounge Chair"
              >
                <span>🪑 Sit & Listen</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projected 3D Cyberpunk Supercar Interactive Tag */}
        <div
          ref={cyberCarLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-400/60 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRidingCyberCar) {
                  exitCyberCarActionRef.current?.();
                } else {
                  boardCyberCarActionRef.current?.(cyberCarCompanionId || 'hawa');
                }
              }}
              className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-400 hover:from-cyan-300 hover:to-fuchsia-300 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
            >
              <span>
                {isRidingCyberCar
                  ? '🏎️ Seated Inside · Exit 🚪'
                  : '🏎️ Sit in Cyber Car (with Hawa ❤️)'}
              </span>
            </button>
            {isRidingCyberCar && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCyberCarMoveRef.current?.();
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition active:scale-95 whitespace-nowrap ${
                  isCyberCarMoving
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 animate-pulse'
                }`}
                title="Car only moves when you sit inside and press this button or WASD!"
              >
                <span>
                  {isCyberCarMoving ? '🛑 Stop Car' : '⚡ Press to Move'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Projected 3D 5-Passenger Autonomous Bus Interactive Tag */}
        <div
          ref={busLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 backdrop-blur-md border border-amber-400/60 shadow-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRidingBus) {
                  setIsRidingBus(false);
                  isRidingBusRef.current = false;
                } else {
                  setIsRidingCyberCar(false);
                  isRidingCyberCarRef.current = false;
                  setIsRidingBus(true);
                  isRidingBusRef.current = true;
                  setIsVehiclePanelCollapsed(false);
                }
              }}
              className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
            >
              <span>
                🚌 Bus ({busUiStatus.passengerIds.length}/5) ·{' '}
                {isRidingBus ? 'Exit' : 'Sit Inside'}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isBusParked || !isBusEngineOn) {
                  startBusEngineRef.current?.();
                } else {
                  stopAndParkBusRef.current?.();
                }
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition active:scale-95 whitespace-nowrap ${
                isBusParked || !isBusEngineOn
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                  : 'bg-rose-500/90 hover:bg-rose-400 text-white'
              }`}
              title="Stop & Park the bus until you turn it ON, or start the engine to move!"
            >
              <span>
                {isBusParked || !isBusEngineOn ? '🔑 Turn ON' : '🛑 Stop & Park'}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                parkBusAtDepotRef.current?.();
              }}
              className="px-2 py-0.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 text-[10px] font-semibold transition active:scale-95 whitespace-nowrap"
              title="Park the bus at the 3D Bus Parking Depot Bay until you turn it on!"
            >
              <span>🅿️ Depot</span>
            </button>
          </div>
        </div>

        {/* Projected 3D Toggleable Bus Stop Station Markers across the 3D Map */}
        {BUS_STOP_STATIONS.map((stop) => {
          const isBusHere = busUiStatus.activeStopId === stop.id;
          const isNext = !isBusHere && busUiStatus.nextStopId === stop.id;
          return (
            <div
              key={stop.id}
              ref={(el) => {
                busStopLabelRefs.current[stop.id] = el;
              }}
              style={{ opacity: 0 }}
              className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
            >
              <div
                className={`pointer-events-auto flex items-center gap-1 p-1 rounded-xl backdrop-blur-md border shadow-xl transition ${
                  isBusHere
                    ? 'bg-emerald-950/92 border-emerald-400 shadow-emerald-500/25 scale-105'
                    : isNext
                    ? 'bg-slate-950/90 border-amber-400/75'
                    : 'bg-slate-950/85 border-white/25'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    travelToSpotRef.current?.(stop.shelterX, stop.shelterZ, true);
                  }}
                  className="px-2 py-0.5 rounded-lg text-slate-950 text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                  style={{ backgroundColor: stop.accentColor }}
                  title={`Walk to ${stop.name} (${stop.zone})`}
                >
                  <span>
                    🚏 STOP {stop.code} · {stop.shortName}
                  </span>
                  {isBusHere && <span>· 🚌 DOORS OPEN</span>}
                  {isNext && <span>· 🔜 NEXT</span>}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatchBusToStopRef.current?.(stop.id, true);
                  }}
                  className="px-1.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-emerald-200 text-[10px] font-bold transition active:scale-95 whitespace-nowrap"
                  title="Pause the 5-Passenger Bus at this stop for resident pickup & drop-off"
                >
                  <span>🚌 Pause Here</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Player Tag */}
        <div
          ref={playerLabelRef}
          style={{ opacity: 0 }}
          className="absolute top-0 left-0 pointer-events-none flex flex-col items-center"
        >
          {playerEmote && playerEmote !== 'none' && (
            <div className="mb-0.5 px-2 py-0.5 rounded-full bg-fuchsia-500/90 text-white text-[10px] font-bold shadow-sm">
              {playerEmote === 'dance'
                ? '💃'
                : playerEmote === 'laugh'
                ? '😂'
                : playerEmote === 'wave'
                ? '👋'
                : playerEmote === 'cheer'
                ? '🎉'
                : playerEmote === 'think'
                ? '🤔'
                : '👏'}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectExplorer?.();
            }}
            className="pointer-events-auto px-2 py-0.5 rounded-md bg-amber-400/95 hover:bg-amber-300 text-slate-950 text-[10px] font-bold tracking-tight shadow-sm whitespace-nowrap transition active:scale-95"
          >
            ★ {explorerProfile.name}
          </button>
        </div>

        {/* AI Residents — Clean & Cinematic: Visual animations only, NO floating conversation text or speech bubbles */}
        {characters.map((char) => {
          const isSelected = selectedCharacterId === char.id;
          // When walking through the city: NO floating dialogue, NO speech bubbles, NO NPC names floating above heads unless explicitly selected
          if (!isSelected) {
            return null;
          }

          const wardrobe = getResidentWeatherWardrobe(char, weather);

          return (
            <div
              key={char.id}
              ref={(el) => {
                charLabelRefs.current[char.id] = el;
              }}
              style={{ opacity: 0 }}
              className="absolute top-0 left-0 flex flex-col items-center pointer-events-none"
            >
              {/* Selected Resident Name Tag (Essential gameplay inspection only) */}
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md backdrop-blur-md border bg-slate-950/85 text-white border-amber-400/40 font-semibold select-none shadow-lg">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 border border-white/40"
                    style={{ backgroundColor: wardrobe.outfitColor }}
                  />
                  <span className="text-[11px] tracking-tight whitespace-nowrap font-bold">{char.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Gameplay View — 4-Finger Claw Landscape Gamepad HUD (Active ONLY when turned on from Settings!) */}
      {isGamepadMode && !hideActionHud && (
        <div className="absolute inset-0 z-25 pointer-events-none select-none">
          {/* 1. TOP-LEFT CLAW ZONE (Left Index Finger: L1 Slide/Dash Trigger + Screen View Preset Bar) */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-2 pointer-events-auto">
            <div className="flex items-center gap-2">
              {/* L1 Index Finger Claw Trigger: SLIDE / DASH */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerSlideRef.current?.();
                }}
                className="h-14 px-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-display font-extrabold shadow-xl shadow-amber-500/30 border-2 border-amber-200/85 flex items-center gap-2 active:scale-90 transition"
                title="Left Index Claw Trigger: High-Speed Slide & Dash"
              >
                <Zap className="w-5 h-5 stroke-[2.8]" />
                <div className="text-left leading-none">
                  <div className="text-xs tracking-tight">L1 · SLIDE</div>
                  <div className="text-[9px] font-sans font-bold text-slate-900/80 mt-0.5">
                    INDEX CLAW
                  </div>
                </div>
              </button>

              {/* Camera View Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 shadow-lg">
                {(
                  [
                    { id: 'chase', label: 'Chase' },
                    { id: 'action', label: 'Close 3D' },
                    { id: 'panoramic', label: 'Vista' },
                    { id: 'sky', label: 'Sky' },
                  ] as { id: CameraViewMode; label: string }[]
                ).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCameraViewMode(v.id);
                      applyCameraViewPresetRef.current?.(v.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold tracking-tight transition active:scale-95 ${
                      cameraViewMode === v.id
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. TOP-CENTER GAMEPAD CONTROL PILL (Turn Screen 90° Orientation + Exit to Normal Control) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-xl border border-sky-400/40 rounded-2xl px-3 py-1.5 shadow-2xl pointer-events-auto">
            <div className="hidden sm:flex items-center gap-1.5 pr-1.5 border-r border-white/15 text-sky-300 text-[11px] font-bold">
              <Gamepad2 className="w-4 h-4" />
              <span>4-Finger Claw</span>
            </div>

            {onCycleScreenRotation && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCycleScreenRotation();
                }}
                className="px-2.5 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
                title="Rotate Screen Orientation (90° Sideways Gamepad vs Straight)"
              >
                <Smartphone className="w-3.5 h-3.5 text-sky-300" />
                <span>
                  {screenRotation === 90
                    ? 'Rotated 90° ↻'
                    : screenRotation === -90
                    ? 'Rotated 90° ↺'
                    : 'Rotate 90° 📱'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                snapBehindPlayerRef.current?.();
              }}
              className="px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
              title="Snap Screen Behind Character"
            >
              <Camera className="w-3 h-3 text-amber-300" />
              <span>Behind</span>
            </button>

            {onExitGamepadMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExitGamepadMode();
                }}
                className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition active:scale-95"
                title="Exit Full Gameplay View and return to Normal Phone Control"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit Gamepad</span>
              </button>
            )}
          </div>

          {/* 3. TOP-RIGHT CLAW ZONE (Right Index Finger: R1 Jump / Double Jump Trigger + Quick Camera Rotate) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 shadow-lg">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  continuousRotateDirRef.current = 1;
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  continuousRotateDirRef.current = 0;
                }}
                onPointerLeave={() => {
                  continuousRotateDirRef.current = 0;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateDeltaRef.current.dAzimuth += 0.38;
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-300" />
                <span>Left</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoFollowCamera((prev) => !prev);
                }}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 active:scale-95 transition border ${
                  autoFollowCamera
                    ? 'bg-emerald-400/20 border-emerald-400/45 text-emerald-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                <Compass className="w-3 h-3" />
                <span>Auto</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  continuousRotateDirRef.current = -1;
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  continuousRotateDirRef.current = 0;
                }}
                onPointerLeave={() => {
                  continuousRotateDirRef.current = 0;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  rotateDeltaRef.current.dAzimuth -= 0.38;
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
              >
                <span>Right</span>
                <RotateCw className="w-3.5 h-3.5 text-sky-300" />
              </button>
            </div>

            {/* R1 Index Finger Claw Trigger: JUMP / DOUBLE JUMP */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerJumpRef.current?.();
              }}
              className="h-14 px-5 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-display font-extrabold shadow-xl shadow-sky-500/30 border-2 border-sky-200/80 flex items-center gap-2 active:scale-90 transition"
              title="Right Index Claw Trigger: Jump & Double Jump"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.8]" />
              <div className="text-left leading-none">
                <div className="text-xs tracking-tight">R1 · JUMP</div>
                <div className="text-[9px] font-sans font-semibold text-sky-100/90 mt-0.5">
                  INDEX CLAW
                </div>
              </div>
            </button>
          </div>

          {/* 4. BOTTOM-LEFT THUMB ZONE (Left Thumb Analog Joystick with Sprint Ring) */}
          <div className="absolute bottom-3 left-4 pointer-events-auto">
            <VirtualJoystick
              variant="gamepad"
              screenRotation={screenRotation}
              onMove={(vec) => {
                joystickRef.current = vec;
                onJoystickMove?.(vec);
              }}
            />
          </div>

          {/* 5. BOTTOM-RIGHT THUMB ZONE (Right Thumb 360° Screen Rotation Pad + Thumb Jump & Slide Buttons) */}
          <div className="absolute bottom-3 right-4 flex items-end gap-3 pointer-events-auto">
            {/* Right-Thumb 360° Free-Look & Screen Rotation Pad */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                ref={lookPadContainerRef}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  lookPadPointerId.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  lookPadCachedRectRef.current = e.currentTarget.getBoundingClientRect();
                  lookPadPrevPos.current = { x: e.clientX, y: e.clientY };
                  setIsLookPadActive(true);
                }}
                onPointerMove={(e) => {
                  if (lookPadPointerId.current !== e.pointerId) return;
                  e.stopPropagation();
                  const rawDx = e.clientX - lookPadPrevPos.current.x;
                  const rawDy = e.clientY - lookPadPrevPos.current.y;
                  lookPadPrevPos.current = { x: e.clientX, y: e.clientY };

                  const rot = screenRotationRef.current;
                  const dx = rot === 90 ? rawDy : rot === -90 ? -rawDy : rawDx;
                  const dy = rot === 90 ? -rawDx : rot === -90 ? rawDx : rawDy;

                  rotateDeltaRef.current.dAzimuth -= dx * 0.014;
                  rotateDeltaRef.current.dPolar += dy * 0.01;

                  const rect =
                    lookPadCachedRectRef.current || e.currentTarget.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const offX = e.clientX - cx;
                  const offY = e.clientY - cy;
                  const localX = rot === 90 ? offY : rot === -90 ? -offY : offX;
                  const localY = rot === 90 ? -offX : rot === -90 ? offX : offY;

                  const kx = Math.max(-24, Math.min(24, localX));
                  const ky = Math.max(-24, Math.min(24, localY));
                  if (lookPadKnobRef.current) {
                    lookPadKnobRef.current.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
                  }
                }}
                onPointerUp={(e) => {
                  if (lookPadPointerId.current !== e.pointerId) return;
                  e.stopPropagation();
                  lookPadPointerId.current = null;
                  lookPadCachedRectRef.current = null;
                  setIsLookPadActive(false);
                  if (lookPadKnobRef.current) {
                    lookPadKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
                  }
                }}
                onPointerCancel={(e) => {
                  if (lookPadPointerId.current !== e.pointerId) return;
                  lookPadPointerId.current = null;
                  lookPadCachedRectRef.current = null;
                  setIsLookPadActive(false);
                  if (lookPadKnobRef.current) {
                    lookPadKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
                  }
                }}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing backdrop-blur-md transition-colors ${
                  isLookPadActive
                    ? 'bg-slate-900/85 border-2 border-sky-400 shadow-xl shadow-sky-400/30'
                    : 'bg-slate-950/70 border-2 border-white/25 hover:border-sky-300/60'
                }`}
                title="Right Thumb: Drag to Rotate Screen 360° & Tilt View"
              >
                <div className="w-12 h-12 rounded-full border border-white/15 pointer-events-none" />
                <div
                  ref={lookPadKnobRef}
                  style={{
                    transform: 'translate3d(0px, 0px, 0)',
                    willChange: 'transform',
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center pointer-events-none ${
                    isLookPadActive
                      ? 'bg-sky-400 text-slate-950 shadow-md'
                      : 'bg-white/90 text-slate-900'
                  }`}
                >
                  <Move className="w-4 h-4" />
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200/90 drop-shadow">
                Right Thumb · Rotate View
              </span>
            </div>

            {/* Right-Thumb Quick Action Buttons (Jump & Slide) */}
            <div className="flex flex-col gap-2 pb-4">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerJumpRef.current?.();
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-display font-bold shadow-xl shadow-sky-500/30 border-2 border-sky-200/80 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition"
                title="Jump / Double Jump"
              >
                <ArrowUp className="w-5 h-5 stroke-[2.8]" />
                <span className="text-[11px] tracking-tight leading-none">JUMP</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerSlideRef.current?.();
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-display font-bold shadow-xl shadow-amber-500/30 border-2 border-amber-200/85 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition"
                title="Ground Slide & Dash"
              >
                <Zap className="w-4.5 h-4.5 stroke-[2.6]" />
                <span className="text-[11px] tracking-tight leading-none">SLIDE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Safety Fallback */}
      {webglLost && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
          <p className="font-display text-xl text-white mb-2">Restoring 3D Viewport...</p>
          <p className="text-sm text-slate-400 max-w-sm">
            Graphics context was temporarily suspended by your device. Tap any resident below to
            continue conversing.
          </p>
        </div>
      )}
    </div>
  );
};
