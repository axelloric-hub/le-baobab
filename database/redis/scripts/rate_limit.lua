-- Fenetre glissante (sorted set). Atomique : purge, compte, ajoute.
-- KEYS[1]=cle ; ARGV[1]=now_ms ; ARGV[2]=fenetre_ms ; ARGV[3]=limite ; ARGV[4]=member unique
-- Retour : {autorise(1/0), restant, retry_after_ms}
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then retry = math.max(0, tonumber(oldest[2]) + window - now) end
  return {0, 0, retry}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {1, limit - count - 1, 0}
