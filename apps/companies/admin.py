from django.contrib import admin

from apps.companies.models import Company, CompanyMember, CompanyProductRef, CompanyProject, CompanyService, CompanySocialLink, CompanyVerification
from apps.core.admin_utils import register_readable


class MemberInline(admin.TabularInline):
    model = CompanyMember
    extra = 0
    raw_id_fields = ("user",)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "industry", "size_range", "created_at")
    list_filter = ("status", "size_range")
    search_fields = ("name", "slug")
    raw_id_fields = ("country",)
    inlines = [MemberInline]
    ordering = ("-created_at",)


register_readable(CompanyVerification, search=("company__name",), filters=("status", "method"))
register_readable(CompanySocialLink, search=("url",))
register_readable(CompanyProject, search=("title",))
register_readable(CompanyService, search=("title",))
register_readable(CompanyProductRef)
