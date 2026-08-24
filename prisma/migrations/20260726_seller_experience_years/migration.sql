-- Years of AI-creation experience, asked at seller onboarding (band lower bound:
-- 0 = under a year, 1 = 1-2, 3 = 3-5, 5 = 5+). Null = never answered.
ALTER TABLE "SellerProfile" ADD COLUMN "experienceYears" INTEGER;
