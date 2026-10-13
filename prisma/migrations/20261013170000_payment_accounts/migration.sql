-- Data only (no schema change): payment details now depend on the invoice
-- currency (docs/13 §11). The single set of bank details (pay_bank_name,
-- pay_account_title, pay_account_number) becomes one payment account marked
-- Default, stored as JSON in the `payment_accounts` setting. An account
-- number that looks like an IBAN moves to the IBAN field. pay_wallet stays.
-- The JSON is built with CONCAT + JSON_QUOTE so `isDefault` is a real JSON
-- boolean on both MariaDB and MySQL.

SET @pa_bank = COALESCE((SELECT TRIM(`value`) FROM `settings` WHERE `key` = 'pay_bank_name'), '');
SET @pa_title = COALESCE((SELECT TRIM(`value`) FROM `settings` WHERE `key` = 'pay_account_title'), '');
SET @pa_number = COALESCE((SELECT TRIM(`value`) FROM `settings` WHERE `key` = 'pay_account_number'), '');
SET @pa_compact = UPPER(REPLACE(REPLACE(@pa_number, ' ', ''), '-', ''));
SET @pa_is_iban = @pa_compact REGEXP '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$';

INSERT INTO `settings` (`key`, `value`, `updated_at`)
SELECT
  'payment_accounts',
  CONCAT(
    '[{"id":"default","label":"Main account","bankName":', JSON_QUOTE(@pa_bank),
    ',"accountTitle":', JSON_QUOTE(@pa_title),
    ',"accountNumber":', JSON_QUOTE(IF(@pa_is_iban, '', @pa_number)),
    ',"iban":', JSON_QUOTE(IF(@pa_is_iban, @pa_compact, '')),
    ',"swift":"","branchCode":"","currencies":[],"isDefault":true}]'
  ),
  UTC_TIMESTAMP(3)
FROM DUAL
WHERE (@pa_bank <> '' OR @pa_title <> '' OR @pa_number <> '')
  AND NOT EXISTS (SELECT 1 FROM `settings` WHERE `key` = 'payment_accounts');

DELETE FROM `settings` WHERE `key` IN ('pay_bank_name', 'pay_account_title', 'pay_account_number');
