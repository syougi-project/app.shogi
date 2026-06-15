import { Image } from 'expo-image';
import { Crown, Shield } from 'lucide-react-native';
import { memo, useEffect, useMemo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';

import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { BoardCell } from '@/features/stage-shogi/domain/game-rules';
import { StageShogiSkillParticleLayer } from '@/features/stage-shogi/ui/components/stage-shogi-skill-particle-layer';
import {
  BOARD_CELL,
  BOARD_CELL_INNER_RATIO,
  BOARD_INNER,
  BOARD_PADDING,
  BOARD_PADDING_RATIO,
  BOARD_PIECE_SIZE_OVERRIDES,
  BOARD_SIZE,
  BOARD_VIEWBOX,
  type ArrowCellDisplay,
  type BoardPiece,
  KING_PIECE_SIZE_PERCENT,
  NORMAL_PIECE_SIZE_PERCENT,
  ARROW_DOWN_CELL_IMAGE_SOURCE,
  ARROW_LEFT_CELL_IMAGE_SOURCE,
  ARROW_RIGHT_CELL_IMAGE_SOURCE,
  ARROW_UP_CELL_IMAGE_SOURCE,
  BATSU_CELL_IMAGE_SOURCE,
  CHRYSANTHEMUM_REVIVAL_IMAGE_SOURCE,
  POISON_CELL_IMAGE_SOURCE,
  SAFE_ROOM_CELL_IMAGE_SOURCE,
  PRISON_CHAIN_IMAGE_SOURCE,
  ROCK_OBSTACLE_IMAGE_SOURCE,
  THORN_CELL_IMAGE_SOURCE,
  collectStandardBaseCodesForLocalPromotedImage,
  fallbackPiecePalette,
  getDisplayChar,
  getPieceImageSource,
  isEnemySide,
  isGiantTwoByTwoBoardPiece,
  isKingChar,
  kirinShowsImmunityShieldMark,
  isPromotedVisualPiece,
  localPromotedModuleFromBaseCodeCandidates,
  normalizeCellIndex,
  resolvePromotedImageSource,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';

export type PromotionImageFlash = {
  row: number;
  col: number;
  side: 'player' | 'enemy';
  assetModule: number;
  flashKey: string;
};

const YangSkillSparkleRing = memo(function YangSkillSparkleRing() {
  const pulse = useSharedValue(0.42);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 480, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.34, { duration: 480, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: '4%',
          right: '4%',
          top: '5%',
          bottom: '5%',
          borderRadius: 999,
          borderWidth: 2.5,
          borderColor: 'rgba(249, 115, 22, 0.98)',
          backgroundColor: 'rgba(255, 237, 213, 0.28)',
          shadowColor: '#f97316',
          shadowOpacity: 0.92,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
        animatedStyle,
      ]}
    />
  );
});

const KirinImmunityShieldBadge = memo(function KirinImmunityShieldBadge() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -4,
        left: -2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#facc15',
        borderWidth: 2,
        borderColor: '#b45309',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 24,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      <Shield size={20} color="#92400e" strokeWidth={2.6} fill="#fef08a" />
    </View>
  );
});

const MaiDanceRestrictionXMark = memo(function MaiDanceRestrictionXMark() {
  const barStyle: ViewStyle = {
    position: 'absolute' as const,
    width: '86%' as const,
    height: 3,
    backgroundColor: 'rgba(250, 204, 21, 0.96)',
    borderRadius: 2,
    shadowColor: '#ca8a04',
    shadowOpacity: 0.85,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  };
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        top: '8%',
        bottom: '8%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={[barStyle, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[barStyle, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
});

const YinSkillSparkleRing = memo(function YinSkillSparkleRing() {
  const pulse = useSharedValue(0.38);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 520, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: '11%',
          right: '11%',
          top: '12%',
          bottom: '12%',
          borderRadius: 999,
          borderWidth: 2,
          borderColor: 'rgba(168, 85, 247, 0.98)',
          backgroundColor: 'rgba(126, 34, 206, 0.24)',
          shadowColor: '#9333ea',
          shadowOpacity: 0.92,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        animatedStyle,
      ]}
    />
  );
});

