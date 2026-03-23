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

    testWidgets('keeps the photo clean and moves feed references below media', (
      tester,
    ) async {
      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const ['https://example.com/post-1.jpg'],
          linkedService: null,
          staffMemberName: 'Maria',
        ),
      );

      final mediaSection = find.ancestor(
        of: find.byType(PageView),
        matching: find.byType(ClipRRect),
      );

      expect(find.text('Resultado real'), findsOneWidget);
      expect(find.text('Referência do salão'), findsOneWidget);
      expect(find.text('Assinado por Maria'), findsOneWidget);
      expect(
        find.descendant(
          of: mediaSection,
          matching: find.text('Resultado real'),
        ),
        findsNothing,
      );
      expect(
        find.descendant(
          of: mediaSection,
          matching: find.text('Referência do salão'),
        ),
        findsNothing,
      );
    });

    testWidgets('renders before and after labels for transformation posts', (
      tester,
    ) async {
      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const [
            'https://example.com/post-before.jpg',
            'https://example.com/post-after.jpg',
          ],
          postType: SalonPostType.beforeAfter,
          linkedService: null,
        ),
      );

      expect(find.text('Antes'), findsOneWidget);
      expect(find.text('Depois'), findsOneWidget);
      expect(find.byType(PageView), findsNothing);
      expect(find.text('Antes e depois'), findsOneWidget);
    });

    testWidgets('shows reel CTA and opens the video action', (tester) async {
      var openVideoCount = 0;

      await _pumpFeedCard(
        tester,
        post: _feedPost(
          imageUrls: const ['https://example.com/post-cover.jpg'],
          postType: SalonPostType.reel,
          videoUrl: 'https://example.com/post.mp4',
          linkedService: null,
          staffMemberName: 'Talita',
          staffMemberRole: 'Colorista',
        ),
        onOpenVideo: () {
          openVideoCount += 1;
        },
      );

      expect(find.text('Vídeo curto'), findsWidgets);
      expect(find.text('Assinado por Talita • Colorista'), findsOneWidget);
      expect(find.text('Assistir em movimento'), findsOneWidget);

      await tester.tap(find.text('Assistir em movimento'));
      await tester.pump();

      expect(openVideoCount, 1);
    });

    testWidgets('double tap on photo triggers like burst once', (tester) async {
      var likeTapCount = 0;

      await _pumpFeedCard(
        tester,
        post: _feedPost(imageUrls: const ['https://example.com/post-1.jpg']),
        onToggleLike: () {
          likeTapCount += 1;
        },
      );

      await tester.tap(find.byType(PageView));
      await tester.pump(const Duration(milliseconds: 40));
      await tester.tap(find.byType(PageView));
      await tester.pump();

      expect(likeTapCount, 1);
      expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 320));

      expect(find.byIcon(Icons.favorite_rounded), findsNothing);
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

      expect(
        find.textContaining('Primeiro comentário.', findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining('Segundo comentário.', findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining('Terceiro comentário.', findRichText: true),
        findsNothing,
      );
      expect(find.text('Ver 3 comentários'), findsOneWidget);
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

      expect(find.text('Quero esse resultado'), findsOneWidget);
      expect(find.text('Resultado real'), findsOneWidget);
      expect(find.text('Corte premium'), findsAtLeastNWidgets(1));
      expect(find.text('Resultado glossy'), findsOneWidget);
      expect(find.text('Falar com o salão'), findsOneWidget);

      await tester.tap(find.text('Quero esse resultado'));
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

        expect(find.text('Quero esse resultado'), findsNothing);
        expect(find.text('Corte premium'), findsNothing);
        expect(find.text('60 min'), findsNothing);
        expect(find.text('Falar sobre esse resultado'), findsOneWidget);
        expect(find.text('Resultado glossy'), findsOneWidget);

        await tester.tap(find.text('Falar sobre esse resultado'));
        await tester.pump();

        expect(contactTapCount, 1);
      },
    );

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

        await tester.tap(find.byTooltip('Curtir publicação'));
        await tester.pump();
        await tester.tap(find.text('Ver 2 comentários'));
        await tester.pump();
        await tester.tap(find.text('Quero esse resultado'));
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
  VoidCallback? onOpenVideo,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 2200));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: Center(
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
              onOpenVideo: onOpenVideo,
            ),
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
  SalonPostType postType = SalonPostType.standard,
  String? videoUrl,
  String? staffMemberName,
  String? staffMemberRole,
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
    postType: postType,
    videoUrl: videoUrl,
    staffMemberName: staffMemberName,
    staffMemberRole: staffMemberRole,
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
