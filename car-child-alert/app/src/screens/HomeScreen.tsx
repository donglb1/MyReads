import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Subtle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useStore } from '@/state/store';

export default function HomeScreen() {
  const { data, activeTrip, startTrip, endTripManually, simulateTripEnd } = useStore();

  const riding = !!activeTrip && !activeTrip.endedAt;
  const child = data.children[0];
  const contactCount = data.contacts.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.h1}>AnToànBé</Text>

        <Card style={{ backgroundColor: riding ? colors.primaryDark : colors.surface }}>
          <View style={styles.statusRow}>
            <View
              style={[styles.dot, { backgroundColor: riding ? colors.primary : colors.textDim }]}
            />
            <Title>{riding ? 'Đang chở bé' : 'Đang ở nhà / xe trống'}</Title>
          </View>
          <Subtle>
            {riding
              ? `Chuyến bắt đầu lúc ${new Date(activeTrip!.startedAt).toLocaleTimeString('vi-VN')}. Khi xuống xe, hãy xác nhận đã đưa bé ra.`
              : 'Chưa có chuyến nào đang diễn ra.'}
          </Subtle>
        </Card>

        {!riding ? (
          <Button label="🚗 Bắt đầu chở bé" onPress={startTrip} />
        ) : (
          <>
            <Button label="✅ Kết thúc chuyến (xuống xe)" onPress={endTripManually} />
            <Button
              label="🧪 Mô phỏng: quên bé trên xe"
              variant="danger"
              onPress={simulateTripEnd}
            />
          </>
        )}

        <Card style={{ marginTop: spacing.lg }}>
          <Title>Sẵn sàng bảo vệ?</Title>
          <Subtle>
            {child ? `• Bé: ${child.name}` : '• Chưa có hồ sơ bé — thêm ở tab Cài đặt.'}
            {'\n'}
            {contactCount > 0
              ? `• ${contactCount} liên hệ khẩn cấp`
              : '• Chưa có liên hệ khẩn cấp — thêm ở tab Liên hệ (rất quan trọng!).'}
          </Subtle>
        </Card>

        <Text style={styles.tip}>
          Mẹo test: bấm “Bắt đầu chở bé”, rồi “Mô phỏng: quên bé trên xe” để xem luồng cảnh báo
          leo thang.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  tip: { color: colors.textDim, fontSize: 12, marginTop: spacing.lg, fontStyle: 'italic' },
});