type BoardPieceSpriteProps = {
  piece: BoardPiece;
  failed: boolean;
  onImageError: () => void;
  instantPromotedSource?: number | null;
  instantPromotedKey?: string | null;
  darkVeiled?: boolean;
  aTransformed?: boolean;
  prisonChained?: boolean;
  stunnedAura?: boolean;
  abyssAura?: boolean;
  lightProtectionAura?: boolean;
  deathCurseAura?: boolean;
  deathCurseCountdown?: number | null;
  chrysanthemumRevivalMark?: boolean;
  yangSkillSparkle?: boolean;
  yinSkillSparkle?: boolean;
  maiDanceRestrictionMark?: boolean;
  kirinImmunityShieldMark?: boolean;
};

const BoardPieceSprite = memo(function BoardPieceSprite({
  piece,
  failed,
  onImageError,
  instantPromotedSource = null,
  instantPromotedKey = null,
  darkVeiled = false,
  aTransformed = false,
  prisonChained = false,
  stunnedAura = false,
  abyssAura = false,
  lightProtectionAura = false,
  deathCurseAura = false,
  deathCurseCountdown = null,
  chrysanthemumRevivalMark = false,
  yangSkillSparkle = false,
  yinSkillSparkle = false,
  maiDanceRestrictionMark = false,
  kirinImmunityShieldMark = false,
}: BoardPieceSpriteProps) {
  const rowIndex = normalizeCellIndex(piece.row);
  const colIndex = normalizeCellIndex(piece.col);
  if (rowIndex === null || colIndex === null) {
    return null;
  }

  const enemy = isEnemySide(piece.side);
  const king = piece.pieceCode === 'OU' || isKingChar(piece.char);
  const giant2x2 = isGiantTwoByTwoBoardPiece(piece);
  const cellSpan = giant2x2 ? 2 : 1;
  const pieceScalePercent = giant2x2
    ? 100
    : (BOARD_PIECE_SIZE_OVERRIDES[piece.char] ??
      (king ? KING_PIECE_SIZE_PERCENT : NORMAL_PIECE_SIZE_PERCENT));
  const isStage4DragonVisual =
    (piece.pieceCode?.toUpperCase() ?? '') === 'RYU' && piece.char === '竜';
  const bundledPromoted =
    !isStage4DragonVisual && (piece.promoted || isPromotedVisualPiece(piece))
      ? localPromotedModuleFromBaseCodeCandidates(
          collectStandardBaseCodesForLocalPromotedImage(piece),
        )
      : null;
  const localPromotedImageSource =
    instantPromotedSource != null
      ? instantPromotedSource
      : bundledPromoted != null
        ? bundledPromoted
        : resolvePromotedImageSource(piece);
  const bundledOrLocalSource =
    localPromotedImageSource ?? (failed ? null : getPieceImageSource(piece)) ?? null;
  const imageAssetFingerprint =
    typeof bundledOrLocalSource === 'number'
      ? `m${bundledOrLocalSource}`
      : failed
        ? 'fail'
        : 'none';
  const imageSource = bundledOrLocalSource;
  const pieceImageRecyclingKey = `${instantPromotedKey ?? 'x'}-${piece.side}-r${piece.row}-c${piece.col}-p${piece.promoted ? 1 : 0}-ch${piece.char}-pc${piece.pieceCode ?? ''}-src${imageAssetFingerprint}`;

  return (
    <View
      style={{
        position: 'absolute',
        top: `${rowIndex * BOARD_CELL_INNER_RATIO * 100}%`,
        left: `${colIndex * BOARD_CELL_INNER_RATIO * 100}%`,
        width: `${cellSpan * BOARD_CELL_INNER_RATIO * 100}%`,
        height: `${cellSpan * BOARD_CELL_INNER_RATIO * 100}%`,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: giant2x2 ? 8 : 0,
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: `${pieceScalePercent}%`,
          height: `${pieceScalePercent}%`,
          position: 'relative',
        }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            transform: [{ rotate: enemy ? '180deg' : '0deg' }],
            borderWidth: aTransformed ? 2 : 0,
            borderRadius: aTransformed ? 8 : 0,
            borderColor: aTransformed ? 'rgba(255, 215, 64, 0.9)' : 'transparent',
            backgroundColor: aTransformed ? 'rgba(255, 215, 64, 0.14)' : 'transparent',
          }}
        >
          <View style={{ width: '100%', height: '100%', position: 'relative' }}>
            {localPromotedImageSource != null ? (
              <Image
                key={`pl-${instantPromotedKey ?? 'n'}-${piece.side}-${piece.row}-${piece.col}-${piece.promoted ? 1 : 0}-${piece.char}-${piece.pieceCode ?? ''}`}
                recyclingKey={pieceImageRecyclingKey}
                source={localPromotedImageSource}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
                style={{ width: '100%', height: '100%' }}
              />
            ) : imageSource ? (
              <Image
                key={`uri-${piece.side}-${piece.row}-${piece.col}-${piece.promoted ? 1 : 0}-${piece.char}-${piece.pieceCode ?? ''}-src${imageAssetFingerprint}`}
                recyclingKey={pieceImageRecyclingKey}
                source={imageSource}
                contentFit="contain"
                style={{ width: '100%', height: '100%' }}
                onError={onImageError}
              />
            ) : (
              <View style={{ width: '100%', height: '100%' }}>
                <Svg width="100%" height="100%" viewBox="0 0 100 120">
                  <Polygon
                    points="50,3 97,30 83,117 17,117 3,30"
                    fill={fallbackPiecePalette(piece.side).fill}
                    stroke={fallbackPiecePalette(piece.side).stroke}
                    strokeWidth={5}
                  />
                </Svg>
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  {king ? (
                    <Crown size={16} color={fallbackPiecePalette(piece.side).icon} />
                  ) : (
                    <Shield size={16} color={fallbackPiecePalette(piece.side).icon} />
                  )}
                  <Text
                    className="text-sm font-black"
                    style={{ color: fallbackPiecePalette(piece.side).text }}
                  >
                    {darkVeiled ? '' : getDisplayChar(piece)}
                  </Text>
                </View>
              </View>
            )}
            {darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: '#000000',
                }}
              />
            ) : null}
            {prisonChained && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: '6%',
                  right: '6%',
                  top: '8%',
                  bottom: '8%',
                  opacity: 0.88,
                }}
              >
                <Image
                  source={PRISON_CHAIN_IMAGE_SOURCE}
                  contentFit="contain"
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            ) : null}
            {stunnedAura && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  top: '10%',
                  bottom: '10%',
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: 'rgba(34, 197, 94, 0.95)',
                  backgroundColor: 'rgba(34, 197, 94, 0.16)',
                  opacity: 0.95,
                }}
              />
            ) : null}
            {abyssAura && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  top: '10%',
                  bottom: '10%',
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: 'rgba(147, 51, 234, 0.95)',
                  backgroundColor: 'rgba(147, 51, 234, 0.18)',
                  opacity: 0.95,
                }}
              />
            ) : null}
            {lightProtectionAura && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: '9%',
                  right: '9%',
                  top: '9%',
                  bottom: '9%',
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: 'rgba(254, 249, 210, 0.98)',
                  backgroundColor: 'rgba(255, 252, 220, 0.28)',
                  opacity: 0.98,
                }}
              />
            ) : null}
            {deathCurseAura && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: '8%',
                  right: '8%',
                  top: '8%',
                  bottom: '8%',
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: 'rgba(239, 68, 68, 0.95)',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  opacity: 0.96,
                }}
              />
            ) : null}
            {deathCurseAura && !darkVeiled && deathCurseCountdown != null ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: '2%',
                  right: '2%',
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: 'rgba(127, 29, 29, 0.95)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 200, 200, 0.95)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                  {String(deathCurseCountdown)}
                </Text>
              </View>
            ) : null}
            {chrysanthemumRevivalMark && !darkVeiled ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: '-2%',
                  right: '2%',
                  width: '54%',
                  height: '54%',
                  maxWidth: 56,
                  maxHeight: 56,
                }}
              >
                <Image
                  source={CHRYSANTHEMUM_REVIVAL_IMAGE_SOURCE}
                  contentFit="contain"
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            ) : null}
            {yinSkillSparkle && !darkVeiled ? <YinSkillSparkleRing /> : null}
            {yangSkillSparkle && !darkVeiled ? <YangSkillSparkleRing /> : null}
            {maiDanceRestrictionMark && !darkVeiled ? <MaiDanceRestrictionXMark /> : null}
          </View>
        </View>
        {kirinImmunityShieldMark && !darkVeiled ? <KirinImmunityShieldBadge /> : null}
      </View>
    </View>
  );
});

