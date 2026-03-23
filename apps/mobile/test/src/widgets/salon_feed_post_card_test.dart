import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/theme/salon_branding.dart';
import 'package:salon_client/src/widgets/salon_feed_post_card.dart';

void main() {
  group('SalonFeedPostCard', () {
    testWidgets('updates the gallery counter as the user swipes images', (
      tester,
    ) async {
      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const [
            'https://example.com/post-1.jpg',
            'https://example.com/post-2.jpg',
            'https://example.com/post-3.jpg',
          ],
        ),
      );

      expect(find.text('1/3'), findsOneWidget);

      await tester.drag(find.byType(PageView), const Offset(-600, 0));
      await tester.pumpAndSettle();

      expect(find.text('2/3'), findsOneWidget);

      await tester.drag(find.byType(PageView), const Offset(-600, 0));
      await tester.pumpAndSettle();

      expect(find.text('3/3'), findsOneWidget);
    });

    testWidgets('hides the gallery counter when the post has one image', (
      tester,
    ) async {
      await _pumpFeedCard(
        tester,
        post: _feedPost(imageUrls: const ['https://example.com/post-1.jpg']),
      );

      expect(find.text('1/1'), findsNothing);
      expect(find.byType(PageView), findsOneWidget);
    });

    testWidgets('shows only the first two preview comments', (tester) async {
      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const ['https://example.com/post-1.jpg'],
          comments: [
            _comment(
              id: 'comment-1',
              customerName: 'Talita',
              body: 'Primeiro comentário.',
              createdAt: DateTime(2099, 4, 10, 16, 20),
            ),
            _comment(
              id: 'comment-2',
              customerName: 'Camila',
              body: 'Segundo comentário.',
              createdAt: DateTime(2099, 4, 10, 16, 25),
            ),
            _comment(
              id: 'comment-3',
              customerName: 'Bia',
              body: 'Terceiro comentário.',
              createdAt: DateTime(2099, 4, 10, 16, 30),
            ),
          ],
        ),
      );

      expect(find.text('Primeiro comentário.'), findsOneWidget);
      expect(find.text('Segundo comentário.'), findsOneWidget);
      expect(find.text('Terceiro comentário.'), findsNothing);
      expect(find.text('3 comentários'), findsOneWidget);
    });

    testWidgets('shows the booking CTA and triggers it when service exists', (
      tester,
    ) async {
      var bookTapCount = 0;
      var contactTapCount = 0;

      await _pumpFeedCard(
        tester,
        post: _feedPost(imageUrls: const ['https://example.com/post-1.jpg']),
        onBookService: () {
          bookTapCount += 1;
        },
        onContactSalon: () {
          contactTapCount += 1;
        },
      );

      expect(find.text('Agendar este serviço'), findsOneWidget);
      expect(
        find.text(
          'Gostou desse resultado? Reserve Corte premium no app ou fale com o salão para alinhar detalhes.',
        ),
        findsOneWidget,
      );
      expect(find.text('Falar com o salão'), findsOneWidget);

      await tester.tap(find.text('Agendar este serviço'));
      await tester.pump();
      await tester.tap(find.text('Falar com o salão'));
      await tester.pump();

      expect(bookTapCount, 1);
      expect(contactTapCount, 1);
    });

    testWidgets(
      'replaces booking with contact CTA when the post has no linked service',
      (tester) async {
        var contactTapCount = 0;

      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const ['https://example.com/post-1.jpg'],
          linkedService: null,
        ),
        onContactSalon: () {
          contactTapCount += 1;
        },
      );

      expect(find.text('Agendar este serviço'), findsNothing);
      expect(find.text('Corte premium'), findsNothing);
      expect(find.text('60 min'), findsNothing);
      expect(find.text('Falar sobre esse resultado'), findsOneWidget);
      expect(
        find.text(
          'Se esse visual combinou com você, fale com o salão para descobrir o melhor serviço e o melhor encaixe.',
        ),
        findsOneWidget,
      );

      await tester.tap(find.text('Falar sobre esse resultado'));
      await tester.pump();

      expect(contactTapCount, 1);
    });

    testWidgets(
      'shows busy indicators and blocks all feed card actions while busy',
      (tester) async {
        var likeTapCount = 0;
        var commentTapCount = 0;
        var bookTapCount = 0;
        var contactTapCount = 0;

        await _pumpFeedCard(
          tester,
          post: _feedPost(imageUrls: const ['https://example.com/post-1.jpg']),
          interactionBusy: true,
          onToggleLike: () {
            likeTapCount += 1;
          },
          onOpenComments: () {
            commentTapCount += 1;
          },
          onBookService: () {
            bookTapCount += 1;
          },
          onContactSalon: () {
            contactTapCount += 1;
          },
        );
        await tester.pump(const Duration(milliseconds: 300));

        expect(
          find.byType(CircularProgressIndicator).evaluate().length,
          greaterThanOrEqualTo(2),
        );

        await tester.tap(find.text('1 curtida'));
        await tester.pump();
        await tester.tap(find.text('2 comentários'));
        await tester.pump();
        await tester.tap(find.text('Agendar este serviço'));
        await tester.pump();
        await tester.tap(find.text('Falar com o salão'));
        await tester.pump();

        expect(likeTapCount, 0);
        expect(commentTapCount, 0);
        expect(bookTapCount, 0);
        expect(contactTapCount, 0);
      },
    );
  });
}

Future<void> _pumpFeedCard(
  WidgetTester tester, {
  required SalonPost post,
  bool interactionBusy = false,
  VoidCallback? onToggleLike,
  VoidCallback? onOpenComments,
  VoidCallback? onBookService,
  VoidCallback? onContactSalon,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 2200));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SalonFeedPostCard(
            post: post,
            branding: SalonBranding.fromName(
              'Salon Fun',
              overrideHexColor: '#C56B43',
            ),
            interactionBusy: interactionBusy,
            onToggleLike: onToggleLike ?? () {},
            onOpenComments: onOpenComments ?? () {},
            onBookService: onBookService,
            onContactSalon: onContactSalon,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

SalonPost _feedPost({
  required List<String> imageUrls,
  List<SalonPostComment>? comments,
  ServiceItem? linkedService = const ServiceItem(
    id: 'service-1',
    name: 'Corte premium',
    price: 120,
    duration: 60,
    sortOrder: 0,
    category: 'Cabelo',
    description: 'Corte com acabamento e finalização.',
  ),
}) {
  return SalonPost(
    id: 'post-1',
    title: 'Resultado glossy',
    caption: 'Finalização com brilho intenso e corte em camadas.',
    imageUrls: imageUrls,
    createdAt: DateTime(2099, 4, 10, 16),
    likeCount: 1,
    commentCount: comments?.length ?? 2,
    likedByMe: false,
    comments:
        comments ??
        [
          _comment(
            id: 'comment-1',
            customerName: 'Talita',
            body: 'Amei esse resultado.',
            createdAt: DateTime(2099, 4, 10, 16, 20),
          ),
          _comment(
            id: 'comment-2',
            customerName: 'Camila',
            body: 'Ficou impecável.',
            createdAt: DateTime(2099, 4, 10, 16, 30),
          ),
        ],
    linkedService: linkedService,
  );
}

SalonPostComment _comment({
  required String id,
  required String customerName,
  required String body,
  required DateTime createdAt,
}) {
  return SalonPostComment(
    id: id,
    customerId: 'customer-$id',
    customerName: customerName,
    body: body,
    createdAt: createdAt,
  );
}
