"""Cree (ou repare) l'administrateur initial depuis l'environnement : ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME (facultatif).
Indispensable sur un hebergeur sans console (Render gratuit). Idempotent. Le mot de passe n'est defini QU'A LA CREATION : relancer ne l'ecrase jamais."""
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import register_user


class Command(BaseCommand):
    help = "Cree l'administrateur initial depuis ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME (ignore si ADMIN_EMAIL est vide)."

    def handle(self, *args, **options):
        email, password = os.environ.get("ADMIN_EMAIL", "").strip().lower(), os.environ.get("ADMIN_PASSWORD", "")
        username = (os.environ.get("ADMIN_USERNAME", "") or "admin").strip().lower()
        if not email:
            self.stdout.write("ensure_admin : ADMIN_EMAIL vide, rien a faire.")
            return
        user = User.objects.filter(email=email).first()
        created = user is None
        if created:
            if not password:
                raise CommandError("ADMIN_PASSWORD est obligatoire pour creer l'administrateur.")
            try:
                validate_password(password)
            except ValidationError as exc:
                raise CommandError("Mot de passe administrateur trop faible : " + " ".join(exc.messages)) from exc
            user = register_user(email=email, username=username, password=password, display_name="Administrateur")
        user.is_staff, user.is_superuser, user.status = True, True, "active"
        user.email_verified_at = user.email_verified_at or timezone.now()
        user.save(update_fields=["is_staff", "is_superuser", "status", "email_verified_at"])
        self.stdout.write(self.style.SUCCESS(f"ensure_admin : {'cree' if created else 'deja present, droits verifies'} ({email})"))
