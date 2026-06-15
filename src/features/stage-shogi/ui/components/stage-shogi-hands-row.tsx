import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import {
  getPieceImageSource,
  handKeyToDisplayPieceCode,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { getHandCount, HandsState, Side } from '@/features/stage-shogi/domain/game-rules';
import { CODE_TO_CHAR, PieceSfenMapping } from '@/features/stage-shogi/domain/piece-conversion';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

export function StageShogiHandsRow(props: {
  side: Side;
  hands: HandsState;
  pieceSfenMapping: PieceSfenMapping;
  pieceDefsByCode: Partial<Record<string, PieceCatalogItem>>;
  selectedDropPieceCode: string | null;
  sideToMove: Side;
  isAiThinking: boolean;
  isCreatingGame: boolean;
  isFinished: boolean;
  hasPendingPromotion: boolean;
  pieceCatalog: readonly PieceCatalogItem[];
  compact?: boolean;
  onPressPiece: (pieceCode: string) => void;
  onLongPressPiece?: (pieceCode: string, side: Side) => void;
}) {
  const {
    side,
    hands,
    pieceSfenMapping,
    pieceDefsByCode,
    sideToMove,
    isAiThinking,
    isCreatingGame,
    isFinished,
    hasPendingPromotion,
    pieceCatalog,
    compact = false,
    onPressPiece,
    onLongPressPiece,
  } = props;
  const orderedCodes = [
    ...pieceSfenMapping.handOrder,
    ...Object.keys(hands[side]).filter((code) => !pieceSfenMapping.handOrder.includes(code)),
  ];
  const entries = orderedCodes
    .map((code) => ({
      code,
      count: hands[side][code] ?? 0,
    }))
    .filter((entry) => entry.count > 0);

  if (entries.length === 0) {
    return null;
  }

  return (
    <View className={`${compact ? 'mt-0' : 'mt-1'} flex-row flex-wrap gap-0`}>
      {entries.map((entry) => {
        const isPlayer = side === 'player';
        const codeKey = handKeyToDisplayPieceCode(entry.code, pieceCatalog).toUpperCase();
        const dropDisabled =
          !isPlayer ||
          sideToMove !== 'player' ||
          isAiThinking ||
          isCreatingGame ||
          isFinished ||
          hasPendingPromotion ||
          getHandCount(hands, 'player', codeKey) <= 0;
        const handImageSource = getPieceImageSource({
          pieceCode: codeKey,
          char:
            CODE_TO_CHAR[codeKey] ??
            pieceDefsByCode[codeKey]?.char ??
            pieceDefsByCode[entry.code]?.char ??
            null,
          imageSignedUrl:
            pieceDefsByCode[codeKey]?.imageSignedUrl ??
            pieceDefsByCode[entry.code]?.imageSignedUrl ??
            null,
        });
        return (
          <Pressable
            key={`${side}-${codeKey}`}
            testID={`hand-${side}-${codeKey}`}
            delayLongPress={350}
            onPress={() => {
              if (dropDisabled) return;
              onPressPiece(codeKey);
            }}
            onLongPress={() => {
              if (entry.count <= 0 || !onLongPressPiece) return;
              onLongPressPiece(codeKey, side);
            }}
            className="px-0 py-0.5"
          >
            <View className="flex-row items-center gap-0">
              <View className="h-10 w-10 items-center justify-center">
                {handImageSource ? (
                  <Image
                    source={handImageSource}
                    contentFit="contain"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text className="text-base font-black text-[#5d3b2e]">
                    {CODE_TO_CHAR[codeKey] ?? entry.code}
                  </Text>
                )}
              </View>
              <Text className="-ml-0.5 text-sm font-bold text-black">{`x${entry.count}`}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