const StaticBoardBackground = memo(function StaticBoardBackground() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`}>
      <Rect x={0} y={0} width={BOARD_VIEWBOX} height={BOARD_VIEWBOX} fill="#deb887" />
      <Rect
        x={BOARD_PADDING}
        y={BOARD_PADDING}
        width={BOARD_INNER}
        height={BOARD_INNER}
        fill="#e8c88e"
        stroke="#7a4b20"
        strokeWidth={2}
      />
      {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => {
        const p = BOARD_PADDING + BOARD_CELL * i;
        return (
          <Line
            key={`v-${i}`}
            x1={p}
            y1={BOARD_PADDING}
            x2={p}
            y2={BOARD_PADDING + BOARD_INNER}
            stroke="#6b3f1a"
            strokeWidth={1.5}
          />
        );
      })}
      {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => {
        const p = BOARD_PADDING + BOARD_CELL * i;
        return (
          <Line
            key={`h-${i}`}
            x1={BOARD_PADDING}
            y1={p}
            x2={BOARD_PADDING + BOARD_INNER}
            y2={p}
            stroke="#6b3f1a"
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
});

const PoisonHazardLayer = memo(function PoisonHazardLayer({
  poisonHazards,
}: {
  poisonHazards: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      {poisonHazards.map((cell) => (
        <View
          key={`poison-image-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
            backgroundColor: '#7c3aed33',
          }}
        >
          <Image
            source={POISON_CELL_IMAGE_SOURCE}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const RockObstacleLayer = memo(function RockObstacleLayer({
  rockObstacles,
}: {
  rockObstacles: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 22 }}>
      {rockObstacles.map((cell) => (
        <View
          key={`rock-obstacle-image-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
          }}
        >
          <Image
            source={ROCK_OBSTACLE_IMAGE_SOURCE}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const ARROW_CELL_IMAGE_BY_DIRECTION = {
  up: ARROW_UP_CELL_IMAGE_SOURCE,
  left: ARROW_LEFT_CELL_IMAGE_SOURCE,
  down: ARROW_DOWN_CELL_IMAGE_SOURCE,
  right: ARROW_RIGHT_CELL_IMAGE_SOURCE,
} as const;

const ArrowCellLayer = memo(function ArrowCellLayer({
  arrowCells,
}: {
  arrowCells: ArrowCellDisplay[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 21 }}>
      {arrowCells.map((cell) => (
        <View
          key={`arrow-cell-image-${cell.row}-${cell.col}-${cell.direction}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
          }}
        >
          <Image
            source={ARROW_CELL_IMAGE_BY_DIRECTION[cell.direction]}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const BatsuHazardLayer = memo(function BatsuHazardLayer({
  batsuHazards,
}: {
  batsuHazards: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 23 }}>
      {batsuHazards.map((cell) => (
        <View
          key={`batsu-hazard-image-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
          }}
        >
          <Image
            source={BATSU_CELL_IMAGE_SOURCE}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const HEN_EDGE_HIGHLIGHT_COLOR = 'rgba(147, 51, 234, 0.42)';

const HenEdgeHighlightLayer = memo(function HenEdgeHighlightLayer({
  henEdgeHighlightCells,
}: {
  henEdgeHighlightCells: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 23 }}>
      {henEdgeHighlightCells.map((cell) => (
        <View
          key={`hen-edge-highlight-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
            backgroundColor: HEN_EDGE_HIGHLIGHT_COLOR,
            borderWidth: 1,
            borderColor: 'rgba(192, 132, 252, 0.85)',
          }}
        />
      ))}
    </View>
  );
});

