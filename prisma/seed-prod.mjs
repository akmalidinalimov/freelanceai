// Production demo seed — categories + showcase sellers + demo gigs so the marketplace
// looks alive pre-launch. Idempotent (upserts by fixed slug/id). Re-runs safely on every
// deploy. To remove demo content later: delete users/gigs with the `demo_` id prefix.
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
    bio: "Qora Quti Studio — brending, professional retush va reklama kreativlari. Moda va e-commerce brendlari uchun yuqori konversiyali banner va vizuallar; rasm tiklash, upscale va fon almashtirish.",
    skills: ["Brending", "Retush va upscale", "Reklama kreativi", "Fon almashtirish"],
    aiTools: ["Photoshop", "Magnific", "Flux", "Midjourney"],
    specializations: ["branding", "image_edit", "fashion"],
    instagramUsername: IG,
  },
  demo_s7: {
    headline: "AI ovoz, dublyaj va original musiqa",
    bio: "OvozLab — professional AI ovoz, koʻp tilli dublyaj va original musiqa/jingle. Reklama, video va oʻyinlar uchun oʻzbek, rus va ingliz tillarida tabiiy ovoz.",
    skills: ["Ovoz dublyaji", "Original musiqa", "Jingle", "Sound dizayn"],
    aiTools: ["ElevenLabs", "Suno", "Udio", "Adobe Audition"],
    specializations: ["voiceover", "music_audio", "entertainment"],
    instagramUsername: IG,
  },
  demo_s8: {
    headline: "Motion-grafika va logo animatsiyasi",
    bio: "MotionBek — logo animatsiyasi, motion-grafika va dinamik reklama roliklari. Brend intro, ijtimoiy tarmoq animatsiyalari va explainer motion.",
    skills: ["Logo animatsiyasi", "Motion grafika", "Intro dizayn", "Kinetik tipografiya"],
    aiTools: ["After Effects", "Runway", "Kling", "Pika"],
    specializations: ["motion", "ai_video", "ecommerce"],
    instagramUsername: IG,
  },
  demo_s9: {
    headline: "AI avatar va goʻzallik brendlari uchun UGC",
    bio: "Aisha Studio — goʻzallik va kosmetika brendlari uchun AI avatar va UGC reklamalar. Ishonarli talking-head modellar va tabiiy mahsulot taqdimoti.",
    skills: ["AI avatar", "UGC reklama", "Beauty kontent", "Video montaj"],
    aiTools: ["HeyGen", "Arcads", "Runway", "ElevenLabs"],
    specializations: ["ai_avatar", "beauty", "ai_video"],
    instagramUsername: IG,
  },
  demo_s10: {
    headline: "3D render va e-commerce mahsulot vizuallari",
    bio: "RenderUz — 3D mahsulot renderlari va e-commerce uchun fotorealistik vizuallar. Marketplace kataloglari, upakovka va mahsulot animatsiyasi.",
    skills: ["3D render", "Mahsulot vizuali", "Upakovka dizayni", "Katalog"],
    aiTools: ["Blender", "Midjourney", "Magnific", "KeyShot"],
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

// prices/days/revisions are [BASIC, STANDARD, PREMIUM]
const GIGS = [
  {
    slug: "ai-reklama-videosi-mahsulot", seller: "demo_s1", cat: "ai-video",
    title: "Mahsulotingiz uchun AI reklama videosi (15–30s)",
    description: "Brendingiz uchun e'tiborni tortuvchi AI reklama roligi. Stsenariy, ovoz va montaj — hammasi tayyor holatda. Instagram, TikTok va YouTube uchun moslashtiriladi.",
    tags: ["ai video", "reklama", "instagram", "tiktok"], prices: [300000, 700000, 1500000], days: [3, 5, 7], revs: [1, 2, 3],
  },
  {
    slug: "cinematic-ai-short-film-4k", seller: "demo_s3", cat: "ai-video",
    title: "Cinematic AI short-film (4K)",
    description: "Kinematografik uslubdagi AI qisqa metrajli video. Atmosfera, rang-baranglik va professional montaj bilan. Brend hikoyasi yoki musiqiy klip uchun ideal.",
    tags: ["cinematic", "4k", "ai film", "storytelling"], prices: [500000, 1200000, 2500000], days: [5, 8, 12], revs: [1, 2, 3],
  },
  {
    slug: "instagram-reels-tiktok-ai-video", seller: "demo_s5", cat: "ai-video",
    title: "Instagram Reels / TikTok uchun AI video paketi",
    description: "Ijtimoiy tarmoqlar uchun trendga mos qisqa AI videolar. Haftalik kontent paketi sifatida ham buyurtma qilish mumkin.",
    tags: ["reels", "tiktok", "short video", "content"], prices: [200000, 450000, 900000], days: [2, 4, 6], revs: [2, 3, 5],
  },
  {
    slug: "brending-uchun-ai-rasm-toplami", seller: "demo_s2", cat: "ai-image",
    title: "Brending uchun AI rasm to'plami",
    description: "Brendingiz uslubiga mos AI rasmlar to'plami — ijtimoiy tarmoq, sayt va reklama uchun. Yagona vizual til bilan.",
    tags: ["ai image", "brending", "visual", "social", "moda", "fashion"], prices: [120000, 300000, 600000], days: [2, 3, 5], revs: [2, 3, 5],
  },
  {
    slug: "ai-fantasy-art-illustration", seller: "demo_s4", cat: "ai-image",
    title: "AI fantasy art & illustration",
    description: "Noyob fantaziya uslubidagi AI illyustratsiyalar. Kitob muqovasi, plakat yoki kollektsiya uchun yuqori aniqlikdagi rasmlar.",
    tags: ["fantasy", "illustration", "concept art", "hi-res"], prices: [150000, 350000, 700000], days: [3, 5, 7], revs: [1, 2, 3],
  },
  {
    slug: "ai-portret-avatar-ijtimoiy", seller: "demo_s3", cat: "ai-image",
    title: "AI portret va avatar (ijtimoiy tarmoq)",
    description: "Profil rasmi va shaxsiy brend uchun professional AI portretlar. Bir nechta uslub variantlari bilan.",
    tags: ["portrait", "avatar", "profile", "personal brand"], prices: [80000, 180000, 350000], days: [1, 2, 3], revs: [2, 3, 5],
  },
  {
    slug: "ai-avatar-raqamli-model", seller: "demo_s1", cat: "ai-avatar",
    title: "AI avatar / raqamli model yaratish",
    description: "Brend yoki blogeringiz uchun izchil raqamli avatar. Turli pozalar va kiyimlarda qayta ishlatish mumkin.",
    tags: ["ai avatar", "digital human", "influencer", "brand"], prices: [400000, 900000, 1800000], days: [4, 7, 10], revs: [1, 2, 3],
  },
  {
    slug: "ai-reklama-banner-kreativ", seller: "demo_s6", cat: "ai-ads",
    title: "AI reklama bannerlari va kreativlar",
    description: "Targetlangan reklama uchun yuqori konversiyali banner va kreativlar to'plami. A/B test uchun bir nechta variant.",
    tags: ["ads", "banner", "creative", "performance", "moda", "fashion"], prices: [180000, 400000, 800000], days: [2, 4, 6], revs: [2, 3, 5],
  },
  {
    slug: "ai-ugc-talking-head-reklama", seller: "demo_s5", cat: "ai-ugc",
    title: "AI UGC talking-head reklama (Instagram/TikTok)",
    description: "Haqiqiy odamga o'xshash AI ovozli talking-head UGC reklamalar. Mahsulotingizni tabiiy va ishonarli taqdim etadi.",
    tags: ["ugc", "talking head", "ai actor", "ads"], prices: [250000, 550000, 1100000], days: [3, 5, 7], revs: [1, 2, 3],
  },
  {
    slug: "ozbekcha-ruscha-ovoz-dublyaji", seller: "demo_s3", cat: "voiceover",
    title: "Professional o'zbekcha / ruscha ovoz dublyaji",
    description: "Reklama, video va prezentatsiya uchun toza, professional ovoz. O'zbek va rus tillarida, turli ohanglarda.",
    tags: ["voiceover", "uzbek", "russian", "dubbing"], prices: [120000, 250000, 500000], days: [1, 2, 3], revs: [2, 3, 5],
  },
  {
    slug: "ai-original-musiqa-jingle", seller: "demo_s4", cat: "ai-music",
    title: "AI bilan original musiqa va jingle",
    description: "Brendingiz uchun original AI musiqa, jingle yoki fon trek. Mualliflik huquqidan xoli, tijoriy foydalanishga tayyor.",
    tags: ["ai music", "jingle", "soundtrack", "royalty-free"], prices: [200000, 450000, 900000], days: [3, 5, 8], revs: [1, 2, 3],
  },
  {
    slug: "toliq-brending-logo-identika", seller: "demo_s2", cat: "branding",
    title: "To'liq brending: logo + vizual identika",
    description: "Logotip, rang palitrasi, shrift va brand guideline. Yangi biznes yoki rebrending uchun to'liq paket.",
    tags: ["branding", "logo", "identity", "guideline"], prices: [500000, 1200000, 2500000], days: [5, 8, 14], revs: [2, 3, 5],
  },
  {
    slug: "ai-mahsulot-fotosurati-ecommerce", seller: "demo_s1", cat: "ai-product",
    title: "AI mahsulot fotosurati (e-commerce)",
    description: "Onlayn do'kon uchun toza fonli, professional AI mahsulot fotosuratlari. Marketplace talablariga mos.",
    tags: ["product photo", "ecommerce", "studio", "catalog"], prices: [100000, 250000, 550000], days: [2, 3, 5], revs: [2, 3, 5],
  },
  {
    slug: "rasm-tahrirlash-retush-upscale", seller: "demo_s6", cat: "image-editing",
    title: "Rasm tahrirlash, retush va upscale",
    description: "Eski yoki past sifatli rasmlarni tiklash, retush va 4K gacha upscale. Fon almashtirish ham mavjud.",
    tags: ["retouch", "upscale", "restoration", "editing"], prices: [60000, 150000, 350000], days: [1, 2, 4], revs: [2, 3, 5],
  },
  {
    slug: "ai-taqdimot-explainer-video", seller: "demo_s5", cat: "ai-presentation",
    title: "AI taqdimot va explainer video",
    description: "Investor yoki mijoz uchun pishiq taqdimot va explainer video. Stsenariy, dizayn va ovoz bilan.",
    tags: ["presentation", "explainer", "pitch deck", "slides"], prices: [180000, 400000, 850000], days: [3, 5, 8], revs: [2, 3, 4],
  },
  {
    slug: "oyin-brend-personaj-dizayni", seller: "demo_s4", cat: "ai-character",
    title: "O'yin va brend uchun personaj dizayni",
    description: "Mascot, o'yin qahramoni yoki brend personaji uchun izchil dizayn. Turli emotsiya va pozalarda.",
    tags: ["character", "mascot", "game art", "concept"], prices: [220000, 500000, 1000000], days: [3, 6, 9], revs: [1, 2, 3],
  },
  {
    slug: "kop-tilli-ai-ovoz-dublyaji", seller: "demo_s7", cat: "voiceover",
    title: "Koʻp tilli AI ovoz va dublyaj (uz / ru / en)",
    description: "Reklama, video va prezentatsiya uchun tabiiy AI ovoz. Oʻzbek, rus va ingliz tillarida, turli ohang va tezlikda. Skript ham tayyorlab beramiz.",
    tags: ["voiceover", "dubbing", "uzbek", "russian", "ovoz"], prices: [130000, 280000, 550000], days: [1, 2, 3], revs: [2, 3, 5],
  },
  {
    slug: "brend-uchun-ai-musiqa-jingle", seller: "demo_s7", cat: "ai-music",
    title: "Brend uchun original AI musiqa va jingle",
    description: "Brendingiz uchun original AI musiqa, jingle yoki fon trek. Mualliflik huquqidan xoli, tijoriy foydalanishga tayyor.",
    tags: ["ai music", "jingle", "branding", "royalty-free"], prices: [220000, 480000, 950000], days: [3, 5, 8], revs: [1, 2, 3],
  },
  {
    slug: "logo-animatsiyasi-motion-grafika", seller: "demo_s8", cat: "ai-video",
    title: "Logo animatsiyasi va motion-grafika",
    description: "Brend intro, logo animatsiyasi va ijtimoiy tarmoq uchun motion-grafika. Dinamik, zamonaviy va brendingizga mos.",
    tags: ["motion", "animation", "logo", "intro"], prices: [180000, 400000, 800000], days: [2, 4, 6], revs: [2, 3, 4],
  },
  {
    slug: "gozallik-brendi-ai-ugc-avatar", seller: "demo_s9", cat: "ai-ugc",
    title: "Goʻzallik brendi uchun AI UGC avatar reklama",
    description: "Kosmetika va goʻzallik brendlari uchun ishonarli AI avatar UGC reklamalar. Tabiiy mahsulot taqdimoti, oʻzbek/rus ovozi bilan.",
    tags: ["ugc", "avatar", "beauty", "kosmetika"], prices: [260000, 560000, 1100000], days: [3, 5, 7], revs: [1, 2, 3],
  },
  {
    slug: "3d-mahsulot-render-ecommerce", seller: "demo_s10", cat: "ai-product",
    title: "3D mahsulot renderi (e-commerce)",
    description: "Onlayn doʻkon uchun fotorealistik 3D mahsulot renderlari. Marketplace talablariga mos, turli rakurs va fonlarda.",
    tags: ["3d", "render", "product", "ecommerce"], prices: [200000, 450000, 900000], days: [3, 5, 8], revs: [1, 2, 3],
  },
  {
    slug: "moda-brendi-uchun-ai-video-lookbook", seller: "demo_s11", cat: "ai-video",
    title: "Moda brendi uchun AI video va lookbook (reels)",
    description: "Kiyim va aksessuar brendlari uchun trendga mos AI videolar — lookbook, podium va Instagram reels. Brend uslubida, tez va sifatli.",
    tags: ["fashion", "moda", "video", "reels", "lookbook", "kiyim"], prices: [280000, 600000, 1200000], days: [3, 5, 7], revs: [1, 2, 3],
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

  for (const g of GIGS) {
    const cat = await prisma.category.findUnique({ where: { slug: g.cat } });
    const coverUrl = coverFor(g.cat);
    await prisma.gig.upsert({
      where: { id: `demo_gig_${g.slug}` },
      update: { status: "ACTIVE", categoryId: cat?.id ?? null, tags: g.tags, coverUrl },
      create: {
        id: `demo_gig_${g.slug}`,
        sellerId: g.seller,
        categoryId: cat?.id ?? null,
        title: g.title,
        slug: g.slug,
        description: g.description,
        tags: g.tags,
        coverUrl,
        status: "ACTIVE",
        locale: "uz",
        packages: {
          create: [
            { tier: "BASIC", title: "Basic", priceUzs: g.prices[0], deliveryDays: g.days[0], revisions: g.revs[0] },
            { tier: "STANDARD", title: "Standard", priceUzs: g.prices[1], deliveryDays: g.days[1], revisions: g.revs[1] },
            { tier: "PREMIUM", title: "Premium", priceUzs: g.prices[2], deliveryDays: g.days[2], revisions: g.revs[2] },
          ],
        },
      },
    });
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
