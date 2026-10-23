-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT DEFAULT 'stock-keeping',
    "shelf_life" TEXT DEFAULT 'perpetual',

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "eligible_from" TEXT NOT NULL,
    "eligible_to" TEXT NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "items_json" TEXT NOT NULL,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dept_quota_maps" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "effective_from" TEXT NOT NULL,
    "quota_id" TEXT NOT NULL,

    CONSTRAINT "dept_quota_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteens" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "canteens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL,
    "min_level" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_batches" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "delivery_time" TEXT,
    "received_qty" DOUBLE PRECISION NOT NULL,
    "issued_qty" DOUBLE PRECISION NOT NULL,
    "remaining_qty" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "cleared_at" TEXT,
    "waste_qty" DOUBLE PRECISION,

    CONSTRAINT "daily_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fingerprint_enrolled" BOOLEAN,
    "biometric_card_no" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "dept" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "canteen_id" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dept_balances" (
    "department" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "dept_balances_pkey" PRIMARY KEY ("department")
);

-- CreateTable
CREATE TABLE "biometric_logs" (
    "id" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_ip" TEXT NOT NULL,
    "verification_mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "biometric_logs_pkey" PRIMARY KEY ("id")
);
