CREATE TABLE station_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  name text NOT NULL DEFAULT 'AquaFlow',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 3000 CHECK (price_cents BETWEEN 1 AND 10000000),
  delivery_fee_cents integer NOT NULL DEFAULT 0 CHECK (delivery_fee_cents BETWEEN 0 AND 10000000),
  timezone text NOT NULL DEFAULT 'Asia/Manila',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO station_settings (id) VALUES (1);

CREATE TABLE customers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_name_idx ON customers (lower(name));

CREATE TABLE suppliers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 100000000),
  reorder_level integer NOT NULL DEFAULT 20 CHECK (reorder_level BETWEEN 0 AND 100000000),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO inventory (id, name, unit) VALUES
  ('filled', 'Filled 5-gallon containers', 'containers'),
  ('empty', 'Empty 5-gallon containers', 'containers'),
  ('caps', 'Seals & caps', 'pieces');

CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  customer_name text NOT NULL,
  address text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  delivery_fee_cents integer NOT NULL CHECK (delivery_fee_cents >= 0),
  total_cents bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_cents + delivery_fee_cents) STORED,
  fulfillment text NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  paid boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_created_idx ON orders (created_at DESC, id DESC);
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_completed_idx ON orders (completed_at) WHERE status = 'completed';

CREATE TABLE stock_operations (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id text NOT NULL REFERENCES inventory(id),
  delta integer NOT NULL CHECK (delta <> 0),
  balance integer NOT NULL CHECK (balance >= 0),
  reason text NOT NULL,
  created_by text NOT NULL,
  order_id bigint REFERENCES orders(id),
  operation_id uuid REFERENCES stock_operations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_created_idx ON stock_movements (created_at DESC, id DESC);

CREATE TABLE maintenance (
  id uuid PRIMARY KEY,
  equipment text NOT NULL,
  description text NOT NULL,
  due_date date NOT NULL,
  completed_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_due_idx ON maintenance (due_date);
