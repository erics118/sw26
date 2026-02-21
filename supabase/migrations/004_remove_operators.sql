-- Remove the operators concept. This is a single-charter app; there are no third-party carriers.

-- Drop operator_id FK columns before dropping the table
ALTER TABLE aircraft DROP COLUMN IF EXISTS operator_id;
ALTER TABLE crew     DROP COLUMN IF EXISTS operator_id;
ALTER TABLE quotes   DROP COLUMN IF EXISTS operator_id;

-- Drop the column that only made sense when dealing with external operator quotes
ALTER TABLE quote_costs DROP COLUMN IF EXISTS operator_quoted_rate;

-- Drop the operators table
DROP TABLE IF EXISTS operators;
