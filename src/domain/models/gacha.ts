export type GachaLineupEntry = {
  char: string;
  name: string;
  rarity: string;
  weight: number;
  /** master.m_piece.move_description_ja（BFF 経由） */
  description?: string | null;
};

export type GachaBanner = {
  key: string;
  name: string;
  rareRateText: string;
  /** HTML 版の排出割合ラベル（歩45%・金25%…） */
  pieceRateText: string;
  description: string | null;
  lineup: GachaLineupEntry[];
  usesGold?: boolean;
  pawnCost: number;
  goldCost: number;
  imageSignedUrl?: string | null;
};

export type GachaLobbySnapshot = {
  banners: GachaBanner[];
  pawnCurrency: number;
  goldCurrency: number;
  history: string[];
  /** 本日の広告無償ガチャ（うかんむり/ひへん/しんにょうのいずれか1つ） */
  dailyAdGacha?: DailyAdGachaStatus;
};

export type DailyAdGachaStatus = {
  dayKey: string;
  featuredGachaKey: string;
  used: boolean;
};

export type GachaPiece = {
  char: string;
  name: string;
  rarity: string;
  description: string;
  imageSignedUrl?: string | null;
};

export type RollGachaResult =
  | {
      type: 'hit';
      piece: GachaPiece;
      alreadyOwned: boolean;
      /** 既所持の当たり駒が出たときに付与された金通貨（mock / API） */
      duplicateGoldGranted?: number;
      duplicateLabel?: string;
      pawnCurrency: number;
      goldCurrency: number;
    }
  | {
      type: 'miss';
      currency: 'pawn' | 'gold';
      amount: number;
      pawnCurrency: number;
      goldCurrency: number;
    };
