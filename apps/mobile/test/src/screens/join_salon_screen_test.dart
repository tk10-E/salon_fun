import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/join_salon_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedJoinTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedJoinTestClient;

  group('JoinSalonScreen', () {
    testWidgets(
      'shows the unlocked value of joining and submits with the recognized salon preview',
      (tester) async {
        final repository = _FakeJoinSalonRepository(
          preview: const SalonJoinPreview(
            salonId: 'salon-1',
            name: 'Salon Fun',
            tagline: 'Beleza com cuidado',
            brandColor: '#C56B43',
            whatsappPhone: '5511999999999',
          ),
        );
        var joinedCount = 0;

        await tester.binding.setSurfaceSize(const Size(1200, 2000));
        addTearDown(() => tester.binding.setSurfaceSize(null));
        await tester.pumpWidget(
          MaterialApp(
            home: JoinSalonScreen(
              repository: repository,
              onJoined: () async {
                joinedCount += 1;
              },
            ),
          ),
        );
        await tester.pump();

        await tester.enterText(find.byType(TextField).at(0), 'Talita');
        await tester.enterText(find.byType(TextField).at(1), 'a1b2c3');
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pump(const Duration(milliseconds: 100));

        expect(
          find.text('O que libera depois da conexão com Salon Fun'),
          findsOneWidget,
        );
        expect(
          find.text('Último passo para entrar em Salon Fun.'),
          findsOneWidget,
        );
        expect(
          find.text('Agenda, serviços e identidade de Salon Fun no app.'),
          findsOneWidget,
        );
        expect(find.text('Falar com o salão'), findsOneWidget);
        expect(find.textContaining('agenda liberada'), findsOneWidget);
        expect(
          find.textContaining('benefícios prontos para aparecer'),
          findsOneWidget,
        );

        await tester.tap(find.text('Conectar Salon Fun e continuar'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.joinRequests, hasLength(1));
        expect(repository.joinRequests.single.code, 'a1b2c3');
        expect(repository.joinRequests.single.customerName, 'Talita');
        expect(joinedCount, 1);
        expect(
          find.textContaining(
            'Agenda, benefícios e contato já aparecem daqui para frente.',
          ),
          findsOneWidget,
        );
      },
    );
  });
}

class _FakeJoinSalonRepository extends SalonRepository {
  _FakeJoinSalonRepository({this.preview}) : super(_sharedJoinTestClient);

  final SalonJoinPreview? preview;
  final List<_JoinRequest> joinRequests = [];

  @override
  Future<SalonJoinPreview?> getSalonJoinPreview(String joinCode) async =>
      preview;

  @override
  Future<void> joinSalon({
    required String code,
    required String customerName,
    String? referralCode,
  }) async {
    joinRequests.add(
      _JoinRequest(
        code: code,
        customerName: customerName,
        referralCode: referralCode,
      ),
    );
  }
}

class _JoinRequest {
  const _JoinRequest({
    required this.code,
    required this.customerName,
    required this.referralCode,
  });

  final String code;
  final String customerName;
  final String? referralCode;
}
