-- Dữ liệu GIẢ để thử trên production, trước khi dùng thật. Xoá hết và tạo lại từ đầu khi đưa vào hoạt động.
-- Chỉ tên và số điện thoại giả: không đưa dữ liệu người thật vào đây (design doc, Dependencies).
--
-- Chạy SAU khi deploy (migration 0011-0013 đã chạy), dùng kết nối trực tiếp (không qua pooler):
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/prod-test-data.sql
-- Chạy lại lần hai sẽ báo lỗi (địa vực đã có) và không ghi gì.
--
-- Tài khoản (mật khẩu tất cả: test). Đăng nhập cần SĐT 10 số, nên tài khoản theo quy luật:
--   Địa vực trưởng        0000000000
--   KVT khu vực MS n      00000000n0   (MS 1: 0000000010, MS 2: 0000000020, ...)
--   Thánh đồ MS n         00000000n1, 00000000n2, 00000000n3
--
-- Mỗi khu vực MS 1..4: 1 KVT + 3 thánh đồ; mỗi người 2 chiên (KVT thêm 1 chiên đã báptem); ĐVT không có chiên.
-- Ca trudo mỗi khu vực: 1 ca đã xong (3 ngày trước, có ghi chú), 1 ca tối nay, 1 ca sắp tới chưa có ai chia sẻ chính,
-- 1 ca đi tiếp xúc ngày mai. Thêm: 1 ca chéo khu vực (MS 1 đi cùng MS 2) và 1 ca đi tiếp xúc của ĐVT (hiện ở mọi
-- khu vực). Thời gian tính theo lúc chạy file.

BEGIN;

DO $$
DECLARE
  pw constant text := '$argon2id$v=19$m=19456,t=2,p=1$tFcChHRGNyL8i/CkJSXFAg$+Ib33Y7IK5LN6M2xrqa1Su4QOq8j7ihLPMW5m9nKMKk';
  names constant text[] := array['An', 'Bình', 'Chi'];
  tz constant text := 'Asia/Ho_Chi_Minh';
  today timestamptz := (date_trunc('day', now() at time zone tz)) at time zone tz; -- 00:00 hôm nay, giờ VN
  rid int;
  rl int; -- region leader
  aid int;
  kvt int;
  mem int[]; -- members of the area, index 1..3
  people int[]; -- KVT + members
  firsts int[]; -- each person's first listener, same order as people
  uid int;
  lid int;
  sid int;
  ms1_member int;
  ms2_member int;
  ms2_listener int;
  a int;
  i int;
