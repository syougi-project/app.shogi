import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { BgmTrack, SeTrack, bgmSources, seSources } from '@/constants/audio-assets';
import { BATTLE_PIECE_EFFECT_SOUND_MODULES } from '@/constants/battle-piece-effect-sound-modules.generated';

let audioModeReady = false;
let activeBgmTrack: BgmTrack | null = null;
let activeBgmPlayer: AudioPlayer | null = null;
const sePlayers = new Map<SeTrack, AudioPlayer>();
const pieceEffectSoundPlayers = new Map<string, AudioPlayer>();

function normalizePieceEffectKey(kanjiKey: string | null | undefined): string {
  if (kanjiKey == null) return '';
  const t = String(kanjiKey).trim();
  if (!t) return '';
  try {
    return t.normalize('NFKC');
  } catch {
    return t;
  }
}

/** 同一駒の「◯効果音」でも移動用とスキル発動用でプレイヤーを分離（seek が互いを打ち消さないようにする） */
function pieceEffectPlayerCacheKey(kanjiKey: string, fallback: SeTrack): string {
  return `${kanjiKey}|${fallback}`;
}

/** 終了済み・連続再生でも確実に先頭から鳴らす（再利用プレイヤー用） */
async function rewindAndPlay(player: AudioPlayer, volume: number): Promise<void> {
  try {
    player.pause();
  } catch {
    /* ignore */
  }
  player.volume = volume;
  try {
    await player.seekTo(0);
  } catch {
    /* ignore */
  }
  try {
    player.play();
  } catch {
    /* ignore */
  }
}

async function ensureAudioMode() {
  if (audioModeReady) {
    return;
  }

  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
  audioModeReady = true;
}

function clearBgmPlayer() {
  if (!activeBgmPlayer) {
    return;
  }
  activeBgmPlayer.pause();
  activeBgmPlayer.remove();
  activeBgmPlayer = null;
  activeBgmTrack = null;
}

export async function playBgm(track: BgmTrack, volume = 0.55) {
  const source = bgmSources[track];
  if (!source) {
    return;
  }

  await ensureAudioMode();

  if (activeBgmTrack === track && activeBgmPlayer) {
    activeBgmPlayer.volume = volume;
    if (!activeBgmPlayer.playing) {
      activeBgmPlayer.play();
    }
    return;
  }

  clearBgmPlayer();

  const player = createAudioPlayer(source, { keepAudioSessionActive: true });
  player.loop = true;
  player.volume = volume;
  player.play();

  activeBgmPlayer = player;
  activeBgmTrack = track;
}

export function isBgmPlaying(track?: BgmTrack) {
  if (!activeBgmPlayer) {
    return false;
  }
  if (track && activeBgmTrack !== track) {
    return false;
  }
  return activeBgmPlayer.playing;
}

export function stopBgm(track?: BgmTrack) {
  if (!activeBgmPlayer) {
    return;
  }
  if (track && activeBgmTrack !== track) {
    return;
  }
  clearBgmPlayer();
}

export async function playSe(track: SeTrack, volume = 1) {
  const source = seSources[track];
  if (!source) {
    return;
  }

  await ensureAudioMode();

  let player = sePlayers.get(track) ?? null;
  if (!player) {
    player = createAudioPlayer(source, { keepAudioSessionActive: false });
    sePlayers.set(track, player);
  }

  await rewindAndPlay(player, volume);
}

/**
 * 駒の一字（NFKC）に対応する battle フォルダの「◯効果音」があれば再生。なければ fallback の SE。
 */
export async function playBattlePieceEffectSound(
  kanjiKey: string | null | undefined,
  fallback: SeTrack,
  volume = 1,
) {
  const key = normalizePieceEffectKey(kanjiKey);
  const mod = key ? BATTLE_PIECE_EFFECT_SOUND_MODULES[key] : undefined;
  if (mod == null) {
    await playSe(fallback, volume);
    return;
  }

  await ensureAudioMode();

  const cacheKey = pieceEffectPlayerCacheKey(key, fallback);
  let player = pieceEffectSoundPlayers.get(cacheKey) ?? null;
  if (!player) {
    player = createAudioPlayer(mod, { keepAudioSessionActive: false });
    pieceEffectSoundPlayers.set(cacheKey, player);
  }

  await rewindAndPlay(player, volume);
}

export async function playBattlePieceEffectSoundFirstMatch(
  keys: readonly (string | null | undefined)[],
  fallback: SeTrack,
  volume = 1,
) {
  for (const raw of keys) {
    const key = normalizePieceEffectKey(raw);
    if (!key) continue;
    const mod = BATTLE_PIECE_EFFECT_SOUND_MODULES[key];
    if (mod == null) continue;

    await ensureAudioMode();

    const cacheKey = pieceEffectPlayerCacheKey(key, fallback);
    let player = pieceEffectSoundPlayers.get(cacheKey) ?? null;
    if (!player) {
      player = createAudioPlayer(mod, { keepAudioSessionActive: false });
      pieceEffectSoundPlayers.set(cacheKey, player);
    }

    await rewindAndPlay(player, volume);
    return;
  }

  await playSe(fallback, volume);
}

export function releaseAudioPlayers() {
  clearBgmPlayer();
  sePlayers.forEach((player) => {
    player.pause();
    player.remove();
  });
  sePlayers.clear();
  pieceEffectSoundPlayers.forEach((player) => {
    player.pause();
    player.remove();
  });
  pieceEffectSoundPlayers.clear();
}
