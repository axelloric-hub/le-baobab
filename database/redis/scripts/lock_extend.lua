-- Prolonge le TTL d'un verrou si proprietaire. KEYS[1]=cle ; ARGV[1]=token ; ARGV[2]=ttl_ms
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
