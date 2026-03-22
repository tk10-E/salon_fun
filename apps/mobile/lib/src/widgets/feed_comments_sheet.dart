import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class FeedCommentsSheet extends StatefulWidget {
  const FeedCommentsSheet({
    super.key,
    required this.post,
    required this.branding,
    required this.onSubmitComment,
  });

  final SalonPost post;
  final SalonBranding branding;
  final Future<void> Function(String body) onSubmitComment;

  @override
  State<FeedCommentsSheet> createState() => _FeedCommentsSheetState();
}

class _FeedCommentsSheetState extends State<FeedCommentsSheet> {
  final _controller = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _saving) {
      return;
    }

    setState(() => _saving = true);

    try {
      await widget.onSubmitComment(body);
      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível enviar seu comentário agora.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final insets = MediaQuery.of(context).viewInsets.bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, insets + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Comentários', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(widget.post.title, style: theme.textTheme.bodyLarge),
            const SizedBox(height: 18),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.42,
              ),
              child: widget.post.comments.isEmpty
                  ? SoftCard(
                      padding: const EdgeInsets.all(18),
                      backgroundColor: widget.branding.highlightBackground,
                      borderColor: widget.branding.outline,
                      child: Text(
                        'Seja a primeira pessoa a comentar esta foto.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: widget.branding.deep,
                        ),
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      itemCount: widget.post.comments.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final comment = widget.post.comments[index];
                        return SoftCard(
                          padding: const EdgeInsets.all(16),
                          backgroundColor: const Color(0xFFFFFBF7),
                          borderColor: widget.branding.outline,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      comment.customerName,
                                      style: theme.textTheme.titleMedium,
                                    ),
                                  ),
                                  Text(
                                    DateFormat(
                                      'dd/MM • HH:mm',
                                    ).format(comment.createdAt),
                                    style: theme.textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                comment.body,
                                style: theme.textTheme.bodyLarge?.copyWith(
                                  color: const Color(0xFF5C463A),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _controller,
              maxLines: 3,
              minLines: 1,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Seu comentário',
                hintText: 'Escreva algo gentil sobre o resultado.',
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(_saving ? 'Enviando...' : 'Enviar comentário'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
