import { deleteJson } from '@/infra/http/api-client';

type DeleteAccountResponse = {
  deleted: boolean;
};

export class AccountApiDataSource {
  async deleteAccount(token: string): Promise<void> {
    await deleteJson<DeleteAccountResponse>('/api/v1/me/account', { token });
  }
}
