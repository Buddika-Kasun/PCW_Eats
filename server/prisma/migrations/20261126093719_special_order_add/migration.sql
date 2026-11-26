-- CreateTable
CREATE TABLE "special_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "meal_id" TEXT NOT NULL,
    "meal_name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "guest_range_start" TEXT,
    "guest_range_end" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_order_guests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_order_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "special_orders_order_no_key" ON "special_orders"("order_no");

-- AddForeignKey
ALTER TABLE "special_order_guests" ADD CONSTRAINT "special_order_guests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "special_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
