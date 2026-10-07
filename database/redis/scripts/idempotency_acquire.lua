-- Prise de cle d'idempotence. KEYS[1]=cle ; ARGV[1]=request_hash ; ARGV[2]=ttl_s
-- Valeur stockee : "P:<hash>" (en cours) ou "D:<hash>:<reponse_json>" (termine).
-- Retour : {"acquired"} | {"in_progress"} | {"mismatch"} | {"done", reponse_json}
local v = redis.call('GET', KEYS[1])
if not v then
  redis.call('SET', KEYS[1], 'P:' .. ARGV[1], 'EX', tonumber(ARGV[2]))
  return {'acquired'}
end
local state = string.sub(v, 1, 1)
local rest = string.sub(v, 3)
local hash, body
if state == 'D' then
  local sep = string.find(rest, ':', 1, true)
  hash = string.sub(rest, 1, sep - 1)
  body = string.sub(rest, sep + 1)
else
  hash = rest
end
if hash ~= ARGV[1] then return {'mismatch'} end
if state == 'P' then return {'in_progress'} end
return {'done', body}
