CREATE TABLE chat_room_unreads (
  room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid,
  unread_count integer NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  PRIMARY KEY (room_id, user_id)
);

CREATE OR REPLACE FUNCTION increment_unread_on_message()
RETURNS trigger AS $$
BEGIN
  -- 给房间内除了 sender 的所有人 +1
  UPDATE chat_room_unreads
  SET unread_count = unread_count + 1
  WHERE room_id = NEW.room_id
    AND user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_unread
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_on_message();



CREATE OR REPLACE FUNCTION init_chat_room_unreads()
RETURNS trigger AS $$
BEGIN
  -- 为每一个 member 初始化 unread 记录
  INSERT INTO chat_room_unreads (room_id, user_id, unread_count)
  SELECT
    NEW.id,
    unnest(NEW.members),
    0
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_init_chat_room_unreads ON chat_rooms;

CREATE TRIGGER trigger_init_chat_room_unreads
AFTER INSERT ON chat_rooms
FOR EACH ROW
EXECUTE FUNCTION init_chat_room_unreads();
