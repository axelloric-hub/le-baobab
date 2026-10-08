from rest_framework import serializers

from apps.payments.models import Payment, Refund


class StartPaymentSerializer(serializers.Serializer):
    order = serializers.UUIDField()
    provider = serializers.ChoiceField(choices=Payment.Provider.choices)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "order", "provider", "amount_minor", "currency", "status", "created_at")
        read_only_fields = fields


class RefundRequestSerializer(serializers.Serializer):
    order_item = serializers.UUIDField()
    reason = serializers.CharField(max_length=500)
    amount_minor = serializers.IntegerField(min_value=1, required=False)


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = ("id", "order_item", "amount_minor", "reason", "status", "created_at", "decided_at")
        read_only_fields = fields
