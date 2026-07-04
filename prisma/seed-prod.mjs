// Production demo seed — categories + showcase sellers + demo gigs so the marketplace
// looks alive pre-launch. Idempotent (upserts by fixed slug/id). Re-runs safely on every
// deploy. To remove demo content later: delete users/gigs with the `demo_` id prefix.
//
// 2026-07-04 content upgrade (founder): every gig now ships a structured
// best-practice description and three tiers with explicit "what's included"
// checklists (stored in GigPackage.description as "✓ "-prefixed lines; the UI
// renders them as feature lists). The gig upsert also UPDATES description/title
// and upserts packages per tier, so re-running the seed upgrades live content.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "ai-video", nameUz: "AI video", nameRu: "AI-видео", nameEn: "AI video" },
  { slug: "ai-image", nameUz: "AI rasm", nameRu: "AI-изображения", nameEn: "AI image" },
  { slug: "ai-avatar", nameUz: "AI avatar", nameRu: "AI-аватары", nameEn: "AI avatars" },
  { slug: "ai-ads", nameUz: "AI reklama", nameRu: "AI-реклама", nameEn: "AI ads" },
  { slug: "ai-ugc", nameUz: "AI UGC", nameRu: "AI UGC", nameEn: "AI UGC" },
  { slug: "voiceover", nameUz: "Ovoz dublyaji", nameRu: "Озвучка", nameEn: "Voiceover" },
  { slug: "ai-music", nameUz: "AI musiqa", nameRu: "AI-музыка", nameEn: "AI music" },
  { slug: "branding", nameUz: "Brending", nameRu: "Брендинг", nameEn: "Branding" },
  { slug: "ai-product", nameUz: "Mahsulot fotosurati", nameRu: "Фото товаров", nameEn: "Product shots" },
  { slug: "image-editing", nameUz: "Rasm tahrirlash", nameRu: "Обработка фото", nameEn: "Photo editing" },
  { slug: "ai-presentation", nameUz: "Taqdimotlar", nameRu: "Презентации", nameEn: "Presentations" },
  { slug: "ai-character", nameUz: "Personaj dizayni", nameRu: "Дизайн персонажей", nameEn: "Character design" },
];

const SELLERS = [
  { id: "demo_s1", firstName: "Studio Aurora", username: "studio_aurora" },
  { id: "demo_s2", firstName: "PixelUz", username: "pixeluz" },
  { id: "demo_s3", firstName: "NeoMedia", username: "neomedia" },
  { id: "demo_s4", firstName: "VividAI", username: "vivid_ai" },
  { id: "demo_s5", firstName: "Sesara Creative", username: "sesara" },
  { id: "demo_s6", firstName: "Qora Quti Studio", username: "qoraquti" },
  { id: "demo_s7", firstName: "OvozLab", username: "ovozlab" },
  { id: "demo_s8", firstName: "MotionBek", username: "motionbek" },
  { id: "demo_s9", firstName: "Aisha Studio", username: "aisha_studio" },
  { id: "demo_s10", firstName: "RenderUz", username: "render_uz" },
  { id: "demo_s11", firstName: "Malika F.", username: "moda_studio" },
];

// Placeholder Instagram (founder's own account, explicitly authorized) shown as the
// "connected" IG on demo creators until the full IG sync (App Review) goes live.
const IG = "shahlo.alikhanova";

// Ideal reference profiles: headline + bio + skills + AI tools + declared specializations.
const SELLER_PROFILES = {
  demo_s1: {
    headline: "AI video va mahsulot fotosurati — brendlar uchun",
    bio: "Studio Aurora — AI yordamida reklama roliklari va mahsulot fotosuratlari yaratadigan ijodiy studiya. 200+ bajarilgan loyiha; Instagram va TikTok uchun tez, sifatli kontent. Kosmetika, oziq-ovqat va e-commerce brendlari bilan ishlaymiz.",
    skills: ["AI reklama roligi", "Mahsulot fotosurati", "Video montaj", "Rang koreksiyasi"],
    aiTools: ["Runway", "Sora", "Midjourney", "Flux"],
    specializations: ["ai_video", "product_photo", "ecommerce"],
    instagramUsername: IG,
  },
  demo_s2: {
    headline: "Brending va moda uchun AI vizuallar",
    bio: "PixelUz — brend identikasi va moda vizuallariga ixtisoslashgan AI dizayn studiyasi. Logotip, rang palitrasi va ijtimoiy tarmoq kontenti — yagona uslubda. Kiyim brendlari uchun lookbook va kampaniya vizuallari.",
    skills: ["Logotip dizayni", "Brend identikasi", "AI rasm", "Moda vizuallari"],
    aiTools: ["Midjourney", "Flux", "Adobe Firefly", "Photoshop"],
    specializations: ["ai_image", "branding", "fashion"],
    instagramUsername: IG,
  },
  demo_s3: {
    headline: "AI video, avatar va professional ovoz",
    bio: "NeoMedia — talking-head avatarlar, AI video va oʻzbek/rus ovoz dublyaji boʻyicha toʻliq xizmat. Blogerlar va brendlar uchun izchil raqamli personaj, kinematografik montaj va tabiiy ovoz.",
    skills: ["Talking-head avatar", "Video montaj", "Ovoz dublyaji", "Ssenariy"],
    aiTools: ["HeyGen", "ElevenLabs", "Runway", "Kling"],
    specializations: ["ai_video", "ai_avatar", "voiceover"],
    instagramUsername: IG,
  },
  demo_s4: {
    headline: "AI art, personaj va oʻyin grafikasi",
    bio: "VividAI — fantaziya illyustratsiyalari, oʻyin personajlari va concept-art boʻyicha studiya. Kitob muqovasi, oʻyin va brend mascot dizayni; yuqori aniqlikdagi noyob uslub.",
    skills: ["Personaj dizayni", "Concept art", "Illyustratsiya", "Oʻyin grafikasi"],
    aiTools: ["Midjourney", "Stable Diffusion", "Flux", "Krita"],
    specializations: ["ai_image", "gaming", "ai_video"],
    instagramUsername: IG,
  },
  demo_s5: {
    headline: "Reels, explainer va korporativ taqdimotlar",
    bio: "Sesara Creative — ijtimoiy tarmoq kontenti, explainer video va investor taqdimotlariga ixtisoslashgan. UGC talking-head reklamalar va pishiq pitch-deck; startaplar hamda korporativ mijozlar bilan.",
    skills: ["Explainer video", "UGC reklama", "Taqdimot dizayni", "Motion grafika"],
    aiTools: ["Runway", "Pika", "Gamma", "ElevenLabs"],
    specializations: ["ai_video", "presentation", "corporate"],
    instagramUsername: IG,
  },
  demo_s6: {
    headline: "Brending, retush va moda vizuallari",
    bio: "Qora Quti Studio — performance-kreativlar, retush va brend vizuallari. Targetlangan reklama uchun yuqori konversiyali bannerlar; e-commerce katalogi uchun professional tahrir.",
    skills: ["Reklama kreativi", "Retush", "Banner dizayni", "Katalog tahriri"],
    aiTools: ["Photoshop", "Flux", "Topaz", "Firefly"],
    specializations: ["ai_image", "image_edit", "fashion"],
    instagramUsername: IG,
  },
  demo_s7: {
    headline: "AI ovoz, dublyaj va original musiqa",
    bio: "OvozLab — koʻp tilli AI ovoz (uz/ru/en), dublyaj va brend musiqasi. Reklama roliklari, audiokitoblar va podkastlar uchun tabiiy ovozlar; jingle va fon treklar.",
    skills: ["AI ovoz", "Dublyaj", "Jingle", "Podkast tahriri"],
    aiTools: ["ElevenLabs", "Suno", "Udio", "Descript"],
    specializations: ["voiceover", "music", "ai_video"],
    instagramUsername: IG,
  },
  demo_s8: {
    headline: "Motion-grafika va logo animatsiyasi",
    bio: "MotionBek — brend intro, logo animatsiyasi va ijtimoiy tarmoq motion-grafikasi. Dinamik, zamonaviy va brendga mos harakat dizayni.",
    skills: ["Logo animatsiya", "Motion grafika", "Intro/outro", "Lower thirds"],
    aiTools: ["After Effects", "Runway", "Pika", "Lottie"],
    specializations: ["motion", "ai_video", "branding"],
    instagramUsername: IG,
  },
  demo_s9: {
    headline: "AI avatar va goʻzallik brendlari uchun UGC",
    bio: "Aisha Studio — kosmetika va goʻzallik brendlari uchun AI UGC reklamalar. Tabiiy taqdimot, ishonarli avatarlar, oʻzbek va rus ovozi bilan.",
    skills: ["UGC reklama", "AI avatar", "Beauty kontent", "Ssenariy"],
    aiTools: ["HeyGen", "Arcads", "CapCut", "ElevenLabs"],
    specializations: ["ai_avatar", "beauty", "ai_video"],
    instagramUsername: IG,
  },
  demo_s10: {
    headline: "3D render va e-commerce mahsulot vizuallari",
    bio: "RenderUz — fotorealistik 3D mahsulot renderlari va e-commerce vizuallari. Marketplace talablariga mos katalog, 360° koʻrinish va lifestyle sahnalar.",
    skills: ["3D render", "Mahsulot vizuali", "360° koʻrinish", "Lifestyle sahna"],
    aiTools: ["Blender", "KeyShot", "Midjourney", "Flux"],
    specializations: ["render_3d", "product_photo", "ecommerce"],
    instagramUsername: IG,
  },
  demo_s11: {
    headline: "Moda va fashion AI videolar",
    bio: "Moda va fashion AI videolar — kiyim brendlari uchun lookbook, reels va podium roliklari. Instagram va TikTok uchun trendga mos vizual hikoyalar; kosmetika va aksessuar brendlari bilan tajriba.",
    skills: ["Fashion AI video", "Lookbook", "Reels montaj", "Brend hikoyasi"],
    aiTools: ["Runway", "Kling", "Sora", "Midjourney"],
    specializations: ["ai_video", "fashion", "ecommerce"],
    instagramUsername: IG,
  },
};

