ALTER TABLE "User"
ADD COLUMN "defaultAddressId" TEXT;

UPDATE "User" AS users
SET "defaultAddressId" = (
  SELECT addresses."id"
  FROM "Address" AS addresses
  WHERE
    addresses."userId" = users."id"
  ORDER BY addresses."id"
  LIMIT 1
);

CREATE UNIQUE INDEX "User_defaultAddressId_key"
ON "User"("defaultAddressId");

ALTER TABLE "User"
ADD CONSTRAINT "User_defaultAddressId_fkey"
FOREIGN KEY ("defaultAddressId")
REFERENCES "Address"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
