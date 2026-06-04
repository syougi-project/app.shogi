import type { Side } from '@/features/stage-shogi/domain/game-rules';
import {
  CODE_TO_CHAR,
  PROMOTED_CODE_TO_CHAR,
} from '@/features/stage-shogi/domain/piece-conversion';
import type { BoardPiece } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { pieceCharFromCode } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  resolveInspectMoveDescription,
  resolveInspectSkillDescription,
  type InspectingPieceState,
} from '@/features/stage-shogi/ui/stage-shogi-screen.presenters';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

export function resolveInspectingPieceState(input: {
  target: BoardPiece;
  pieceDefsByChar: Record<string, PieceCatalogItem>;
  pieceDefsByCode: Record<string, PieceCatalogItem>;
}): InspectingPieceState {
  const { target, pieceDefsByChar, pieceDefsByCode } = input;
  const lookupChar =
    target.promoted && target.pieceCode
      ? (PROMOTED_CODE_TO_CHAR[target.pieceCode] ?? target.char)
      : target.char;
  const resolvedChar =
    lookupChar === '?' && target.pieceCode
      ? pieceCharFromCode(target.pieceCode, target.side as Side, target.promoted === true)
      : lookupChar;
  const opaqueBookCode =
    typeof target.pieceCode === 'string' && /5D848242A136/i.test(target.pieceCode);
  const opaqueSaintCode =
    typeof target.pieceCode === 'string' && /A3BAB6C13DC7/i.test(target.pieceCode);
  const opaqueBeastCode =
    typeof target.pieceCode === 'string' && /05E4EFB89DAE/i.test(target.pieceCode);
  const opaqueBirdCode =
    typeof target.pieceCode === 'string' && /29ECAB1EF3C3/i.test(target.pieceCode);
  const displayChar =
    resolvedChar && resolvedChar !== '?'
      ? resolvedChar
      : (target.pieceCode ?? '').toUpperCase() === 'BOOK'
        ? '書'
        : opaqueBookCode
          ? '書'
          : (target.pieceCode ?? '').toUpperCase() === 'SAINT'
            ? '聖'
            : opaqueSaintCode
              ? '聖'
              : (target.pieceCode ?? '').toUpperCase() === 'BEAST' || opaqueBeastCode
                ? '獣'
                : (target.pieceCode ?? '').toUpperCase() === 'BIRD' || opaqueBirdCode
                  ? '禽'
                  : lookupChar;
  const pieceCodeLookupKey =
    typeof target.pieceCode === 'string' ? target.pieceCode.toUpperCase() : '';
  const detail =
    pieceDefsByChar[displayChar] ??
    (pieceCodeLookupKey ? pieceDefsByCode[pieceCodeLookupKey] : undefined) ??
    null;
  const pieceCodeLower = (target.pieceCode ?? '').toLowerCase();
  const oniNameOverride =
    displayChar === '青鬼' || pieceCodeLower === 'blueoni'
      ? '青鬼'
      : displayChar === '黒鬼' || pieceCodeLower === 'blackoni'
        ? '黒鬼'
        : displayChar === '赤鬼' ||
            pieceCodeLower === 'redoni' ||
            pieceCodeLookupKey.includes('533B7FEC5456')
          ? '赤鬼'
          : null;
  const beastNameOverride =
    displayChar === '獣' || pieceCodeLower === 'beast' || opaqueBeastCode ? '獣神' : null;
  const birdNameOverride =
    displayChar === '禽' || pieceCodeLower === 'bird' || opaqueBirdCode ? '猛禽類' : null;

  return {
    char: displayChar,
    pieceCode: target.pieceCode,
    name:
      (target.pieceCode ?? '').toUpperCase() === 'BOOK' || displayChar === '書'
        ? '書物'
        : (oniNameOverride ?? beastNameOverride ?? birdNameOverride ?? detail?.name ?? displayChar),
    skill:
      detail?.skill ?? resolveInspectSkillDescription(displayChar, detail?.desc, target.pieceCode),
    move:
      detail?.move ?? resolveInspectMoveDescription(displayChar, detail?.move, target.pieceCode),
    imageSignedUrl: detail?.imageSignedUrl ?? target.imageSignedUrl ?? null,
  };
}

export function buildHandInspectTarget(input: {
  pieceCode: string;
  side: Side;
  imageSignedUrl: string | null;
}): BoardPiece {
  const { pieceCode, side, imageSignedUrl } = input;
  const char = CODE_TO_CHAR[pieceCode] ?? pieceCharFromCode(pieceCode, side, false) ?? '?';
  return {
    side,
    row: 0,
    col: 0,
    pieceCode,
    char,
    promoted: false,
    imageSignedUrl,
  };
}
