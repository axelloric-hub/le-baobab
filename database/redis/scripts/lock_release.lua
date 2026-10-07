-- Liberation d'un verrou distribue SEULEMENT si on en est proprietaire (compare-and-delete).
-- KEYS[1]=cle verrou ; ARGV[1]=token proprietaire
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
