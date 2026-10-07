from django.contrib import admin

from apps.assessments.models import (
    Assignment, AssignmentGroup, AssignmentSubmission, Feedback, Grade, Question, Quiz, QuizAttempt, RubricCriterion,
)
from apps.core.admin_utils import register_readable


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0
    fields = ("position", "kind", "prompt", "points")
    show_change_link = True


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "pass_percent", "max_attempts", "is_published")
    list_filter = ("is_published",)
    search_fields = ("title", "course__title")
    raw_id_fields = ("course", "chapter")
    inlines = [QuestionInline]


register_readable(Question, search=("prompt",), filters=("kind",))
register_readable(QuizAttempt, search=("user__username", "quiz__title"), filters=("status", "passed"), readonly=("score", "max_score"))
register_readable(Assignment, search=("title",), filters=("is_group", "is_published"))
register_readable(RubricCriterion, search=("label",))
register_readable(AssignmentGroup, search=("name",))
register_readable(AssignmentSubmission, search=("user__username",), filters=("status", "is_late"))
register_readable(Grade, search=("submission__user__username",), allow_delete=False)
register_readable(Feedback, search=("body",))
