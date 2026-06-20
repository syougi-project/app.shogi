import { Text, TextInput, Pressable, ImageBackground, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { homeAssets } from '@/constants/home-assets';
import { useUsernameSetupScreen } from '@/features/username-setup/ui/use-username-setup-screen';

const usernameBackground = require('../../../../../assets/bundled/0128-home-ui-6979e56460.png');

export function UsernameSetupScreen() {
  const { username, setUsername, isInitializing, isSubmitting, error, handleSubmit } =
    useUsernameSetupScreen();

  if (isInitializing || isSubmitting) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <ImageBackground source={usernameBackground} resizeMode="cover" className="flex-1">
      <SafeAreaView className="flex-1 justify-center px-8">
        <View className="rounded-2xl bg-black/55 p-6">
          <Text className="mb-2 text-center text-2xl font-black text-white">
            ユーザーネームを設定
          </Text>
          <Text className="mb-8 text-center text-sm font-semibold text-white/80">
            あとから変更できます
          </Text>

          <TextInput
            className="mb-4 rounded-lg bg-white/90 px-4 py-3 text-lg font-bold text-[#111827]"
            placeholder="ユーザーネームを入力"
            placeholderTextColor="#6b7280"
            value={username}
            onChangeText={setUsername}
            maxLength={20}
            autoFocus
          />

          {error ? (
            <Text className="mb-4 text-center text-sm font-bold text-red-200">{error}</Text>
          ) : null}

          <Pressable
            className="items-center rounded-lg bg-yellow-400 py-4 active:opacity-70 disabled:opacity-40"
            onPress={() => void handleSubmit()}
            disabled={isSubmitting || username.trim().length === 0}
          >
            <Text className="text-lg font-black text-black">決定</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
