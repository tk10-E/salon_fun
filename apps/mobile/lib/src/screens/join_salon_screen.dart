import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/salon_repository.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/soft_card.dart';

class JoinSalonScreen extends StatefulWidget {
  const JoinSalonScreen({
    super.key,
    required this.repository,
    required this.onJoined,
  });

  final SalonRepository repository;
  final Future<void> Function() onJoined;

  @override
  State<JoinSalonScreen> createState() => _JoinSalonScreenState();
}

class _JoinSalonScreenState extends State<JoinSalonScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _referralCodeController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);

    try {
      await widget.repository.joinSalon(
        code: _codeController.text,
        customerName: _nameController.text,
        referralCode: _referralCodeController.text,
      );
      await widget.onJoined();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Salão vinculado com sucesso.')),
      );
    } on PostgrestException catch (error) {
      _showMessage(_humanizePostgrestError(error.message));
    } catch (_) {
      _showMessage('Não foi possível vincular ao salão.');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String _humanizePostgrestError(String raw) {
    if (raw.contains('invalid_salon_code')) {
      return 'Código do salão inválido.';
    }
    if (raw.contains('customer_already_linked_to_another_salon')) {
      return 'Esta conta já está vinculada a outro salão.';
    }
    if (raw.contains('customer_name_required')) {
      return 'Informe seu nome.';
    }
    if (raw.contains('invalid_referral_code')) {
      return 'O código de indicação não foi encontrado neste salão.';
    }
    if (raw.contains('referral_program_inactive')) {
      return 'O programa de indicação deste salão não está ativo agora.';
    }
    if (raw.contains('cannot_refer_yourself')) {
      return 'Você não pode usar o próprio código de indicação.';
    }
    if (raw.contains('referral_already_registered')) {
      return 'Esta conta já está ligada a uma indicação neste salão.';
    }
    if (raw.contains('referral_code_too_late')) {
      return 'O código de indicação precisa ser informado antes do primeiro agendamento.';
    }
    return 'Não foi possível vincular ao salão.';
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: AppBackdrop(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500),
                child: Column(
                  children: [
                    SoftCard(
                      padding: const EdgeInsets.all(28),
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFFF4EA), Color(0xFFF4D6BF)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderColor: const Color(0xFFDDBEA7),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 52,
                                height: 52,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.72),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(
                                    color: const Color(0x26A8562D),
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Image.asset(
                                    'assets/branding/app_splash.png',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Código do salão',
                                      style: theme.textTheme.labelLarge,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Ative a experiência personalizada do seu salão',
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        color: const Color(0xFF6B4B3A),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Conecte sua conta ao salão certo.',
                            style: theme.textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Digite o código que você recebeu para ver seus serviços, escolher horários e acompanhar seus agendamentos.',
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: const Color(0xFF5F4334),
                            ),
                          ),
                          const SizedBox(height: 18),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: const Color(0x26A8562D),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.lock_open_rounded,
                                  color: Color(0xFF8E441F),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Exemplo de código: A1B2C3',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: const Color(0xFF5F4334),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.46),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: const Color(0x26A8562D),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.palette_outlined,
                                  color: Color(0xFF8E441F),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Depois do código, o app passa a mostrar a marca, os serviços e a agenda do seu salão.',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: const Color(0xFF5F4334),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    SoftCard(
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Seus dados', style: theme.textTheme.titleLarge),
                          const SizedBox(height: 6),
                          Text(
                            'Preencha seu nome e o código informado pelo salão.',
                            style: theme.textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 22),
                          TextField(
                            controller: _nameController,
                            decoration: const InputDecoration(
                              labelText: 'Seu nome',
                              hintText: 'Maria Silva',
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _codeController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Código do salão',
                              hintText: 'A1B2C3',
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _referralCodeController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Código de indicação (opcional)',
                              hintText: 'INDIQUE8',
                            ),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: _loading ? null : _submit,
                              child: _loading
                                  ? const SizedBox.square(
                                      dimension: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Text('Continuar'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