/* ---------------------------------------------------------------------------
   GIGS — founder-grade content. Every gig:
   - description: hook → "Nimalar qilamiz" → "Jarayon" → "Nega biz" (multi-line;
     the gig page renders whitespace-pre-wrap).
   - tiers: [BASIC, STANDARD, PREMIUM], each with an explicit feature checklist.
     Stored into GigPackage.description as "✓ "-lines; UI renders as a list.
   prices/days/revs remain [BASIC, STANDARD, PREMIUM] triplets.
--------------------------------------------------------------------------- */
const GIGS = [
  {
    slug: "ai-reklama-videosi-mahsulot", seller: "demo_s1", cat: "ai-video",
    title: "Mahsulotingiz uchun AI reklama videosi (15–30s)",
    description: `Sotuvni oshiradigan, eʼtiborni birinchi soniyadan tortadigan AI reklama roligi — skriptdan tayyor videogacha hammasi bizda.

Nimalar qilamiz:
• Mahsulotingiz va auditoriyangizga mos sotuvchi skript
• AI video generatsiya + professional montaj va rang korreksiyasi
• Tabiiy AI ovoz (oʻzbek yoki rus) va fon musiqasi
• Instagram, TikTok va YouTube formatlariga moslash

Jarayon: brif (5 daqiqa) → 24 soatda birinchi variant → tahrir → yakuniy fayllar.

Nega biz: 200+ loyiha, kosmetika va oziq-ovqat brendlari bilan doimiy hamkorlik. Roligingiz «reklama»ga emas, hikoyaga oʻxshaydi.`,
    tags: ["ai video", "reklama", "instagram", "tiktok"],
    prices: [300000, 700000, 1500000], days: [3, 5, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["15 soniyalik video (1 ta)", "9:16 vertikal format", "AI ovoz (uz yoki ru)", "Fon musiqasi", "Sizning skriptingiz asosida"] },
      { f: ["30 soniyagacha video", "Skriptni biz yozamiz", "2 format: 9:16 + 1:1", "Subtitrlar (uz/ru)", "Brend rang va logotip integratsiyasi"] },
      { f: ["3 ta variant (A/B test uchun)", "4K sifat", "Barcha formatlar (9:16, 1:1, 16:9)", "Premium ovoz + sound-design", "Ustuvor navbat — 48 soatda birinchi variant", "Manba fayllar (loyiha fayli)"] },
    ],
  },
  {
    slug: "cinematic-ai-short-film-4k", seller: "demo_s3", cat: "ai-video",
    title: "Cinematic AI short-film (4K)",
    description: `Brendingiz hikoyasini kino darajasida aytib beradigan qisqa metrajli AI film. Reklama emas — asar.

Nimalar qilamiz:
• Gʻoya va ssenariy: hikoya arki, kadr rejasi, mood-board
• Kinematografik AI generatsiya: yorugʻlik, kompozitsiya, atmosfera
• Professional montaj, rang grading va sound-design
• Musiqa tanlash va huquqiy toza treklar

Jarayon: kreativ brif → mood-board tasdiqlash → ishlab chiqarish → 2 bosqichli tahrir.

Nega biz: NeoMedia montaj va ovozni bitta joyda qiladi — natija yaxlit chiqadi. Brend hikoyasi, musiqiy klip yoki imidj-video uchun ideal.`,
    tags: ["cinematic", "4k", "ai film", "storytelling"],
    prices: [500000, 1200000, 2500000], days: [5, 8, 12], revs: [1, 2, 3],
    tiers: [
      { f: ["30 soniyagacha film", "Full HD (1080p)", "Tayyor ssenariy asosida", "Bazaviy rang grading", "Litsenziyali musiqa"] },
      { f: ["60 soniyagacha film", "4K sifat", "Ssenariy va mood-board bizdan", "Toʻliq rang grading + sound-design", "AI ovoz yoki diktor matni"] },
      { f: ["90 soniyagacha film", "Rejissyorlik: kadr rejasi + storyboard", "2 ta muqobil montaj versiyasi", "Teaser (15s) bonus", "Manba fayllar va loyiha arxivi", "Ustuvor qoʻllab-quvvatlash"] },
    ],
  },
  {
    slug: "instagram-reels-tiktok-ai-video", seller: "demo_s5", cat: "ai-video",
    title: "Instagram Reels / TikTok uchun AI video paketi",
    description: `Har hafta trendda qoladigan kontent: algoritm sevadigan, auditoriya saqlaydigan qisqa AI videolar.

Nimalar qilamiz:
• Trendlarga mos gʻoyalar: biz kuzatamiz, siz tasdiqlaysiz
• Hook-birinchi-soniya prinsipi bilan montaj
• Subtitr, sticker va CTA elementlari
• Nashr uchun tayyor fayllar — telefoningizga yuboramiz

Jarayon: mavzular roʻyxati → tasdiqlash → ishlab chiqarish → tahrir.

Nega biz: 1 mln+ organik koʻrishlar keltirgan formatlar bazamiz bor. Kontent-plan bilan ham yordam beramiz.`,
    tags: ["reels", "tiktok", "short video", "content"],
    prices: [200000, 450000, 900000], days: [2, 4, 6], revs: [2, 3, 5],
    tiers: [
      { f: ["1 ta reels/tiktok video (15–30s)", "Trend musiqaga moslash", "Subtitrlar", "1 format (9:16)", "Nashr uchun tayyor fayl"] },
      { f: ["3 ta video seriya", "Gʻoyalar bizdan (kontent-mini-plan)", "Hook variantlari har videoga", "Cover/muqova dizayni", "CTA va sticker elementlari"] },
      { f: ["6 ta video (2 haftalik kontent)", "Toʻliq kontent-plan + tavsiflar", "A/B hook testlari", "Statistika tahlili va tavsiyalar", "Ustuvor navbat", "Keyingi oyga chegirma"] },
    ],
  },
  {
    slug: "logo-animatsiyasi-motion-grafika", seller: "demo_s8", cat: "ai-video",
    title: "Logo animatsiyasi va motion-grafika",
    description: `Statik logotipingizni jonlantiring: video, taqdimot va ijtimoiy tarmoqlar uchun professional intro/outro.

Nimalar qilamiz:
• Logotipingiz xarakteriga mos animatsiya konsepti
• Silliq, brendga mos harakat dizayni (After Effects + AI)
• Sound-design: logoga «ovoz» beramiz
• Barcha kerakli formatlar: video, GIF, alfa-kanal

Jarayon: logo fayli + brend hissi → 2 konsept → tanlov → yakuniy render.

Nega biz: harakat — brendning imzosi. MotionBek 5 yildan beri faqat motion bilan shugʻullanadi.`,
    tags: ["motion", "animation", "logo", "intro"],
    prices: [180000, 400000, 800000], days: [2, 4, 6], revs: [2, 3, 4],
    tiers: [
      { f: ["1 ta logo animatsiya (5s gacha)", "Full HD, MP4", "1 konsept", "Fon musiqasiz"] },
      { f: ["2 konseptdan tanlov", "Sound-design bilan", "MP4 + GIF + alfa-kanal (prozrachniy)", "Intro va outro versiyalari", "4K render"] },
      { f: ["3 konsept + storyboard", "Toʻliq brend-motion toʻplami: intro, outro, lower-thirds", "Ijtimoiy tarmoq stinger'lari (3 ta)", "Loyiha manba fayli (AE)", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "moda-brendi-uchun-ai-video-lookbook", seller: "demo_s11", cat: "ai-video",
    title: "Moda brendi uchun AI video va lookbook (reels)",
    description: `Kolleksiyangizni podiumga olib chiqing — studiya va model xarajatisiz. Kiyim brendlari uchun trendga mos AI lookbook va reels.

Nimalar qilamiz:
• Kiyimlaringiz fotosuratidan AI model videolari
• Podium, koʻcha-style yoki studiya muhitida sahnalar
• Brendingiz rang-uslubiga mos rang grading
• Instagram reels va stories formatlari

Jarayon: mahsulot foto + brend uslubi → sahna variantlari → generatsiya → tahrir.

Nega biz: faqat moda bilan ishlaymiz. Kosmetika va aksessuar brendlari bilan 3 yillik tajriba — trendni his qilamiz.`,
    tags: ["fashion", "moda", "video", "reels", "lookbook", "kiyim"],
    prices: [280000, 600000, 1200000], days: [3, 5, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["1 ta lookbook video (15s)", "3 tagacha kiyim/mahsulot", "1 muhit (studiya yoki podium)", "9:16 reels format", "Brend logotipi bilan"] },
      { f: ["2 ta video (reels + stories)", "6 tagacha mahsulot", "2 muhit + AI model tanlovi", "Trend musiqa va subtitr", "Brend rang grading"] },
      { f: ["4 ta video: toʻliq kolleksiya taqdimoti", "Cheksiz mahsulot (1 kolleksiya)", "Maxsus sahna dizayni", "Teaser + asosiy + 2 stories", "4K + barcha formatlar", "Keyingi kolleksiyaga 20% chegirma"] },
    ],
  },
  {
    slug: "brending-uchun-ai-rasm-toplami", seller: "demo_s2", cat: "ai-image",
    title: "Brending uchun AI rasm toʻplami",
    description: `Sayt, ijtimoiy tarmoq va reklama uchun yagona vizual tilda gapiruvchi rasm toʻplami — brendingizga «yuz» beramiz.

Nimalar qilamiz:
• Brend uslubingizni oʻrganamiz (yoki birga yaratamiz)
• Yagona palitra va kayfiyatdagi AI rasmlar seriyasi
• Har rasm: yuqori aniqlik, nashrga tayyor
• Ijtimoiy tarmoq oʻlchamlariga moslash

Jarayon: brend-brif → uslub namunasi (2 variant) → toʻplam generatsiyasi → tahrir.

Nega biz: PixelUz «chiroyli rasm» emas, tizim yaratadi — 6 oydan keyin ham yangi rasmlar shu uslubda davom etadi.`,
    tags: ["ai image", "brending", "visual", "social", "moda", "fashion"],
    prices: [120000, 300000, 600000], days: [2, 3, 5], revs: [2, 3, 5],
    tiers: [
      { f: ["5 ta AI rasm", "1 uslub yoʻnalishi", "Ijtimoiy tarmoq oʻlchamida", "Tijorat foydalanish huquqi"] },
      { f: ["15 ta AI rasm", "Uslub-gid mini hujjati", "2 uslub varianti bilan boshlaymiz", "Sayt + social oʻlchamlari", "4K aniqlik"] },
      { f: ["30 ta AI rasm (oylik kontent zaxira)", "Toʻliq vizual uslub hujjati", "Prompt-baza — keyin oʻzingiz davom ettira olasiz", "Cheksiz oʻlcham moslamalari", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "ai-fantasy-art-illustration", seller: "demo_s4", cat: "ai-image",
    title: "AI fantasy art & illustration",
    description: `Kitob muqovasi, plakat yoki oʻyiningiz uchun gallereya darajasidagi fantaziya illyustratsiyalari.

Nimalar qilamiz:
• Gʻoyangizni vizual konseptga aylantiramiz (eskiz bosqichi)
• Yuqori aniqlikdagi AI generatsiya + qoʻlda sayqallash
• Chop etish va raqamli foydalanish uchun fayllar
• Uslub: dark fantasy'dan yorqin ertakgacha

Jarayon: referens + tavsif → eskizlar → tanlov → yakuniy detalizatsiya.

Nega biz: VividAI rasmlari shunchaki «generatsiya» emas — har birida kompozitsiya va hikoya bor. Portfolio: 300+ illyustratsiya.`,
    tags: ["fantasy", "illustration", "concept art", "hi-res"],
    prices: [150000, 350000, 700000], days: [3, 5, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["1 ta illyustratsiya", "2K aniqlik", "1 eskiz varianti", "Raqamli foydalanish litsenziyasi"] },
      { f: ["1 ta illyustratsiya + 2 muqobil", "4K aniqlik", "3 eskiz varianti", "Chop etish uchun CMYK versiya", "Detal qoʻlda sayqallanadi"] },
      { f: ["3 ta illyustratsiya seriyasi (yagona uslub)", "8K gacha, chop formatida", "Character-sheet bonus", "Toʻliq mualliflik huquqi topshiriladi", "Manba fayllar (qatlamli)"] },
    ],
  },
  {
    slug: "ai-portret-avatar-ijtimoiy", seller: "demo_s3", cat: "ai-image",
    title: "AI portret va avatar (ijtimoiy tarmoq)",
    description: `LinkedIn, Instagram va Telegram uchun professional portret — studiyaga bormasdan. Oddiy selfidan biznes-darajadagi surat.

Nimalar qilamiz:
• 10–15 ta selfingizdan shaxsiy AI model
• Turli uslublar: biznes, casual, ijodiy, kinematografik
• Yuz oʻxshashligi kafolati — «siz, lekin eng yaxshi kuningizda»
• Retush va yorugʻlik korreksiyasi

Jarayon: selfilaringizni yuborasiz → uslub tanlaysiz → 24–48 soatda tayyor.

Nega biz: NeoMedia yuz oʻxshashligini birinchi oʻringa qoʻyadi — «AI'ga oʻxshagan» emas, sizga oʻxshagan portretlar.`,
    tags: ["portrait", "avatar", "profile", "personal brand"],
    prices: [80000, 180000, 350000], days: [1, 2, 3], revs: [2, 3, 5],
    tiers: [
      { f: ["10 ta portret", "2 uslub (biznes + casual)", "1080px, social uchun", "24 soatda tayyor"] },
      { f: ["25 ta portret", "5 uslub tanlovi", "4K aniqlik", "Yengil retush har biriga", "LinkedIn + IG + Telegram oʻlchamlari"] },
      { f: ["50 ta portret", "10 uslub + maxsus istaklar", "Jamoa uchun (3 kishigacha)", "Chuqur retush", "Brend fonlari bilan versiyalar"] },
    ],
  },
  {
    slug: "ai-avatar-raqamli-model", seller: "demo_s1", cat: "ai-avatar",
    title: "AI avatar / raqamli model yaratish",
    description: `Brendingiz uchun charchamaydigan, hamisha brendda gapiradigan raqamli yuz — bir marta yaratiladi, yillar davomida ishlaydi.

Nimalar qilamiz:
• Auditoriyangizga mos avatar-persona konsepti
• Izchil qiyofa: turli poza, kiyim va muhitlarda bir xil yuz
• Video va foto kontentda foydalanishga tayyor paket
• Persona-gid: ovoz ohangi, xarakter, dos & don'ts

Jarayon: persona-brif → 3 qiyofa varianti → tanlov → toʻplam ishlab chiqarish.

Nega biz: izchillik — eng qiyin qism. Bizning pipeline bir xil yuzni 100+ sahnada saqlaydi.`,
    tags: ["ai avatar", "digital human", "influencer", "brand"],
    prices: [400000, 900000, 1800000], days: [4, 7, 10], revs: [1, 2, 3],
    tiers: [
      { f: ["1 avatar qiyofasi", "10 ta foto (turli poza)", "1 kiyim uslubi", "Tijorat litsenziyasi"] },
      { f: ["3 qiyofa variantidan tanlov", "25 ta foto + 1 ta 15s video", "3 kiyim uslubi, 3 muhit", "Persona mini-gid", "Instagram uchun tayyor paket"] },
      { f: ["Toʻliq raqamli model paketi", "50 ta foto + 3 ta video", "Cheksiz kiyim/muhit (1 oy soʻrovlar)", "Toʻliq persona-kitob", "Talking-head uchun tayyor rig", "6 oy qoʻllab-quvvatlash"] },
    ],
  },
  {
    slug: "biznes-talking-head-avatar", seller: "demo_s9", cat: "ai-avatar",
    title: "Biznes uchun talking-head AI avatar (video-taqdimotchi)",
    description: `Kamera oldiga chiqmasdan har hafta video kontent: sizning matningizni oʻqiydigan professional AI taqdimotchi.

Nimalar qilamiz:
• Biznesingizga mos taqdimotchi qiyofasi (yoki sizning raqamli egizingiz)
• Tabiiy mimika va lab-sinxron oʻzbek/rus nutqi
• Ekran, slayd va mahsulot koʻrsatish bilan montaj
• Doimiy foydalanish: matn yuborasiz — video olasiz

Jarayon: qiyofa tanlash → test video → tasdiqlash → seriyali ishlab chiqarish.

Nega biz: Aisha Studio ovoz-ohang va mimikani birga sozlaydi — «robot» emas, ishonchli taqdimotchi.`,
    tags: ["talking head", "avatar", "video presenter", "biznes"],
    prices: [220000, 500000, 1000000], days: [2, 4, 6], revs: [1, 2, 3],
    tiers: [
      { f: ["1 ta talking-head video (60s gacha)", "Tayyor qiyofalardan tanlov", "Sizning matningiz, AI ovoz (uz/ru)", "Oddiy fon", "Subtitr"] },
      { f: ["3 ta video (60s gacha)", "Brendlangan fon va lower-thirds", "Slayd/ekran koʻrsatish montaji", "2 ovoz varianti", "Matnni biz ham tahrirlaymiz"] },
      { f: ["Sizning raqamli egizingiz (yuzingizdan)", "5 ta video + shablon-loyiha", "Keyingi videolar uchun arzon narx kafolati", "4K, barcha formatlar", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "ai-reklama-banner-kreativ", seller: "demo_s6", cat: "ai-ads",
    title: "AI reklama bannerlari va kreativlar",
    description: `Target va kontekst reklama uchun bosiladigan kreativlar — chiroyli emas, ishlaydigan.

Nimalar qilamiz:
• Auditoriya ogʻrigʻiga uradigan vizual gʻoyalar
• A/B test uchun bir nechta yondashuv
• Barcha maydonchalar oʻlchamlari (IG, FB, Google, Yandex)
• Matn + vizual uygʻunligi: CTR uchun optimallashtirilgan

Jarayon: mahsulot + auditoriya brifi → 2-3 kreativ yoʻnalish → variantlar → moslashtirish.

Nega biz: Qora Quti «like» uchun emas, konversiya uchun ishlaydi. Har kreativga qisqa «nega bu ishlaydi» izohi beramiz.`,
    tags: ["ads", "banner", "creative", "performance", "moda", "fashion"],
    prices: [180000, 400000, 800000], days: [2, 4, 6], revs: [2, 3, 5],
    tiers: [
      { f: ["3 ta banner (1 gʻoya, 3 oʻlcham)", "IG/FB formatlari", "Matn joylashuvi bilan", "Tijorat litsenziyasi"] },
      { f: ["9 ta banner (3 gʻoya × 3 oʻlcham)", "A/B test tavsiyalari", "IG, FB, Google, Yandex oʻlchamlari", "Brend uslubiga moslash", "Manba fayllar"] },
      { f: ["18 ta kreativ + 2 ta animatsion banner", "Toʻliq kampaniya vizual paketi", "Har oyga yangilash opsiyasi", "Raqobatchilar tahlili mini-hisoboti", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "performance-video-ads-paket", seller: "demo_s5", cat: "ai-ads",
    title: "Performance video-reklama paketi (target uchun)",
    description: `Target reklamada pul kuydirmaslikning yoʻli — testlash uchun yetarlicha video-variant. Bitta «zoʻr» rolik emas, ishlaydiganini topadigan paket.

Nimalar qilamiz:
• 1 mahsulot uchun turli hook va format videolar
• UGC-uslub, motion va statik + harakat kombinatsiyalari
• Meta/TikTok talablariga mos texnik tayyorlash
• Test natijalari boʻyicha gʻolibni kuchaytirish

Jarayon: mahsulot brifi → hook-matritsa → ishlab chiqarish → test → optimizatsiya.

Nega biz: Sesara mediabaying jamoalar bilan ishlagan — qaysi birinchi 3 soniya ishlashini bilamiz.`,
    tags: ["performance", "video ads", "target", "meta", "tiktok"],
    prices: [350000, 750000, 1400000], days: [3, 5, 8], revs: [2, 3, 4],
    tiers: [
      { f: ["3 ta video-kreativ (15s)", "3 xil hook", "9:16 format", "Subtitr + CTA", "Meta/TikTok texnik talablariga mos"] },
      { f: ["6 ta video-kreativ", "Hook-matritsa hujjati", "2 format (9:16 + 1:1)", "UGC + motion aralash uslublar", "1 hafta ichida gʻolib variantni kuchaytirish"] },
      { f: ["12 ta kreativ: toʻliq test-paketi", "Oylik hamkorlik rejimi", "Statistika tahlili + keyingi partiya tavsiyasi", "Barcha formatlar + manba fayllar", "Ustuvor aloqa (24s ichida javob)"] },
    ],
  },
  {
    slug: "ai-ugc-talking-head-reklama", seller: "demo_s5", cat: "ai-ugc",
    title: "AI UGC talking-head reklama (Instagram/TikTok)",
    description: `«Doʻstim tavsiya qilgandek» ishonarli reklama — haqiqiy odamga oʻxshaydigan AI UGC videolar, aktyor va suratga olish xarajatisiz.

Nimalar qilamiz:
• Mahsulotingizga mos «oddiy odam» personaji
• Tabiiy nutq skripti — reklama emas, tavsiya ohangida
• Mahsulot koʻrsatish, unboxing hissi, real muhit
• Platforma-native montaj (TikTok'da TikTok'dek koʻrinadi)

Jarayon: mahsulot + auditoriya → skript → persona tanlovi → video → tahrir.

Nega biz: UGC janrida ohang hal qiladi — bizning skriptlar «sotish» emas, «boʻlishish» kabi eshitiladi.`,
    tags: ["ugc", "talking head", "ai actor", "ads"],
    prices: [250000, 550000, 1100000], days: [3, 5, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["1 ta UGC video (30s gacha)", "Tayyor personalardan tanlov", "Skript bizdan", "Oʻzbek yoki rus tili", "9:16 + subtitr"] },
      { f: ["3 ta video (turli persona/hook)", "Mahsulot koʻrsatish sahnalari", "2 til versiyasi", "Trend ovoz va musiqa", "A/B uchun turli CTA"] },
      { f: ["6 ta video toʻliq kampaniya", "Maxsus persona (faqat sizniki)", "Uzun versiya (60s) + qisqalar", "Oylik yangilash opsiyasi", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "gozallik-brendi-ai-ugc-avatar", seller: "demo_s9", cat: "ai-ugc",
    title: "Goʻzallik brendi uchun AI UGC avatar reklama",
    description: `Kosmetika sotadigan kontent: teri, tekstura va natijani chiroyli koʻrsatadigan, ayol auditoriya ishonchini qozonadigan AI UGC.

Nimalar qilamiz:
• Goʻzallik janriga mos avatarlar: tabiiy, «filtrsiz» estetika
• Mahsulot qoʻllash sahnalari: krem, serum, dekorativ kosmetika
• «Before/after» va «get ready with me» formatlari
• Oʻzbek va rus tilida tabiiy ayol ovozlari

Jarayon: mahsulot + brend ohangi → format tanlash → skript → video.

Nega biz: Aisha Studio faqat beauty bilan ishlaydi — janr klishelarini emas, ishlaydigan formatlarini bilamiz.`,
    tags: ["ugc", "avatar", "beauty", "kosmetika"],
    prices: [260000, 560000, 1100000], days: [3, 5, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["1 ta beauty UGC video (30s)", "Mahsulot qoʻllash sahnasi", "Ayol AI ovoz (uz/ru)", "9:16 + subtitr", "Skript bizdan"] },
      { f: ["3 ta video (GRWM / before-after / tavsiya)", "2 avatar tanlovi", "Brend rang-estetikasiga moslash", "Stories versiyalari bonus", "2 til"] },
      { f: ["6 ta video: launch-kampaniya paketi", "Maxsus avatar (faqat brendingiz uchun)", "Mahsulot liniyasi boʻylab seriya", "Oylik kontent rejimi opsiyasi", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "ozbekcha-ruscha-ovoz-dublyaji", seller: "demo_s3", cat: "voiceover",
    title: "Professional oʻzbekcha / ruscha ovoz dublyaji",
    description: `Reklama, video va kurslar uchun studiya sifatidagi ovoz — his bilan, urgʻusiz, muddatida.

Nimalar qilamiz:
• Loyihangizga mos ovoz va ohang tanlovi (namunalar beramiz)
• Professional yozuv: toza, fon shovqinsiz
• Talaffuz va urgʻu nazorati (ona tili darajasida)
• Video ostiga sinxronlash opsiyasi

Jarayon: matn + ohang istagi → namuna (10s) → toʻliq yozuv → tuzatishlar.

Nega biz: NeoMedia diktorlari va AI-ovozlari aralash portfeli bor — byudjetga qarab eng yaxshisini taklif qilamiz.`,
    tags: ["voiceover", "uzbek", "russian", "dubbing"],
    prices: [120000, 250000, 500000], days: [1, 2, 3], revs: [2, 3, 5],
    tiers: [
      { f: ["60 soʻzgacha matn", "1 til (uz yoki ru)", "1 ovoz varianti", "MP3/WAV fayl", "24 soatda tayyor"] },
      { f: ["200 soʻzgacha matn", "2 ovoz variantidan tanlov", "Video ostiga sinxronlash", "Fon musiqa bilan miks", "Tijorat litsenziyasi"] },
      { f: ["500 soʻzgacha (kurs/hujjatli film)", "2 til versiyasi (uz + ru)", "Premium diktor yoki maxsus AI ovoz", "Toʻliq post-processing", "Boblarga boʻlingan fayllar", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "kop-tilli-ai-ovoz-dublyaji", seller: "demo_s7", cat: "voiceover",
    title: "Koʻp tilli AI ovoz va dublyaj (uz / ru / en)",
    description: `Bitta videoni uch tilda gapirting — eksport bozarlarga eshik ochadigan tabiiy AI dublyaj.

Nimalar qilamiz:
• Asl videodagi ohang va temperamentni saqlash
• Uch tilda tabiiy AI ovozlar (erkak/ayol tanlovi)
• Lab-sinxron opsiyasi (talking-head videolar uchun)
• Tarjimani ham qilamiz yoki sizning matningizni olamiz

Jarayon: video/matn → til va ovoz tanlovi → namuna → toʻliq dublyaj.

Nega biz: OvozLab 40+ AI ovoz bazasi va inson-tahririga ega — «mashina tarjimasi» hissi qolmaydi.`,
    tags: ["voiceover", "dubbing", "uzbek", "russian", "ovoz"],
    prices: [130000, 280000, 550000], days: [1, 2, 3], revs: [2, 3, 5],
    tiers: [
      { f: ["1 daqiqagacha video/matn", "1 til", "2 ovoz variantidan tanlov", "MP3 + video ostiga joylash"] },
      { f: ["3 daqiqagacha", "2 til (masalan uz + ru)", "Tarjima bizdan", "Fon musiqa balansi", "Subtitr fayli (SRT) bonus"] },
      { f: ["10 daqiqagacha (kurs, korporativ film)", "3 til toʻliq paket (uz+ru+en)", "Lab-sinxron", "Har til uchun aloha video-render", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "ai-original-musiqa-jingle", seller: "demo_s4", cat: "ai-music",
    title: "AI bilan original musiqa va jingle",
    description: `Brendingizning oʻz ovozi: reklama uchun jingle, video uchun fon trek — mualliflik huquqi toʻliq sizda.

Nimalar qilamiz:
• Brend xarakteriga mos janr va kayfiyat tanlovi
• Original AI kompozitsiya + inson-tahriri (aranjirovka)
• Reklama uchun 5-15s jingle yoki toʻliq trek
• Royalty-free: istalgan joyda cheksiz foydalaning

Jarayon: kayfiyat brifi + referens treklar → 2 demo → tanlov → yakuniy master.

Nega biz: shunchaki generatsiya emas — musiqiy tahrir bilan «AI'ligi bilinmaydigan» treklar.`,
    tags: ["ai music", "jingle", "soundtrack", "royalty-free"],
    prices: [200000, 450000, 900000], days: [3, 5, 8], revs: [1, 2, 3],
    tiers: [
      { f: ["15s gacha jingle", "2 demo variant", "MP3 + WAV", "Royalty-free litsenziya"] },
      { f: ["60s gacha trek", "3 demo variant", "Intro/loop/outro versiyalari", "Stems (qatlamlar) fayli", "Master sifatida"] },
      { f: ["Toʻliq brend-audio paketi", "Asosiy trek + jingle + 3 qisqa stinger", "Cheksiz tuzatish (2 hafta)", "Toʻliq mualliflik shartnomasi", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "brend-uchun-ai-musiqa-jingle", seller: "demo_s7", cat: "ai-music",
    title: "Brend uchun original AI musiqa va jingle",
    description: `Radioda, reelsda, doʻkoningizda — hamma joyda taniladigan audio-imzo. OvozLab brendingiz uchun musiqa yozadi.

Nimalar qilamiz:
• Audio-brending konsulti: qanday «tovush» sizniki?
• Original kompozitsiya: jingle, fon trek yoki toʻliq gimn
• Ovoz + musiqa paketi (jingle ichida slogan aytiladi)
• Barcha formatlar va litsenziya hujjatlari

Jarayon: brend brifi → 2-3 demo → tanlov va tahrir → master + hujjatlar.

Nega biz: ovoz va musiqa bitta studiyada — jingle'dagi slogan talaffuzi ham professional boʻladi.`,
    tags: ["ai music", "jingle", "branding", "royalty-free"],
    prices: [220000, 480000, 950000], days: [3, 5, 8], revs: [1, 2, 3],
    tiers: [
      { f: ["10-15s jingle", "2 demo", "Slogan ovozi bilan (uz/ru)", "MP3 + WAV", "Royalty-free"] },
      { f: ["Jingle + 60s fon trek", "3 demo", "Slogan 2 tilda", "Stems fayllari", "Reels/stories uchun qisqa versiyalar"] },
      { f: ["Toʻliq audio-brend paketi", "Gimn + jingle + 5 stinger", "Audio-brend gid (qachon qaysi trek)", "Cheksiz kichik tuzatishlar (2 hafta)", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "toliq-brending-logo-identika", seller: "demo_s2", cat: "branding",
    title: "Toʻliq brending: logo + vizual identika",
    description: `Yangi biznes yoki rebrending uchun toʻliq paket: logotipdan brand-book'gacha — bir qoʻlda, yagona tizimda.

Nimalar qilamiz:
• Strategik brif: auditoriya, raqobat, pozitsiya
• 3 ta logo konsepti (AI tezligi + dizayner didi)
• Rang palitra, tipografika, grafik elementlar
• Brand guideline: jamoangiz doim toʻgʻri ishlatadi

Jarayon: brif → konseptlar → tanlov va sayqal → identika → guideline.

Nega biz: PixelUz logo emas, TIZIM topshiradi — 2 yildan keyin ham har poster «sizniki» koʻrinadi.`,
    tags: ["branding", "logo", "identity", "guideline"],
    prices: [500000, 1200000, 2500000], days: [5, 8, 14], revs: [2, 3, 5],
    tiers: [
      { f: ["2 logo konsepti", "Tanlangani sayqallanadi", "Rang palitra + shrift tanlovi", "Logo fayllari (PNG, SVG)", "Mini foydalanish qoidalari (1 sahifa)"] },
      { f: ["3 logo konsepti", "Toʻliq identika: palitra, tipografika, pattern", "Vizitka + IG post/stories shablonlari", "Brand guideline (10+ sahifa)", "Barcha manba fayllar"] },
      { f: ["Strategik sessiya (1 soat, video)", "3+2 logo konsepti (ikki bosqich)", "Kengaytirilgan guideline (20+ sahifa)", "Ofis paketi: blank, taqdimot, email imzo", "Ijtimoiy tarmoq starter-paketi (9 post)", "3 oy dizayn-maslahat"] },
    ],
  },
  {
    slug: "ijtimoiy-tarmoq-brend-paketi", seller: "demo_s6", cat: "branding",
    title: "Ijtimoiy tarmoq brend-paketi (IG/Telegram)",
    description: `Instagram va Telegram'da darhol professional koʻrinish: oy davomida ishlatadigan tayyor dizayn tizimi.

Nimalar qilamiz:
• Profilingiz auditi: nima ishlayapti, nima yoʻq
• Post, stories va highlights uchun shablon tizimi
• Rang/shrift moslamasi — bor logotipingizga qurish mumkin
• Canva'da tahrirlanadigan fayllar: jamoa oʻzi yuritadi

Jarayon: audit + brif → uslub varianti → shablonlar → oʻrgatuvchi mini-video.

Nega biz: shablonlarimiz «chiroyli» emas, YURITILADIGAN qilib qurilgan — 5 daqiqada yangi post.`,
    tags: ["smm", "instagram", "telegram", "shablon", "branding"],
    prices: [200000, 420000, 850000], days: [3, 5, 7], revs: [2, 3, 4],
    tiers: [
      { f: ["6 ta post shabloni", "3 ta stories shabloni", "Highlights muqovalari (5 ta)", "Canva fayllari", "Rang/shrift moslamasi"] },
      { f: ["12 post + 6 stories shabloni", "Profil auditi + tavsiyalar", "Telegram post ramkalari", "Reels muqova shablonlari", "Oʻrgatuvchi video (10 daqiqa)"] },
      { f: ["Toʻliq SMM dizayn-tizimi (25+ shablon)", "Kontent-rubrikalar boʻyicha turkumlar", "2 platforma: IG + Telegram", "Oylik yangilash opsiyasi", "Jamoa uchun jonli oʻrgatish (30 daqiqa)"] },
    ],
  },
  {
    slug: "ai-mahsulot-fotosurati-ecommerce", seller: "demo_s1", cat: "ai-product",
    title: "AI mahsulot fotosurati (e-commerce)",
    description: `Uzum, Wildberries va Instagram doʻkoningiz uchun studiya sifatidagi mahsulot fotolari — studiyasiz.

Nimalar qilamiz:
• Oddiy telefon suratingizdan professional kadr
• Toza oq fon (marketplace talabi) + lifestyle sahnalar
• Soya, aks va material teksturasini tabiiy saqlash
• Katalog uchun yagona uslubda seriya

Jarayon: mahsulot suratlari → fon/sahna tanlovi → generatsiya → retush.

Nega biz: marketplace moderatsiyasidan qaytmaydigan fayllar — texnik talablarni yoddan bilamiz.`,
    tags: ["product photo", "ecommerce", "studio", "catalog"],
    prices: [100000, 250000, 550000], days: [2, 3, 5], revs: [2, 3, 5],
    tiers: [
      { f: ["5 ta mahsulot fotosi", "Toza oq fon", "Marketplace talabiga mos oʻlcham", "Yengil retush"] },
      { f: ["15 ta foto", "Oq fon + 5 lifestyle sahna", "Soya/aks bilan premium koʻrinish", "Instagram uchun kvadrat versiyalar", "Katalog uslub izchilligi"] },
      { f: ["40 ta foto: toʻliq katalog", "Cheksiz sahna variantlari", "Banner uchun keng formatlar", "Har oy yangilash opsiyasi", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "3d-mahsulot-render-ecommerce", seller: "demo_s10", cat: "ai-product",
    title: "3D mahsulot renderi (e-commerce)",
    description: `Mahsulotingiz hali ishlab chiqarilmagan boʻlsa ham sota boshlang: fotorealistik 3D render — foto'dan ham mukammal.

Nimalar qilamiz:
• Mahsulot chizmasi yoki namunasidan aniq 3D model
• Fotorealistik materiallar: shisha, metall, mato, suyuqlik
• Istalgan rakurs, rang varianti va muhit
• 360° aylanma va animatsion render opsiyalari

Jarayon: chizma/foto → model tasdiqlash → materiallar → yakuniy renderlar.

Nega biz: RenderUz «AI + Blender» aralash pipeline ishlatadi — AI tezligi, 3D aniqligi.`,
    tags: ["3d", "render", "product", "ecommerce"],
    prices: [200000, 450000, 900000], days: [3, 5, 8], revs: [1, 2, 3],
    tiers: [
      { f: ["1 mahsulot, 3 rakurs", "Oq fon render", "2K aniqlik", "Model keyingi buyurtmalar uchun saqlanadi"] },
      { f: ["1 mahsulot, 6 rakurs + 2 lifestyle sahna", "4K aniqlik", "Rang variantlari (3 tagacha)", "Soya/aks premium sozlash", "PSD qatlamli fayl"] },
      { f: ["3 mahsulotgacha toʻliq paket", "360° aylanma animatsiya", "10s reklama-render videosi", "Cheksiz rakurs (1 hafta soʻrov)", "Manba 3D fayl (keyin oʻzingizniki)"] },
    ],
  },
  {
    slug: "rasm-tahrirlash-retush-upscale", seller: "demo_s6", cat: "image-editing",
    title: "Rasm tahrirlash, retush va upscale",
    description: `Eski, xira yoki «deyarli yaxshi» suratlarni professional darajaga olib chiqamiz — xotiralardan katalogga qadar.

Nimalar qilamiz:
• Retush: teri, yorugʻlik, rang, chalgʻituvchi detallar
• Upscale: kichik suratni 4K gacha, sifat yoʻqotmasdan
• Restavratsiya: eski/yirtilgan suratlarni tiklash
• Fon almashtirish va obyekt olib tashlash

Jarayon: suratlarni yuborasiz → muammo tahlili → tahrir → tasdiqlash.

Nega biz: AI vositalar + qoʻlda Photoshop nazorati — «plastik yuz» effektisiz tabiiy natija.`,
    tags: ["retouch", "upscale", "restoration", "editing"],
    prices: [60000, 150000, 350000], days: [1, 2, 4], revs: [2, 3, 5],
    tiers: [
      { f: ["3 ta surat", "Bazaviy retush + rang korreksiya", "2x upscale", "24-48 soatda tayyor"] },
      { f: ["10 ta surat", "Chuqur retush", "4K gacha upscale", "Fon almashtirish (3 tagacha)", "Obyekt olib tashlash"] },
      { f: ["25 ta surat yoki 5 ta murakkab restavratsiya", "Eski surat tiklash (yirtiq, dogʻ)", "Katalog seriyasi uchun yagona uslub", "Chop formatida fayllar", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "ecommerce-katalog-tahrir-paketi", seller: "demo_s10", cat: "image-editing",
    title: "E-commerce katalog tahriri (ommaviy retush)",
    description: `100 ta suratlik katalogni bir xil, professional koʻrinishga keltiramiz — marketplace doʻkoningiz «brend» boʻlib koʻrinadi.

Nimalar qilamiz:
• Ommaviy fon tozalash va oq fonga oʻtkazish
• Yagona yorugʻlik/rang standarti butun katalog boʻylab
• Oʻlcham va ramka standartlashtirish (Uzum/WB talablari)
• Nomlash tizimi: SKU boʻyicha tartibli fayllar

Jarayon: namunaviy 3 ta surat → standart tasdiqlash → butun partiya → topshirish.

Nega biz: konveyer + nazorat: har 20-surat qoʻlda tekshiriladi. Katta hajmda ham sifat tushmaydi.`,
    tags: ["katalog", "retush", "ecommerce", "marketplace", "uzum"],
    prices: [150000, 400000, 900000], days: [2, 4, 7], revs: [1, 2, 3],
    tiers: [
      { f: ["20 ta suratgacha", "Oq fonga oʻtkazish", "Oʻlcham standartlash", "SKU nomlash"] },
      { f: ["60 ta suratgacha", "Rang/yorugʻlik bir xillash", "Yengil retush har biriga", "2 marketplace formati", "Namuna tasdiqlash bosqichi"] },
      { f: ["150 ta suratgacha", "Premium retush liniyasi", "Lifestyle ramkalar (10 ta)", "Doimiy hamkorlik narxi kafolati", "3 kunda ekspress opsiyasi"] },
    ],
  },
  {
    slug: "ai-taqdimot-explainer-video", seller: "demo_s5", cat: "ai-presentation",
    title: "AI taqdimot va explainer video",
    description: `Investor yoki mijozni 3 daqiqada ishontiring: gʻoyangizni sodda, chiroyli va esda qoladigan qilib aytamiz.

Nimalar qilamiz:
• Xabar arxitekturasi: nimani, kimga, qanday tartibda
• Taqdimot dizayni: toza, brendga mos, «slaydshou» emas
• Explainer video: ssenariy + animatsiya + ovoz
• Taqdim etish boʻyicha maslahat (qanday gapirish)

Jarayon: material + maqsad → struktura → dizayn/video → mashq-koʻrik.

Nega biz: Sesara pitch-deck'lari investitsiya olgan startaplarda ishlagan — «chiroyli» emas, ISHONTIRADIGAN qilamiz.`,
    tags: ["presentation", "explainer", "pitch deck", "slides"],
    prices: [180000, 400000, 850000], days: [3, 5, 8], revs: [2, 3, 4],
    tiers: [
      { f: ["10 slaydgacha taqdimot", "Sizning matningiz asosida dizayn", "Brend ranglariga moslash", "PDF + PPTX fayllar"] },
      { f: ["20 slaydgacha", "Xabar strukturasini birga quramiz", "Infografika va ikonkalar", "60s explainer video BONUS", "Taqdim etish boʻyicha 5 maslahat"] },
      { f: ["Toʻliq pitch-paket", "30 slayd + 90s explainer video", "AI ovoz yoki diktor bilan", "Investor savollariga Q&A slaydlar", "1 soatlik mashq-sessiya (video)", "2 hafta cheksiz mayda tuzatish"] },
    ],
  },
  {
    slug: "korporativ-taqdimot-dizayni", seller: "demo_s6", cat: "ai-presentation",
    title: "Korporativ taqdimot dizayni (hisobot, seminar)",
    description: `Hisobot, seminar yoki savdo taqdimotini «Word'dan koʻchirilgan» koʻrinishdan qutqaramiz — jiddiy, toza, korporativ.

Nimalar qilamiz:
• Matningizni vizual ierarxiyaga aylantirish
• Jadval va raqamlarni tushunarli infografikaga oʻtkazish
• Kompaniya brendbukiga qatʼiy rioya
• Master-slaydlar: keyingi taqdimotlarni oʻzingiz yasaysiz

Jarayon: material → struktura kelishuvi → dizayn → topshirish + master-fayl.

Nega biz: Qora Quti korporativ formatda ishlaydi — «kreativ shou» emas, ishonchli professionallik.`,
    tags: ["korporativ", "taqdimot", "hisobot", "slides"],
    prices: [150000, 350000, 700000], days: [2, 4, 6], revs: [2, 3, 4],
    tiers: [
      { f: ["10 slaydgacha", "Matn strukturasini saqlab dizayn", "2 ta diagramma/infografika", "PPTX + PDF"] },
      { f: ["25 slaydgacha", "5 ta infografika", "Master-slaydlar toʻplami", "Ikonka kutubxonasi", "Brendbukka moslash"] },
      { f: ["50 slaydgacha yoki 2 taqdimot", "Cheksiz infografika", "Animatsion oʻtishlar", "Jamoa uchun shablon-tizim", "Ustuvor navbat"] },
    ],
  },
  {
    slug: "oyin-brend-personaj-dizayni", seller: "demo_s4", cat: "ai-character",
    title: "Oʻyin va brend uchun personaj dizayni",
    description: `Mascot, oʻyin qahramoni yoki brend personaji — bir marta yaratiladi, hamma joyda taniladi.

Nimalar qilamiz:
• Xarakter konsepti: tashqi koʻrinish + ichki «fe'l»
• Turli emotsiya, poza va rakurslarda izchil dizayn
• Character-sheet: jamoangiz/animatorlar uchun standart
• Stiker-paket va social foydalanish variantlari

Jarayon: brif + referenslar → 3 konsept → tanlov → toʻliq character-sheet.

Nega biz: VividAI personajlari «rasm» emas, XARAKTER — auditoriya ularni yaxshi koʻrib qoladi.`,
    tags: ["character", "mascot", "game art", "concept"],
    prices: [220000, 500000, 1000000], days: [3, 6, 9], revs: [1, 2, 3],
    tiers: [
      { f: ["1 personaj konsepti", "3 poza", "2 emotsiya", "2K fayllar", "Tijorat litsenziyasi"] },
      { f: ["3 konseptdan tanlov", "Character-sheet: 6 poza + 6 emotsiya", "Old/yon/orqa koʻrinish (turnaround)", "Telegram stiker-paketi (6 ta)", "4K fayllar"] },
      { f: ["Toʻliq personaj-paketi", "12 poza + 12 emotsiya + turnaround", "2 kiyim/versiya varianti", "Stiker-paket (12 ta) + banner sahnalar", "Animatsiyaga tayyor qatlamli fayllar", "Mualliflik toʻliq sizda"] },
    ],
  },
  {
    slug: "3d-oyin-personaji-game-ready", seller: "demo_s10", cat: "ai-character",
    title: "3D oʻyin personaji (game-ready)",
    description: `Unity/Unreal uchun tayyor 3D personaj: konseptdan rigga qadar — indie jamoangiz badiiy jamoaga ega boʻladi.

Nimalar qilamiz:
• 2D konseptdan (yoki bizning konseptdan) 3D model
• Game-ready topologiya va optimal poligonlar
• PBR teksturalar: albedo, normal, roughness
• Bazaviy rig va T-pose (animatsiyaga tayyor)

Jarayon: konsept → blokaut tasdiqlash → model + teksturalar → rig → eksport.

Nega biz: RenderUz real oʻyin loyihalarida ishlagan — modellarimiz enjinda «ogʻir» boʻlmaydi.`,
    tags: ["3d", "game", "character", "unity", "unreal"],
    prices: [400000, 900000, 1800000], days: [5, 9, 14], revs: [1, 2, 3],
    tiers: [
      { f: ["1 personaj (low-poly, 10k gacha)", "PBR teksturalar", "T-pose, rigsiz", "FBX/GLB eksport", "Sizning 2D konseptingizdan"] },
      { f: ["Mid-poly personaj (30k gacha)", "2D konsept bizdan (2 variant)", "Bazaviy rig (humanoid)", "3 tekstura varianti", "Unity/Unreal test-sahnasi"] },
      { f: ["Hero-personaj (60k, LOD'lar bilan)", "Toʻliq rig + blend-shapes (yuz)", "4 tekstura varianti + emissive", "3 ta bazaviy animatsiya (idle/walk/run)", "Manba fayllar (Blender)", "Ustuvor qoʻllab-quvvatlash"] },
    ],
  },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameUz: c.nameUz, nameRu: c.nameRu, nameEn: c.nameEn },
      create: c,
    });
  }

  for (const s of SELLERS) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: { isSeller: true, status: "ACTIVE" },
      create: {
        id: s.id,
        firstName: s.firstName,
        username: s.username,
        isSeller: true,
        role: "BUYER",
        status: "ACTIVE",
        onboardingCompleted: true,
      },
    });
    const prof = SELLER_PROFILES[s.id];
    if (prof) {
      // NOTE: no fabricated ratingAvg/ratingCount here — ratings must trace to real
      // Review rows (platform honesty rule; same reason the ticker uses real events).
      // Cards handle the empty state ("New") instead of showing fake counts.
      const data = {
        headline: prof.headline,
        bio: prof.bio,
        skills: prof.skills,
        aiTools: prof.aiTools,
        specializations: prof.specializations,
        instagramUsername: prof.instagramUsername,
      };
      await prisma.sellerProfile.upsert({
        where: { userId: s.id },
        update: data,
        create: { userId: s.id, ...data },
      });
    }
  }

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const coverFor = (cat) => (publicBase ? `${publicBase}/covers/${cat}.png` : null);
  const TIER_NAMES = ["BASIC", "STANDARD", "PREMIUM"];
  const TIER_TITLES = ["Basic", "Standard", "Premium"];
  // Positioning tagline shown above each tier's checklist (non-✓ first line):
  // answers "why this tier?" before the buyer reads a single feature.
  const TIER_TAGLINES = [
    "Sinab koʻrish uchun ideal start",
    "Eng ommabop tanlov — eng yaxshi narx/qiymat",
    "Jiddiy natija uchun toʻliq quvvat",
  ];

  for (const g of GIGS) {
    const cat = await prisma.category.findUnique({ where: { slug: g.cat } });
    const coverUrl = coverFor(g.cat);
    const gigId = `demo_gig_${g.slug}`;
    await prisma.gig.upsert({
      where: { id: gigId },
      // UPDATE now upgrades content too — re-running the seed refreshes copy.
      update: {
        status: "ACTIVE",
        categoryId: cat?.id ?? null,
        tags: g.tags,
        coverUrl,
        title: g.title,
        description: g.description,
      },
      create: {
        id: gigId,
        sellerId: g.seller,
        categoryId: cat?.id ?? null,
        title: g.title,
        slug: g.slug,
        description: g.description,
        tags: g.tags,
        coverUrl,
        status: "ACTIVE",
        locale: "uz",
      },
    });
    // Packages: per-tier upsert (unique [gigId, tier]) with "✓ " feature lines.
    for (let i = 0; i < 3; i++) {
      const features = g.tiers?.[i]?.f ?? [];
      const desc = features.length
        ? [TIER_TAGLINES[i], ...features.map((f) => `✓ ${f}`)].join("\n")
        : null;
      await prisma.gigPackage.upsert({
        where: { gigId_tier: { gigId, tier: TIER_NAMES[i] } },
        update: {
          title: TIER_TITLES[i],
          description: desc,
          priceUzs: g.prices[i],
          deliveryDays: g.days[i],
          revisions: g.revs[i],
        },
        create: {
          gigId,
          tier: TIER_NAMES[i],
          title: TIER_TITLES[i],
          description: desc,
          priceUzs: g.prices[i],
          deliveryDays: g.days[i],
          revisions: g.revs[i],
        },
      });
    }
  }

  console.log(`Demo seed complete: ${CATEGORIES.length} categories, ${SELLERS.length} sellers, ${GIGS.length} gigs`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("seed-prod failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
