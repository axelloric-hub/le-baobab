from apps.core.admin_utils import register_readable
from apps.portfolio.models import Achievement, CertificateEntry, Education, Experience, Portfolio, Project, ProjectLink, ProjectMedia, Repository

register_readable(Portfolio, search=("user__username",), filters=("visibility",))
register_readable(Project, search=("title", "slug"))
register_readable(ProjectMedia)
register_readable(ProjectLink, search=("url",), filters=("kind",))
register_readable(Repository, search=("full_name",), filters=("provider",))
register_readable(Experience, search=("company_name", "title"))
register_readable(Education, search=("institution",))
register_readable(Achievement, search=("title",))
register_readable(CertificateEntry, search=("name",))
