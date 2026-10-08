from django.test import SimpleTestCase

from apps.advertising.targeting import Rule, UserContext, evaluate, rule_matches


def ctx(personalized=True, **values):
    return UserContext(user_id="u", personalized=personalized, values={k: frozenset(v) for k, v in values.items()})


class TargetingLogicTests(SimpleTestCase):
    def test_in_is_OR_all_is_AND_not_in_is_NOT(self):
        c = ctx(skill=["python"])
        self.assertTrue(rule_matches(Rule("skill", "in", ("python", "django", "ml")), c))     # Python OU Django OU ML
        self.assertFalse(rule_matches(Rule("skill", "in", ("java", "go")), c))
        self.assertFalse(rule_matches(Rule("skill", "all", ("python", "django")), c))         # il faut les DEUX
        self.assertTrue(rule_matches(Rule("skill", "all", ("python",)), c))
        self.assertTrue(rule_matches(Rule("skill", "not_in", ("java",)), c))
        self.assertFalse(rule_matches(Rule("skill", "not_in", ("python",)), c))

    def test_the_specification_example_javascript_and_cameroon_and_freelance(self):
        rules = [Rule("skill", "in", ("javascript",)), Rule("country", "in", ("cm",)), Rule("availability", "in", ("freelance",))]
        self.assertEqual(evaluate(rules, ctx(skill=["javascript"], country=["cm"], availability=["freelance"])), (True, 0))
        self.assertFalse(evaluate(rules, ctx(skill=["javascript"], country=["cm"], availability=["none"]))[0])  # un seul critere manque : exclu

    def test_matching_is_case_insensitive_and_unknown_or_empty_rules_never_match(self):
        self.assertTrue(rule_matches(Rule("country", "in", ("CM",)), ctx(country=["cm"])))
        self.assertFalse(rule_matches(Rule("religion", "in", ("x",)), ctx(religion=["x"])))   # critere hors liste blanche : echec FERME
        self.assertFalse(rule_matches(Rule("skill", "in", ()), ctx(skill=["python"])))
        self.assertFalse(rule_matches(Rule("skill", "not_in", ()), ctx(skill=["python"])))

    def test_soft_rules_boost_but_never_exclude(self):
        rules = [Rule("skill", "in", ("django",), required=True), Rule("country", "in", ("cm",), required=False, weight=4), Rule("language", "in", ("fr",), required=False, weight=2)]
        self.assertEqual(evaluate(rules, ctx(skill=["django"], country=["cm"], language=["fr"])), (True, 6))
        self.assertEqual(evaluate(rules, ctx(skill=["django"], country=["sn"])), (True, 0))   # criteres souples non remplis : toujours eligible
        self.assertEqual(evaluate(rules, ctx(skill=["rust"])), (False, 0))

    def test_no_rules_means_everyone_and_personalization_opt_out_blocks_targeted_ads_only(self):
        self.assertEqual(evaluate([], ctx()), (True, 0))
        self.assertEqual(evaluate([], ctx(personalized=False)), (True, 0))                      # annonce generique : montree meme a qui refuse la personnalisation
        self.assertFalse(evaluate([Rule("skill", "in", ("django",))], ctx(personalized=False, skill=["django"]))[0])
