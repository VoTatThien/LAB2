-- Membership mặc định của tài khoản thường bắt đầu với 10 điểm.
ALTER TABLE "memberships" ALTER COLUMN "score" SET DEFAULT 10;

UPDATE "memberships"
SET "score" = 10
WHERE "mname" = 'BASIC';

-- Chuẩn hóa tên role tài khoản đăng ký mới theo yêu cầu nghiệp vụ.
INSERT INTO "roles" ("rolename")
VALUES ('NORMAL')
ON CONFLICT ("rolename") DO NOTHING;
