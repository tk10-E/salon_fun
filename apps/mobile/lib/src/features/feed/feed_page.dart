import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';
import 'feed_repository.dart';

class FeedPage extends StatefulWidget {
  const FeedPage({
    super.key,
    required this.feedRepository,
    required this.notificationsController,
    required this.session,
    this.onNavigateToAgenda,
  });

  final FeedRepository feedRepository;
  final CustomerNotificationsController notificationsController;
  final AppSession session;
  final VoidCallback? onNavigateToAgenda;

  @override
  State<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends State<FeedPage> {
  final ImagePicker _imagePicker = ImagePicker();
  bool _loading = true;
  bool _publishingOwnStory = false;
  List<FeedPost> _posts = const [];
  List<FeedStory> _stories = const [];
  String _selectedCategory = 'Todos';
  late int _lastFeedRevision;

  @override
  void initState() {
    super.initState();
    _lastFeedRevision = widget.notificationsController.feedRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _load();
  }

  @override
  void didUpdateWidget(covariant FeedPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleSyncChange);
      _lastFeedRevision = widget.notificationsController.feedRevision;
      widget.notificationsController.addListener(_handleSyncChange);
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleSyncChange);
    super.dispose();
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.feedRevision;
    if (_lastFeedRevision == revision || _loading) {
      return;
    }

    _lastFeedRevision = revision;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait<dynamic>([
        widget.feedRepository.fetchPosts(
          customerId: widget.session.customer.id,
        ),
        widget.feedRepository.fetchStories(),
      ]);
      final posts = results[0] as List<FeedPost>;
      final stories = results[1] as List<FeedStory>;

      if (!mounted) {
        return;
      }

      final activeStories = stories
          .where((story) => story.isActive)
          .toList(growable: false);

      final availableCategories = _deriveFeedCategories(posts);
      setState(() {
        _posts = posts;
        _stories = activeStories;
        if (_selectedCategory != 'Todos' &&
            !availableCategories.contains(_selectedCategory)) {
          _selectedCategory = 'Todos';
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
        );
    }
  }

