import { Router } from 'express';
import {
  getAllStores, getStoreBySlug, getStorePopups, getStoreProducts, getProductById,
  searchAll, getTeaCategories, getProductsByCategory, getProductsByTeaType,
  getMainBanners, getMainPopups, getTeaRecommendations,
} from '../controllers/public.controller';

const router = Router();

router.get('/stores', getAllStores);
router.get('/stores/:slug', getStoreBySlug);
router.get('/stores/:slug/popups', getStorePopups);
router.get('/stores/:slug/products', getStoreProducts);
router.get('/products/:id', getProductById);
router.get('/search', searchAll);
router.get('/tea-type', getProductsByTeaType);
router.get('/main-banners', getMainBanners);
router.get('/main-popups', getMainPopups);
router.get('/tea-recommendations', getTeaRecommendations);
router.get('/notices', async (_req, res) => {
  try {
    const prisma = require('../config/database').default;
    const notices = await prisma.notice.findMany({ where: { isActive: true }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
    res.json({ success: true, data: notices });
  } catch { res.status(500).json({ success: false, error: '공지사항 조회 실패' }); }
});
router.get('/point-setting', async (_req, res) => {
  try {
    const prisma = require('../config/database').default;
    let s = await prisma.pointSetting.findFirst();
    if (!s) s = await prisma.pointSetting.create({ data: {} });
    res.json({ success: true, data: { earnRate: s.earnRate, minOrderAmount: s.minOrderAmount, maxEarnAmount: s.maxEarnAmount, minUseAmount: s.minUseAmount, settlementNotice: s.settlementNotice, platformFeeRate: s.platformFeeRate, paymentFeeRate: s.paymentFeeRate } });
  } catch { res.status(500).json({ success: false, error: '설정 조회 실패' }); }
});
// 신고
router.post('/report', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const { type, targetId, reason, detail, consumerId } = req.body;
    if (!type || !targetId || !reason) { res.status(400).json({ success: false, error: '신고 정보를 입력해주세요.' }); return; }
    await prisma.report.create({ data: { type, targetId, reason, detail: detail || null, consumerId: consumerId || null } });
    res.json({ success: true, message: '신고가 접수되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '신고 접수 실패' }); }
});

// 1:1 문의
router.post('/inquiry', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const { name, email, category, title, content, consumerId } = req.body;
    if (!name || !email || !title || !content) { res.status(400).json({ success: false, error: '필수 항목을 입력해주세요.' }); return; }
    await prisma.inquiry.create({ data: { name, email, category: category || '일반', title, content, consumerId: consumerId || null } });
    res.json({ success: true, message: '문의가 접수되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '문의 접수 실패' }); }
});

router.get('/inquiries', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const consumerId = req.query.consumerId as string;
    if (!consumerId) { res.json({ success: true, data: [] }); return; }
    const inquiries = await prisma.inquiry.findMany({ where: { consumerId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: inquiries });
  } catch { res.status(500).json({ success: false, error: '조회 실패' }); }
});

// 발견 추천 (매번 다른 상품)
router.get('/discover', async (_req, res) => {
  try {
    const prisma = require('../config/database').default;
    const all = await prisma.product.findMany({
      where: { isActive: true, store: { isPublished: true } },
      select: { id: true, name: true, price: true, originalPrice: true, discountRate: true, thumbnail: true, teaType: true, aromaProfile: true, totalSales: true, totalViews: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });
    const scored = all.map((p: any) => ({
      ...p, score: Math.random() * 0.5 + (p.totalSales || 0) * 0.001 + (p.discountRate || 0) * 0.01,
    }));
    scored.sort((a: any, b: any) => b.score - a.score);
    res.json({ success: true, data: scored.slice(0, 12).map(({ score, ...r }: any) => r) });
  } catch { res.status(500).json({ success: false, error: '추천 조회 실패' }); }
});

// AI 감정 차 추천 (OpenAI 대화형)
router.post('/ai-tea-recommend', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const { message, history } = req.body;
    if (!message) { res.status(400).json({ success: false, error: '메시지를 입력해주세요.' }); return; }

    const allProducts = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 }, store: { isPublished: true } },
      select: { id: true, name: true, price: true, teaType: true, aromaProfile: true, description: true, thumbnail: true, stock: true,
        store: { select: { name: true, slug: true } } },
      take: 80,
    });

    // 테스트 상품 제외
    const products = allProducts.filter((p: any) =>
      !p.name.toLowerCase().includes('test') &&
      !p.store.name.toLowerCase().includes('test') &&
      p.name.length > 2
    );

    const productList = products.map((p: any) =>
      `- [${p.store.name}] ${p.name} (${p.teaType}, ${p.price}원) : ${p.description || ''}`
    ).join('\n');

    const systemPrompt = `너는 차 전문 큐레이터 "티브리"야. 차에 대해 깊이 알고, 사람 취향을 정확하게 파악해서 맞춤 추천을 해주는 사람이야.

말투 규칙:
- 반드시 한국어로만 답변해.
- 편하고 친근하게. "~요" 체. "그렇구나~", "오, 그거 좋죠!" 이런 느낌.
- 2~3문장으로 짧게. AI스러운 말("추천드립니다", "도움이 되셨으면") 절대 금지.
- 이모티콘 금지.

차 종류별 특성 (추천 시 반드시 참고):
- 녹차: 풀향, 청량감, 카페인 있음. 집중력, 상쾌함 원할 때.
- 홍차: 진하고 깊은 맛, 약간 쓴맛, 카페인 있음. 아침/오후에 각성 효과.
- 백차: 은은하고 부드러움, 카페인 적음. 섬세한 향 좋아하는 사람.
- 우롱차: 꽃향/과일향 복합, 카페인 중간. 중간 정도 맛 선호하는 사람.
- 보이차: 발효된 흙향, 묵직하고 진함, 카페인 있음. 술/커피 즐기는 성인 취향.
- 허브차: 카페인 없음, 수면/릴렉스에 좋음. 카모마일(달콤), 페퍼민트(상쾌), 라벤더(진정).
- 말차: 강한 풀향, 쓴맛, 카페인 많음. 단맛과 쓴맛 조화 좋아하는 사람.
- 블렌딩: 카페인 다양, 과일/꽃 향 혼합. 개성 있는 조합 원할 때.

대화 방식 (반드시 이 순서):
1단계) 기분/상황 들으면 → 공감 한마디 + 취향 질문 1개. 상품 언급 금지.
  질문 예시: "카페인 괜찮아요?", "달달한 게 좋아요 쌉싸름한 게 좋아요?", "지금 뜨거운 거 원해요 시원한 거요?", "향 진한 거 좋아요 은은한 게 좋아요?"

2단계) 취향 들으면 → 한 가지 더 좁히는 질문.
  예: 카페인 없는 걸 원한다 → "허브 계열이요? 아니면 과일 블렌딩 같은 거요?"
      달달한 거 원한다 → "꿀향 나는 거요? 아니면 과일향 나는 거요?"
      쓴맛 좋아한다 → "녹차 계열이요? 보이차 같은 깊고 묵직한 거요?"

3단계) 2번 취향 파악 후 → 상품 목록에서 조건에 딱 맞는 1~2개만 추천.
  추천 멘트에 반드시 왜 이 차인지 이유를 구체적으로 말해줘.
  예: "카페인 없고 달달한 거 원하셨잖아요. OO의 'OO'이 딱이에요. 카모마일에 레몬 블렌딩해서 자기 전에 마시기 딱 좋거든요."

추천 필터 규칙 (이거 어기면 안 됨):
- 카페인 싫다 → 녹차/홍차/우롱차/보이차/말차 절대 추천 금지. 허브차/블렌딩만.
- 쓴맛 싫다 → 녹차/말차/보이차 금지.
- 달달한 거 원한다 → 보이차/녹차(단순) 금지.
- 상쾌함 원한다 → 보이차/말차 금지.
- 수면/릴렉스 → 반드시 카페인 없는 것만.
- 맞는 게 없으면 솔직하게: "지금 딱 맞는 게 없네요. 혹시 다른 방향은 어때요?"

추천 시 규칙:
- 반드시 아래 목록에 있는 상품만 추천. 목록에 없는 상품은 절대 만들어서 추천하면 안 됨.
- 추천할 때 맨 끝에 이 형식 추가 (상품명은 목록의 정확한 이름 그대로):
\`\`\`json
{"picks":["상품명"]}
\`\`\`
- 맞는 상품이 없으면 json 없이 "지금 딱 맞는 상품이 없어요" 라고 솔직하게.

현재 판매 중인 상품 목록 (이 목록에서만 추천):
${productList}`;

    const chatHistory = (history || []).slice(-8).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    }));

    let aiText = '';
    let picks: any[] = [];

    // AI 호출 시도 (Gemini)
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('no key');
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      // 2.5-flash 먼저 시도, 503이면 1.5-flash로 fallback
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      let model = genAI.getGenerativeModel({ model: models[0], systemInstruction: systemPrompt });

      let geminiHistory = chatHistory.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') geminiHistory.shift();
      geminiHistory = geminiHistory.filter((m: any, i: number) => i === 0 || m.role !== geminiHistory[i - 1].role);

      let chat = model.startChat({ history: geminiHistory });
      let result;
      try {
        result = await chat.sendMessage(message);
      } catch (e503: any) {
        if (e503.message?.includes('503') || e503.message?.includes('unavailable') || e503.message?.includes('high demand')) {
          // 1.5-flash로 재시도
          model = genAI.getGenerativeModel({ model: models[1], systemInstruction: systemPrompt });
          chat = model.startChat({ history: geminiHistory });
          result = await chat.sendMessage(message);
        } else {
          throw e503;
        }
      }
      aiText = result.response.text() || '';

      const jsonMatch = aiText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.picks) {
            picks = parsed.picks.map((name: string) => {
              const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase();
              const nName = normalize(name);
              // 정확한 매칭 우선, 그 다음 70% 이상 겹치는 경우만
              const found = products.find((p: any) => {
                const nP = normalize(p.name);
                if (nP === nName) return true;
                // 단어가 3자 이상이고 포함관계일 때만
                if (nP.length >= 3 && nName.includes(nP)) return true;
                if (nName.length >= 3 && nP.includes(nName)) return true;
                return false;
              });
              return found ? { ...found, reason: '' } : null;
            }).filter(Boolean);
          }
        } catch {}
      }
      aiText = aiText.replace(/```json[\s\S]*?```/g, '').trim();
    } catch (aiErr: any) {
      console.error('AI call failed:', aiErr?.message || aiErr);

      const text = message.toLowerCase();
      const userTurns = (history || []).filter((h: any) => h.role === 'user').length;
      const allTexts = (history || []).map((h: any) => h.text || '').join(' ').toLowerCase() + ' ' + text;
      const has = (...kws: string[]) => kws.some(k => text.includes(k));
      const allHas = (...kws: string[]) => kws.some(k => allTexts.includes(k));

      // 현재 메시지에서 취향 감지 (이번 메시지 기준)
      const nowFloral = has('향긋', '꽃향', '플로럴', '화사', '향');
      const nowSweet = has('달달', '달콤', '단맛', '달');
      const nowFresh = has('상쾌', '시원', '산뜻', '청량');
      const nowNutty = has('고소', '구수', '묵직', '넛티');
      const nowFruit = has('과일', '상큼', '새콤', '시트러스');
      const nowDeep = has('쓴', '진한', '깊은', '스모키');
      const nowNoCaff = has('카페인 없', '카페인없', '잠', '수면', '디카');
      const nowWarm = has('따뜻', '뜨거', '핫');
      const nowCold = has('차갑', '아이스', '냉', '시원');
      const nowCheer = has('기분 전환', '화사', '밝', '상쾌', '활기');

      // 현재 메시지에서 부정 감지
      const negatingSweet = has('안 달달', '안달달', '달달한거 말고', '달달한 거 말고', '달달 말고', '단거 말고', '달달하지 않', '달달하지않');
      const negatingFloral = has('꽃향 말고', '향긋한거 말고', '향 말고');
      const negatingFresh = has('상쾌한거 말고', '시원한거 말고', '상쾌 말고');
      const negatingCaff = has('카페인 있어도', '카페인 괜찮', '카페인 상관없');
      // "아니다" + 이전 turn이 있으면 직전 선호 취소
      const isNegating = has('아니', '말고', '싫어', '별로', '그냥 안', '안 그런', '아니에요') && userTurns > 0;

      // 전체 대화에서 누적된 취향 (부정어로 취소 가능)
      const pref = {
        floral: !negatingFloral && (nowFloral || allHas('향긋', '꽃향', '플로럴', '화사')),
        sweet: !negatingSweet && !isNegating && (nowSweet || allHas('달달', '달콤', '단맛')),
        fresh: !negatingFresh && (nowFresh || nowCheer || allHas('상쾌', '시원', '산뜻', '청량')),
        nutty: nowNutty || allHas('고소', '구수', '묵직'),
        fruit: nowFruit || allHas('과일', '상큼', '새콤', '시트러스'),
        deep: nowDeep || allHas('쓴맛', '진한', '깊은', '스모키'),
        noCaff: !negatingCaff && (nowNoCaff || allHas('카페인 없', '잠', '수면')),
        warm: nowWarm || allHas('따뜻하'),
        cold: nowCold || allHas('아이스', '냉차'),
      };


      const tasteCount = Object.values(pref).filter(Boolean).length;
      const readyToRecommend = userTurns >= 2 && tasteCount >= 1 && !isNegating;

      // 대화 맥락 파악
      const isCasual = has('헐', '진짜', '대박', '오', '와', '그래', '맞아', '기억');
      const isNegative = has('아니', '별로', '싫', '말고', '다른');

      if (isCasual && !tasteCount) {
        // "헐 그런것도 기억해주는거야?" 같은 대화
        const casualReplies = [
          '당연하죠~ 말씀하신 거 다 기억하고 있어요.',
          '물론이죠, 제가 잘 듣고 있었거든요.',
          '네, 대화하면서 다 메모해뒀어요.',
        ];
        aiText = casualReplies[Math.floor(Math.random() * casualReplies.length)];
        if (tasteCount >= 1) aiText += '\n그러면 취향 파악됐으니까 바로 찾아드릴까요?';
        else aiText += '\n혹시 지금 어떤 맛이나 향이 당기세요?';

      } else if (readyToRecommend) {
        // 추천 로직
        let codes: string[] = [];
        if (pref.floral) codes.push('FLA', 'HON');
        if (pref.sweet) codes.push('SWE', 'HON', 'CRE');
        if (pref.fresh || pref.cold) codes.push('CIT', 'FRU', 'MIN', 'VEG');
        if (pref.nutty) codes.push('ROA', 'MAL');
        if (pref.fruit) codes.push('FRU', 'CIT');
        if (pref.deep) codes.push('EAR', 'SMO', 'COM');
        if (pref.noCaff) codes.push('FLA', 'SWE', 'CRE');
        if (codes.length === 0) codes = ['FLA', 'SWE', 'FRU'];

        const unique = [...new Set(codes)];
        let matched = products.filter((p: any) => (p.aromaProfile || []).some((a: string) => unique.includes(a)));
        if (pref.noCaff) matched = matched.filter((p: any) => ['허브차', '블렌딩'].includes(p.teaType));

        // 테스트 상품 제외 (이름에 test 포함)
        const realProducts = matched.filter((p: any) => !p.name.toLowerCase().includes('test') && !p.store.name.toLowerCase().includes('test'));
        const pool = realProducts.length > 0 ? realProducts : (matched.filter((p: any) => !p.name.toLowerCase().includes('test')) || matched);
        picks = pool.sort(() => Math.random() - 0.5).slice(0, 3);

        if (picks.length > 0) {
          const m = picks[0];
          const reasonParts: string[] = [];
          if (pref.floral) reasonParts.push('향긋한 거 좋아하신다고 하셨잖아요');
          if (pref.sweet) reasonParts.push('달달한 거 원하셨고요');
          if (pref.fresh) reasonParts.push('상쾌한 느낌 원하셨잖아요');
          if (pref.noCaff) reasonParts.push('카페인 없는 걸 원하셨고');
          if (pref.fruit) reasonParts.push('과일향 좋아하신다고 하셨고');
          if (pref.nutty) reasonParts.push('고소한 맛 좋아하신다고 하셨고');
          if (pref.deep) reasonParts.push('진한 맛 원하셨고');
          const reason = reasonParts.length ? reasonParts[0] + ', ' : '';
          const desc = m.description ? m.description.slice(0, 50) + (m.description.length > 50 ? '...' : '') : '';
          aiText = `${reason}딱 떠오르는 게 있어요.\n${m.store.name}의 '${m.name}' — ${desc || m.teaType}`;
        } else {
          aiText = '음... 지금 조건에 딱 맞는 게 없는 것 같아요.\n다른 방향으로 한번 찾아볼까요?';
        }

      } else if (nowFloral) {
        aiText = '향긋한 거! 좋아요.\n꽃향 계열이에요, 아니면 허브 향 쪽이에요?';
      } else if (nowSweet) {
        aiText = '달달한 거~ 좋죠.\n과일 블렌딩 쪽이 좋아요, 아니면 꿀향 나는 차 쪽이요?';
      } else if (nowFresh) {
        aiText = '상쾌한 느낌!\n민트 계열이에요, 아니면 녹차 같은 풀향이에요?';
      } else if (nowNutty) {
        aiText = '고소한 거 좋아하시는군요.\n볶은 곡물 느낌이에요, 아니면 녹차 같은 담백한 고소함이에요?';
      } else if (nowFruit) {
        aiText = '과일향~ 기분이 화사해지는 맛이죠.\n카페인 괜찮아요?';
      } else if (nowDeep) {
        aiText = '깊고 진한 맛!\n보이차 같은 발효차 계열이에요, 아니면 홍차 쪽이에요?';
      } else if (nowNoCaff) {
        aiText = '카페인 없는 거요!\n편하게 마실 수 있는 거로 찾아드릴게요.\n달달한 허브차 좋아요, 아니면 산뜻한 과일 블렌딩이요?';
      } else if (nowWarm) {
        aiText = '따뜻하게!\n지금 기분은 어떠세요? 달달한 게 당기는 날이에요, 아니면 향긋한 게요?';
      } else if (has('피곤', '지친', '힘들', '녹초')) {
        aiText = '아 많이 지치셨겠다.\n달달한 게 당겨요, 아니면 뭔가 상쾌하게 머리를 비우고 싶어요?';
      } else if (has('우울', '슬프', '꿀꿀', '울적')) {
        aiText = '그런 날 있죠...\n지금 마음이 복잡한 편이에요, 아니면 그냥 기분 전환이 필요한 거예요?';
      } else if (has('행복', '신나', '좋은 날', '기분 좋')) {
        aiText = '오 좋은 날이네요!\n기분 좋을 때 마시는 차는 더 맛있죠. 화사한 과일향이 어울릴 것 같은데, 어때요?';
      } else if (isNegating) {
        // 방향 전환 요청
        if (negatingSweet) aiText = '알겠어요, 달달한 건 빼고요!\n그럼 향긋한 거, 상쾌한 거, 고소한 거 중에 뭐가 끌려요?';
        else if (negatingFloral) aiText = '꽃향 빼고요!\n달달한 거, 시원한 거, 고소한 거 중에 뭐가 좋아요?';
        else aiText = '알겠어요, 방향을 바꿔볼게요.\n향긋한 거, 시원한 거, 고소한 거, 진한 거 — 뭐가 지금 당겨요?';
      } else if (isNegative) {
        aiText = '알겠어요. 그럼 반대 방향으로 가볼게요.\n어떤 느낌이 지금 더 끌려요? 향긋한 거, 상쾌한 거, 고소한 거?';
      } else if (has('모르', '아무거나', '골라', '뭐든', '추천')) {
        aiText = '그럼 제가 골라드릴게요!\n지금 마음이 좀 지친 편이에요, 아니면 그냥 맛있는 게 마시고 싶은 거예요?';
      } else if (userTurns === 0) {
        aiText = '안녕하세요! 어떤 차를 찾고 계세요?\n지금 기분이나 원하는 맛 아무거나 편하게 말씀해주세요.';
      } else {
        const fallbacks = [
          '지금 어떤 맛이나 향이 끌려요?\n달달한 거, 향긋한 거, 시원한 거 뭐든요.',
          '어떤 느낌의 차가 마시고 싶어요?\n오늘 기분이나 원하는 맛으로 말씀해주세요.',
          '달달한 거, 향긋한 거, 고소한 거, 상쾌한 거 — 지금 딱 하나만 골라본다면요?',
        ];
        aiText = userTurns >= 2
          ? '제가 잘 못 알아들은 것 같아요.\n향긋한 거, 달달한 거, 시원한 거 중에 뭐가 지금 끌려요?'
          : fallbacks[userTurns % fallbacks.length];
      }
    }

    res.json({
      success: true,
      data: {
        message: aiText,
        recommendations: picks,
      },
    });
  } catch (err: any) {
    console.error('AI recommend error:', err?.message);
    res.status(500).json({ success: false, error: 'AI 추천 실패' });
  }
});

