import { toGachaRollCode } from '@/constants/gacha-room-assets';
import type { GachaLobbySnapshot, RollGachaResult } from '@/domain/models/gacha';
import { getJson, postJson } from '@/infra/http/api-client';
import { supabase } from '@/lib/supabase/supabase-client';

export class GachaApiDataSource {
  private async getToken(): Promise<string> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('No active session');
    return session.access_token;
  }

  async getLobby(): Promise<GachaLobbySnapshot> {
    const token = await this.getToken();
    return getJson<GachaLobbySnapshot>('/api/v1/gacha/lobby', { token });
  }

  async roll(input: {
    gachaId: string;
    gachaBallColorIndex?: number;
    adFreeRoll?: boolean;
  }): Promise<RollGachaResult> {
    const token = await this.getToken();
    return postJson<RollGachaResult>(
      '/api/v1/gacha/roll',
      {
        gachaId: toGachaRollCode(input.gachaId),
        gachaBallColorIndex: input.gachaBallColorIndex ?? 0,
        adFreeRoll: input.adFreeRoll === true,
      },
      { token },
    );
  }
}
