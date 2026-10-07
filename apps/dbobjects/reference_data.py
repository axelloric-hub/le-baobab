"""Donnees de REFERENCE (necessaires au fonctionnement, distinctes des donnees de demo). Idempotent."""
AFRICAN_COUNTRIES = {
    "Afrique du Nord": {"DZ": "Algerie", "EG": "Egypte", "LY": "Libye", "MA": "Maroc", "SD": "Soudan", "TN": "Tunisie"},
    "Afrique de l'Ouest": {"BJ": "Benin", "BF": "Burkina Faso", "CV": "Cap-Vert", "CI": "Cote d'Ivoire", "GM": "Gambie", "GH": "Ghana",
                           "GN": "Guinee", "GW": "Guinee-Bissau", "LR": "Liberia", "ML": "Mali", "MR": "Mauritanie", "NE": "Niger",
                           "NG": "Nigeria", "SN": "Senegal", "SL": "Sierra Leone", "TG": "Togo"},
    "Afrique centrale": {"AO": "Angola", "CM": "Cameroun", "CF": "Centrafrique", "TD": "Tchad", "CG": "Congo", "CD": "RD Congo",
                         "GQ": "Guinee equatoriale", "GA": "Gabon", "ST": "Sao Tome-et-Principe"},
    "Afrique de l'Est": {"BI": "Burundi", "KM": "Comores", "DJ": "Djibouti", "ER": "Erythree", "ET": "Ethiopie", "KE": "Kenya",
                         "MG": "Madagascar", "MW": "Malawi", "MU": "Maurice", "MZ": "Mozambique", "RW": "Rwanda", "SC": "Seychelles",
                         "SO": "Somalie", "SS": "Soudan du Sud", "TZ": "Tanzanie", "UG": "Ouganda", "ZM": "Zambie", "ZW": "Zimbabwe"},
    "Afrique australe": {"BW": "Botswana", "SZ": "Eswatini", "LS": "Lesotho", "NA": "Namibie", "ZA": "Afrique du Sud"},
}
OTHER_COUNTRIES = {"FR": "France", "BE": "Belgique", "CA": "Canada", "CH": "Suisse", "GB": "Royaume-Uni", "US": "Etats-Unis", "DE": "Allemagne"}

NOTIFICATION_TYPES = [
    # code, categorie, canaux par defaut, critique
    ("friend_request", "social", ["in_app", "websocket", "push"], False),
    ("friend_accepted", "social", ["in_app", "websocket"], False),
    ("comment", "social", ["in_app", "websocket", "push"], False),
    ("post_reaction", "social", ["in_app", "websocket"], False),
    ("mention", "social", ["in_app", "websocket", "push"], False),
    ("message", "messaging", ["websocket", "push"], False),
    ("group_invitation", "social", ["in_app", "websocket", "push"], False),
    ("group_join_approved", "social", ["in_app", "websocket"], False),
    ("moderation_notice", "system", ["in_app", "email"], True),
    ("security_alert", "system", ["in_app", "email", "push"], True),
    ("classroom_invitation", "learning", ["in_app", "websocket", "push"], False),
    ("course_enrollment", "learning", ["in_app", "websocket"], False),
    ("assignment_graded", "learning", ["in_app", "websocket", "push"], False),
    ("certificate_issued", "learning", ["in_app", "websocket", "email"], False),
]

EVENT_TYPES = [
    # code, domaine, acteur requis, pii, retention (jours)
    ("user_registered", "accounts", True, False, 730), ("post_created", "social", True, False, 400), ("post_viewed", "social", False, False, 90),
    ("post_liked", "social", True, False, 400), ("message_sent", "messaging", True, False, 90), ("friendship_created", "social", False, False, 400),
    ("course_started", "education", True, False, 730), ("lesson_completed", "education", True, False, 730), ("job_applied", "jobs", True, False, 730),
    ("product_viewed", "marketplace", False, False, 90), ("purchase_completed", "marketplace", True, False, 2555),
    ("ad_impression", "advertising", False, False, 60), ("ad_click", "advertising", False, False, 400),
]

REPORT_REASONS = [("spam", "Spam", 1), ("harassment", "Harcelement", 3), ("hate", "Discours haineux", 4), ("violence", "Violence", 4),
                  ("nudity", "Contenu sexuel", 3), ("scam", "Arnaque / fraude", 3), ("copyright", "Violation de droits d'auteur", 2),
                  ("child_safety", "Securite des mineurs", 5), ("misinformation", "Desinformation", 2), ("other", "Autre", 1)]

PROVIDERS = [("github", "GitHub", True, False, 24), ("gitlab", "GitLab", True, False, 24), ("linkedin", "LinkedIn", True, True, 24),
             ("tiktok", "TikTok", True, True, 24), ("youtube", "YouTube", True, True, 24)]

SKILLS = [
    ("python", "Python", "language"), ("javascript", "JavaScript", "language"), ("typescript", "TypeScript", "language"), ("java", "Java", "language"),
    ("kotlin", "Kotlin", "language"), ("php", "PHP", "language"), ("go", "Go", "language"), ("rust", "Rust", "language"), ("csharp", "C#", "language"),
    ("django", "Django", "framework"), ("react", "React", "framework"), ("nextjs", "Next.js", "framework"), ("nodejs", "Node.js", "framework"),
    ("laravel", "Laravel", "framework"), ("flutter", "Flutter", "framework"), ("postgresql", "PostgreSQL", "tool"), ("mongodb", "MongoDB", "tool"),
    ("redis", "Redis", "tool"), ("docker", "Docker", "tool"), ("kubernetes", "Kubernetes", "tool"), ("git", "Git", "tool"),
    ("machine-learning", "Machine Learning", "domain"), ("devops", "DevOps", "domain"), ("cybersecurity", "Cybersecurite", "domain"),
    ("data-engineering", "Data Engineering", "domain"), ("mobile", "Developpement mobile", "domain"), ("ui-ux", "UI/UX Design", "domain"),
]
INTERESTS = ["Open source", "Intelligence artificielle", "Fintech", "Mobile money", "Agritech", "Edtech", "Healthtech", "Cloud", "Web3", "Jeux video", "Freelance", "Entrepreneuriat"]
PROFESSIONS = ["Developpeur backend", "Developpeur frontend", "Developpeur fullstack", "Developpeur mobile", "Ingenieur DevOps", "Data scientist", "Data engineer",
               "Designer UI/UX", "Chef de projet", "Etudiant", "Enseignant", "CTO / Fondateur"]