  Future<void> _toggleLike(FeedPost post) async {
    final index = _posts.indexWhere((item) => item.id == post.id);
    if (index == -1) {
      return;
    }

    final optimistic = post.copyWith(
      isLikedByCustomer: !post.isLikedByCustomer,
      likesCount: post.likesCount + (post.isLikedByCustomer ? -1 : 1),
    );

    setState(() => _posts[index] = optimistic);

    try {
      await widget.feedRepository.toggleLike(
        post: post,
        customerId: widget.session.customer.id,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _posts[index] = post);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _openComments(FeedPost post) async {
    final controller = TextEditingController();
    final index = _posts.indexWhere((item) => item.id == post.id);
    if (index == -1) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        bool sending = false;
        return StatefulBuilder(
          builder: (context, setModalState) {
            final currentPost = _posts[index];
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                salonBottomActionInset(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Comentarios',
                    subtitle: 'Conversa rapida, limpa e dentro do post.',
                  ),
                  const SizedBox(height: 14),
                  Flexible(
                    child: currentPost.comments.isEmpty
                        ? const EmptyStateCard(
                            title: 'Sem comentarios ainda',
                            message:
                                'Seja a primeira cliente a puxar a conversa.',
                            icon: Icons.chat_bubble_outline_rounded,
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            itemCount: currentPost.comments.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, commentIndex) {
                              final comment =
                                  currentPost.comments[commentIndex];
                              return SalonPanel(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      comment.customerName,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      comment.body,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Escreva um comentario',
                      hintText: 'Ex.: amei esse resultado',
                    ),
                  ),
                  const SizedBox(height: 12),
                  AsyncButton(
                    label: 'Publicar comentario',
                    isBusy: sending,
                    icon: Icons.send_rounded,
                    onPressed: () async {
                      if (controller.text.trim().isEmpty) {
                        return;
                      }
                      setModalState(() => sending = true);
                      try {
                        final comment = await widget.feedRepository.addComment(
                          postId: post.id,
                          customerId: widget.session.customer.id,
                          customerName: widget.session.customer.name,
                          body: controller.text,
                        );
                        if (!mounted) {
                          return;
                        }
                        setState(() {
                          _posts[index] = currentPost.copyWith(
                            comments: [comment, ...currentPost.comments],
                          );
                        });
                        controller.clear();
                        setModalState(() => sending = false);
                      } catch (error) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$error'.replaceFirst('Exception: ', ''),
                            ),
                          ),
                        );
                        setModalState(() => sending = false);
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    controller.dispose();
  }

  List<String> _deriveFeedCategories(List<FeedPost> posts) {
    final categories = <String>[];
    for (final post in posts) {
      final label = _primaryFeedCategory(post);
      if (label == null || categories.contains(label)) {
        continue;
      }
      categories.add(label);
      if (categories.length >= 4) {
        break;
      }
    }
    return categories;
  }

  List<FeedPost> _filteredPostsForCategory(
    List<FeedPost> posts,
    String selectedCategory,
  ) {
    if (selectedCategory == 'Todos') {
      return posts;
    }

    return posts
        .where((post) => _primaryFeedCategory(post) == selectedCategory)
        .toList(growable: false);
  }

  Future<void> _openCategorySheet(List<String> categories) async {
    if (categories.isEmpty) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            salonBottomActionInset(context),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle(
                title: 'Filtrar feed',
                subtitle:
                    'Escolha um recorte para ver somente os posts dessa area.',
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final category in ['Todos', ...categories])
                    ChoiceChip(
                      label: Text(category),
                      selected: _selectedCategory == category,
                      onSelected: (_) {
                        setState(() => _selectedCategory = category);
                        Navigator.of(context).pop();
                      },
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openOwnStoryActions(FeedStory? activeStory) async {
    if (_publishingOwnStory) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(bottom: salonBottomActionInset(context)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (activeStory != null)
                ListTile(
                  leading: const Icon(Icons.play_circle_outline_rounded),
                  title: const Text('Ver seu story'),
                  subtitle: const Text(
                    'Abre a foto que ja esta ativa no topo do feed.',
                  ),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _openStoryViewer([activeStory], initialIndex: 0);
                  },
                ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: Text(
                  activeStory == null
                      ? 'Escolher foto da galeria'
                      : 'Trocar foto do story',
                ),
                subtitle: const Text(
                  'Publica uma foto vertical como story por 24 horas.',
                ),
                onTap: () async {
                  Navigator.of(context).pop();
                  await _pickAndPublishOwnStory(ImageSource.gallery);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Tirar foto agora'),
                subtitle: const Text(
                  'Abre a camera para publicar um story novo.',
                ),
                onTap: () async {
                  Navigator.of(context).pop();
                  await _pickAndPublishOwnStory(ImageSource.camera);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _pickAndPublishOwnStory(ImageSource source) async {
    if (_publishingOwnStory) {
      return;
    }

    final selected = await _imagePicker.pickImage(
      source: source,
      imageQuality: 90,
      maxWidth: 1080,
      maxHeight: 1920,
      requestFullMetadata: false,
    );

    if (selected == null) {
      return;
    }

    setState(() => _publishingOwnStory = true);
    try {
      final bytes = await selected.readAsBytes();
      final extension = _extractImageExtension(selected.name);
      final contentType = _resolveImageContentType(extension);
      await widget.feedRepository.uploadCustomerStory(
        bytes: bytes,
        fileExtension: extension,
        contentType: contentType,
      );
      await _load();
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Seu story foi publicado e ja aparece no topo do feed.',
            ),
          ),
        );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
        );
    } finally {
      if (mounted) {
        setState(() => _publishingOwnStory = false);
      }
    }
  }

  Future<void> _openStoryViewer(
    List<FeedStory> stories, {
    required int initialIndex,
  }) async {
    if (stories.isEmpty) {
      return;
    }

    final preview = widget.session.landingData?.preview;
    final whatsappUrl = _salonWhatsAppUrl();

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => _FeedStoryViewerPage(
          stories: stories,
          initialIndex: initialIndex,
          salonName: sentenceOrFallback(
            preview?.appDisplayName,
            sentenceOrFallback(preview?.name, 'Salao'),
          ),
          fallbackAvatarUrl: preview?.logoUrl,
          onSchedule: widget.onNavigateToAgenda,
          onContactSalon: whatsappUrl == null
              ? null
              : () => _launchExternalUrl(
                  whatsappUrl,
                  failureMessage: 'Nao foi possivel abrir o WhatsApp do salao.',
                ),
        ),
        fullscreenDialog: true,
      ),
    );
  }

  Future<void> _openPostMediaViewer(
    FeedPost post, {
    int initialIndex = 0,
  }) async {
    if (post.imageUrls.isEmpty) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) =>
            _FeedPostMediaViewerPage(post: post, initialIndex: initialIndex),
        fullscreenDialog: true,
      ),
    );
  }

  Future<void> _openPostActions(FeedPost post) async {
    final sourceUrl = _postSourceUrl(post);
    final whatsappUrl = _salonWhatsAppUrl();

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(bottom: salonBottomActionInset(context)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Ver fotos da publicacao'),
                subtitle: Text(
                  post.imageUrls.length > 1
                      ? '${post.imageUrls.length} imagens na galeria'
                      : 'Abrir a imagem principal em tela cheia',
                ),
                onTap: () async {
                  Navigator.of(context).pop();
                  await _openPostMediaViewer(post);
                },
              ),
              if (widget.onNavigateToAgenda != null)
                ListTile(
                  leading: const Icon(Icons.calendar_month_rounded),
                  title: Text(
                    post.serviceName?.trim().isNotEmpty == true
                        ? 'Agendar ${post.serviceName!.trim()}'
                        : 'Abrir agenda',
                  ),
                  subtitle: const Text(
                    'Leva a cliente direto para reservar no salao.',
                  ),
                  onTap: () {
                    Navigator.of(context).pop();
                    widget.onNavigateToAgenda?.call();
                  },
                ),
              if (sourceUrl != null)
                ListTile(
                  leading: const Icon(Icons.open_in_new_rounded),
                  title: const Text('Abrir origem da publicacao'),
                  subtitle: const Text(
                    'Usa o link real quando o conteudo veio do Instagram.',
                  ),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _launchExternalUrl(
                      sourceUrl,
                      failureMessage:
                          'Nao foi possivel abrir a origem desta publicacao.',
                    );
                  },
                ),
              if ((post.caption?.trim().isNotEmpty ?? false))
                ListTile(
                  leading: const Icon(Icons.content_copy_rounded),
                  title: const Text('Copiar legenda'),
                  subtitle: const Text(
                    'Copia o texto da publicacao para usar onde quiser.',
                  ),
                  onTap: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.of(context).pop();
                    await Clipboard.setData(
                      ClipboardData(text: post.caption!.trim()),
                    );
                    if (!mounted) {
                      return;
                    }
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Legenda copiada.')),
                    );
                  },
                ),
              if (whatsappUrl != null)
                ListTile(
                  leading: const Icon(Icons.chat_rounded),
                  title: const Text('Falar com o salao'),
                  subtitle: const Text(
                    'Abre o canal oficial do salao no WhatsApp.',
                  ),
                  onTap: () async {
                    Navigator.of(context).pop();
                    await _launchExternalUrl(
                      whatsappUrl,
                      failureMessage:
                          'Nao foi possivel abrir o WhatsApp do salao.',
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _launchExternalUrl(
    String rawUrl, {
    required String failureMessage,
  }) async {
    final parsed = Uri.tryParse(rawUrl.trim());
    if (parsed == null) {
      return;
    }

    final opened = await launchUrl(
      parsed,
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(failureMessage)));
    }
  }

  String? _salonWhatsAppUrl() {
    final links = widget.session.landingData?.links;
    if (links?.whatsappUrl?.trim().isNotEmpty == true) {
      return links!.whatsappUrl!.trim();
    }

    final rawPhone = widget.session.landingData?.preview.whatsappPhone?.trim();
    if (rawPhone == null || rawPhone.isEmpty) {
      return null;
    }

    final digits = rawPhone.replaceAll(RegExp(r'\D+'), '');
    return digits.isEmpty ? null : 'https://wa.me/$digits';
  }

  String? _postSourceUrl(FeedPost post) {
    if (post.permalinkUrl?.trim().isNotEmpty == true) {
      return post.permalinkUrl!.trim();
    }

    final caption = post.caption?.trim();
    if (caption == null || caption.isEmpty) {
      return null;
    }

    final match = RegExp(
      r'https?://\S+',
      caseSensitive: false,
    ).firstMatch(caption);
    return match?.group(0);
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(preview?.brandColor);
    final goldTone =
        Color.lerp(accent, AppTheme.accent, 0.55) ?? AppTheme.accent;
    const canvasColor = Color(0xFF090C10);
    const surfaceColor = Color(0xFF11161C);
    const softSurfaceColor = Color(0xFF171D24);
    final lineColor = Colors.white.withValues(alpha: 0.08);
    final salonName = sentenceOrFallback(
      preview?.appDisplayName,
      sentenceOrFallback(preview?.name, 'Studio Barber'),
    );
    final categories = _deriveFeedCategories(_posts);
    final filteredPosts = _filteredPostsForCategory(_posts, _selectedCategory);
    FeedStory? ownActiveStory;
    for (final story in _stories) {
      if (story.ownerCustomerId == widget.session.customer.id.trim()) {
        ownActiveStory = story;
        break;
      }
    }
    final visibleStories = _stories
        .where((story) => story.id != ownActiveStory?.id)
        .take(5)
        .toList(growable: false);
    final latestPost = filteredPosts.isEmpty ? null : filteredPosts.first;
    final latestMoment = _stories.isNotEmpty
        ? _stories.first.createdAt
        : latestPost?.createdAt;
    final customerProfileImageUrl = _normalizedImageUrl(
      widget.session.customer.profileImageUrl,
    );

    return Scaffold(
      backgroundColor: canvasColor,
      body: Stack(
        children: [
          Positioned.fill(
            child: AppGradientBackground(
              accentColor: goldTone,
              backgroundImageUrl:
                  preview?.galleryCoverImageUrl ?? preview?.heroImageUrl,
              bannerStyle: 'immersive',
              child: const SizedBox.expand(),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    canvasColor.withValues(alpha: 0.18),
                    canvasColor.withValues(alpha: 0.84),
                    canvasColor,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: RefreshIndicator(
              color: goldTone,
              backgroundColor: surfaceColor,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Feed do salao',
                              style: Theme.of(context).textTheme.displaySmall
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontSize: 26,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Acompanhe novidades e transformacoes',
                              style: Theme.of(context).textTheme.bodyLarge
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.72),
                                  ),
                            ),
                            if (latestMoment != null) ...[
                              const SizedBox(height: 10),
                              Text(
                                _stories.isNotEmpty
                                    ? 'Story ativa desde ${formatCompactDateTime(latestMoment)}'
                                    : 'Ultima publicacao ${formatCompactDateTime(latestMoment)}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: Colors.white.withValues(
                                        alpha: 0.52,
                                      ),
                                      letterSpacing: 0,
                                    ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      _FeedGhostIconButton(
                        icon: _stories.isNotEmpty
                            ? Icons.play_circle_outline_rounded
                            : Icons.refresh_rounded,
                        onPressed: _stories.isNotEmpty
                            ? () => _openStoryViewer(_stories, initialIndex: 0)
                            : _load,
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    height: 128,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: 1 + visibleStories.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 16),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return _FeedStoryChip(
                            accent: goldTone,
                            label: 'Seu story',
                            imageUrl:
                                ownActiveStory?.imageUrl ??
                                customerProfileImageUrl ??
                                preview?.logoUrl,
                            onTap: () => _openOwnStoryActions(ownActiveStory),
                            showAddBadge:
                                ownActiveStory == null && !_publishingOwnStory,
                            isBusy: _publishingOwnStory,
                          );
                        }

                        final story = visibleStories[index - 1];
                        return _FeedStoryChip(
                          accent: goldTone,
                          label: _feedStoryLabel(story),
                          imageUrl: story.imageUrl ?? preview?.logoUrl,
                          onTap: () => _openStoryViewer(
                            visibleStories,
                            initialIndex: index - 1,
                          ),
                        );
                      },
                    ),
                  ),
                  if (_stories.isEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Ainda nao ha stories ativos. Toque em Seu story para publicar a primeira foto ou aguarde o proximo story do salao.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.58),
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  SizedBox(
                    height: 50,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _FeedFilterChip(
                          label: 'Todos',
                          selected: _selectedCategory == 'Todos',
                          tone: goldTone,
                          onTap: () =>
                              setState(() => _selectedCategory = 'Todos'),
                        ),
                        for (final category in categories) ...[
                          const SizedBox(width: 10),
                          _FeedFilterChip(
                            label: category,
                            selected: _selectedCategory == category,
                            tone: goldTone,
                            onTap: () =>
                                setState(() => _selectedCategory = category),
                          ),
                        ],
                        if (categories.isNotEmpty) ...[
                          const SizedBox(width: 10),
                          _FeedGhostIconButton(
                            icon: Icons.tune_rounded,
                            onPressed: () => _openCategorySheet(categories),
                            compact: true,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (_loading)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: CircularProgressIndicator(color: goldTone),
                      ),
                    )
                  else if (_posts.isEmpty)
                    _FeedEmptyState(
                      surfaceColor: surfaceColor,
                      lineColor: lineColor,
                      accent: goldTone,
                      title: 'Feed sem posts no momento',
                      message:
                          'Assim que o salao publicar algo novo, tudo aparece aqui.',
                    )
                  else if (filteredPosts.isEmpty)
                    _FeedEmptyState(
                      surfaceColor: surfaceColor,
                      lineColor: lineColor,
                      accent: goldTone,
                      title: 'Nenhum post nesse recorte',
                      message:
                          'Troque o filtro para ver mais publicacoes do salao.',
                    )
                  else
                    ...filteredPosts.map(
                      (post) => Padding(
                        padding: const EdgeInsets.only(bottom: 18),
                        child: _FeedPostCard(
                          post: post,
                          accent: goldTone,
                          borderColor: lineColor,
                          fallbackAvatarUrl: preview?.logoUrl,
                          salonName: salonName,
                          surfaceColor: surfaceColor,
                          softSurfaceColor: softSurfaceColor,
                          onLike: () => _toggleLike(post),
                          onComment: () => _openComments(post),
                          onOpenMedia: () => _openPostMediaViewer(post),
                          onMore: () => _openPostActions(post),
                          onSchedule: widget.onNavigateToAgenda,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedStoryChip extends StatelessWidget {
  const _FeedStoryChip({
    required this.accent,
    required this.label,
    this.imageUrl,
    this.onTap,
    this.showAddBadge = false,
    this.isBusy = false,
  });

  final Color accent;
  final String label;
  final String? imageUrl;
  final VoidCallback? onTap;
  final bool showAddBadge;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: SizedBox(
        width: 86,
        child: Column(
          children: [
            Container(
              width: 86,
              height: 86,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.68),
                    accent,
                    AppTheme.primary,
                  ],
                ),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: imageUrl == null || imageUrl!.isEmpty
                          ? _FeedImagePlaceholder(accent: accent)
                          : SalonNetworkImage(
                              imageUrl: imageUrl!,
                              fit: BoxFit.cover,
                              error: _FeedImagePlaceholder(accent: accent),
                              placeholder: _FeedImagePlaceholder(
                                accent: accent,
                              ),
                            ),
                    ),
                  ),
                  if (isBusy)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.36),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.2),
                          ),
                        ),
                      ),
                    ),
                  if (showAddBadge)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: accent,
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF090C10)),
                        ),
                        child: const Icon(
                          Icons.add_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.92),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedFilterChip extends StatelessWidget {
  const _FeedFilterChip({
    required this.label,
    required this.selected,
    required this.tone,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? tone.withValues(alpha: 0.34)
              : const Color(0xFF171C22),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected
                ? tone.withValues(alpha: 0.58)
                : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: selected
                ? Colors.white
                : Colors.white.withValues(alpha: 0.78),
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _FeedGhostIconButton extends StatelessWidget {
  const _FeedGhostIconButton({
    required this.icon,
    required this.onPressed,
    this.compact = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 50.0 : 56.0;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onPressed,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: Colors.white.withValues(alpha: 0.9)),
      ),
    );
  }
}

class _FeedEmptyState extends StatelessWidget {
  const _FeedEmptyState({
    required this.surfaceColor,
    required this.lineColor,
    required this.accent,
    required this.title,
    required this.message,
  });

  final Color surfaceColor;
  final Color lineColor;
  final Color accent;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: lineColor),
      ),
      child: Column(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(18),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.perm_media_outlined, color: accent),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.68),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedPostCard extends StatefulWidget {
  const _FeedPostCard({
    required this.post,
    required this.accent,
    required this.borderColor,
    required this.fallbackAvatarUrl,
    required this.salonName,
    required this.surfaceColor,
    required this.softSurfaceColor,
    required this.onLike,
    required this.onComment,
    required this.onOpenMedia,
    required this.onMore,
    this.onSchedule,
  });

  final FeedPost post;
  final Color accent;
  final Color borderColor;
  final String? fallbackAvatarUrl;
  final String salonName;
  final Color surfaceColor;
  final Color softSurfaceColor;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onOpenMedia;
  final VoidCallback onMore;
  final VoidCallback? onSchedule;

  @override
  State<_FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends State<_FeedPostCard> {
  late final PageController _pageController;
  int _pageIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goToPreviousPage() {
    if (_pageIndex <= 0) {
      return;
    }
    _pageController.previousPage(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  void _goToNextPage() {
    if (_pageIndex >= widget.post.imageUrls.length - 1) {
      return;
    }
    _pageController.nextPage(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final visibleCaption = visibleFeedCaptionForDisplay(post);
    final serviceLabel = post.serviceName?.trim();
    final isBeforeAfter =
        post.postType.trim().toLowerCase() == 'before_after' &&
        post.imageUrls.length >= 2;
    final highlightLabel = _postHighlightLabel(post, DateTime.now());
    final showScheduleButton = widget.onSchedule != null;

    return Container(
      decoration: BoxDecoration(
        color: widget.surfaceColor.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: widget.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 10, 12),
            child: Row(
              children: [
                _FeedAuthorAvatar(
                  post: post,
                  accent: widget.accent,
                  fallbackAvatarUrl: widget.fallbackAvatarUrl,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.salonName,
                        style: Theme.of(
                          context,
                        ).textTheme.titleMedium?.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _feedMetaLabel(post),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                if (highlightLabel != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: highlightLabel == 'DESTAQUE'
                          ? const Color(0xFF1B613A)
                          : widget.accent.withValues(alpha: 0.26),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      highlightLabel,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Colors.white,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                IconButton(
                  onPressed: widget.onMore,
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: Colors.white.withValues(alpha: 0.78),
                  ),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.zero),
            child: Stack(
              children: [
                GestureDetector(
                  onTap: widget.onOpenMedia,
                  child: SizedBox(
                    height: 360,
                    width: double.infinity,
                    child: post.imageUrls.isEmpty
                        ? _FeedImagePlaceholder(accent: widget.accent)
                        : isBeforeAfter
                        ? _FeedBeforeAfterGallery(
                            leftImageUrl: post.imageUrls.first,
                            rightImageUrl: post.imageUrls[1],
                            accent: widget.accent,
                          )
                        : PageView.builder(
                            controller: _pageController,
                            itemCount: post.imageUrls.length,
                            onPageChanged: (index) {
                              setState(() => _pageIndex = index);
                            },
                            itemBuilder: (context, index) {
                              return NetworkCardImage(
                                imageUrl: post.imageUrls[index],
                                height: 360,
                                borderRadius: 0,
                              );
                            },
                          ),
                  ),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.04),
                          Colors.black.withValues(alpha: 0.38),
                        ],
                      ),
                    ),
                  ),
                ),
                if (serviceLabel != null && serviceLabel.isNotEmpty)
                  Positioned(
                    left: 16,
                    bottom: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            widget.accent.withValues(alpha: 0.82),
                            AppTheme.primary.withValues(alpha: 0.76),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        serviceLabel.toUpperCase(),
                        style: Theme.of(
                          context,
                        ).textTheme.labelLarge?.copyWith(color: Colors.white),
                      ),
                    ),
                  ),
                if (!isBeforeAfter && post.imageUrls.length > 1)
                  Positioned(
                    top: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.34),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        '${_pageIndex + 1}/${post.imageUrls.length}',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                if (!isBeforeAfter && post.imageUrls.length > 1)
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    child: IgnorePointer(
                      ignoring: false,
                      child: Row(
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Padding(
                                padding: const EdgeInsets.only(left: 12),
                                child: _FeedCarouselArrow(
                                  icon: Icons.chevron_left_rounded,
                                  onTap: _goToPreviousPage,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: _FeedCarouselArrow(
                                  icon: Icons.chevron_right_rounded,
                                  onTap: _goToNextPage,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            decoration: BoxDecoration(
              color: widget.surfaceColor.withValues(alpha: 0.98),
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(28),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  post.title,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    fontSize: 19,
                    height: 1.18,
                  ),
                ),
                if (visibleCaption != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    visibleCaption,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.white.withValues(alpha: 0.72),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    _FeedActionCounter(
                      icon: post.isLikedByCustomer
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      value: '${post.likesCount}',
                      color: post.isLikedByCustomer
                          ? AppTheme.primary
                          : Colors.white.withValues(alpha: 0.82),
                      onTap: widget.onLike,
                    ),
                    const SizedBox(width: 18),
                    _FeedActionCounter(
                      icon: Icons.mode_comment_outlined,
                      value: '${post.commentsCount}',
                      color: Colors.white.withValues(alpha: 0.82),
                      onTap: widget.onComment,
                    ),
                    const SizedBox(width: 18),
                    _FeedActionCounter(
                      icon: Icons.photo_library_outlined,
                      value: post.imageUrls.length > 1
                          ? '${post.imageUrls.length}'
                          : null,
                      color: Colors.white.withValues(alpha: 0.82),
                      onTap: widget.onOpenMedia,
                    ),
                  ],
                ),
                if (showScheduleButton) ...[
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.onSchedule,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(58),
                        foregroundColor: widget.accent,
                        side: BorderSide(
                          color: widget.accent.withValues(alpha: 0.76),
                        ),
                        backgroundColor: widget.softSurfaceColor,
                      ),
                      icon: const Icon(Icons.calendar_month_rounded),
                      label: const Text('Agendar servico'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedBeforeAfterGallery extends StatelessWidget {
  const _FeedBeforeAfterGallery({
    required this.leftImageUrl,
    required this.rightImageUrl,
    required this.accent,
  });

  final String leftImageUrl;
  final String rightImageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Row(
          children: [
            Expanded(
              child: NetworkCardImage(
                imageUrl: leftImageUrl,
                height: 360,
                borderRadius: 0,
              ),
            ),
            Expanded(
              child: NetworkCardImage(
                imageUrl: rightImageUrl,
                height: 360,
                borderRadius: 0,
              ),
            ),
          ],
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: Center(
              child: Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.82),
                  shape: BoxShape.circle,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.chevron_left_rounded),
                    Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: Align(
              alignment: Alignment.center,
              child: Container(
                width: 2,
                color: Colors.white.withValues(alpha: 0.6),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FeedCarouselArrow extends StatelessWidget {
  const _FeedCarouselArrow({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.28),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: Colors.white),
      ),
    );
  }
}

class _FeedStoryViewerPage extends StatefulWidget {
  const _FeedStoryViewerPage({
    required this.stories,
    required this.initialIndex,
    required this.salonName,
    this.fallbackAvatarUrl,
    this.onSchedule,
    this.onContactSalon,
  });

  final List<FeedStory> stories;
  final int initialIndex;
  final String salonName;
  final String? fallbackAvatarUrl;
  final VoidCallback? onSchedule;
  final VoidCallback? onContactSalon;

  @override
  State<_FeedStoryViewerPage> createState() => _FeedStoryViewerPageState();
}

class _FeedStoryViewerPageState extends State<_FeedStoryViewerPage>
    with SingleTickerProviderStateMixin {
  static const Duration _storyDuration = Duration(seconds: 5);

  late final PageController _pageController;
  late final AnimationController _progressController;
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    _activeIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
    _progressController =
        AnimationController(vsync: this, duration: _storyDuration)
          ..addStatusListener((status) {
            if (status == AnimationStatus.completed) {
              _goToStory(1, closeAtEnd: true);
            }
          });
    _startProgress();
  }

  @override
  void dispose() {
    _progressController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _startProgress() {
    _progressController
      ..stop()
      ..forward(from: 0);
  }

  void _handlePageChanged(int index) {
    setState(() => _activeIndex = index);
    _startProgress();
  }

  void _goToStory(int direction, {bool closeAtEnd = false}) {
    final nextIndex = _activeIndex + direction;
    if (nextIndex < 0) {
      return;
    }
    if (nextIndex >= widget.stories.length) {
      if (closeAtEnd && mounted) {
        Navigator.of(context).pop();
      }
      return;
    }
    _progressController.stop();
    _pageController.animateToPage(
      nextIndex,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  TextStyle? _storyTextStyle(
    BuildContext context, {
    TextStyle? base,
    double shadowOpacity = 0.32,
  }) {
    return base?.copyWith(
      color: Colors.white,
      shadows: [
        Shadow(
          color: Colors.black.withValues(alpha: shadowOpacity),
          blurRadius: 16,
          offset: const Offset(0, 3),
        ),
      ],
    );
  }

  Widget _buildStoryProgressBars() {
    return AnimatedBuilder(
      animation: _progressController,
      builder: (context, _) {
        return Row(
          children: [
            for (var index = 0; index < widget.stories.length; index++) ...[
              Expanded(
                child: Container(
                  height: 3,
                  margin: EdgeInsets.only(
                    right: index == widget.stories.length - 1 ? 0 : 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: index < _activeIndex
                        ? 1
                        : index == _activeIndex
                        ? _progressController.value
                        : 0,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppTheme.accent;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              itemCount: widget.stories.length,
              onPageChanged: _handlePageChanged,
              itemBuilder: (context, index) {
                final story = widget.stories[index];
                final isCustomerStory =
                    story.sourceType?.trim().toLowerCase() == 'customer_story';
                final storyDisplayName =
                    isCustomerStory &&
                        story.authorUsername?.trim().isNotEmpty == true
                    ? story.authorUsername!.trim()
                    : widget.salonName;
                final storyAvatarUrl =
                    isCustomerStory &&
                        story.authorAvatarUrl?.trim().isNotEmpty == true
                    ? story.authorAvatarUrl!.trim()
                    : widget.fallbackAvatarUrl;
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    story.imageUrl == null || story.imageUrl!.isEmpty
                        ? _FeedImagePlaceholder(accent: accent)
                        : SalonNetworkImage(
                            imageUrl: story.imageUrl!,
                            fit: BoxFit.cover,
                            backgroundColor: Colors.black,
                            error: _FeedImagePlaceholder(accent: accent),
                            placeholder: Stack(
                              fit: StackFit.expand,
                              children: [
                                _FeedImagePlaceholder(accent: accent),
                                const Center(
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.4,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: const [0, 0.18, 0.55, 1],
                          colors: [
                            Colors.black.withValues(alpha: 0.64),
                            Colors.black.withValues(alpha: 0.18),
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.92),
                          ],
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onTap: () => _goToStory(-1),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onTap: () => _goToStory(1, closeAtEnd: true),
                          ),
                        ),
                      ],
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      top: 16,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildStoryProgressBars(),
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.24),
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.08),
                              ),
                            ),
                            child: Row(
                              children: [
                                _FeedAvatarBadge(
                                  accent: accent,
                                  imageUrl: storyAvatarUrl,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        storyDisplayName,
                                        style: _storyTextStyle(
                                          context,
                                          base: Theme.of(context)
                                              .textTheme
                                              .titleMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                      ),
                                      Text(
                                        _storyExpiryLabel(story),
                                        style: _storyTextStyle(
                                          context,
                                          base: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                color: Colors.white.withValues(
                                                  alpha: 0.84,
                                                ),
                                              ),
                                          shadowOpacity: 0.28,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.28),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.1,
                                      ),
                                    ),
                                  ),
                                  child: IconButton(
                                    onPressed: () =>
                                        Navigator.of(context).pop(),
                                    icon: const Icon(
                                      Icons.close_rounded,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 18,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.34),
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.08),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (story.serviceName?.trim().isNotEmpty == true)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: accent.withValues(alpha: 0.86),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text(
                                  story.serviceName!.trim().toUpperCase(),
                                  style: Theme.of(context).textTheme.labelLarge
                                      ?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                              ),
                            const SizedBox(height: 14),
                            Text(
                              story.title,
                              style: _storyTextStyle(
                                context,
                                base: Theme.of(context).textTheme.headlineMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                                shadowOpacity: 0.42,
                              ),
                            ),
                            if (story.caption?.trim().isNotEmpty == true) ...[
                              const SizedBox(height: 8),
                              Text(
                                story.caption!.trim(),
                                style: _storyTextStyle(
                                  context,
                                  base: Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.92,
                                        ),
                                      ),
                                  shadowOpacity: 0.36,
                                ),
                              ),
                            ],
                            if (story.staffName?.trim().isNotEmpty == true) ...[
                              const SizedBox(height: 10),
                              Text(
                                story.staffRole?.trim().isNotEmpty == true
                                    ? '${story.staffName} • ${story.staffRole}'
                                    : story.staffName!,
                                style: _storyTextStyle(
                                  context,
                                  base: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.86,
                                        ),
                                      ),
                                  shadowOpacity: 0.3,
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            Row(
                              children: [
                                if (widget.onSchedule != null)
                                  Expanded(
                                    child: FilledButton.icon(
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppTheme.secondary,
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                      ),
                                      onPressed: widget.onSchedule,
                                      icon: const Icon(
                                        Icons.calendar_month_rounded,
                                      ),
                                      label: Text(
                                        story.serviceName?.trim().isNotEmpty ==
                                                true
                                            ? 'Agendar agora'
                                            : 'Abrir agenda',
                                      ),
                                    ),
                                  ),
                                if (widget.onSchedule != null &&
                                    widget.onContactSalon != null)
                                  const SizedBox(width: 12),
                                if (widget.onContactSalon != null)
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: Colors.white,
                                        backgroundColor: Colors.black
                                            .withValues(alpha: 0.18),
                                        side: BorderSide(
                                          color: Colors.white.withValues(
                                            alpha: 0.82,
                                          ),
                                        ),
                                      ),
                                      onPressed: widget.onContactSalon,
                                      icon: const Icon(Icons.chat_rounded),
                                      label: const Text('Falar com o salao'),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedPostMediaViewerPage extends StatefulWidget {
  const _FeedPostMediaViewerPage({required this.post, this.initialIndex = 0});

  final FeedPost post;
  final int initialIndex;

  @override
  State<_FeedPostMediaViewerPage> createState() =>
      _FeedPostMediaViewerPageState();
}

class _FeedPostMediaViewerPageState extends State<_FeedPostMediaViewerPage> {
  late final PageController _pageController;
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    _activeIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final caption = visibleFeedCaptionForDisplay(post);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        Text(
                          '${_activeIndex + 1}/${post.imageUrls.length}',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.68),
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: post.imageUrls.length,
                onPageChanged: (index) {
                  setState(() => _activeIndex = index);
                },
                itemBuilder: (context, index) {
                  return InteractiveViewer(
                    child: Center(
                      child: SalonNetworkImage(
                        imageUrl: post.imageUrls[index],
                        fit: BoxFit.contain,
                        backgroundColor: Colors.black,
                        error: _FeedImagePlaceholder(accent: AppTheme.accent),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (caption != null || post.serviceName?.trim().isNotEmpty == true)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 24),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.72),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (post.serviceName?.trim().isNotEmpty == true)
                      Text(
                        post.serviceName!.trim(),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppTheme.accent,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    if (caption != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        caption,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.white.withValues(alpha: 0.82),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FeedActionCounter extends StatelessWidget {
  const _FeedActionCounter({
    required this.icon,
    required this.color,
    this.value,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 28),
        if (value?.trim().isNotEmpty == true) ...[
          const SizedBox(width: 8),
          Text(
            value!,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );

    if (onTap == null) {
      return content;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: content,
      ),
    );
  }
}

class _FeedAvatarBadge extends StatelessWidget {
  const _FeedAvatarBadge({required this.accent, this.imageUrl});

  final Color accent;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accent.withValues(alpha: 0.4), Colors.white],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: imageUrl == null || imageUrl!.isEmpty
            ? Container(
                color: Colors.black.withValues(alpha: 0.24),
                alignment: Alignment.center,
                child: Icon(Icons.cut_rounded, color: accent, size: 20),
              )
            : SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                backgroundColor: Colors.black.withValues(alpha: 0.24),
                error: Icon(Icons.cut_rounded, color: accent, size: 20),
              ),
      ),
    );
  }
}

class _FeedAuthorAvatar extends StatefulWidget {
  const _FeedAuthorAvatar({
    required this.post,
    required this.accent,
    this.fallbackAvatarUrl,
  });

  final FeedPost post;
  final Color accent;
  final String? fallbackAvatarUrl;

  @override
  State<_FeedAuthorAvatar> createState() => _FeedAuthorAvatarState();
}

class _FeedAuthorAvatarState extends State<_FeedAuthorAvatar> {
  List<String> _avatarCandidates = const <String>[];
  int _activeAvatarIndex = 0;

  @override
  void initState() {
    super.initState();
    _syncAvatarCandidates();
  }

  @override
  void didUpdateWidget(covariant _FeedAuthorAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post.authorAvatarUrl != widget.post.authorAvatarUrl ||
        oldWidget.fallbackAvatarUrl != widget.fallbackAvatarUrl) {
      _syncAvatarCandidates();
    }
  }

  void _syncAvatarCandidates() {
    final orderedCandidates = [
      widget.post.authorAvatarUrl,
      widget.fallbackAvatarUrl,
    ];
    final nextCandidates = <String>{
      for (final candidate in orderedCandidates)
        if (candidate?.trim().isNotEmpty == true) candidate!.trim(),
    }.toList(growable: false);

    _avatarCandidates = nextCandidates;
    _activeAvatarIndex = 0;
  }

  void _tryNextAvatarCandidate() {
    if (_activeAvatarIndex >= _avatarCandidates.length - 1) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() => _activeAvatarIndex += 1);
    });
  }

  Widget _buildIconAvatar() {
    return Container(
      color: Colors.transparent,
      alignment: Alignment.center,
      child: Icon(Icons.cut_rounded, color: widget.accent, size: 22),
    );
  }

  @override
  Widget build(BuildContext context) {
    final avatarUrl = _activeAvatarIndex < _avatarCandidates.length
        ? _avatarCandidates[_activeAvatarIndex]
        : null;

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [widget.accent.withValues(alpha: 0.4), Colors.white],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(2),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: avatarUrl == null || avatarUrl.isEmpty
            ? _buildIconAvatar()
            : SalonNetworkImage(
                imageUrl: avatarUrl,
                fit: BoxFit.cover,
                onError: _tryNextAvatarCandidate,
                error: _buildIconAvatar(),
                placeholder: _buildIconAvatar(),
              ),
      ),
    );
  }
}

class _FeedImagePlaceholder extends StatelessWidget {
  const _FeedImagePlaceholder({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.22), const Color(0xFF141A20)],
        ),
      ),
      child: Center(
        child: Icon(Icons.auto_awesome_rounded, size: 32, color: accent),
      ),
    );
  }
}

String? _primaryFeedCategory(FeedPost post) {
  final serviceName = post.serviceName?.trim();
  if (serviceName != null && serviceName.isNotEmpty) {
    return serviceName;
  }

  final postType = post.postType.trim().toLowerCase();
  if (postType == 'before_after') {
    return 'Transformacao';
  }
  if (postType == 'reel') {
    return 'Videos';
  }
  if ((post.sourceType?.trim().toLowerCase().startsWith('instagram') ??
      false)) {
    return 'Instagram';
  }

  return null;
}

String _feedStoryLabel(FeedStory story) {
  final isCustomerStory =
      story.sourceType?.trim().toLowerCase() == 'customer_story';
  final authorUsername = story.authorUsername?.trim();
  if (isCustomerStory && authorUsername != null && authorUsername.isNotEmpty) {
    return authorUsername.length <= 12
        ? authorUsername
        : '${authorUsername.substring(0, 12)}...';
  }

  final serviceName = story.serviceName?.trim();
  if (serviceName != null && serviceName.isNotEmpty) {
    return serviceName.length <= 12
        ? serviceName
        : '${serviceName.substring(0, 12)}...';
  }

  final staffName = story.staffName?.trim();
  if (staffName != null && staffName.isNotEmpty) {
    return staffName.length <= 12
        ? staffName
        : '${staffName.substring(0, 12)}...';
  }

  final title = story.title.trim();
  if (title.isEmpty) {
    return 'Story';
  }

  return title.length <= 12 ? title : '${title.substring(0, 12)}...';
}

String? _postHighlightLabel(FeedPost post, DateTime now) {
  if (isFeedHighlightForDay(post, now)) {
    return 'NOVO';
  }

  if (post.postType.trim().toLowerCase() == 'before_after') {
    return 'ANTES E DEPOIS';
  }

  return null;
}

String _feedMetaLabel(FeedPost post) {
  return formatCompactDateTime(post.createdAt);
}

String _storyExpiryLabel(FeedStory story) {
  final remaining = story.expiresAt.difference(DateTime.now());
  if (remaining.inHours >= 1) {
    return 'Sai em ${remaining.inHours}h';
  }
  final minutes = remaining.inMinutes <= 0 ? 1 : remaining.inMinutes;
  return 'Sai em ${minutes}min';
}

bool isFeedHighlightForDay(FeedPost post, DateTime day) {
  return _isSameLocalDay(post.createdAt, day);
}

String? visibleFeedCaptionForDisplay(FeedPost post) {
  return _visibleFeedCaption(post);
}

bool _isSameLocalDay(DateTime left, DateTime right) {
  final leftLocal = left.toLocal();
  final rightLocal = right.toLocal();
  return leftLocal.year == rightLocal.year &&
      leftLocal.month == rightLocal.month &&
      leftLocal.day == rightLocal.day;
}

String? _visibleFeedCaption(FeedPost post) {
  final rawCaption = post.caption?.trim();
  if (rawCaption == null || rawCaption.isEmpty) {
    return null;
  }

  if (post.imageUrls.isEmpty) {
    return rawCaption;
  }

  final withoutUrls = rawCaption
      .replaceAll(RegExp(r'https?://\S+', caseSensitive: false), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  return withoutUrls.isEmpty ? null : withoutUrls;
}

String? _normalizedImageUrl(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  return normalized;
}

String _extractImageExtension(String fileName) {
  final normalized = fileName.trim().toLowerCase();
  if (!normalized.contains('.')) {
    return 'jpg';
  }

  return normalized.split('.').last;
}

String _resolveImageContentType(String extension) {
  switch (extension.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}
