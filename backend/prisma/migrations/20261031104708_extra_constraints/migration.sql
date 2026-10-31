-- Stock can never go negative
ALTER TABLE "StockLevel"
  ADD CONSTRAINT stock_level_non_negative CHECK ("quantity" >= 0);

-- A transfer must move something, and never from a location to itself
ALTER TABLE "TransferItem"
  ADD CONSTRAINT transfer_item_qty_sent_positive CHECK ("qtySent" > 0),
  ADD CONSTRAINT transfer_item_qty_received_valid CHECK ("qtyReceived" IS NULL OR "qtyReceived" >= 0);

ALTER TABLE "Transfer"
  ADD CONSTRAINT transfer_different_locations CHECK ("fromLocationId" <> "toLocationId");

-- Sales and payments must be positive amounts
ALTER TABLE "SaleItem"
  ADD CONSTRAINT sale_item_quantity_positive CHECK ("quantity" > 0),
  ADD CONSTRAINT sale_item_price_non_negative CHECK ("unitPrice" >= 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT payment_amount_positive CHECK ("amount" > 0);

-- Every non-owner user must belong to a location
ALTER TABLE "User"
  ADD CONSTRAINT user_location_required CHECK ("role" = 'OWNER' OR "locationId" IS NOT NULL);

-- Restricted view for the public website: published products only, no internal data
CREATE VIEW "PublicProduct" AS
  SELECT p."id", p."sku", p."name", p."description", p."material", p."dimensions",
         p."price", p."imagePath", c."name" AS "categoryName"
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."categoryId"
  WHERE p."isPublished" = true AND p."isActive" = true;