"""Traduit des evenements de domaine en notifications. Idempotents grace a `dedupe_key`."""
from apps.accounts.models import User
from apps.core.outbox import subscribe
from apps.notifications.services import notify


@subscribe("FriendRequestSent")
def friend_request(ev):
    to, frm = User.objects.get(pk=ev.payload["to"]), User.objects.get(pk=ev.payload["from"])
    notify(recipient=to, type_code="friend_request", actor=frm, target_type="friendship", target_id=ev.aggregate_id,
           data={"from": frm.username}, dedupe_key=f"fr:{ev.aggregate_id}:{ev.event_id}")


@subscribe("CommentCreated")
def comment_created(ev):
    p = ev.payload
    author, post_author = User.objects.get(pk=p["author"]), User.objects.get(pk=p["post_author"])
    notify(recipient=post_author, type_code="comment", actor=author, target_type="post", target_id=p["post"],
           data={"from": author.username, "post": p["post"]}, dedupe_key=f"cm:{ev.aggregate_id}")


@subscribe("PostLiked")
def post_liked(ev):
    from apps.social.models import Post

    liker = User.objects.get(pk=ev.payload["user"])
    owner_id = Post.objects.filter(pk=ev.aggregate_id).values_list("author_id", flat=True).first()
    if owner_id:
        notify(recipient=User.objects.get(pk=owner_id), type_code="post_reaction", actor=liker, target_type="post", target_id=ev.aggregate_id,
               data={"from": liker.username}, dedupe_key=f"pr:{ev.aggregate_id}:{liker.pk}")


@subscribe("MessageSent")
def message_mentions(ev):
    sender = User.objects.get(pk=ev.payload["sender"])
    for uid in ev.payload.get("mentions", []):
        notify(recipient=User.objects.get(pk=uid), type_code="mention", actor=sender, target_type="message", target_id=ev.aggregate_id,
               data={"from": sender.username, "conversation": ev.payload["conversation"]}, dedupe_key=f"mn:{ev.aggregate_id}:{uid}")


# ------------------------------------------------------------------ education
@subscribe("SubmissionGraded")
def submission_graded(ev):
    grader = User.objects.get(pk=ev.payload["grader"])
    for sid in ev.payload["students"]:
        notify(recipient=User.objects.get(pk=sid), type_code="assignment_graded", actor=grader, target_type="submission", target_id=ev.aggregate_id,
               data={"points": ev.payload["points"], "assignment": ev.payload["assignment"]}, dedupe_key=f"sg:{ev.event_id}:{sid}")


@subscribe("CertificateIssued")
def certificate_issued(ev):
    notify(recipient=User.objects.get(pk=ev.payload["user"]), type_code="certificate_issued", target_type="certificate", target_id=ev.aggregate_id,
           data={"course": ev.payload["course"]}, dedupe_key=f"ci:{ev.aggregate_id}")


@subscribe("CourseEnrolled")
def course_enrolled(ev):
    student = User.objects.get(pk=ev.payload["user"])
    for iid in ev.payload.get("instructors", []):
        notify(recipient=User.objects.get(pk=iid), type_code="course_enrollment", actor=student, target_type="course", target_id=ev.payload["course"],
               data={"student": student.username}, dedupe_key=f"ce:{ev.event_id}:{iid}")


@subscribe("ClassroomInvitationSent")
def classroom_invitation(ev):
    notify(recipient=User.objects.get(pk=ev.payload["to"]), type_code="classroom_invitation", actor=User.objects.get(pk=ev.payload["by"]),
           target_type="classroom", target_id=ev.payload["classroom"], dedupe_key=f"cinv:{ev.aggregate_id}")
