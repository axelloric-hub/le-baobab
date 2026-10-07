-- Compteur plafonne avec TTL fixe a la creation (frequency capping publicitaire, cooldowns).
-- KEYS[1]=cle ; ARGV[1]=plafond ; ARGV[2]=ttl_s
-- Retour : {1,nouvelle_valeur} si incremente, {0,valeur} si plafond atteint
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur >= tonumber(ARGV[1]) then return {0, cur} end
cur = redis.call('INCR', KEYS[1])
if cur == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end
return {1, cur}
