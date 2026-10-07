from rest_framework import serializers

from apps.assessments.models import Assignment, AssignmentSubmission, Choice, Grade, Question, Quiz, QuizAttempt


class ChoicePublicSerializer(serializers.ModelSerializer):
    """JAMAIS is_correct ni correct_order : ils permettraient de lire la correction dans la reponse API."""

    class Meta:
        model = Choice
        fields = ("id", "position", "label")
        read_only_fields = fields


class QuestionPublicSerializer(serializers.ModelSerializer):
    choices = ChoicePublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ("id", "position", "kind", "prompt", "points", "choices")  # ni answer_key ni explanation
        read_only_fields = fields


class QuizPublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = ("id", "title", "pass_percent", "max_attempts", "time_limit_seconds", "questions")
        read_only_fields = fields


class AnswerInputSerializer(serializers.Serializer):
    selected = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=50)
    text = serializers.CharField(required=False, allow_blank=True, max_length=20000)


class AttemptSubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=AnswerInputSerializer())


class QuizAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = ("id", "quiz", "attempt_no", "status", "started_at", "submitted_at", "score", "max_score", "passed")
        read_only_fields = fields


class AssignmentSerializer(serializers.ModelSerializer):
    criteria = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ("id", "course", "title", "instructions", "max_points", "due_at", "allow_late", "max_attempts", "is_group", "criteria")
        read_only_fields = fields

    def get_criteria(self, obj):
        return [{"id": str(c.pk), "label": c.label, "max_points": c.max_points} for c in obj.criteria.all()]


class SubmissionCreateSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, max_length=50000, default="")
    attachments = serializers.ListField(child=serializers.DictField(), required=False, max_length=10)


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ("points", "feedback", "graded_at")
        read_only_fields = fields


class SubmissionSerializer(serializers.ModelSerializer):
    grade = GradeSerializer(read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = ("id", "assignment", "attempt_no", "status", "text", "attachments", "is_late", "submitted_at", "grade")
        read_only_fields = fields


class GradeInputSerializer(serializers.Serializer):
    points = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    criteria = serializers.ListField(child=serializers.DictField(), required=False)
    feedback = serializers.CharField(required=False, allow_blank=True, default="")