BEGIN
  IF EXISTS (SELECT 1 FROM regions WHERE name = 'Địa vực Giô-suê') THEN
    RAISE EXCEPTION 'Địa vực Giô-suê đã có: dữ liệu test đã được tạo trước đó.';
  END IF;

  INSERT INTO regions (name) VALUES ('Địa vực Giô-suê') RETURNING id INTO rid;
  INSERT INTO users (phone, password_hash, name, area_id, region_id, role, must_change_password)
  VALUES ('0000000000', pw, 'ĐVT Giô-suê', NULL, rid, 'region_leader', false)
  RETURNING id INTO rl;

  FOR a IN 1..4 LOOP
    INSERT INTO areas (name, region_id) VALUES ('MS ' || a, rid) RETURNING id INTO aid;

    INSERT INTO users (phone, password_hash, name, area_id, region_id, role, must_change_password, created_by)
    VALUES ('00000000' || a || '0', pw, 'KVT MS ' || a, aid, rid, 'area_leader', false, rl)
    RETURNING id INTO kvt;
    mem := array[]::int[];
    FOR i IN 1..3 LOOP
      INSERT INTO users (phone, password_hash, name, area_id, region_id, role, must_change_password, created_by)
      VALUES ('00000000' || a || i, pw, 'ae ' || names[i] || ' MS' || a, aid, rid, 'member', false, kvt)
      RETURNING id INTO uid;
      mem := mem || uid;
    END LOOP;
    people := kvt || mem;
    firsts := array[]::int[];

    -- Two listeners each: one hearing Mảnh (1..4 bài), one new on route B or F.
    FOR i IN 1..4 LOOP
      uid := people[i];
      INSERT INTO listeners (area_id, region_id, name, birth_year, manual_status, route, lessons_reached,
                             first_lesson_at, created_by, created_at)
      VALUES (aid, rid, 'Chiên ' || i || 'A · MS' || a, 1990 + a + i, 'goi_mo', 'manh', i,
              now() - (i * 7 || ' days')::interval, uid, now() - (30 + i || ' days')::interval)
      RETURNING id INTO lid;
      firsts := firsts || lid;
      INSERT INTO listener_links (listener_id, user_id, added_by) VALUES (lid, uid, uid);
      INSERT INTO private.listener_private (listener_id, phone, hometown)
      VALUES (lid, '09' || a || i || '000001', 'Quê giả MS' || a);
      INSERT INTO private.listener_notes (listener_id, author_id, body, created_at)
      VALUES (lid, uid, 'Ghi chú test: chiên hỏi thêm về bài vừa nghe, hẹn gặp lại cuối tuần.', now() - interval '3 days');

      INSERT INTO listeners (area_id, region_id, name, birth_year, manual_status, route, lessons_reached, created_by)
      VALUES (aid, rid, 'Chiên ' || i || 'B · MS' || a, 2000 + i, 'moi_quen',
              CASE WHEN i % 2 = 0 THEN 'b' ELSE 'f' END::listening_route, 0, uid)
      RETURNING id INTO lid;
      INSERT INTO listener_links (listener_id, user_id, added_by) VALUES (lid, uid, uid);
      INSERT INTO private.listener_private (listener_id, zalo) VALUES (lid, 'zalo.me/test' || a || i);
    END LOOP;

    -- The area leader also has a baptized listener.
    INSERT INTO listeners (area_id, region_id, name, birth_year, manual_status, route, lessons_reached,
                           first_lesson_at, baptized_at, created_by, created_at)
    VALUES (aid, rid, 'Chiên báptem · MS' || a, 1985 + a, 'baptem', 'manh', 7,
            now() - interval '60 days', now() - interval '5 days', kvt, now() - interval '90 days')
    RETURNING id INTO lid;
    INSERT INTO listener_links (listener_id, user_id, added_by) VALUES (lid, kvt, kvt);
    INSERT INTO private.listener_private (listener_id, phone) VALUES (lid, '09' || a || '9000001');

    -- Done 3 days ago: KVT + ae 1 with ae 1's listener, ae 1 shared.
    INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state, sharer_id)
    VALUES (aid, rid, mem[1], 'visit', today - interval '3 days' + interval '19 hours', 'Quán cafe MS' || a,
            'planned', mem[1])
    RETURNING id INTO sid;
    INSERT INTO session_members (session_id, user_id) VALUES (sid, mem[1]), (sid, kvt);
    INSERT INTO session_listeners (session_id, listener_id) VALUES (sid, firsts[2]);
    INSERT INTO private.session_private (session_id) VALUES (sid);

    -- Tonight 19:30: ae 2 and ae 3 with ae 2's listener.
    INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state, sharer_id)
    VALUES (aid, rid, mem[2], 'visit', today + interval '19 hours 30 minutes', 'Quán cafe Kết MS' || a, 'planned', mem[2])
    RETURNING id INTO sid;
    INSERT INTO session_members (session_id, user_id) VALUES (sid, mem[2]), (sid, mem[3]);
    INSERT INTO session_listeners (session_id, listener_id) VALUES (sid, firsts[3]);
    INSERT INTO private.session_private (session_id) VALUES (sid);

    -- In 2 days: ae 3 alone, nobody sharing yet (others can join).
    INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state)
    VALUES (aid, rid, mem[3], 'visit', today + interval '2 days 18 hours', 'Công viên MS' || a, 'planned')
    RETURNING id INTO sid;
    INSERT INTO session_members (session_id, user_id) VALUES (sid, mem[3]);
    INSERT INTO session_listeners (session_id, listener_id) VALUES (sid, firsts[4]);
    INSERT INTO private.session_private (session_id) VALUES (sid);

    -- Tomorrow: outreach by the area leader.
    INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state)
    VALUES (aid, rid, kvt, 'outreach', today + interval '1 day 9 hours', 'Gõ cửa khu MS' || a, 'planned')
    RETURNING id INTO sid;
    INSERT INTO session_members (session_id, user_id) VALUES (sid, kvt);
    INSERT INTO private.session_private (session_id, summary) VALUES (sid, 'Ghi chú test cho ca đi tiếp xúc.');

    IF a = 1 THEN ms1_member := mem[1]; END IF;
    IF a = 2 THEN ms2_member := mem[1]; ms2_listener := firsts[2]; END IF;
  END LOOP;

  -- Cross-area: ae An MS2 plans with their listener, ae An MS1 goes along. Shows in MS 1 and MS 2.
  INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state)
  SELECT area_id, rid, ms2_member, 'visit', today + interval '3 days 19 hours', 'Quán cafe chung MS1-MS2', 'planned'
  FROM users WHERE id = ms2_member
  RETURNING id INTO sid;
  INSERT INTO session_members (session_id, user_id) VALUES (sid, ms2_member), (sid, ms1_member);
  INSERT INTO session_listeners (session_id, listener_id) VALUES (sid, ms2_listener);
  INSERT INTO private.session_private (session_id) VALUES (sid);

  -- The region leader's outreach: no area, so it shows in every area.
  INSERT INTO sessions (area_id, region_id, created_by, kind, starts_at, location_label, state)
  VALUES (NULL, rid, rl, 'outreach', today + interval '4 days 8 hours', 'Đi tiếp xúc cả địa vực', 'planned')
  RETURNING id INTO sid;
  INSERT INTO session_members (session_id, user_id) VALUES (sid, rl);
  INSERT INTO private.session_private (session_id) VALUES (sid);
