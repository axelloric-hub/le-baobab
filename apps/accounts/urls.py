from apps.accounts import api
from apps.core.api import route

urlpatterns = [
    route("auth/register/", POST=api.register),
    route("auth/verify-email/", POST=api.verify_email),
    route("auth/resend-otp/", POST=api.resend_otp),
    route("auth/login/", POST=api.login),
    route("auth/token/refresh/", POST=api.refresh),
    route("auth/logout/", POST=api.logout),
    route("auth/password/forgot/", POST=api.forgot_password),
    route("auth/password/reset/", POST=api.reset_password),
    route("me/password/", POST=api.change_password),
    route("me/login-history/", GET=api.login_history),
    route("me/devices/", GET=api.devices),
]
