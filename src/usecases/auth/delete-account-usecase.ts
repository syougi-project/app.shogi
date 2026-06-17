import { AccountApiDataSource } from '@/infra/datasources/account-api-datasource';
import { resetClientStaminaStateForAccountChange } from '@/lib/stamina/spend-stage-stamina';
import { supabase } from '@/lib/supabase/supabase-client';

export interface AccountDeleter {
  deleteAccount(token: string): Promise<void>;
}

export async function deleteAccount(
  token: string,
  dataSource: AccountDeleter = new AccountApiDataSource(),
): Promise<void> {
  await dataSource.deleteAccount(token);
  await supabase.auth.signOut({ scope: 'local' });
  resetClientStaminaStateForAccountChange();
}
