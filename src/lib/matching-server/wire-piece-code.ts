import type { PlayerSide } from '@/domain/matching-server/protocol';

/** matching_server の encodeStage45PieceSuffixes / decodeStage45PieceCodePart と整合 */
export type DecodedWireBoardPiece = {
  serverSide: PlayerSide;
  code: string;
  promoted: boolean;
  cowChargeCount?: number;
  pigInheritedPieceCode?: string;
  pigInheritedPromoted?: boolean;
};

function decodeCowChargeSuffix(rawCode: string): { codePart: string; cowChargeCount: number } {
  const atIdx = rawCode.indexOf('@');
  if (atIdx < 0) return { codePart: rawCode, cowChargeCount: 0 };
  const pigIdx = rawCode.indexOf('>', atIdx);
  const chargeRaw = rawCode.slice(atIdx + 1, pigIdx >= 0 ? pigIdx : undefined);
  const charge = Math.min(8, Math.max(0, Number.parseInt(chargeRaw, 10) || 0));
  const codePart = rawCode.slice(0, atIdx) + (pigIdx >= 0 ? rawCode.slice(pigIdx) : '');
  return { codePart, cowChargeCount: charge };
}

function decodePigInheritedSuffix(rawCode: string): {
  code: string;
  pigInheritedPieceCode?: string;
  pigInheritedPromoted?: boolean;
} {
  const idx = rawCode.indexOf('>');
  if (idx < 0) return { code: rawCode };
  const base = rawCode.slice(0, idx);
  let inherited = rawCode.slice(idx + 1);
  const promoted = inherited.endsWith('+');
  if (promoted) inherited = inherited.slice(0, -1);
  return {
    code: base,
    pigInheritedPieceCode: inherited || undefined,
    pigInheritedPromoted: promoted || undefined,
  };
}

export function decodeWirePieceCodePart(rawCode: string): {
  code: string;
  promoted: boolean;
  cowChargeCount: number;
  pigInheritedPieceCode?: string;
  pigInheritedPromoted?: boolean;
} {
  let codePart = rawCode.trim();
  let promoted = false;
  if (!codePart.includes('>') && codePart.endsWith('+')) {
    promoted = true;
    codePart = codePart.slice(0, -1);
  }
  const cowDecoded = decodeCowChargeSuffix(codePart);
  const pigDecoded = decodePigInheritedSuffix(cowDecoded.codePart);
  return {
    code: pigDecoded.code.toUpperCase(),
    promoted,
    cowChargeCount: cowDecoded.cowChargeCount,
    pigInheritedPieceCode: pigDecoded.pigInheritedPieceCode?.toUpperCase(),
    pigInheritedPromoted: pigDecoded.pigInheritedPromoted,
  };
}

export function encodeWirePieceCodeBody(piece: {
  pieceCode?: string | null;
  promoted?: boolean;
  cowChargeCount?: number;
  pigInheritedPieceCode?: string | null;
  pigInheritedPromoted?: boolean;
}): string {
  const code = (piece.pieceCode ?? 'FU').trim().toUpperCase();
  const hasPig = Boolean(piece.pigInheritedPieceCode?.trim());
  let body = code;
  if (piece.promoted && !hasPig) body += '+';
  const charge = Math.min(8, Math.max(0, Math.floor(piece.cowChargeCount ?? 0)));
  if (charge > 0) body += `@${charge}`;
  if (hasPig) {
    body += `>${piece.pigInheritedPieceCode!.trim().toUpperCase()}${piece.pigInheritedPromoted ? '+' : ''}`;
  }
  return body;
}

export function decodeEncodedBoardPiece(encoded: string): DecodedWireBoardPiece {
  const [sideRaw, restRaw] = encoded.split(':');
  const serverSide: PlayerSide = sideRaw === 'white' ? 'white' : 'black';
  const decoded = decodeWirePieceCodePart(restRaw ?? '');
  return {
    serverSide,
    code: decoded.code,
    promoted: decoded.promoted,
    ...(decoded.cowChargeCount > 0 ? { cowChargeCount: decoded.cowChargeCount } : {}),
    ...(decoded.pigInheritedPieceCode
      ? {
          pigInheritedPieceCode: decoded.pigInheritedPieceCode,
          ...(decoded.pigInheritedPromoted != null
            ? { pigInheritedPromoted: decoded.pigInheritedPromoted }
            : {}),
        }
      : {}),
  };
}