const SafeRoomHazardLayer = memo(function SafeRoomHazardLayer({
  safeRoomHazards,
}: {
  safeRoomHazards: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
      {safeRoomHazards.map((cell) => (
        <View
          key={`safe-room-hazard-image-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
          }}
        >
          <Image
            source={SAFE_ROOM_CELL_IMAGE_SOURCE}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const ThornHazardLayer = memo(function ThornHazardLayer({
  thornHazards,
}: {
  thornHazards: BoardCell[];
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 24 }}>
      {thornHazards.map((cell) => (
        <View
          key={`thorn-hazard-image-${cell.row}-${cell.col}`}
          style={{
            position: 'absolute',
            top: `${cell.row * BOARD_CELL_INNER_RATIO * 100}%`,
            left: `${cell.col * BOARD_CELL_INNER_RATIO * 100}%`,
            width: `${BOARD_CELL_INNER_RATIO * 100}%`,
            height: `${BOARD_CELL_INNER_RATIO * 100}%`,
          }}
        >
          <Image
            source={THORN_CELL_IMAGE_SOURCE}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ))}
    </View>
  );
});

const BoardHighlightsLayer = memo(function BoardHighlightsLayer({
  selectedCell,
  legalTargets,
  aiPreviewTarget,
  enemyPreviewTargets,
}: {
  selectedCell: BoardCell | null;
  legalTargets: BoardCell[];
  aiPreviewTarget: BoardCell | null;
  enemyPreviewTargets: BoardCell[];
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${BOARD_INNER} ${BOARD_INNER}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      {selectedCell ? (
        <Rect
          x={selectedCell.col * BOARD_CELL}
          y={selectedCell.row * BOARD_CELL}
          width={BOARD_CELL}
          height={BOARD_CELL}
          fill="none"
          stroke="#2563eb"
          strokeWidth={4}
        />
      ) : null}
      {legalTargets.map((target) => (
        <Rect
          key={`legal-${target.row}-${target.col}`}
          x={target.col * BOARD_CELL}
          y={target.row * BOARD_CELL}
          width={BOARD_CELL}
          height={BOARD_CELL}
          fill="none"
          stroke="#16a34a"
          strokeWidth={4}
        />
      ))}
      {aiPreviewTarget ? (
        <Rect
          key={`ai-preview-${aiPreviewTarget.row}-${aiPreviewTarget.col}`}
          x={aiPreviewTarget.col * BOARD_CELL}
          y={aiPreviewTarget.row * BOARD_CELL}
          width={BOARD_CELL}
          height={BOARD_CELL}
          fill="#16a34a55"
          stroke="#16a34a"
          strokeWidth={4}
        />
      ) : null}
      {enemyPreviewTargets.map((target) => (
        <Rect
          key={`enemy-preview-${target.row}-${target.col}`}
          x={target.col * BOARD_CELL}
          y={target.row * BOARD_CELL}
          width={BOARD_CELL}
          height={BOARD_CELL}
          fill="#dc262622"
          stroke="#dc2626"
          strokeWidth={4}
        />
      ))}
    </Svg>
  );
});

const BoardTouchLayer = memo(function BoardTouchLayer({
  onCellPress,
  onCellLongPress,
}: {
  onCellPress: (row: number, col: number) => void;
  onCellLongPress: (row: number, col: number) => void;
}) {
  return (
    <>
      {Array.from({ length: BOARD_SIZE }).map((_, rowIndex) =>
        Array.from({ length: BOARD_SIZE }).map((__, colIndex) => (
          <Pressable
            key={`cell-${rowIndex}-${colIndex}`}
            testID={`board-cell-${rowIndex}-${colIndex}`}
            className="absolute items-center justify-center"
            style={{
              top: `${rowIndex * BOARD_CELL_INNER_RATIO * 100}%`,
              left: `${colIndex * BOARD_CELL_INNER_RATIO * 100}%`,
              width: `${BOARD_CELL_INNER_RATIO * 100}%`,
              height: `${BOARD_CELL_INNER_RATIO * 100}%`,
            }}
            onPress={() => {
              onCellPress(rowIndex, colIndex);
            }}
            onLongPress={() => {
              onCellLongPress(rowIndex, colIndex);
            }}
            delayLongPress={350}
          />
        )),
      )}
    </>
  );
});

const BoardPiecesLayer = memo(function BoardPiecesLayer({
  pieces,
  failedImageKeys,
  onPieceImageError,
  spriteEpoch = 0,
  promotionImageFlash = null,
}: {
  pieces: BoardPiece[];
  failedImageKeys: Record<string, true>;
  onPieceImageError: (pieceKey: string) => void;
  spriteEpoch?: number;
  promotionImageFlash?: PromotionImageFlash | null;
}) {
  const keySeqByBase = new Map<string, number>();
  const orderedPieces = useMemo(() => {
    const out = [...pieces];
    out.sort((a, b) => {
      const ga = isGiantTwoByTwoBoardPiece(a) ? 1 : 0;
      const gb = isGiantTwoByTwoBoardPiece(b) ? 1 : 0;
      return ga - gb;
    });
    return out;
  }, [pieces]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {orderedPieces.map((placement) => {
        const basePlacementKey = `${spriteEpoch}-${placement.side}-${placement.pieceCode ?? 'X'}-${placement.promoted ? 'P' : 'N'}-${getDisplayChar(placement)}-${placement.row}-${placement.col}`;
        const seq = keySeqByBase.get(basePlacementKey) ?? 0;
        keySeqByBase.set(basePlacementKey, seq + 1);
        const placementKey = `${basePlacementKey}-${seq}`;
        const flash =
          promotionImageFlash &&
          promotionImageFlash.side === placement.side &&
          promotionImageFlash.row === placement.row &&
          promotionImageFlash.col === placement.col
            ? promotionImageFlash
            : null;
        return (
          <BoardPieceSprite
            key={placementKey}
            piece={placement}
            failed={Boolean(failedImageKeys[placementKey])}
            onImageError={() => {
              onPieceImageError(placementKey);
            }}
            instantPromotedSource={flash?.assetModule ?? null}
            instantPromotedKey={flash?.flashKey ?? null}
            darkVeiled={Boolean(placement.darkVeiled)}
            aTransformed={Boolean(placement.aTransformed)}
            prisonChained={Boolean(placement.prisonChained)}
            stunnedAura={Boolean(placement.stunnedAura)}
            abyssAura={Boolean(placement.abyssAura)}
            lightProtectionAura={Boolean(placement.lightProtectionAura)}
            deathCurseAura={Boolean(placement.deathCurseAura)}
            deathCurseCountdown={placement.deathCurseCountdown ?? null}
            chrysanthemumRevivalMark={Boolean(placement.chrysanthemumRevivalMark)}
            yangSkillSparkle={Boolean(placement.yangSkillSparkle)}
            yinSkillSparkle={Boolean(placement.yinSkillSparkle)}
            maiDanceRestrictionMark={Boolean(placement.maiDanceRestrictionMark)}
            kirinImmunityShieldMark={kirinShowsImmunityShieldMark(pieces, placement)}
          />
        );
      })}
    </View>
  );
});

export function StageShogiBoard(props: {
  pieces: BoardPiece[];
  failedImageKeys: Record<string, true>;
  onPieceImageError: (pieceKey: string) => void;
  spriteEpoch?: number;
  promotionImageFlash?: PromotionImageFlash | null;
  selectedCell: BoardCell | null;
  legalTargets: BoardCell[];
  aiPreviewTarget: BoardCell | null;
  enemyPreviewTargets: BoardCell[];
  poisonHazardCells: BoardCell[];
  rockObstacleCells: BoardCell[];
  batsuHazardCells: BoardCell[];
  arrowCells: ArrowCellDisplay[];
  thornHazardCells: BoardCell[];
  safeRoomHazardCells: BoardCell[];
  henEdgeHighlightCells: BoardCell[];
  skillVisualEffects?: SkillVisualEffect[];
  onSkillVisualEffectFinished?: (effect: SkillVisualEffect) => void;
  onCellPress: (row: number, col: number) => void;
  onCellLongPress: (row: number, col: number) => void;
}) {
  const {
    pieces,
    failedImageKeys,
    onPieceImageError,
    spriteEpoch,
    promotionImageFlash,
    selectedCell,
    legalTargets,
    aiPreviewTarget,
    enemyPreviewTargets,
    poisonHazardCells,
    rockObstacleCells,
    batsuHazardCells,
    arrowCells,
    thornHazardCells,
    safeRoomHazardCells,
    henEdgeHighlightCells,
    skillVisualEffects = [],
    onSkillVisualEffectFinished,
    onCellPress,
    onCellLongPress,
  } = props;

  return (
    <View className="overflow-hidden rounded-xl border-2 border-[#a27700] bg-[#e3c690]">
      <View className="relative w-full self-center" style={{ aspectRatio: 1 }}>
        <StaticBoardBackground />

        <View
          className="absolute"
          style={{
            top: `${BOARD_PADDING_RATIO * 100}%`,
            left: `${BOARD_PADDING_RATIO * 100}%`,
            width: `${(BOARD_INNER / BOARD_VIEWBOX) * 100}%`,
            height: `${(BOARD_INNER / BOARD_VIEWBOX) * 100}%`,
          }}
        >
          <BoardHighlightsLayer
            selectedCell={selectedCell}
            legalTargets={legalTargets}
            aiPreviewTarget={aiPreviewTarget}
            enemyPreviewTargets={enemyPreviewTargets}
          />
          <BoardPiecesLayer
            pieces={pieces}
            failedImageKeys={failedImageKeys}
            onPieceImageError={onPieceImageError}
            spriteEpoch={spriteEpoch}
            promotionImageFlash={promotionImageFlash}
          />
          <HenEdgeHighlightLayer henEdgeHighlightCells={henEdgeHighlightCells} />
          <PoisonHazardLayer poisonHazards={poisonHazardCells} />
          <ArrowCellLayer arrowCells={arrowCells} />
          <RockObstacleLayer rockObstacles={rockObstacleCells} />
          <BatsuHazardLayer batsuHazards={batsuHazardCells} />
          <ThornHazardLayer thornHazards={thornHazardCells} />
          <SafeRoomHazardLayer safeRoomHazards={safeRoomHazardCells} />
          {onSkillVisualEffectFinished ? (
            <StageShogiSkillParticleLayer
              effects={skillVisualEffects}
              onEffectFinished={onSkillVisualEffectFinished}
            />
          ) : null}
          <BoardTouchLayer onCellPress={onCellPress} onCellLongPress={onCellLongPress} />
        </View>
      </View>
    </View>
  );
}
