-- Usunięto formę zatrudnienia „Instruktor sekcji (sekcje + weekendy)” – takie konta przechodzą na „Tylko sekcje”.
UPDATE "User" SET "employment" = 'TYLKO_SEKCJE' WHERE "employment" = 'SEKCJA';