END $$;

COMMIT;

-- Xoá riêng dữ liệu test này (nếu không xoá cả database): bỏ comment và chạy.
-- BEGIN;
-- CREATE TEMP TABLE t_users AS SELECT id FROM users WHERE region_id = (SELECT id FROM regions WHERE name = 'Địa vực Giô-suê');
-- CREATE TEMP TABLE t_sessions AS SELECT id FROM sessions WHERE region_id = (SELECT id FROM regions WHERE name = 'Địa vực Giô-suê');
-- CREATE TEMP TABLE t_listeners AS SELECT id FROM listeners WHERE region_id = (SELECT id FROM regions WHERE name = 'Địa vực Giô-suê');
-- DELETE FROM pii_access_log WHERE viewer_id IN (SELECT id FROM t_users) OR target_user_id IN (SELECT id FROM t_users)
--   OR listener_id IN (SELECT id FROM t_listeners) OR session_id IN (SELECT id FROM t_sessions);
-- DELETE FROM private.session_private WHERE session_id IN (SELECT id FROM t_sessions);
-- DELETE FROM session_members WHERE session_id IN (SELECT id FROM t_sessions);
-- DELETE FROM session_listeners WHERE session_id IN (SELECT id FROM t_sessions);
-- DELETE FROM sessions WHERE id IN (SELECT id FROM t_sessions);
-- DELETE FROM private.listener_notes WHERE listener_id IN (SELECT id FROM t_listeners);
-- DELETE FROM private.listener_private WHERE listener_id IN (SELECT id FROM t_listeners);
-- DELETE FROM listener_links WHERE listener_id IN (SELECT id FROM t_listeners);
-- DELETE FROM listeners WHERE id IN (SELECT id FROM t_listeners);
-- DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM t_users);
-- DELETE FROM login_attempts WHERE phone IN (SELECT phone FROM users WHERE id IN (SELECT id FROM t_users));
-- DELETE FROM users WHERE id IN (SELECT id FROM t_users);
-- DELETE FROM areas WHERE region_id = (SELECT id FROM regions WHERE name = 'Địa vực Giô-suê');
-- DELETE FROM regions WHERE name = 'Địa vực Giô-suê';
-- COMMIT;
