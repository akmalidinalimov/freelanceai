-- Gig cover focal point ("x% y%" CSS object-position) so 4:5 featured + 16:9 card
-- frames crop around the creator-chosen area. Nullable → existing gigs center by default.
ALTER TABLE "Gig" ADD COLUMN "coverFocal" TEXT;
