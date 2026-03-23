import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/theme/salon_branding.dart';
import 'package:salon_client/src/widgets/feed_comments_sheet.dart';

void main() {
  group('FeedCommentsSheet', () {
    testWidgets('submits a trimmed comment and closes the sheet', (
      tester,
    ) async {
      final submittedBodies = <String>[];
      final resultCompleter = Completer<bool?>();

      await tester.binding.setSurfaceSize(const Size(1200, 1800));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(
          home: _FeedCommentsSheetHost(
            post: _post(),
            onResult: resultCompleter.complete,
            onSubmitComment: (body) async {
              submittedBodies.add(body);
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();

      expect(
        find.text('Seja a primeira pessoa a comentar esta foto.'),
        findsOneWidget,
      );

      await tester.enterText(find.byType(TextField), '  Ficou maravilhoso!  ');
      await tester.ensureVisible(find.text('Enviar comentário'));
      await tester.tap(find.text('Enviar comentário'));
      await tester.pumpAndSettle();

      expect(submittedBodies, ['Ficou maravilhoso!']);
      expect(await resultCompleter.future, isTrue);
      expect(find.text('Comments host'), findsOneWidget);
    });

    testWidgets('shows a snackbar when the comment submission fails', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(1200, 1800));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(
          home: _FeedCommentsSheetHost(
            post: _post(),
            onSubmitComment: (_) async {
              throw Exception('submit_failed');
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'Lindo resultado!');
      await tester.ensureVisible(find.text('Enviar comentário'));
      await tester.tap(find.text('Enviar comentário'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.text('Não foi possível enviar seu comentário agora.'),
        findsOneWidget,
      );
      expect(find.text('Comentários'), findsOneWidget);
    });
  });
}

SalonPost _post() {
  return SalonPost(
    id: 'post-1',
    title: 'Resultado de hoje',
    caption: 'Uma transformação linda para inspirar sua próxima visita.',
    imageUrls: ['https://example.com/post.jpg'],
    createdAt: DateTime(2099, 4, 10, 15),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    comments: [],
  );
}

class _FeedCommentsSheetHost extends StatefulWidget {
  const _FeedCommentsSheetHost({
    required this.post,
    required this.onSubmitComment,
    this.onResult,
  });

  final SalonPost post;
  final Future<void> Function(String body) onSubmitComment;
  final ValueChanged<bool?>? onResult;

  @override
  State<_FeedCommentsSheetHost> createState() => _FeedCommentsSheetHostState();
}

class _FeedCommentsSheetHostState extends State<_FeedCommentsSheetHost> {
  bool _didOpen = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didOpen) {
      return;
    }

    _didOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final result = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        backgroundColor: const Color(0xFFFFFBF7),
        builder: (_) => FeedCommentsSheet(
          post: widget.post,
          branding: SalonBranding.fromName(
            'Salon Fun',
            overrideHexColor: '#C56B43',
          ),
          onSubmitComment: widget.onSubmitComment,
        ),
      );
      widget.onResult?.call(result);
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Comments host')));
  }
}
