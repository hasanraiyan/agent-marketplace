import 'package:clerk_flutter/clerk_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';

/// Hosts the Clerk pre-built authentication UI.
///
/// Shows a branded loading state while the Clerk SDK is initialising
/// (isNotAvailable) so the screen is never blank. Once ready, renders
/// [ClerkAuthentication] which handles sign-in, sign-up, email verification,
/// forgot/reset password, and OAuth.
class AuthPage extends StatelessWidget {
  const AuthPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: ClerkAuthBuilder(
          // While the SDK is still initialising (isNotAvailable == true) the
          // signedOutBuilder fires with no user data — show a spinner instead
          // of handing off to ClerkAuthentication which would render blank.
          signedOutBuilder: (context, authState) {
            if (authState.isNotAvailable) {
              return _buildLoading(isDark);
            }
            return _buildAuthContent(isDark);
          },
          // Signed-in users are redirected by GoRouter; this state should
          // never be visible on AuthPage, but show a spinner just in case.
          signedInBuilder: (context, authState) => _buildLoading(isDark),
        ),
      ),
    );
  }

  Widget _buildAuthContent(bool isDark) {
    return Column(
      children: [
        _buildHeader(isDark),
        Expanded(
          child: ClerkErrorListener(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: const ClerkAuthentication(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoading(bool isDark) {
    return Column(
      children: [
        _buildHeader(isDark),
        Expanded(
          child: Center(
            child: CircularProgressIndicator(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: (isDark ? AppColors.primaryDark : AppColors.primaryLight)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.auto_awesome_rounded,
              size: 32,
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms)
              .scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1)),
          const SizedBox(height: 16),
          Text(
            'Persona.ai',
            style: AppTypography.headlineMedium.copyWith(
              color: isDark
                  ? AppColors.textPrimaryDark
                  : AppColors.textPrimaryLight,
            ),
          ).animate().fadeIn(delay: 100.ms, duration: 400.ms),
          const SizedBox(height: 4),
          Text(
            'Your AI Agent Marketplace',
            style: AppTypography.bodyMedium.copyWith(
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
          ).animate().fadeIn(delay: 150.ms, duration: 400.ms),
        ],
      ),
    );
  }
}
