import React, { useEffect, useMemo, useState } from 'react';
import {
  AICharacter,
  BuildingId,
  CreatedWorldObject,
  ExplorerProfile,
  SocialEvent,
} from '../types/game';
import {
  CITY_BUILDINGS,
  DEFAULT_EXPLORER_PROFILE,
  getOrCreateResidentDailyGoal,
} from '../data/cityData';
import {
  Activity,
  AlertCircle,
  Building2,
  Compass,
  Flame,
  Layers,
  MapPin,
  MessageSquareHeart,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

export type WorldAlmanacTab =
  | 'directory'
  | 'heatmap'
  | 'social'
  | 'landmarks'
  | 'architecture';

interface WorldGuideModalProps {
  isOpen: boolean;
  initialTab?: WorldAlmanacTab;
  characters: AICharacter[];
  socialEvents: SocialEvent[];
  createdObjects?: CreatedWorldObject[];
  explorerProfile?: ExplorerProfile;
  playerPosition?: { x: number; z: number };
  onClose: () => void;
  onSelectCharacter: (id: string) => void;
  onSelectBuilding: (id: BuildingId) => void;
  onTriggerRandomSocial: () => void;
}

interface ZoneHeatMetrics {
  buildingId: BuildingId;
  name: string;
  subtitle: string;
  category: string;
  position: [number, number, number];
  liveResidents: AICharacter[];
  socialEventCount: number;
  routineHoursCount: number;
  creationsCount: number;
  explorerNotesCount: number;
  heatScore: number; // 0 to 100
  zoneStatus: 'hotspot' | 'moderate' | 'under_utilized';
  explorerInsight: string;
}

export const WorldGuideModal: React.FC<WorldGuideModalProps> = ({
  isOpen,
  initialTab = 'directory',
  characters,
  socialEvents,
  createdObjects = [],
  explorerProfile = DEFAULT_EXPLORER_PROFILE,
  playerPosition = { x: 0, z: 6.2 },
  onClose,
  onSelectCharacter,
  onSelectBuilding,
  onTriggerRandomSocial,
}) => {
  const [tab, setTab] = useState<WorldAlmanacTab>(initialTab);
  const [selectedZoneId, setSelectedZoneId] = useState<BuildingId | null>(null);
  const [heatmapFilter, setHeatmapFilter] = useState<'all' | 'hotspot' | 'under_utilized'>('all');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Compute Explorer-driven City Heatmap metrics across all zones
  const zoneMetricsList = useMemo<ZoneHeatMetrics[]>(() => {
    const fieldNotes = explorerProfile.fieldNotes || [];
    const buildings = Object.values(CITY_BUILDINGS);

    const rawMetrics = buildings.map((b) => {
      // 1. Live residents currently in or within 16m of this building/zone
      const liveResidents = characters.filter((c) => {
        if (c.currentLocationId === b.id) return true;
        const dist = Math.hypot(
          c.currentPosition.x - b.position[0],
          c.currentPosition.z - b.position[2]
        );
        return dist < 16.0;
      });

      // 2. Social events that occurred at this landmark
      const socialEventCount = socialEvents.filter(
        (ev) =>
          ev.locationName.toLowerCase().includes(b.name.toLowerCase()) ||
          b.name.toLowerCase().includes(ev.locationName.toLowerCase())
      ).length;

      // 3. Total daily routine hours scheduled at this location across all residents
      let routineHoursCount = 0;
      characters.forEach((c) => {
        c.routines.forEach((r) => {
          if (r.locationId === b.id) {
            const duration =
              r.endHour >= r.startHour
                ? r.endHour - r.startHour
                : 24 - r.startHour + r.endHour;
            routineHoursCount += duration;
          }
        });
      });

      // 4. Autonomous 3D creations built near this zone
      const creationsCount = createdObjects.filter((obj) => obj.locationId === b.id).length;

      // 5. Explorer Field Notes referencing this location or residents here
      const explorerNotesCount = fieldNotes.filter(
        (note) =>
          note.observation.toLowerCase().includes(b.name.toLowerCase()) ||
          note.actionableImprovement.toLowerCase().includes(b.name.toLowerCase()) ||
          liveResidents.some((r) => r.id === note.targetCharacterId)
      ).length;

      // Weighted Congregation & Activity Score
      const rawScore =
        liveResidents.length * 24 +
        socialEventCount * 14 +
        routineHoursCount * 2.2 +
        creationsCount * 10 +
        explorerNotesCount * 6;

      return {
        building: b,
        liveResidents,
        socialEventCount,
        routineHoursCount,
        creationsCount,
        explorerNotesCount,
        rawScore,
      };
    });

    const maxRaw = Math.max(1, ...rawMetrics.map((m) => m.rawScore));

    return rawMetrics
      .map((m) => {
        const normalized = Math.min(
          100,
          Math.max(12, Math.round((m.rawScore / maxRaw) * 92) + (m.liveResidents.length > 0 ? 8 : 0))
        );

        const zoneStatus: ZoneHeatMetrics['zoneStatus'] =
          normalized >= 68
            ? 'hotspot'
            : normalized >= 42
            ? 'moderate'
            : 'under_utilized';

        let explorerInsight = '';
        if (zoneStatus === 'hotspot') {
          explorerInsight = `${explorerProfile.name}'s Data: High social congregation hub (${m.liveResidents.length} live residents, ${m.socialEventCount} social encounters). Ideal for group conversations and shared memories.`;
        } else if (zoneStatus === 'moderate') {
          explorerInsight = `${explorerProfile.name}'s Data: Steady community flow (${m.routineHoursCount}h daily routines, ${m.creationsCount} AI creations). Balanced environment for focused goal progress.`;
        } else {
          explorerInsight = `${explorerProfile.name}'s Data: Under-utilized zone (${m.liveResidents.length} residents currently here). Send residents here or spark an encounter to activate this space!`;
        }

        return {
          buildingId: m.building.id,
          name: m.building.name,
          subtitle: m.building.subtitle,
          category: m.building.category,
          position: m.building.position,
          liveResidents: m.liveResidents,
          socialEventCount: m.socialEventCount,
          routineHoursCount: m.routineHoursCount,
          creationsCount: m.creationsCount,
          explorerNotesCount: m.explorerNotesCount,
          heatScore: normalized,
          zoneStatus,
          explorerInsight,
        };
      })
      .sort((a, b) => b.heatScore - a.heatScore);
  }, [characters, socialEvents, createdObjects, explorerProfile]);

  if (!isOpen) return null;

  const topHotspot = zoneMetricsList[0];
  const mostUnderUtilized = zoneMetricsList[zoneMetricsList.length - 1];
  const underUtilizedCount = zoneMetricsList.filter(
    (z) => z.zoneStatus === 'under_utilized'
  ).length;
  const hotspotCount = zoneMetricsList.filter((z) => z.zoneStatus === 'hotspot').length;

  const filteredZones = zoneMetricsList.filter((z) => {
    if (heatmapFilter === 'hotspot') return z.zoneStatus === 'hotspot';
    if (heatmapFilter === 'under_utilized') return z.zoneStatus === 'under_utilized';
    return true;
  });

  // Helper to convert 3D world (x, z) coordinates [-40..40, -38..38] into 2D map percentages [8%..92%]
  const toMapPercent = (x: number, z: number) => {
    const px = Math.min(92, Math.max(8, ((x + 40) / 80) * 84 + 8));
    const py = Math.min(90, Math.max(10, ((z + 38) / 76) * 80 + 10));
    return { left: `${px}%`, top: `${py}%` };
  };

  if (isPanelCollapsed) {
    return (
      <div className="fixed top-1/2 -translate-y-1/2 right-0 z-40 flex flex-col items-end gap-1 pointer-events-auto">
        <div className="flex items-center bg-slate-950/92 backdrop-blur-xl border border-r-0 border-amber-400/50 rounded-l-2xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition"
            title="Expand World Almanac & Heatmap Side Panel"
          >
            <span>◂ 📖 World Almanac</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-rose-500/30 border-l border-white/10 transition"
            title="Close Almanac"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[92vw] sm:w-[460px] md:w-[540px] h-full flex pointer-events-auto">
      <div className="w-full h-full bg-slate-900/96 backdrop-blur-xl border-l border-white/15 rounded-l-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
              Gemini City — Society Almanac &amp; Heatmap
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Independent AI residents · Explorer City Heatmap · Emergent friendships &amp; events
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 transition"
              title="Collapse panel to side edge so the 3D world is clearly visible"
            >
              ▸
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Almanac"
              className="p-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setTab('directory')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === 'directory'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Independent Residents</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('heatmap')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === 'heatmap'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                : 'text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>City Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('social')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === 'social'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5" />
            <span>Town Social Feed ({socialEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('landmarks')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === 'landmarks'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>City Landmarks</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('architecture')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === 'architecture'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Society Engine & Controls</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
          {/* TAB 1: DIRECTORY */}
          {tab === 'directory' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Each resident has an independent life, personal needs, and evolving friendships. Tap
                any resident below to focus the 3D camera on them and open a conversation.
              </p>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {characters.map((char) => {
                  const loc = CITY_BUILDINGS[char.currentLocationId];
                  const topFriend = [...char.relationships].sort(
                    (a, b) => b.affinity - a.affinity
                  )[0];
                  const dGoal = getOrCreateResidentDailyGoal(
                    char,
                    char.dailyGoal?.dayNumber || 1,
                    'sunny'
                  );
                  return (
                    <div
                      key={char.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: char.avatarColor }}
                          />
                          <h3 className="text-sm font-semibold text-white">{char.name}</h3>
                          <span aria-hidden="true" className="text-slate-500">
                            ·
                          </span>
                          <span className="text-xs font-mono text-amber-300">
                            {char.modelBadge}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                              dGoal.completed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                                : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                            }`}
                          >
                            {dGoal.badgeIcon} Daily Goal: {dGoal.title} (
                            {dGoal.completed ? '✅ 100%' : `${Math.round(dGoal.progress)}%`})
                          </span>
                        </div>

                        <div className="text-xs text-slate-400">
                          <span>{char.independentTitle}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="text-emerald-400">At {loc?.name}</span>
                          {topFriend && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="text-slate-300">
                                Closest Bond: {topFriend.targetName.split(' ')[0]} ({topFriend.status})
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 italic truncate">
                          “{char.currentActivity}”
                        </p>
                        <div className="text-[11px] text-sky-300 truncate">
                          <strong>Autonomous Decision Context:</strong> {char.decisionReason}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectCharacter(char.id);
                          onClose();
                        }}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 self-start sm:self-center transition-transform active:scale-95"
                      >
                        Talk to {char.name.split(' ')[0]}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: EXPLORER CITY HEATMAP VIEW */}
          {tab === 'heatmap' && (
            <div className="space-y-5">
              {/* Explorer Telemetry Summary Banner */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>{explorerProfile.name}’s Spatial Congregation & Activity Heatmap</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Synthesizes live resident positions, {socialEvents.length} social encounters,{' '}
                    {(explorerProfile.fieldNotes || []).length} Explorer field notes, and daily
                    routines to highlight high-activity hotspots vs. under-utilized city zones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onTriggerRandomSocial}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Spark Social Activity</span>
                </button>
              </div>

              {/* Top KPI Summary Cards: #1 Hotspot vs Most Under-Utilized Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topHotspot && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-400/35 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-rose-300">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Top Social Hotspot</span>
                      </span>
                      <span className="font-mono">{topHotspot.heatScore}% Heat</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">{topHotspot.name}</div>
                    <div className="text-[11px] text-slate-300">
                      {topHotspot.liveResidents.length} residents now · {topHotspot.socialEventCount}{' '}
                      chats
                    </div>
                  </div>
                )}

                {mostUnderUtilized && (
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-400/35 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Most Under-Utilized</span>
                      </span>
                      <span className="font-mono">{mostUnderUtilized.heatScore}% Heat</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {mostUnderUtilized.name}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {mostUnderUtilized.liveResidents.length} residents now · Needs activation
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/35 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>City Zone Balance</span>
                    </span>
                    <span className="font-mono">{characters.length} AI Live</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {hotspotCount} Hotspots · {underUtilizedCount} Quiet Zones
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {(explorerProfile.fieldNotes || []).length} Explorer notes logged
                  </div>
                </div>
              </div>

              {/* Interactive 2D Top-Down Spatial City Heatmap Radar */}
              <div className="rounded-2xl bg-slate-950 border border-white/15 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Interactive 2D City Thermal Map (Tap Any Zone or Resident)</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-rose-300 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      High Activity (70%+)
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      Moderate (42–69%)
                    </span>
                    <span className="flex items-center gap-1 text-indigo-300 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                      Under-Utilized (&lt;42%)
                    </span>
                  </div>
                </div>

                {/* Map Viewport */}
                <div className="relative w-full h-80 sm:h-92 rounded-2xl bg-slate-900/95 border border-white/10 overflow-hidden shadow-inner">
                  {/* Subtle Coordinate Grid & Roads Overlay */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
                      backgroundSize: '36px 36px',
                    }}
                  />
                  {/* Central Plaza Cross-Roads */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-6 bg-slate-800/50 border-y border-white/5 pointer-events-none" />
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-slate-800/50 border-x border-white/5 pointer-events-none" />

                  {/* Compass Directions */}
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest text-slate-500 pointer-events-none">
                    North District
                  </span>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest text-slate-500 pointer-events-none">
                    South Harbor
                  </span>

                  {/* 1. Thermal Glow Aura & Zone Nodes for Each Landmark */}
                  {zoneMetricsList.map((zone) => {
                    const pos = toMapPercent(zone.position[0], zone.position[2]);
                    const isSelected = selectedZoneId === zone.buildingId;
                    const auraSize = 68 + Math.round((zone.heatScore / 100) * 76);

                    const glowGradient =
                      zone.zoneStatus === 'hotspot'
                        ? 'radial-gradient(circle, rgba(244,63,94,0.52) 0%, rgba(245,158,11,0.26) 48%, rgba(244,63,94,0) 75%)'
                        : zone.zoneStatus === 'moderate'
                        ? 'radial-gradient(circle, rgba(245,158,11,0.42) 0%, rgba(16,185,129,0.18) 50%, rgba(16,185,129,0) 75%)'
                        : 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0.08) 50%, rgba(99,102,241,0) 75%)';

                    const badgeColor =
                      zone.zoneStatus === 'hotspot'
                        ? 'bg-rose-500/90 border-rose-300 text-white'
                        : zone.zoneStatus === 'moderate'
                        ? 'bg-amber-400/95 border-amber-200 text-slate-950'
                        : 'bg-indigo-950/90 border-indigo-400/60 border-dashed text-indigo-200';

                    return (
                      <div
                        key={zone.buildingId}
                        style={{ left: pos.left, top: pos.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                      >
                        {/* Radial Thermal Heat Blob */}
                        <div
                          style={{
                            width: `${auraSize}px`,
                            height: `${auraSize}px`,
                            background: glowGradient,
                          }}
                          className="rounded-full pointer-events-none transition-all duration-500"
                        />

                        {/* Clickable Zone Marker */}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedZoneId((prev) =>
                              prev === zone.buildingId ? null : zone.buildingId
                            )
                          }
                          className={`-mt-10 px-2.5 py-1 rounded-xl border text-[10px] font-bold shadow-lg whitespace-nowrap flex items-center gap-1.5 transition transform hover:scale-105 ${badgeColor} ${
                            isSelected ? 'ring-2 ring-white scale-105' : ''
                          }`}
                        >
                          <span>
                            {zone.zoneStatus === 'hotspot'
                              ? '🔥'
                              : zone.zoneStatus === 'moderate'
                              ? '⚡'
                              : '❄️'}
                          </span>
                          <span>{zone.name.split(' ').slice(0, 2).join(' ')}</span>
                          <span className="font-mono opacity-90">{zone.heatScore}%</span>
                        </button>

                        {zone.zoneStatus === 'under_utilized' && (
                          <span className="mt-0.5 px-1.5 py-0.2 rounded bg-indigo-950/90 border border-indigo-400/40 text-[9px] font-semibold text-indigo-300 whitespace-nowrap">
                            Under-Utilized Zone
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* 2. Live AI Resident Dots on the Heatmap */}
                  {characters.map((char) => {
                    const pos = toMapPercent(char.currentPosition.x, char.currentPosition.z);
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          onSelectCharacter(char.id);
                          onClose();
                        }}
                        style={{ left: pos.left, top: pos.top }}
                        title={`${char.name}: ${char.currentActivity}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group flex flex-col items-center"
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[8px] font-bold text-white transition group-hover:scale-125 ${
                            char.conversingWithId ? 'animate-bounce ring-2 ring-amber-300' : ''
                          }`}
                          style={{ backgroundColor: char.avatarColor }}
                        >
                          {char.name[0]}
                        </span>
                        <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/90 text-[9px] font-semibold text-white whitespace-nowrap border border-white/15">
                          {char.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}

                  {/* 3. Explorer (Johnny) Live Position Pin */}
                  {(() => {
                    const expPos = toMapPercent(playerPosition.x, playerPosition.z);
                    return (
                      <div
                        style={{ left: expPos.left, top: expPos.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-25 flex flex-col items-center pointer-events-none"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-400 border-2 border-slate-950 text-slate-950 font-bold text-[10px] flex items-center justify-center shadow-lg">
                          ★
                        </span>
                        <span className="mt-0.5 px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-bold whitespace-nowrap shadow">
                          {explorerProfile.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Selected Zone Detail Callout */}
                {selectedZoneId &&
                  (() => {
                    const sel = zoneMetricsList.find((z) => z.buildingId === selectedZoneId);
                    if (!sel) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{sel.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold">
                              {sel.heatScore}% Social Activity
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {sel.explorerInsight}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBuilding(sel.buildingId);
                            onClose();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Teleport Camera Here</span>
                        </button>
                      </div>
                    );
                  })()}
              </div>

              {/* Zone-by-Zone Breakdown with Filter Buttons */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Zone Congregation Ranking & Under-Utilized Diagnostics</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: `All Zones (${zoneMetricsList.length})` },
                        { id: 'hotspot', label: `🔥 Hotspots (${hotspotCount})` },
                        {
                          id: 'under_utilized',
                          label: `❄️ Under-Utilized (${underUtilizedCount})`,
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHeatmapFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          heatmapFilter === f.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {filteredZones.map((zone) => {
                    const barColor =
                      zone.zoneStatus === 'hotspot'
                        ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                        : zone.zoneStatus === 'moderate'
                        ? 'bg-gradient-to-r from-sky-400 to-emerald-400'
                        : 'bg-indigo-400';

                    return (
                      <div
                        key={zone.buildingId}
                        className={`p-4 rounded-2xl border space-y-2.5 ${
                          zone.zoneStatus === 'hotspot'
                            ? 'bg-slate-950/90 border-rose-400/35'
                            : zone.zoneStatus === 'under_utilized'
                            ? 'bg-slate-950/90 border-indigo-400/35'
                            : 'bg-slate-950/80 border-white/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{zone.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                zone.zoneStatus === 'hotspot'
                                  ? 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
                                  : zone.zoneStatus === 'moderate'
                                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                                  : 'bg-indigo-500/20 border border-indigo-400/40 text-indigo-300'
                              }`}
                            >
                              {zone.zoneStatus === 'hotspot'
                                ? '🔥 High Social Hotspot'
                                : zone.zoneStatus === 'moderate'
                                ? '⚡ Active Zone'
                                : '❄️ Under-Utilized Zone'}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {zone.heatScore}% Activity Index
                          </span>
                        </div>

                        {/* Thermal Bar */}
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${zone.heatScore}%` }}
                          />
                        </div>

                        {/* Metrics Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-slate-400 block">Live Residents</span>
                            <span className="font-bold text-white">
                              {zone.liveResidents.length > 0
                                ? zone.liveResidents.map((r) => r.name.split(' ')[0]).join(', ')
                                : '0 right now'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-slate-400 block">Social Encounters</span>
                            <span className="font-mono font-bold text-amber-300">
                              {zone.socialEventCount} logged
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-slate-400 block">Routine Coverage</span>
                            <span className="font-mono font-bold text-sky-300">
                              {zone.routineHoursCount} hrs/day
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-slate-400 block">AI Creations</span>
                            <span className="font-mono font-bold text-emerald-300">
                              {zone.creationsCount} built
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {zone.explorerInsight}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBuilding(zone.buildingId);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-amber-300 shrink-0 flex items-center gap-1.5 self-start sm:self-center transition"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>View Zone in 3D</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOCIAL FEED */}
          {tab === 'social' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Independent residents discover nearby neighbors, discuss shared interests, and
                  build friendships organically.
                </p>
                <button
                  type="button"
                  onClick={onTriggerRandomSocial}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Spark Encounter</span>
                </button>
              </div>

              <div className="divide-y divide-white/10 border-y border-white/10">
                {socialEvents.map((ev, evIdx) => (
                  <div key={`${ev.id}_${evIdx}`} className="py-3.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono tabular-nums text-amber-300">{ev.gameTime}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-white font-medium">
                        {ev.speakerAName} & {ev.speakerBName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{ev.locationName}</span>
                      {ev.topic && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400 font-mono text-[11px]">
                            Topic: {ev.topic}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="space-y-1.5 pl-3 border-l-2 border-amber-400/40 text-xs">
                      {ev.lines.map((line, i) => (
                        <p key={i} className="text-slate-200 leading-relaxed">
                          <strong className="text-white">{line.speakerName}: </strong>“{line.text}”
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LANDMARKS */}
          {tab === 'landmarks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(CITY_BUILDINGS).map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">{b.name}</h3>
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: b.roofColor }}
                      />
                    </div>
                    <p className="text-xs text-amber-300/90 mt-0.5">{b.subtitle}</p>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{b.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectBuilding(b.id);
                      onClose();
                    }}
                    className="min-h-[40px] w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Landmark in 3D</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: ARCHITECTURE */}
          {tab === 'architecture' && (
            <div className="space-y-5 text-xs text-slate-300 leading-relaxed">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  01. Mobile-First Touch & Desktop Controls
                </h3>
                <p>
                  Use the bottom-left <strong>Virtual Thumb Joystick</strong> or tap directly on any
                  road, park plaza, or building to walk your explorer character there. Drag anywhere
                  on the sky/world to orbit the camera, and pinch with two fingers (or scroll wheel)
                  to zoom. On desktop, <strong>WASD / Arrow Keys</strong> also move your character.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  02. Autonomous Needs, Emergent Friendships & Player Approach
                </h3>
                <p>
                  Every AI resident lives an independent life driven by personal ambitions,
                  schedules, and dynamic needs (<strong>Energy</strong>, <strong>Social</strong>,
                  and <strong>Inspiration</strong>). Residents autonomously choose where to go,
                  discover nearby neighbors, build friendship affinity from Acquaintance to Close
                  Friend, and can notice and walk up to the player to initiate conversations.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  03. Server-Side Gemini API & Dynamic Memory Engine
                </h3>
                <p>
                  All AI conversations route through the Express backend (
                  <code className="font-mono text-amber-300">/api/chat</code> and{' '}
                  <code className="font-mono text-amber-300">/api/socialize</code>) using the{' '}
                  <code className="font-mono text-amber-300">@google/genai</code> SDK with
                  structured JSON schemas. Every conversation generates an in-character spoken
                  reply, an internal thought, a mood shift, and a real episodic memory stored in the
                  resident’s profile.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