// 배송 추적
router.get('/tracking/:courier/:trackingNumber', async (req, res) => {
  try {
    const { courier, trackingNumber } = req.params;
    const courierInfo: Record<string, { name: string; url: string }> = {
      CJ: { name: 'CJ대한통운', url: `https://trace.cjlogistics.com/tracking.html?gnbInvcNo=${trackingNumber}` },
      HANJIN: { name: '한진택배', url: `https://www.hanjin.com/kor/CMS/DeliveryMg498/trackingResult.do?inv_no=${trackingNumber}` },
      LOTTE: { name: '롯데택배', url: `https://www.lotteglogis.com/home/reservation/tracking/link498View?InvNo=${trackingNumber}` },
      LOGEN: { name: '로젠택배', url: `https://www.ilogen.com/web/personal/trace/${trackingNumber}` },
      EPOST: { name: '우체국택배', url: `https://service.epost.go.kr/trace.RetrieveDomRi498001Cmd.postal?sid1=${trackingNumber}` },
      KDEXP: { name: '경동택배', url: `https://kdexp.com/basicNew498.kd?barcode=${trackingNumber}` },
    };
    const info = courierInfo[courier?.toUpperCase()] || { name: courier, url: '' };

    // 배송 상태 시뮬레이션 (실제 운영 시 택배사 API 연동)
    const prisma = require('../config/database').default;
    const order = await prisma.order.findFirst({
      where: { trackingNumber },
      select: { status: true, shippedAt: true, deliveredAt: true, createdAt: true },
    });

    const steps = [
      { status: '접수', done: true, time: order?.createdAt },
      { status: '상품 준비중', done: true, time: order?.createdAt },
      { status: '배송 시작', done: !!order?.shippedAt, time: order?.shippedAt },
      { status: '배송 중', done: order?.status === 'SHIPPING' || order?.status === 'DELIVERED' || order?.status === 'CONFIRMED', time: order?.shippedAt },
      { status: '배송 완료', done: order?.status === 'DELIVERED' || order?.status === 'CONFIRMED', time: order?.deliveredAt },
    ];

    res.json({
      success: true,
      data: {
        courier: info.name,
        trackingNumber,
        trackingUrl: info.url,
        steps,
      },
    });
  } catch { res.status(500).json({ success: false, error: '배송 조회 실패' }); }
});

router.get('/categories', getTeaCategories);
router.get('/categories/:categoryId/products', getProductsByCategory);

export default router;