import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qr_flutter/qr_flutter.dart';
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
  bool _savingProfile = false;
  bool _savingProfileImage = false;
  ReferralSummary? _referral;
  CustomerProfile? _customerProfile;
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _customerNameController = TextEditingController();
  final TextEditingController _customerPhoneController =
      TextEditingController();
  final TextEditingController _customerEmailController =
      TextEditingController();
  String? _lastSyncedCustomerName;
  String? _lastSyncedCustomerPhone;
  String? _lastSyncedCustomerEmail;
  DateTime? _draftBirthDate;
  DateTime? _lastSyncedBirthDate;
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
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _customerEmailController.dispose();
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
    final currentSession =
        widget.bootstrap.sessionController.session ?? widget.session;
    if (mounted) {
      setState(() => _loading = true);
    }

    final customerFallback = _customerProfile ?? currentSession.customer;
    final referralFallback = _referral;
    final results = await Future.wait<dynamic>([
      _safeLoad(
        widget.bootstrap.profileRepository.fetchCurrentCustomer,
        customerFallback,
      ),
      _safeLoad(
        widget.bootstrap.profileRepository.fetchReferralSummary,
        referralFallback,
      ),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      final resolvedCustomer =
          results[0] as CustomerProfile? ?? currentSession.customer;
      _customerProfile = resolvedCustomer;
      _syncCustomerForm(resolvedCustomer);
      _referral = results[1] as ReferralSummary?;
      _loading = false;
    });
  }

  Future<T> _safeLoad<T>(Future<T> Function() loader, T fallback) async {
    try {
      return await loader();
    } catch (_) {
      return fallback;
    }
  }

  void _syncCustomerForm(CustomerProfile customer, {bool force = false}) {
    _syncController(
      controller: _customerNameController,
      incomingValue: customer.name,
      lastSyncedValue: _lastSyncedCustomerName,
      normalize: (value) => value.trim(),
      onSynced: (value) => _lastSyncedCustomerName = value,
      force: force,
    );
    _syncController(
      controller: _customerPhoneController,
      incomingValue: _formatPhone(customer.phone) ?? '',
      lastSyncedValue: _lastSyncedCustomerPhone,
      normalize: _normalizePhoneDigits,
      onSynced: (value) => _lastSyncedCustomerPhone = value,
      force: force,
    );
    _syncController(
      controller: _customerEmailController,
      incomingValue: customer.email ?? '',
      lastSyncedValue: _lastSyncedCustomerEmail,
      normalize: (value) => value.trim().toLowerCase(),
      onSynced: (value) => _lastSyncedCustomerEmail = value,
      force: force,
    );

    final canOverwriteBirthDate =
        force ||
        _draftBirthDate == null ||
        _sameDateOnly(_draftBirthDate, _lastSyncedBirthDate);
    if (canOverwriteBirthDate) {
      _draftBirthDate = customer.birthDate;
      _lastSyncedBirthDate = customer.birthDate;
    }
  }

  void _syncController({
    required TextEditingController controller,
    required String incomingValue,
    required String? lastSyncedValue,
    required String Function(String value) normalize,
    required ValueChanged<String> onSynced,
    required bool force,
  }) {
    final normalizedIncoming = normalize(incomingValue);
    final normalizedCurrent = normalize(controller.text);
    final canOverwrite =
        force ||
        normalizedCurrent.isEmpty ||
        normalizedCurrent == (lastSyncedValue ?? '');

    if (!canOverwrite) {
      return;
    }

    onSynced(normalizedIncoming);
    controller.value = TextEditingValue(
      text: incomingValue,
      selection: TextSelection.collapsed(offset: incomingValue.length),
    );
  }

  Future<void> _saveCustomerProfile(CustomerProfile customer) async {
    if (_savingProfile) {
      return;
    }

    final name = _customerNameController.text.trim();
    final phone = _customerPhoneController.text.trim();
    final email = _customerEmailController.text.trim();

    if (name.length < 2) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Informe seu nome com pelo menos 2 letras.'),
          ),
        );
      return;
    }

    setState(() => _savingProfile = true);
    try {
      final updatedCustomer = await widget.bootstrap.profileRepository
          .saveCustomerProfile(
            customerId: customer.id,
            name: name,
            phone: phone,
            email: email,
            birthDate: _draftBirthDate,
          );
      if (!mounted) {
        return;
      }

      setState(() {
        _customerProfile = updatedCustomer;
        _syncCustomerForm(updatedCustomer, force: true);
      });
      await _syncProfileAfterMutation(updatedCustomer);
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Seu cadastro foi salvo. O painel do salão já recebe essas informações.',
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
        setState(() => _savingProfile = false);
      }
    }
  }

  Future<void> _syncProfileAfterMutation(
    CustomerProfile updatedCustomer,
  ) async {
    try {
      await widget.bootstrap.sessionController.refreshAuthenticatedSession();
    } catch (_) {}

    try {
      await _load();
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _customerProfile = updatedCustomer;
        _syncCustomerForm(updatedCustomer, force: true);
        _loading = false;
      });
    }
  }

  Future<void> _pickCustomerBirthDate() async {
    if (_savingProfile) {
      return;
    }

    final now = DateTime.now();
    final initialDate =
        _draftBirthDate != null &&
            !_draftBirthDate!.isAfter(now) &&
            _draftBirthDate!.year >= 1900
        ? _draftBirthDate!
        : DateTime(now.year - 25, now.month, now.day);
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900, 1, 1),
      lastDate: DateTime(now.year, now.month, now.day),
      helpText: 'Data de nascimento',
      confirmText: 'Salvar',
      cancelText: 'Cancelar',
    );

    if (pickedDate == null || !mounted) {
      return;
    }

    setState(() => _draftBirthDate = pickedDate);
  }

  Future<void> _pickCustomerProfileImage(CustomerProfile customer) async {
    if (_savingProfileImage) {
      return;
    }

    final selected = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1440,
      requestFullMetadata: false,
    );

    if (selected == null) {
      return;
    }

    setState(() => _savingProfileImage = true);
    try {
      final bytes = await selected.readAsBytes();
      final extension = _extractImageExtension(selected.name);
      final contentType = _resolveImageContentType(extension);
      final updatedCustomer = await widget.bootstrap.profileRepository
          .uploadCustomerProfileImage(
            customer: customer,
            bytes: bytes,
            fileExtension: extension,
            contentType: contentType,
          );
      if (!mounted) {
        return;
      }

      setState(() {
        _customerProfile = updatedCustomer;
      });
      await _syncProfileAfterMutation(updatedCustomer);
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Sua foto de perfil foi atualizada e já aparece no painel do salão.',
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
        setState(() => _savingProfileImage = false);
      }
    }
  }

  Future<void> _removeCustomerProfileImage(CustomerProfile customer) async {
    if (_savingProfileImage) {
      return;
    }

    setState(() => _savingProfileImage = true);
    try {
      final updatedCustomer = await widget.bootstrap.profileRepository
          .removeCustomerProfileImage(customer: customer);
      if (!mounted) {
        return;
      }

      setState(() {
        _customerProfile = updatedCustomer;
      });
      await _syncProfileAfterMutation(updatedCustomer);
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Sua foto foi removida. O painel do salão já recebeu essa atualização.',
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
        setState(() => _savingProfileImage = false);
      }
    }
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

  String? _firstNonEmpty(String? primary, String? fallback) {
    final normalizedPrimary = primary?.trim();
    if (normalizedPrimary != null && normalizedPrimary.isNotEmpty) {
      return normalizedPrimary;
    }

    final normalizedFallback = fallback?.trim();
    if (normalizedFallback != null && normalizedFallback.isNotEmpty) {
      return normalizedFallback;
    }

    return null;
  }

  int _completedProfileFields(CustomerProfile customer) {
    var total = 0;
    if (customer.profileImagePath?.trim().isNotEmpty == true) {
      total += 1;
    }
    if (customer.name.trim().isNotEmpty) {
      total += 1;
    }
    if (customer.phone?.trim().isNotEmpty == true) {
      total += 1;
    }
    if (customer.email?.trim().isNotEmpty == true) {
      total += 1;
    }
    if (customer.birthDate != null) {
      total += 1;
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    final currentSession =
        widget.bootstrap.sessionController.session ?? widget.session;
    final displayCustomer = _customerProfile ?? currentSession.customer;
    final preview = currentSession.landingData?.preview;
    final links = currentSession.landingData?.links;
    final accent = parseHexColor(preview?.brandColor);
    final referralCode = displayCustomer.referralCode?.trim().isNotEmpty == true
        ? displayCustomer.referralCode!.trim()
        : _referral?.referralCode?.trim();
    final privacyPolicyUrl = _firstNonEmpty(
      links?.privacyPolicyUrl,
      widget.bootstrap.environment.defaultPrivacyPolicyUrl,
    );
    final termsOfUseUrl = _firstNonEmpty(
      links?.termsOfUseUrl,
      widget.bootstrap.environment.defaultTermsOfUseUrl,
    );
    final supportUrl = _firstNonEmpty(
      links?.supportUrl,
      widget.bootstrap.environment.defaultSupportUrl,
    );
    final officialWhatsAppUrl = _firstNonEmpty(
      links?.whatsappUrl,
      _whatsAppLinkFromPhone(preview?.whatsappPhone),
    );
    final supportEmail = links?.supportEmail?.trim();
    final supportEmailUrl = supportEmail != null && supportEmail.isNotEmpty
        ? 'mailto:$supportEmail'
        : null;
    final accountDeletionUrl =
        widget.bootstrap.environment.defaultAccountDeletionUrl;
    final completedFields = _completedProfileFields(displayCustomer);

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
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  _ReferralShareCard(
                    accent: accent,
                    referralCode: referralCode,
                    qualifiedCount: _referral?.qualifiedCount ?? 0,
                    availableRewardsCount:
                        _referral?.availableRewardsCount ?? 0,
                    programTitle: _referral?.programTitle,
                    rewardLabel: _referral?.rewardLabel,
                    salonName: preview?.name,
                    joinCode: currentSession.joinCode ?? preview?.joinCode,
                  ),
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionTitle(
                          title: 'Privacidade, termos e suporte',
                          subtitle:
                              'Acesse os documentos do app, os canais de ajuda e o pedido de exclusão quando precisar.',
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            if (officialWhatsAppUrl != null)
                              Tooltip(
                                message: 'Abrir WhatsApp do salão',
                                child: OutlinedButton.icon(
                                  onPressed: () =>
                                      _openUrl(officialWhatsAppUrl),
                                  icon: const Icon(Icons.chat_rounded),
                                  label: const Text('WhatsApp do salão'),
                                ),
                              ),
                            if (privacyPolicyUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openUrl(privacyPolicyUrl),
                                icon: const Icon(Icons.privacy_tip_rounded),
                                label: const Text('Política de privacidade'),
                              ),
                            if (termsOfUseUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openUrl(termsOfUseUrl),
                                icon: const Icon(Icons.description_rounded),
                                label: const Text('Termos de uso'),
                              ),
                            if (supportUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openUrl(supportUrl),
                                icon: const Icon(Icons.support_agent_rounded),
                                label: const Text('Central de suporte'),
                              ),
                            if (supportEmailUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openUrl(supportEmailUrl),
                                icon: const Icon(Icons.mail_rounded),
                                label: const Text('E-mail de suporte'),
                              ),
                            if (accountDeletionUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openUrl(accountDeletionUrl),
                                icon: const Icon(Icons.delete_outline_rounded),
                                label: const Text('Pedir exclusão da conta'),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Esses links ajudam você a entender como o app trata seus dados e como falar com a equipe responsável pelo Salon Fun.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionTitle(
                          title: 'Meu cadastro no salão',
                          subtitle:
                              'Você preenche aqui e o painel recebe sem duplicidade. O salão só complementa se faltar alguma informação.',
                          trailing: Pill(
                            label: '$completedFields/5 campos prontos',
                            icon: Icons.verified_user_rounded,
                            backgroundColor: accent.withValues(alpha: 0.12),
                            foregroundColor: accent,
                          ),
                        ),
                        const SizedBox(height: 16),
                        _ProfileMetricGrid(
                          children: [
                            _ProfileStatusCard(
                              icon: displayCustomer.profileImagePath == null
                                  ? Icons.add_a_photo_outlined
                                  : Icons.verified_rounded,
                              title: 'Foto',
                              value: displayCustomer.profileImagePath == null
                                  ? 'Pendente'
                                  : 'Pronta',
                              tone: displayCustomer.profileImagePath == null
                                  ? AppTheme.accent
                                  : AppTheme.secondary,
                            ),
                            _ProfileStatusCard(
                              icon: displayCustomer.birthDate == null
                                  ? Icons.cake_outlined
                                  : Icons.cake_rounded,
                              title: 'Aniversário',
                              value: displayCustomer.birthDate == null
                                  ? 'Pendente'
                                  : 'Salvo',
                              tone: accent,
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        _ProfileSubsectionLabel(
                          icon: Icons.account_circle_rounded,
                          title: 'Identidade do cliente',
                          subtitle:
                              'Foto e dados principais que o salão usa para te reconhecer rapidamente.',
                        ),
                        const SizedBox(height: 18),
                        _ProfileFeatureStack(
                          children: [
                            _CustomerAvatarEditor(
                              accent: accent,
                              customer: displayCustomer,
                              isBusy: _savingProfileImage,
                              onUpload: () =>
                                  _pickCustomerProfileImage(displayCustomer),
                              onRemove: displayCustomer.profileImagePath == null
                                  ? null
                                  : () => _removeCustomerProfileImage(
                                      displayCustomer,
                                    ),
                            ),
                            _BirthDateEditorCard(
                              accent: accent,
                              birthDate: _draftBirthDate,
                              onSelect: _pickCustomerBirthDate,
                              onClear: _draftBirthDate == null
                                  ? null
                                  : () =>
                                        setState(() => _draftBirthDate = null),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        _ProfileSubsectionLabel(
                          icon: Icons.perm_contact_calendar_rounded,
                          title: 'Contato e cadastro',
                          subtitle:
                              'Esses dados alimentam o painel, os agendamentos e a comunicação oficial do salão.',
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _customerNameController,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Nome no cadastro',
                            helperText:
                                'Esse nome aparece no painel, nos agendamentos e no histórico do salão.',
                            prefixIcon: Icon(Icons.badge_rounded),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _ProfileMetricGrid(
                          children: [
                            TextField(
                              controller: _customerPhoneController,
                              keyboardType: TextInputType.phone,
                              decoration: const InputDecoration(
                                labelText: 'Telefone principal',
                                helperText:
                                    'Use o número principal para confirmação e atendimento.',
                                prefixIcon: Icon(Icons.phone_rounded),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _customerEmailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'E-mail do cadastro',
                            helperText:
                                'Opcional. Ajuda o salão a localizar e validar seu cadastro.',
                            prefixIcon: Icon(Icons.mail_rounded),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: AsyncButton(
                            label: 'Salvar meu cadastro',
                            isBusy: _savingProfile,
                            icon: Icons.save_rounded,
                            onPressed: () =>
                                _saveCustomerProfile(displayCustomer),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            ToneIconBadge(
                              icon: Icons.logout_rounded,
                              tone: AppTheme.secondary,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Acesso do app',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleSmall,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Seu cadastro continua salvo no salão mesmo quando você sair desta conta.',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Align(
                          alignment: Alignment.centerRight,
                          child: OutlinedButton.icon(
                            onPressed:
                                widget.bootstrap.sessionController.signOut,
                            icon: const Icon(Icons.logout_rounded),
                            label: const Text('Sair'),
                          ),
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

class _CustomerAvatarEditor extends StatelessWidget {
  const _CustomerAvatarEditor({
    required this.accent,
    required this.customer,
    required this.isBusy,
    required this.onUpload,
    required this.onRemove,
  });

  final Color accent;
  final CustomerProfile customer;
  final bool isBusy;
  final VoidCallback onUpload;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              _CustomerProfileAvatar(
                imageUrl: customer.profileImageUrl,
                name: customer.name,
                size: 86,
                accent: accent,
              ),
              if (isBusy)
                Container(
                  width: 86,
                  height: 86,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(28),
                  ),
                  alignment: Alignment.center,
                  child: const SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Foto de perfil do cliente',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  customer.profileImagePath == null
                      ? 'Escolha uma foto sua para o painel do salão te reconhecer mais rápido.'
                      : 'Essa mesma foto aparece no cadastro do cliente dentro do painel.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: isBusy ? null : onUpload,
                      icon: const Icon(Icons.photo_library_rounded),
                      label: Text(
                        customer.profileImagePath == null
                            ? 'Escolher foto'
                            : 'Trocar foto',
                      ),
                    ),
                    if (onRemove != null)
                      OutlinedButton.icon(
                        onPressed: isBusy ? null : onRemove,
                        icon: const Icon(Icons.delete_outline_rounded),
                        label: const Text('Remover'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BirthDateEditorCard extends StatelessWidget {
  const _BirthDateEditorCard({
    required this.accent,
    required this.birthDate,
    required this.onSelect,
    required this.onClear,
  });

  final Color accent;
  final DateTime? birthDate;
  final VoidCallback onSelect;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ToneIconBadge(icon: Icons.cake_rounded, tone: accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Data de nascimento',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      birthDate == null
                          ? 'Ainda não informada'
                          : formatNumericDate(birthDate!),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            birthDate == null
                ? 'O salão usa essa data para reconhecer seu aniversário e preparar a mensagem especial na home.'
                : 'Se o salão ativar a homenagem de aniversário, ela cruza com esta data automaticamente.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: onSelect,
                icon: const Icon(Icons.edit_calendar_rounded),
                label: Text(
                  birthDate == null ? 'Escolher data' : 'Atualizar data',
                ),
              ),
              if (onClear != null)
                OutlinedButton.icon(
                  onPressed: onClear,
                  icon: const Icon(Icons.delete_outline_rounded),
                  label: const Text('Remover data'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileSubsectionLabel extends StatelessWidget {
  const _ProfileSubsectionLabel({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ToneIconBadge(icon: icon, tone: AppTheme.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _CustomerProfileAvatar extends StatelessWidget {
  const _CustomerProfileAvatar({
    required this.imageUrl,
    required this.name,
    required this.size,
    required this.accent,
  });

  final String? imageUrl;
  final String name;
  final double size;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl?.trim().isNotEmpty == true;
    final initials = _buildInitials(name);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.32),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.18), AppTheme.panel],
        ),
        border: Border.all(color: AppTheme.line),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.14),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: hasImage
          ? SalonNetworkImage(
              imageUrl: imageUrl!,
              fit: BoxFit.cover,
              error: _AvatarFallback(initials: initials, accent: accent),
            )
          : _AvatarFallback(initials: initials, accent: accent),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.initials, required this.accent});

  final String initials;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: accent.withValues(alpha: 0.10),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: AppTheme.ink,
          fontWeight: FontWeight.w800,
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

class _ProfileFeatureStack extends StatelessWidget {
  const _ProfileFeatureStack({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 760) {
          return Column(
            children: [
              for (var index = 0; index < children.length; index++) ...[
                children[index],
                if (index != children.length - 1) const SizedBox(height: 12),
              ],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var index = 0; index < children.length; index++) ...[
              Expanded(child: children[index]),
              if (index != children.length - 1) const SizedBox(width: 12),
            ],
          ],
        );
      },
    );
  }
}

class _ProfileStatusCard extends StatelessWidget {
  const _ProfileStatusCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.tone,
  });

  final IconData icon;
  final String title;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        children: [
          ToneIconBadge(icon: icon, tone: tone),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReferralShareCard extends StatelessWidget {
  const _ReferralShareCard({
    required this.accent,
    required this.referralCode,
    required this.qualifiedCount,
    required this.availableRewardsCount,
    required this.programTitle,
    required this.rewardLabel,
    required this.salonName,
    required this.joinCode,
  });

  final Color accent;
  final String? referralCode;
  final int qualifiedCount;
  final int availableRewardsCount;
  final String? programTitle;
  final String? rewardLabel;
  final String? salonName;
  final String? joinCode;

  @override
  Widget build(BuildContext context) {
    final normalizedCode = referralCode?.trim();
    final hasReferralCode = normalizedCode != null && normalizedCode.isNotEmpty;
    final qrPayload = hasReferralCode
        ? _buildReferralQrPayload(
            referralCode: normalizedCode,
            salonName: salonName,
            joinCode: joinCode,
          )
        : null;

    return SalonPanel(
      accent: AppTheme.accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ToneIconBadge(
                icon: Icons.campaign_rounded,
                tone: AppTheme.accent,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Indicação organizada',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SectionTitle(
            title: 'Indique e ganhe',
            subtitle: hasReferralCode
                ? 'Mostre o QR code ou compartilhe o código para deixar sua indicação pronta em qualquer atendimento.'
                : 'Seu código de indicação aparece aqui assim que o programa estiver ativo.',
            trailing: Pill(
              label: hasReferralCode ? 'QR liberado' : 'Em preparação',
              icon: hasReferralCode
                  ? Icons.qr_code_2_rounded
                  : Icons.hourglass_bottom_rounded,
              backgroundColor: accent.withValues(alpha: 0.12),
              foregroundColor: accent,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: '$qualifiedCount indicações',
                icon: Icons.people_alt_rounded,
              ),
              Pill(
                label: '$availableRewardsCount recompensas',
                icon: Icons.card_giftcard_rounded,
                backgroundColor: AppTheme.secondary.withValues(alpha: 0.16),
                foregroundColor: AppTheme.secondary,
              ),
              if (programTitle?.trim().isNotEmpty == true)
                Pill(label: programTitle!.trim(), icon: Icons.campaign_rounded),
            ],
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final stacked = constraints.maxWidth < 430;
              final codeBlock = _ReferralCodeBlock(
                referralCode: normalizedCode,
                rewardLabel: rewardLabel,
              );
              final qrBlock = _ReferralQrBlock(
                qrPayload: qrPayload,
                accent: accent,
              );

              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [codeBlock, const SizedBox(height: 14), qrBlock],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: codeBlock),
                  const SizedBox(width: 14),
                  qrBlock,
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ReferralCodeBlock extends StatelessWidget {
  const _ReferralCodeBlock({
    required this.referralCode,
    required this.rewardLabel,
  });

  final String? referralCode;
  final String? rewardLabel;

  @override
  Widget build(BuildContext context) {
    final hasReferralCode =
        referralCode != null && referralCode!.trim().isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Seu código', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          Text(
            hasReferralCode ? referralCode! : 'Em preparação',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
              fontSize: 28,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            hasReferralCode
                ? 'Quem escanear o QR code vê o código certo para informar ao salão.'
                : 'Assim que o programa de indicação estiver ativo, o código aparece aqui automaticamente.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (rewardLabel?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(
              rewardLabel!.trim(),
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _ReferralQrBlock extends StatelessWidget {
  const _ReferralQrBlock({required this.qrPayload, required this.accent});

  final String? qrPayload;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final hasQr = qrPayload != null && qrPayload!.trim().isNotEmpty;
    return Container(
      width: 170,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.panel.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        children: [
          Container(
            width: 138,
            height: 138,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.line),
              boxShadow: [
                BoxShadow(
                  color: accent.withValues(alpha: 0.10),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: hasQr
                ? QrImageView(
                    key: const ValueKey('profile-referral-qr'),
                    data: qrPayload!,
                    size: 112,
                    backgroundColor: Colors.white,
                    eyeStyle: const QrEyeStyle(
                      eyeShape: QrEyeShape.square,
                      color: AppTheme.ink,
                    ),
                    dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: AppTheme.ink,
                    ),
                  )
                : Icon(
                    Icons.qr_code_2_rounded,
                    size: 56,
                    color: accent.withValues(alpha: 0.5),
                  ),
          ),
          const SizedBox(height: 12),
          Text(
            hasQr ? 'QR code pronto' : 'QR aguardando código',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text(
            hasQr
                ? 'Escaneie para visualizar o código de indicação com contexto do salão.'
                : 'O QR aparece automaticamente quando houver um código válido.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

String _buildReferralQrPayload({
  required String referralCode,
  required String? salonName,
  required String? joinCode,
}) {
  final normalizedSalonName = salonName?.trim();
  final normalizedJoinCode = joinCode?.trim().toUpperCase();
  final buffer = StringBuffer()
    ..writeln('Codigo de indicacao Salon Fun')
    ..writeln('Codigo: $referralCode');

  if (normalizedSalonName != null && normalizedSalonName.isNotEmpty) {
    buffer.writeln('Salao: $normalizedSalonName');
  }

  if (normalizedJoinCode != null && normalizedJoinCode.isNotEmpty) {
    buffer.writeln('Codigo do salao: $normalizedJoinCode');
  }

  buffer.write('Use esse codigo no app cliente para validar a indicação.');
  return buffer.toString();
}

String _normalizePhoneDigits(String? value) {
  return value?.replaceAll(RegExp(r'\D'), '') ?? '';
}

String? _whatsAppLinkFromPhone(String? value) {
  final digits = _normalizePhoneDigits(value);
  if (digits.isEmpty) {
    return null;
  }

  return 'https://wa.me/$digits';
}

String? _formatPhone(String? value) {
  final digits = _normalizePhoneDigits(value);
  if (digits.isEmpty) {
    return null;
  }

  if (digits.length == 13 && digits.startsWith('55')) {
    return '+55 (${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9)}';
  }

  if (digits.length == 12 && digits.startsWith('55')) {
    return '+55 (${digits.substring(2, 4)}) ${digits.substring(4, 8)}-${digits.substring(8)}';
  }

  if (digits.length == 11) {
    return '(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}';
  }

  if (digits.length == 10) {
    return '(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}';
  }

  return digits;
}

bool _sameDateOnly(DateTime? left, DateTime? right) {
  if (left == null && right == null) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  return left.year == right.year &&
      left.month == right.month &&
      left.day == right.day;
}

String _buildInitials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) {
    return 'CL';
  }
  if (parts.length == 1) {
    final word = parts.first;
    return word.substring(0, word.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
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
