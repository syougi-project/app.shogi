import { CHAR_TO_CODE, CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';

export type PieceImageRecord = {
  pieceId?: number;
  pieceCode?: string | null;
  char: string;
  source: number;
};

const pieceImageRecords: PieceImageRecord[] = [
  {
    pieceId: 1,
    pieceCode: 'piece_c518b11858f2',
    char: '歩',
    source: require('../../assets/pieces/0001-piece_c518b11858f2.png'),
  },
  {
    pieceId: 2,
    pieceCode: 'piece_8bc5d3ca0b32',
    char: '香',
    source: require('../../assets/pieces/0002-piece_8bc5d3ca0b32.png'),
  },
  {
    pieceId: 3,
    pieceCode: 'piece_7c0b1e09154b',
    char: '桂',
    source: require('../../assets/pieces/0003-piece_7c0b1e09154b.png'),
  },
  {
    pieceId: 4,
    pieceCode: 'piece_6e7f7100e7bb',
    char: '銀',
    source: require('../../assets/pieces/0004-piece_6e7f7100e7bb.png'),
  },
  {
    pieceId: 5,
    pieceCode: 'piece_c8295f7ed9a8',
    char: '金',
    source: require('../../assets/pieces/0005-piece_c8295f7ed9a8.png'),
  },
  {
    pieceId: 6,
    pieceCode: 'piece_f221427c3f31',
    char: '角',
    source: require('../../assets/pieces/0006-piece_f221427c3f31.png'),
  },
  {
    pieceId: 7,
    pieceCode: 'piece_cc64bbd54bb3',
    char: '飛',
    source: require('../../assets/pieces/0007-piece_cc64bbd54bb3.png'),
  },
  {
    pieceId: 8,
    pieceCode: 'piece_cb504254c93f',
    char: '玉',
    source: require('../../assets/pieces/0008-piece_cb504254c93f.png'),
  },
  {
    pieceId: 9,
    pieceCode: 'piece_shogi_nin',
    char: '忍',
    source: require('../../assets/pieces/0009-piece_shogi_nin.png'),
  },
  {
    pieceId: 10,
    pieceCode: 'piece_shogi_kag',
    char: '影',
    source: require('../../assets/pieces/0010-piece_shogi_kag.png'),
  },
  {
    pieceId: 11,
    pieceCode: 'piece_shogi_hou',
    char: '砲',
    source: require('../../assets/pieces/0011-piece_shogi_hou.png'),
  },
  {
    pieceId: 12,
    pieceCode: 'piece_shogi_ryu',
    char: '竜',
    source: require('../../assets/pieces/0012-piece_shogi_ryu.png'),
  },
  {
    pieceId: 13,
    pieceCode: 'piece_shogi_hoo',
    char: '鳳',
    source: require('../../assets/pieces/0013-piece_shogi_hoo.png'),
  },
  {
    pieceId: 14,
    pieceCode: 'piece_shogi_enn',
    char: '炎',
    source: require('../../assets/pieces/0014-piece_shogi_enn.png'),
  },
  {
    pieceId: 15,
    pieceCode: 'piece_shogi_fir',
    char: '火',
    source: require('../../assets/pieces/0015-piece_shogi_fir.png'),
  },
  {
    pieceId: 16,
    pieceCode: 'piece_shogi_sui',
    char: '水',
    source: require('../../assets/pieces/0016-piece_shogi_sui.png'),
  },
  {
    pieceId: 17,
    pieceCode: 'piece_shogi_nam',
    char: '波',
    source: require('../../assets/pieces/0017-piece_shogi_nam.png'),
  },
  {
    pieceId: 18,
    pieceCode: 'piece_shogi_mok',
    char: '木',
    source: require('../../assets/pieces/0018-piece_shogi_mok.png'),
  },
  {
    pieceId: 19,
    pieceCode: 'piece_shogi_haa',
    char: '葉',
    source: require('../../assets/pieces/0019-piece_shogi_haa.png'),
  },
  {
    pieceId: 20,
    pieceCode: 'piece_shogi_hik',
    char: '光',
    source: require('../../assets/pieces/0020-piece_shogi_hik.png'),
  },
  {
    pieceId: 21,
    pieceCode: 'piece_shogi_hos',
    char: '星',
    source: require('../../assets/pieces/0021-piece_shogi_hos.png'),
  },
  {
    pieceId: 22,
    pieceCode: 'piece_shogi_yam',
    char: '闇',
    source: require('../../assets/pieces/0022-piece_shogi_yam.png'),
  },
  {
    pieceId: 23,
    pieceCode: 'piece_shogi_mak',
    char: '魔',
    source: require('../../assets/pieces/0023-piece_shogi_mak.png'),
  },
  {
    pieceId: 24,
    pieceCode: 'piece_b57883ab1d84',
    char: '銅',
    source: require('../../assets/pieces/0024-piece_b57883ab1d84.png'),
  },
  {
    pieceId: 25,
    pieceCode: 'piece_788aa9f49675',
    char: '鉄',
    source: require('../../assets/pieces/0025-piece_788aa9f49675.png'),
  },
  {
    pieceId: 26,
    pieceCode: 'piece_6be1a386e29e',
    char: '錫',
    source: require('../../assets/pieces/0026-piece_6be1a386e29e.png'),
  },
  {
    pieceId: 27,
    pieceCode: 'piece_0551bf1547d3',
    char: '鉛',
    source: require('../../assets/pieces/0027-piece_0551bf1547d3.png'),
  },
  {
    pieceId: 28,
    pieceCode: 'piece_54ba88ba3fc2',
    char: '宝',
    source: require('../../assets/pieces/0028-piece_54ba88ba3fc2.png'),
  },
  {
    pieceId: 29,
    pieceCode: 'piece_7a2a25793ef2',
    char: '電',
    source: require('../../assets/pieces/0029-piece_7a2a25793ef2.png'),
  },
  {
    pieceId: 30,
    pieceCode: 'piece_5eaf7b36f4b2',
    char: '雷',
    source: require('../../assets/pieces/0030-piece_5eaf7b36f4b2.png'),
  },
  {
    pieceId: 31,
    pieceCode: 'piece_4d9900253f56',
    char: '時',
    source: require('../../assets/pieces/0031-piece_4d9900253f56.png'),
  },
  {
    pieceId: 32,
    pieceCode: 'piece_f3ad3c9ae92b',
    char: '氷',
    source: require('../../assets/pieces/0032-piece_f3ad3c9ae92b.png'),
  },
  {
    pieceId: 33,
    pieceCode: 'piece_6defd2693309',
    char: '雪',
    source: require('../../assets/pieces/0033-piece_6defd2693309.png'),
  },
  {
    pieceId: 34,
    pieceCode: 'piece_9f38189dd3ee',
    char: '砂',
    source: require('../../assets/pieces/0034-piece_9f38189dd3ee.png'),
  },
  {
    pieceId: 35,
    pieceCode: 'piece_a2fab2f6cee9',
    char: '風',
    source: require('../../assets/pieces/0035-piece_a2fab2f6cee9.png'),
  },
  {
    pieceId: 36,
    pieceCode: 'piece_e38e4df15f57',
    char: '苔',
    source: require('../../assets/pieces/0036-piece_e38e4df15f57.png'),
  },
  {
    pieceId: 37,
    pieceCode: 'piece_7446e40db580',
    char: '魚',
    source: require('../../assets/pieces/0037-piece_7446e40db580.png'),
  },
  {
    pieceId: 38,
    pieceCode: 'piece_16ede27b8eff',
    char: '雲',
    source: require('../../assets/pieces/0038-piece_16ede27b8eff.png'),
  },
  {
    pieceId: 39,
    pieceCode: 'piece_74a3ad14ddbc',
    char: '虹',
    source: require('../../assets/pieces/0039-piece_74a3ad14ddbc.png'),
  },
  {
    pieceId: 40,
    pieceCode: 'piece_cbb2ff2e126b',
    char: '毒',
    source: require('../../assets/pieces/0040-piece_cbb2ff2e126b.png'),
  },
  {
    pieceId: 41,
    pieceCode: 'piece_8786b88e621f',
    char: '沼',
    source: require('../../assets/pieces/0041-piece_8786b88e621f.png'),
  },
  {
    pieceId: 42,
    pieceCode: 'piece_ff30a9408903',
    char: '鏡',
    source: require('../../assets/pieces/0042-piece_ff30a9408903.png'),
  },
  {
    pieceId: 43,
    pieceCode: 'piece_ba421ea0d850',
    char: '映',
    source: require('../../assets/pieces/0043-piece_ba421ea0d850.png'),
  },
  {
    pieceId: 44,
    pieceCode: 'piece_a9c2ad579732',
    char: 'あ',
    source: require('../../assets/pieces/0044-piece_a9c2ad579732.png'),
  },
  {
    pieceId: 45,
    pieceCode: 'piece_406177108665',
    char: '牢',
    source: require('../../assets/pieces/0045-piece_406177108665.png'),
  },
  {
    pieceId: 46,
    pieceCode: 'piece_95e4e9f3d8e5',
    char: '柵',
    source: require('../../assets/pieces/0046-piece_95e4e9f3d8e5.png'),
  },
  {
    pieceId: 47,
    pieceCode: 'piece_555d2e24efb0',
    char: '嶺',
    source: require('../../assets/pieces/0047-piece_555d2e24efb0.png'),
  },
  {
    pieceId: 48,
    pieceCode: 'piece_5a24e1332ff7',
    char: '峰',
    source: require('../../assets/pieces/0048-piece_5a24e1332ff7.png'),
  },
  {
    pieceCode: 'YAMA',
    char: '山',
    source: require('../../assets/bundled/0194-pieces-21408bb8f8.png'),
  },
  {
    pieceId: 49,
    pieceCode: 'piece_69d6eceff4e1',
    char: '岩',
    source: require('../../assets/pieces/0049-piece_69d6eceff4e1.png'),
  },
  {
    pieceId: 50,
    pieceCode: 'piece_1bc740c95315',
    char: '鉱',
    source: require('../../assets/pieces/0050-piece_1bc740c95315.png'),
  },
  {
    pieceId: 51,
    pieceCode: 'piece_bc8ab84e787b',
    char: '墓',
    source: require('../../assets/pieces/0051-piece_bc8ab84e787b.png'),
  },
  {
    pieceId: 52,
    pieceCode: 'piece_9d7397390e77',
    char: '霊',
    source: require('../../assets/pieces/0052-piece_9d7397390e77.png'),
  },
  {
    pieceId: 53,
    pieceCode: 'piece_a1ce75d8dc9c',
    char: '幻',
    source: require('../../assets/pieces/0053-piece_a1ce75d8dc9c.png'),
  },
  {
    pieceId: 54,
    pieceCode: 'piece_ae158934197b',
    char: '霧',
    source: require('../../assets/pieces/0054-piece_ae158934197b.png'),
  },
  {
    pieceId: 55,
    pieceCode: 'piece_86718b58142f',
    char: '月',
    source: require('../../assets/pieces/0055-piece_86718b58142f.png'),
  },
  {
    pieceId: 56,
    pieceCode: 'piece_31ea6722b2b4',
    char: '舟',
    source: require('../../assets/pieces/0056-piece_31ea6722b2b4.png'),
  },
  {
    pieceId: 57,
    pieceCode: 'piece_badecf6c6c45',
    char: '機',
    source: require('../../assets/pieces/0057-piece_badecf6c6c45.png'),
  },
  {
    pieceId: 58,
    pieceCode: 'piece_af1ff26a92fc',
    char: '歯',
    source: require('../../assets/pieces/0058-piece_af1ff26a92fc.png'),
  },
  {
    pieceId: 59,
    pieceCode: 'piece_d4b4c9e252e1',
    char: '家',
    source: require('../../assets/pieces/0059-piece_d4b4c9e252e1.png'),
  },
  {
    pieceId: 60,
    pieceCode: 'piece_bc786fd783f2',
    char: '民',
    source: require('../../assets/pieces/0060-piece_bc786fd783f2.png'),
  },
  {
    pieceId: 61,
    pieceCode: 'piece_e2e88ebd1eb1',
    char: '畑',
    source: require('../../assets/pieces/0061-piece_e2e88ebd1eb1.png'),
  },
  {
    pieceId: 62,
    pieceCode: 'piece_3319765cd612',
    char: '泉',
    source: require('../../assets/pieces/0062-piece_3319765cd612.png'),
  },
  {
    pieceId: 63,
    pieceCode: 'piece_707ed60923e2',
    char: '辰',
    source: require('../../assets/pieces/0063-piece_707ed60923e2.png'),
  },
  {
    pieceId: 64,
    pieceCode: 'piece_9c0038ef7d22',
    char: 'K',
    source: require('../../assets/pieces/0064-piece_9c0038ef7d22.png'),
  },
  {
    pieceId: 65,
    pieceCode: 'piece_96f3dca867ec',
    char: '実',
    source: require('../../assets/pieces/0065-piece_96f3dca867ec.png'),
  },
  {
    pieceId: 66,
    pieceCode: 'piece_a8a8cd0feacc',
    char: '異',
    source: require('../../assets/pieces/0066-piece_a8a8cd0feacc.png'),
  },
  {
    pieceId: 67,
    pieceCode: 'piece_c8c3cc0caa2a',
    char: '刀',
    source: require('../../assets/pieces/0067-piece_c8c3cc0caa2a.png'),
  },
  {
    pieceId: 68,
    pieceCode: 'piece_937071416a30',
    char: '鎧',
    source: require('../../assets/pieces/0068-piece_937071416a30.png'),
  },
  {
    pieceId: 69,
    pieceCode: 'piece_ba00f2688d73',
    char: '銃',
    source: require('../../assets/pieces/0069-piece_ba00f2688d73.png'),
  },
  {
    pieceId: 70,
    pieceCode: 'piece_5d848242a136',
    char: '書',
    source: require('../../assets/pieces/0070-piece_5d848242a136.png'),
  },
  {
    pieceId: 71,
    pieceCode: 'piece_7000fed9d9d4',
    char: '封',
    source: require('../../assets/pieces/0071-piece_7000fed9d9d4.png'),
  },
  {
    pieceId: 72,
    pieceCode: 'piece_d24741d0ef18',
    char: '轟',
    source: require('../../assets/pieces/0072-piece_d24741d0ef18.png'),
  },
  {
    pieceId: 73,
    pieceCode: 'piece_1275b5728d1c',
    char: '犇',
    source: require('../../assets/pieces/0073-piece_1275b5728d1c.png'),
  },
  {
    pieceId: 74,
    pieceCode: 'piece_4fcddf14d08d',
    char: '礼',
    source: require('../../assets/pieces/0074-piece_4fcddf14d08d.png'),
  },
  {
    pieceId: 75,
    pieceCode: 'piece_a3bab6c13dc7',
    char: '聖',
    source: require('../../assets/pieces/0075-piece_a3bab6c13dc7.png'),
  },
  {
    pieceId: 76,
    pieceCode: 'piece_0f14abcc6e5e',
    char: '剣',
    source: require('../../assets/pieces/0076-piece_0f14abcc6e5e.png'),
  },
  {
    pieceId: 77,
    pieceCode: 'piece_41ce36fd8ad2',
    char: '盾',
    source: require('../../assets/pieces/0077-piece_41ce36fd8ad2.png'),
  },
  {
    pieceId: 78,
    pieceCode: 'piece_151646512b2f',
    char: '病',
    source: require('../../assets/pieces/0078-piece_151646512b2f.png'),
  },
  {
    pieceId: 79,
    pieceCode: 'piece_3e3ef463eadc',
    char: '薬',
    source: require('../../assets/pieces/0079-piece_3e3ef463eadc.png'),
  },
  {
    pieceId: 80,
    pieceCode: 'piece_8cc9287b7e93',
    char: '滝',
    source: require('../../assets/pieces/0080-piece_8cc9287b7e93.png'),
  },
  {
    pieceId: 81,
    pieceCode: 'piece_e381dfa07a3d',
    char: '穴',
    source: require('../../assets/pieces/0081-piece_e381dfa07a3d.png'),
  },
  {
    pieceId: 82,
    pieceCode: 'piece_31cb39cc0fa8',
    char: '淵',
    source: require('../../assets/pieces/0082-piece_31cb39cc0fa8.png'),
  },
  {
    pieceId: 83,
    pieceCode: 'piece_533b7fec5456',
    char: '赤鬼',
    source: require('../../assets/pieces/0083-piece_533b7fec5456.png'),
  },
  {
    pieceCode: 'redOni',
    char: '赤鬼',
    source: require('../../assets/pieces/0083-piece_533b7fec5456.png'),
  },
  {
    pieceCode: 'blueOni',
    char: '青鬼',
    source: require('../../assets/pieces/blueOni.png'),
  },
  {
    pieceCode: 'blackOni',
    char: '黒鬼',
    source: require('../../assets/pieces/blackOni.png'),
  },
  {
    pieceId: 84,
    pieceCode: 'piece_924546405a8e',
    char: '朧',
    source: require('../../assets/pieces/0084-piece_924546405a8e.png'),
  },
  {
    pieceId: 85,
    pieceCode: 'piece_d8f79c949bfe',
    char: '死',
    source: require('../../assets/pieces/0085-piece_d8f79c949bfe.png'),
  },
  {
    pieceId: 86,
    pieceCode: 'piece_35bf0206eaab',
    char: '魂',
    source: require('../../assets/pieces/0086-piece_35bf0206eaab.png'),
  },
  {
    pieceId: 87,
    pieceCode: 'piece_05e4efb89dae',
    char: '獣',
    source: require('../../assets/pieces/0087-piece_05e4efb89dae.png'),
  },
  {
    pieceId: 88,
    pieceCode: 'piece_29ecab1ef3c3',
    char: '禽',
    source: require('../../assets/pieces/0088-piece_29ecab1ef3c3.png'),
  },
  {
    pieceId: 89,
    pieceCode: 'piece_6d4afa9cdf1c',
    char: '悟',
    source: require('../../assets/pieces/0089-piece_6d4afa9cdf1c.png'),
  },
  {
    pieceId: 90,
    pieceCode: 'piece_ca16911978ff',
    char: '心',
    source: require('../../assets/pieces/0090-piece_ca16911978ff.png'),
  },
  {
    pieceId: 91,
    pieceCode: 'piece_9e27f89f65c5',
    char: '鬱',
    source: require('../../assets/pieces/0091-piece_9e27f89f65c5.png'),
  },
  {
    pieceId: 92,
    pieceCode: 'piece_5a07ca59b158',
    char: '乙',
    source: require('../../assets/pieces/0092-piece_5a07ca59b158.png'),
  },
  {
    pieceId: 93,
    pieceCode: 'piece_a49c1e52b47a',
    char: '薔',
    source: require('../../assets/pieces/0093-piece_a49c1e52b47a.png'),
  },
  {
    pieceId: 94,
    pieceCode: 'piece_8254c41ba326',
    char: '菊',
    source: require('../../assets/pieces/0094-piece_8254c41ba326.png'),
  },
  {
    pieceId: 95,
    pieceCode: 'piece_124c31ea5d7a',
    char: '桜',
    source: require('../../assets/pieces/0095-piece_124c31ea5d7a.png'),
  },
  {
    pieceId: 96,
    pieceCode: 'piece_48204dccfa56',
    char: '凹',
    source: require('../../assets/pieces/0096-piece_48204dccfa56.png'),
  },
  {
    pieceId: 97,
    pieceCode: 'piece_94b641477e72',
    char: '凸',
    source: require('../../assets/pieces/0097-piece_94b641477e72.png'),
  },
  {
    pieceId: 98,
    pieceCode: 'piece_fdc83cf95746',
    char: '焼',
    source: require('../../assets/pieces/0098-piece_fdc83cf95746.png'),
  },
  {
    pieceId: 99,
    pieceCode: 'piece_1732246a37d8',
    char: '炒',
    source: require('../../assets/pieces/0099-piece_1732246a37d8.png'),
  },
  {
    pieceId: 100,
    pieceCode: 'piece_8de5676a5e92',
    char: '煮',
    source: require('../../assets/pieces/0100-piece_8de5676a5e92.png'),
  },
  {
    pieceId: 101,
    pieceCode: 'piece_313b9456c8ac',
    char: '陽',
    source: require('../../assets/pieces/0101-piece_313b9456c8ac.png'),
  },
  {
    pieceId: 102,
    pieceCode: 'piece_a67ce76969f7',
    char: '陰',
    source: require('../../assets/pieces/0102-piece_a67ce76969f7.png'),
  },
  {
    pieceId: 103,
    pieceCode: 'piece_f75d88c48d6d',
    char: '牛',
    source: require('../../assets/pieces/0103-piece_f75d88c48d6d.png'),
  },
  {
    pieceId: 104,
    pieceCode: 'piece_3efa5702e75b',
    char: '豚',
    source: require('../../assets/pieces/0104-piece_3efa5702e75b.png'),
  },
  {
    pieceId: 105,
    pieceCode: 'piece_f1a6ef3b99df',
    char: '鶏',
    source: require('../../assets/pieces/0105-piece_f1a6ef3b99df.png'),
  },
  {
    pieceId: 106,
    pieceCode: 'piece_eacc7f540399',
    char: '銭',
    source: require('../../assets/pieces/0106-piece_eacc7f540399.png'),
  },
  {
    pieceId: 107,
    pieceCode: 'piece_7fc715661514',
    char: '財',
    source: require('../../assets/pieces/0107-piece_7fc715661514.png'),
  },
  {
    pieceId: 108,
    pieceCode: 'piece_c4aeb81f3634',
    char: '巨',
    source: require('../../assets/pieces/0108-piece_c4aeb81f3634.png'),
  },
  {
    pieceId: 114,
    pieceCode: 'piece_gacha_baku',
    char: '爆',
    source: require('../../assets/pieces/0114-piece_gacha_baku.png'),
  },
  {
    pieceId: 115,
    pieceCode: 'piece_gacha_aori',
    char: '煽',
    source: require('../../assets/pieces/0115-piece_gacha_aori.png'),
  },
  {
    pieceId: 116,
    pieceCode: 'piece_gacha_shitsu',
    char: '室',
    source: require('../../assets/bundled/0193-pieces-f2dbf3d29f.png'),
  },
  {
    pieceId: 117,
    pieceCode: 'piece_gacha_sadame',
    char: '定',
    source: require('../../assets/pieces/0117-piece_gacha_sadame.png'),
  },
  {
    pieceId: 118,
    pieceCode: 'piece_gacha_an',
    char: '安',
    source: require('../../assets/pieces/0118-piece_gacha_an.png'),
  },
  {
    pieceId: 119,
    pieceCode: 'piece_gacha_so',
    char: '宋',
    source: require('../../assets/pieces/0119-piece_gacha_so.png'),
  },
  {
    pieceId: 120,
    pieceCode: 'piece_gacha_tou',
    char: '灯',
    source: require('../../assets/bundled/0196-pieces-8fc089190a.png'),
  },
  {
    pieceId: 121,
    pieceCode: 'piece_gacha_hen',
    char: '辺',
    source: require('../../assets/bundled/0202-pieces-83d7cbfff4.png'),
  },
  {
    pieceId: 122,
    pieceCode: 'piece_gacha_itsu',
    char: '逸',
    source: require('../../assets/bundled/0205-pieces-1d2b7fafa9.png'),
  },
  {
    pieceId: 123,
    pieceCode: 'piece_gacha_shin',
    char: '進',
    source: require('../../assets/bundled/0204-pieces-fda560277f.png'),
  },
  {
    pieceId: 124,
    pieceCode: 'piece_gacha_tou2',
    char: '逃',
    source: require('../../assets/bundled/0203-pieces-7224895dba.png'),
  },
  {
    pieceId: 125,
    pieceCode: 'piece_gacha_sou',
    char: '艸',
    source: require('../../assets/bundled/0200-pieces-5a18bfebc3.png'),
  },
  {
    pieceId: 126,
    pieceCode: 'piece_gacha_en',
    char: '閹',
    source: require('../../assets/bundled/0206-pieces-203f8bd2f0.png'),
  },
  {
    pieceId: 127,
    pieceCode: 'piece_gacha_kou',
    char: '膠',
    source: require('../../assets/bundled/0198-pieces-6b34dfd1b1.png'),
  },
  {
    pieceId: 129,
    pieceCode: 'piece_shogi_ng',
    char: '成銀',
    source: require('../../assets/pieces/0129-piece_shogi_ng.png'),
  },
  {
    pieceId: 130,
    pieceCode: 'piece_shogi_nk',
    char: '成桂',
    source: require('../../assets/pieces/0130-piece_shogi_nk.png'),
  },
  {
    pieceId: 131,
    pieceCode: 'piece_shogi_ny',
    char: '成香',
    source: require('../../assets/pieces/0131-piece_shogi_ny.png'),
  },
  {
    pieceId: 132,
    pieceCode: 'piece_shogi_to',
    char: 'と',
    source: require('../../assets/pieces/0132-piece_shogi_to.png'),
  },
  {
    pieceId: 133,
    pieceCode: 'piece_shogi_um',
    char: '馬',
    source: require('../../assets/pieces/0133-piece_shogi_um.png'),
  },
  {
    pieceId: 134,
    pieceCode: 'piece_shogi_ry',
    char: '龍',
    source: require('../../assets/pieces/0134-piece_shogi_ry.png'),
  },
  {
    pieceId: 9001,
    pieceCode: 'piece_shop_so',
    char: '走',
    source: require('../../assets/bundled/0201-pieces-3c3e0ff595.png'),
  },
  {
    pieceId: 9002,
    pieceCode: 'piece_shop_tane',
    char: '種',
    source: require('../../assets/bundled/0197-pieces-729478a77f.png'),
  },
  {
    pieceId: 9003,
    pieceCode: 'piece_shop_kirin',
    char: '麒',
    source: require('../../assets/bundled/0208-pieces-0ee8f60d13.png'),
  },
  {
    pieceId: 9004,
    pieceCode: 'piece_shop_mai',
    char: '舞',
    source: require('../../assets/bundled/0199-pieces-808fa0487c.png'),
  },
  {
    pieceId: 9005,
    pieceCode: 'piece_shop_p',
    char: 'P',
    source: require('../../assets/pieces/P.png'),
  },
  {
    pieceId: 9006,
    pieceCode: 'piece_shop_naku',
    char: '鳴',
    source: require('../../assets/bundled/0207-pieces-e9e01aac8e.png'),
  },
];

const pieceImageById = new Map<number, number>();
const pieceImageByCode = new Map<string, number>();
const pieceImageByChar = new Map<string, number>();

for (const record of pieceImageRecords) {
  if (typeof record.pieceId === 'number') {
    pieceImageById.set(record.pieceId, record.source);
  }
  if (typeof record.pieceCode === 'string' && record.pieceCode.length > 0) {
    pieceImageByCode.set(record.pieceCode, record.source);
    pieceImageByCode.set(record.pieceCode.toUpperCase(), record.source);
  }
  if (record.char.length > 0) {
    pieceImageByChar.set(record.char, record.source);
  }
}

for (const [char, code] of Object.entries(CHAR_TO_CODE)) {
  const source = pieceImageByChar.get(char);
  if (source != null && !pieceImageByCode.has(code)) {
    pieceImageByCode.set(code, source);
  }
}

// 王/玉 は同じ見た目アセットを使う。同期タイミングで「王」表記になっても画像が欠けないようにする。
const kingSource = pieceImageByChar.get('玉');
if (kingSource != null) {
  pieceImageByChar.set('王', kingSource);
  pieceImageByCode.set('OU', kingSource);
}

// 「山」は専用アセット未登録のため、近縁の山系駒（峰/嶺）の画像を流用する。
const yamaSource = pieceImageByChar.get('峰') ?? pieceImageByChar.get('嶺') ?? null;
if (yamaSource != null && !pieceImageByChar.has('山') && !pieceImageByCode.has('YAMA')) {
  pieceImageByChar.set('山', yamaSource);
  pieceImageByCode.set('YAMA', yamaSource);
}

// 刀/銃/鎧/盾は一部経路で canonical code（SWORD/GUN/ARMOR/SHIELD）になるため、
// CHAR_TO_CODE 非登録でも画像解決できるようコード別名を明示する。
const aliasCodeToChar: Readonly<Record<string, string>> = {
  WATER: '水',
  IRON: '鉄',
  RAINBOW: '虹',
  POISON: '毒',
  SWORD: '刀',
  KATANA: '刀',
  HOLY_SWORD: '剣',
  GUN: '銃',
  ARMOR: '鎧',
  SHIELD: '盾',
  BOOK: '書',
  SEAL: '封',
  BIGNOISE: '轟',
  BULL: '犇',
  RITUAL: '礼',
  SAINT: '聖',
  BEAST: '獣',
  BIRD: '禽',
  SATORI: '悟',
  HEART: '心',
  BAKU: '爆',
  GACHA_BAKU: '爆',
  AORI: '煽',
  GACHA_AORI: '煽',
  SHITSU: '室',
  GACHA_SHITSU: '室',
  MURO: '室',
  SADAME: '定',
  GACHA_SADAME: '定',
  AN: '安',
  GACHA_AN: '安',
  GACHA_SO: '宋',
  TOU: '灯',
  GACHA_TOU: '灯',
  HEN: '辺',
  GACHA_HEN: '辺',
  ITSU: '逸',
  GACHA_ITSU: '逸',
  SHIN: '進',
  GACHA_SHIN: '進',
  NIGE: '逃',
  TOU2: '逃',
  GACHA_TOU2: '逃',
  SOU: '艸',
  GACHA_SOU: '艸',
  EN: '閹',
  GACHA_EN: '閹',
  KO: '膠',
  KOU: '膠',
  GACHA_KO: '膠',
  GACHA_KOU: '膠',
  REDONI: '赤鬼',
  BLUEONI: '青鬼',
  BLACKONI: '黒鬼',
  SO: '走',
  TANE: '種',
  KIRIN: '麒',
  MAI: '舞',
  SHOP_P: 'P',
  NAKU: '鳴',
  shop_so: '走',
  shop_tane: '種',
  shop_kirin: '麒',
  shop_mai: '舞',
  shop_p: 'P',
  shop_naku: '鳴',
};
for (const [code, char] of Object.entries(aliasCodeToChar)) {
  const source = pieceImageByChar.get(char);
  if (source != null && !pieceImageByCode.has(code)) {
    pieceImageByCode.set(code, source);
  }
}

// canonical コード（FIR / FU 等）からもローカル画像を引けるようにする（同期後の pieceCode 用）。
for (const [code, char] of Object.entries(CODE_TO_CHAR)) {
  const source = pieceImageByChar.get(char);
  if (source != null) {
    pieceImageByCode.set(code, source);
    pieceImageByCode.set(code.toLowerCase(), source);
  }
}

// 鬼バリアントは char ベースだと上書き順で誤画像になるため、コードごとに固定する。
const redOniSource =
  pieceImageByCode.get('redOni') ??
  pieceImageByCode.get('REDONI') ??
  pieceImageByCode.get('piece_533b7fec5456') ??
  pieceImageByCode.get('PIECE_533B7FEC5456');
if (redOniSource != null) {
  pieceImageByCode.set('REDONI', redOniSource);
}
const blueOniSource = pieceImageByCode.get('blueOni') ?? pieceImageByCode.get('BLUEONI');
if (blueOniSource != null) {
  pieceImageByCode.set('BLUEONI', blueOniSource);
}
const blackOniSource = pieceImageByCode.get('blackOni') ?? pieceImageByCode.get('BLACKONI');
if (blackOniSource != null) {
  pieceImageByCode.set('BLACKONI', blackOniSource);
}

/** opaque `piece_…` などコードのみ分かるときの表示字（レジストリ参照）。 */
export function getDisplayCharFromPieceCode(pieceCode: string | null | undefined): string | null {
  if (!pieceCode) return null;
  const raw = pieceCode.trim();
  if (!raw) return null;
  for (const record of pieceImageRecords) {
    const code = record.pieceCode;
    if (!code) continue;
    if (code === raw || code.toLowerCase() === raw.toLowerCase()) {
      return record.char;
    }
  }
  const upper = raw.toUpperCase();
  if (aliasCodeToChar[upper]) return aliasCodeToChar[upper];
  const fromCanonical = CODE_TO_CHAR[upper];
  if (fromCanonical) return fromCanonical;
  return null;
}

export function getLocalPieceImageSource(input: {
  pieceId?: number;
  pieceCode?: string | null;
  char?: string | null;
}): number | null {
  // pieceCode / 表示文字を pieceId より先に見る。
  // SFEN 同期後はマス上のコード・漢字が正で、DB の numeric id が古い／別駒とずれるケースがあるため。
  if (typeof input.pieceCode === 'string' && input.pieceCode.length > 0) {
    const raw = input.pieceCode;
    const byCode =
      pieceImageByCode.get(raw) ??
      pieceImageByCode.get(raw.toLowerCase()) ??
      pieceImageByCode.get(raw.toUpperCase());
    if (byCode) return byCode;
  }

  if (typeof input.char === 'string' && input.char.length > 0) {
    const byChar = pieceImageByChar.get(input.char);
    if (byChar) return byChar;
  }

  if (typeof input.pieceId === 'number') {
    const byId = pieceImageById.get(input.pieceId);
    if (byId) return byId;
  }

  return null;
}

export function getLocalPieceImageModules() {
  return pieceImageRecords.map((record) => record.source);
}
