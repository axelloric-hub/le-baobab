from django.contrib import admin

from apps.profiles.models import (
    Country, Interest, PrivacySettings, Profession, Profile, Skill, SocialLink, UserInterest, UserPreferences, UserSkill,
)


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "region", "is_african")
    list_filter = ("is_african", "region")
    search_fields = ("code", "name")


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "kind", "is_technology", "is_active")
    list_filter = ("kind", "is_technology", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("name",)


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Profession)
class ProfessionAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


class UserSkillInline(admin.TabularInline):
    model = UserSkill
    extra = 0
    autocomplete_fields = ("skill",)


class SocialLinkInline(admin.TabularInline):
    model = SocialLink
    extra = 0


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "country", "availability", "is_verified", "updated_at")
    list_filter = ("is_verified", "availability", "country")
    search_fields = ("display_name", "user__username", "user__email")
    autocomplete_fields = ("user", "profession")
    raw_id_fields = ("country",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    fieldsets = (
        ("Identite", {"fields": ("user", "display_name", "headline", "bio", "avatar_key", "cover_key")}),
        ("Localisation", {"fields": ("country", "region", "city", "languages")}),
        ("Professionnel", {"fields": ("profession", "availability")}),
        ("Verification", {"fields": ("is_verified", "verified_at")}),
        ("Dates", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(UserSkill)
class UserSkillAdmin(admin.ModelAdmin):
    list_display = ("user", "skill", "level", "years_experience")
    list_filter = ("level",)
    autocomplete_fields = ("user", "skill")
    search_fields = ("user__username", "skill__name")


@admin.register(UserInterest)
class UserInterestAdmin(admin.ModelAdmin):
    list_display = ("user", "interest")
    autocomplete_fields = ("user", "interest")


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "url", "is_verified")
    list_filter = ("provider", "is_verified")
    search_fields = ("user__username", "url", "handle")
    autocomplete_fields = ("user",)


@admin.register(PrivacySettings)
class PrivacySettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "profile_visibility", "who_can_message", "searchable", "updated_at")
    list_filter = ("profile_visibility", "who_can_message", "searchable")
    search_fields = ("user__username",)
    autocomplete_fields = ("user",)


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ("user", "language", "time_zone", "theme")
    search_fields = ("user__username",)
    autocomplete_fields = ("user",)
