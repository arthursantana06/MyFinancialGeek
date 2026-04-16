ALTER TABLE wallets ADD COLUMN institution_name TEXT;
ALTER TABLE payment_methods ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
