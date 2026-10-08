from django.contrib import admin

from apps.core.admin_utils import register_readable
from apps.jobs.models import (
    ApplicationStatusEvent, Contract, FreelancerProfile, Interview, InterviewSlot, Job, JobApplication, JobCategory, JobSkill, Milestone, Offer, Proposal,
)


class JobSkillInline(admin.TabularInline):
    model = JobSkill
    extra = 0
    raw_id_fields = ("skill",)


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "job_type", "status", "published_at", "deadline")
    list_filter = ("status", "job_type", "contract_type", "remote_policy")
    search_fields = ("title", "company__name")
    raw_id_fields = ("company", "posted_by", "category", "country")
    inlines = [JobSkillInline]
    ordering = ("-created_at",)


register_readable(JobCategory, search=("name",))
register_readable(JobApplication, search=("applicant__username", "job__title"), filters=("status",))
register_readable(ApplicationStatusEvent, filters=("to_status",), allow_add=False, allow_delete=False)
register_readable(InterviewSlot, filters=())
register_readable(Interview, filters=("status", "mode"))
register_readable(Offer, filters=("status",), allow_delete=False)
register_readable(FreelancerProfile, search=("user__username", "headline"))
register_readable(Proposal, search=("freelancer__username", "job__title"), filters=("status",))
register_readable(Contract, search=("client__username", "contractor__username"), filters=("kind", "status"), allow_delete=False)
register_readable(Milestone, filters=("status",))
