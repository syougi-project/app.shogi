import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useTitleChangeUsername } from '@/features/home/ui/use-title-change-username';

type TitleSettingsModalProps = {
  visible: boolean;
  accessToken: string | null;
  onClose: () => void;
  onRequestChangeUsername: () => void;
  onRequestDelete: () => void;
};

export function TitleSettingsModal({
  visible,
  accessToken,
  onClose,
  onRequestChangeUsername,
  onRequestDelete,
}: TitleSettingsModalProps) {
  const changeUsername = useTitleChangeUsername(accessToken);

  async function handleOpenChangeUsername() {
    onRequestChangeUsername();
    await changeUsername.open();
  }

  return (
    <>
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
        <View className="flex-1 justify-center bg-black/70 px-5">
          <View className="rounded-lg border border-white/25 bg-[#16110d] p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white">設定</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="設定を閉じる"
                onPress={onClose}
                className="rounded-md border border-white/40 px-4 py-2 active:scale-95"
              >
                <Text className="font-bold text-white">閉じる</Text>
              </Pressable>
            </View>
            <View className="gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="ユーザー名を変更"
                onPress={() => void handleOpenChangeUsername()}
                className="rounded-md border border-white/40 bg-white/10 px-4 py-3 active:scale-95"
              >
                <Text className="text-center text-base font-bold text-white">ユーザー名を変更</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="アカウントを削除"
                onPress={onRequestDelete}
                className="rounded-md border border-red-400/70 bg-red-950/60 px-4 py-3 active:scale-95"
              >
                <Text className="text-center text-base font-bold text-red-100">
                  アカウントを削除
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ChangeUsernameModal
        visible={changeUsername.isOpen}
        username={changeUsername.username}
        isLoading={changeUsername.isLoading}
        isSubmitting={changeUsername.isSubmitting}
        error={changeUsername.error}
        savedMessage={changeUsername.savedMessage}
        onChangeUsername={changeUsername.setUsername}
        onClose={changeUsername.close}
        onSubmit={() => void changeUsername.submit()}
      />
    </>
  );
}

type ChangeUsernameModalProps = {
  visible: boolean;
  username: string;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  savedMessage: string | null;
  onChangeUsername: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function ChangeUsernameModal({
  visible,
  username,
  isLoading,
  isSubmitting,
  error,
  savedMessage,
  onChangeUsername,
  onClose,
  onSubmit,
}: ChangeUsernameModalProps) {
  const isBusy = isLoading || isSubmitting;
  const canSubmit = !isBusy && username.trim().length > 0;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={isBusy ? undefined : onClose}
    >
      <View className="flex-1 justify-center bg-black/70 px-5">
        <View className="rounded-lg border border-white/25 bg-[#16110d] p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">ユーザー名を変更</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ユーザー名変更を閉じる"
              onPress={onClose}
              disabled={isBusy}
              className="rounded-md border border-white/40 px-4 py-2 active:scale-95 disabled:opacity-50"
            >
              <Text className="font-bold text-white">閉じる</Text>
            </Pressable>
          </View>
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : (
            <>
              <TextInput
                className="mb-4 rounded-lg bg-white/90 px-4 py-3 text-base font-bold text-[#111827]"
                placeholder="ユーザーネームを入力"
                placeholderTextColor="#6b7280"
                value={username}
                onChangeText={onChangeUsername}
                maxLength={20}
                editable={!isBusy}
              />
              {error ? <Text className="mb-4 text-sm leading-6 text-red-200">{error}</Text> : null}
              {savedMessage ? (
                <Text className="mb-4 text-sm leading-6 text-green-200">{savedMessage}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="ユーザー名を保存"
                onPress={onSubmit}
                disabled={!canSubmit}
                className="rounded-md border border-yellow-400/80 bg-yellow-500/90 px-4 py-3 active:scale-95 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text className="text-center text-base font-bold text-black">保存</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

type DeleteAccountConfirmStep = 'first' | 'second' | null;

type DeleteAccountConfirmModalProps = {
  step: DeleteAccountConfirmStep;
  isDeleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirmFirst: () => void;
  onConfirmSecond: () => void;
  onBackToFirst: () => void;
};

export function DeleteAccountConfirmModal({
  step,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirmFirst,
  onConfirmSecond,
  onBackToFirst,
}: DeleteAccountConfirmModalProps) {
  if (!step) {
    return null;
  }

  const isFirstStep = step === 'first';

  return (
    <Modal
      animationType="fade"
      transparent
      visible
      onRequestClose={isDeleting ? undefined : onCancel}
    >
      <View className="flex-1 justify-center bg-black/70 px-5">
        <View className="rounded-lg border border-white/25 bg-[#16110d] p-5">
          <Text className="mb-3 text-xl font-bold text-white">
            {isFirstStep ? 'アカウント削除' : '最終確認'}
          </Text>
          <Text className="mb-5 text-sm leading-6 text-white/85">
            {isFirstStep
              ? 'アカウントを削除しますか？\n削除すると、ゲームデータや購入情報などがすべて失われます。'
              : '本当に削除しますか？\nこの操作は取り消せません。'}
          </Text>
          {errorMessage ? (
            <Text className="mb-4 text-sm leading-6 text-red-200">{errorMessage}</Text>
          ) : null}
          {isDeleting ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : (
            <View className="gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isFirstStep ? '削除を続行' : 'アカウントを削除する'}
                onPress={isFirstStep ? onConfirmFirst : onConfirmSecond}
                className="rounded-md border border-red-400/70 bg-red-950/60 px-4 py-3 active:scale-95"
              >
                <Text className="text-center text-base font-bold text-red-100">
                  {isFirstStep ? '続行' : '削除する'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isFirstStep ? 'キャンセル' : '戻る'}
                onPress={isFirstStep ? onCancel : onBackToFirst}
                className="rounded-md border border-white/40 px-4 py-3 active:scale-95"
              >
                <Text className="text-center font-bold text-white">
                  {isFirstStep ? 'キャンセル' : '戻る'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
