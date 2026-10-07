from django.contrib import admin

from apps.core.admin_utils import register_readable
from apps.education.models import (
    Chapter, Classroom, ClassroomInvitation, ClassroomMember, ContentBlock, Course, CourseInstructor, Enrollment, Entitlement, Module,
)


class InstructorInline(admin.TabularInline):
    model = CourseInstructor
    extra = 0
    raw_id_fields = ("user",)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "classroom", "status", "is_free", "price_minor", "currency", "published_at")
    list_filter = ("status", "is_free", "level", "language")
    search_fields = ("title", "slug", "classroom__title")
    raw_id_fields = ("classroom",)
    filter_horizontal = ("skills",)
    inlines = [InstructorInline]
    ordering = ("-created_at",)


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("title", "privacy", "is_paid", "owner", "archived_at", "created_at")
    list_filter = ("privacy", "is_paid")
    search_fields = ("title", "slug")
    raw_id_fields = ("owner", "group")
    ordering = ("-created_at",)


@admin.register(Entitlement)
class EntitlementAdmin(admin.ModelAdmin):
    """Droits d'acces issus de paiements : jamais supprimes (historique financier) ; revocation par `revoked_at`."""

    list_display = ("user", "scope", "source", "source_ref", "granted_at", "expires_at", "revoked_at")
    list_filter = ("scope", "source")
    search_fields = ("user__username", "source_ref", "grant_key")
    raw_id_fields = ("user", "classroom", "course", "module", "chapter")
    ordering = ("-granted_at",)

    def has_delete_permission(self, request, obj=None):
        return False


register_readable(ClassroomMember, search=("user__username", "classroom__title"), filters=("role", "status"))
register_readable(ClassroomInvitation, search=("invited_user__username",), filters=("status",))
register_readable(Module, search=("title",), filters=("is_free", "is_published"))
register_readable(Chapter, search=("title",), filters=("is_free", "is_published"))
register_readable(ContentBlock, search=("title",), filters=("kind",))
register_readable(Enrollment, search=("user__username", "course__title"), filters=("status",))
