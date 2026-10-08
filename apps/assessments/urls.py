from apps.assessments import api
from apps.core.api import route

urlpatterns = [
    route("courses/<uuid:course_id>/quizzes/", POST=api.create_quiz),
    route("quizzes/<uuid:quiz_id>/", GET=api.get_quiz),
    route("quizzes/<uuid:quiz_id>/questions/", POST=api.add_question),
    route("quizzes/<uuid:quiz_id>/publish/", POST=api.publish_quiz),
    route("quizzes/<uuid:quiz_id>/attempts/", GET=api.my_attempts, POST=api.start_attempt),
    route("attempts/<uuid:attempt_id>/submit/", POST=api.submit_attempt),
    route("attempts/<uuid:attempt_id>/grade-code/", POST=api.grade_code),
    route("courses/<uuid:course_id>/assignments/", GET=api.list_assignments, POST=api.create_assignment),
    route("assignments/<uuid:assignment_id>/", GET=api.get_assignment),
    route("assignments/<uuid:assignment_id>/groups/", POST=api.create_group),
    route("assignments/<uuid:assignment_id>/submissions/", GET=api.list_submissions, POST=api.submit),
    route("submissions/<uuid:submission_id>/", GET=api.get_submission),
    route("submissions/<uuid:submission_id>/grade/", POST=api.grade),
    route("submissions/<uuid:submission_id>/feedback/", POST=api.feedback),
]
