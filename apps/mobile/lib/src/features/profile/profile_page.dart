import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.bootstrap,
    required this.notificationsController,
    required this.session,
  });

  final AppBootstrap bootstrap;
  final CustomerNotificationsController notificationsController;
  final AppSession session;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _loading = true;
  LoyaltySummary? _loyalty;
  ReferralSummary? _referral;
  late int _lastBenefitsRevision;

  @override
  void initState() {
    super.initState();
    _lastBenefitsRevision = widget.notificationsController.benefitsRevision;
    widget.notificationsController.addListener(_handleBenefitsChange);
    _load();
  }

  @override
  void didUpdateWidget(covariant ProfilePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleBenefitsChange);
      _lastBenefitsRevision = widget.notificationsController.benefitsRevision;
      widget.notificationsController.addListener(_handleBenefitsChange);
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleBenefitsChange);
    super.dispose();
  }

  void _handleBenefitsChange() {
    final revision = widget.notificationsController.benefitsRevision;
    if (_lastBenefitsRevision == revision || _loading) {
      return;
    }

    _lastBenefitsRevision = revision;
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() => _loading = true);
    }
    final results = await Future.wait<dynamic>([
      widget.bootstrap.profileRepository.fetchLoyaltySummary(),
      widget.bootstrap.profileRepository.fetchReferralSummary(),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _loyalty = results[0] as LoyaltySummary?;
      _referral = results[1] as ReferralSummary?;
      _loading = false;
    });
  }

  Future<void> _openUrl(String? value) async {
    if (value == null || value.isEmpty) {
      return;
    }

    final success = await launchUrl(Uri.parse(value));
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível abrir o link.')),
      );
    }
  }

  String? _mailtoLink(String? email) {
    if (email == null || email.trim().isEmpty) {
      return null;
    }

    return 'mailto:${email.trim()}';
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final links = widget.session.landingData?.links;
    final accent = parseHexColor(preview?.brandColor);
    final quickAccessButtons = <Widget>[
      if (links?.whatsappUrl?.trim().isNotEmpty == true)
        _LinkButton(
          label: 'WhatsApp',
          icon: Icons.chat_rounded,
          onTap: () => _openUrl(links?.whatsappUrl),
        ),
      if (links?.instagramUrl?.trim().isNotEmpty == true)
        _LinkButton(
          label: 'Instagram',
          icon: Icons.camera_alt_rounded,
          onTap: () => _openUrl(links?.instagramUrl),
        ),
      if (links?.mapUrl?.trim().isNotEmpty == true)
        _LinkButton(
          label: 'Mapa',
          icon: Icons.map_rounded,
          onTap: () => _openUrl(links?.mapUrl),
        ),
      if ((links?.supportUrl?.trim().isNotEmpty == true) ||
          (links?.supportEmail?.trim().isNotEmpty == true))
        _LinkButton(
          label: 'Suporte',
          icon: Icons.support_agent_rounded,
          onTap: () =>
              _openUrl(links?.supportUrl ?? _mailtoLink(links?.supportEmail)),
        ),
      if (links?.privacyPolicyUrl?.trim().isNotEmpty == true)
        _LinkButton(
          label: 'Privacidade',
          icon: Icons.privacy_tip_rounded,
          onTap: () => _openUrl(links?.privacyPolicyUrl),
        ),
      if (links?.termsOfUseUrl?.trim().isNotEmpty == true)
        _LinkButton(
          label: 'Termos',
          icon: Icons.article_rounded,
          onTap: () => _openUrl(links?.termsOfUseUrl),
        ),
    ];

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl:
            preview?.profileCoverImageUrl ?? preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                SalonPanel(
                  accent: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.session.customer.name,
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        preview?.name ?? 'Cliente do salão',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        sentenceOrFallback(
                          preview?.tagline,
                          'Seu espaço para benefícios, suporte e identidade do salão.',
                        ),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      if (preview?.heroSupportLine?.trim().isNotEmpty ==
                          true) ...[
                        const SizedBox(height: 8),
                        Text(
                          preview!.heroSupportLine!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      const SizedBox(height: 16),
                      _ProfileMetricGrid(
                        children: [
                          _ProfileMetricTile(
                            label: 'Tier',
                            value: _loyalty?.currentTierName ?? 'Base',
                          ),
                          _ProfileMetricTile(
                            label: 'Pontos',
                            value: '${_loyalty?.pointsBalance ?? 0}',
                          ),
                          _ProfileMetricTile(
                            label: 'Indicações',
                            value: '${_referral?.qualifiedCount ?? 0}',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  _ProfileMetricGrid(
                    children: [
                      SalonPanel(
                        child: _ProfileInfoCard(
                          icon: Icons.workspace_premium_rounded,
                          title: _loyalty?.currentTierName ?? 'Programa ativo',
                          subtitle: _loyalty == null
                              ? 'Assim que houver movimentação, os benefícios aparecem aqui.'
                              : '${_loyalty!.completedVisits} visitas • ${formatCurrency(_loyalty!.cashbackBalance)} em cashback',
                        ),
                      ),
                      SalonPanel(
                        child: _ProfileInfoCard(
                          icon: Icons.campaign_rounded,
                          title:
                              _referral?.referralCode ?? 'Código em preparação',
                          subtitle: _referral == null
                              ? 'As indicações entram aqui assim que o programa estiver ativo.'
                              : '${_referral!.availableRewardsCount} recompensas disponíveis • ${_referral!.programTitle ?? 'programa ativo'}',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionTitle(
                          title: 'Acessos rápidos',
                          subtitle: 'Suporte e presença digital do salão.',
                        ),
                        const SizedBox(height: 16),
                        if (quickAccessButtons.isEmpty)
                          Text(
                            'Assim que o salão publicar links de contato e política, eles aparecem aqui.',
                            style: Theme.of(context).textTheme.bodySmall,
                          )
                        else
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final twoColumns = constraints.maxWidth >= 280;
                              final itemWidth = twoColumns
                                  ? (constraints.maxWidth - 10) / 2
                                  : constraints.maxWidth;
                              return Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  for (final button in quickAccessButtons)
                                    SizedBox(width: itemWidth, child: button),
                                ],
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionTitle(
                          title: 'Sua área',
                          subtitle: 'Saída segura e identidade organizada.',
                        ),
                        const SizedBox(height: 16),
                        _InfoRow(
                          label: 'Telefone',
                          value:
                              widget.session.customer.phone ?? 'Não informado',
                        ),
                        if (preview?.addressLabel?.trim().isNotEmpty ==
                            true) ...[
                          const SizedBox(height: 10),
                          _InfoRow(
                            label: 'Endereço',
                            value: preview!.addressLabel!,
                          ),
                        ],
                        const SizedBox(height: 10),
                        _InfoRow(
                          label: 'Consentimento',
                          value: widget.session.customer.consentStatus,
                        ),
                        if (links?.supportEmail?.trim().isNotEmpty == true) ...[
                          const SizedBox(height: 10),
                          _InfoRow(
                            label: 'E-mail de suporte',
                            value: links!.supportEmail!,
                          ),
                        ],
                        const SizedBox(height: 10),
                        _InfoRow(
                          label: 'Código de indicação',
                          value:
                              widget.session.customer.referralCode ??
                              _referral?.referralCode ??
                              'Em breve',
                        ),
                        const SizedBox(height: 18),
                        OutlinedButton.icon(
                          onPressed: widget.bootstrap.sessionController.signOut,
                          icon: const Icon(Icons.logout_rounded),
                          label: const Text('Sair do app'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileMetricGrid extends StatelessWidget {
  const _ProfileMetricGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = constraints.maxWidth >= 320
            ? (constraints.maxWidth - 12) / 2
            : constraints.maxWidth;

        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

class _ProfileMetricTile extends StatelessWidget {
  const _ProfileMetricTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoCard extends StatelessWidget {
  const _ProfileInfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 144),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ToneIconBadge(icon: icon, tone: AppTheme.primary),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            subtitle,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _LinkButton extends StatelessWidget {
  const _LinkButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.bodySmall),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ],
    );
  }
}
