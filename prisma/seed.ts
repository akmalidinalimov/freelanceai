import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "ai-video", nameUz: "AI video", nameRu: "AI-видео", nameEn: "AI video" },
  { slug: "ai-image", nameUz: "AI rasm", nameRu: "AI-изображения", nameEn: "AI image" },
  { slug: "ai-avatar", nameUz: "AI avatar", nameRu: "AI-аватар", nameEn: "AI avatar" },
  { slug: "ai-ads", nameUz: "AI reklama", nameRu: "AI-реклама", nameEn: "AI ads" },
  { slug: "voiceover", nameUz: "Ovoz dublyaji", nameRu: "Озвучка", nameEn: "Voiceover" },
  { slug: "branding", nameUz: "Brending", nameRu: "Брендинг", nameEn: "Branding" },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
