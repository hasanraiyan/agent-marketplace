import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../../../core/router/route_names.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/config/storage_keys.dart';
import '../../../../core/storage/local_storage.dart';
import '../../../../shared/widgets/app_button.dart';

class _OnboardingSlide {
  const _OnboardingSlide({
    required this.assetPath,
    required this.fallbackIcon,
    required this.title,
    required this.subtitle,
  });
  final String assetPath;
  final IconData fallbackIcon;
  final String title;
  final String subtitle;
}

const _slides = [
  _OnboardingSlide(
    assetPath: 'assets/images/onboarding_1.png',
    fallbackIcon: Icons.explore_rounded,
    title: 'Discover AI Agents',
    subtitle:
        'Browse our marketplace to find specialized agents for coding, writing, research, and creative workflows.',
  ),
  _OnboardingSlide(
    assetPath: 'assets/images/onboarding_2.png',
    fallbackIcon: Icons.chat_bubble_rounded,
    title: 'Chat & Collaborate',
    subtitle:
        'Engage in real-time conversations. Stream trace logs and watch your agents plan, search, and call tools.',
  ),
  _OnboardingSlide(
    assetPath: 'assets/images/onboarding_3.png',
    fallbackIcon: Icons.settings_suggest_rounded,
    title: 'Customize & Expand',
    subtitle:
        'Bring your own LLM keys, configure Model Context Protocol (MCP) servers, and customize agent skills.',
  ),
];

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _currentIndex = 0;

  Future<void> _finish() async {
    await LocalStorage.setBool(StorageKeys.onboardingComplete, value: true);
    if (!mounted) return;
    context.go(RouteNames.splash);
  }

  Future<void> _signIn() async {
    await LocalStorage.setBool(StorageKeys.onboardingComplete, value: true);
    if (!mounted) return;
    context.go(RouteNames.login);
  }

  void _next() {
    if (_currentIndex < _slides.length - 1) {
      if (_controller.hasClients) {
        _controller.nextPage(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
        );
      } else {
        setState(() {
          _currentIndex++;
        });
      }
    } else {
      _finish();
    }
  }

  void _goToPage(int index) {
    if (_controller.hasClients) {
      _controller.animateToPage(
        index,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.backgroundDark
          : AppColors.backgroundLight,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isTablet = constraints.maxWidth > 600;
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            if (isTablet && isLandscape) {
              return _buildTabletLayout(isDark);
            } else {
              return _buildMobileLayout(isDark);
            }
          },
        ),
      ),
    );
  }

  // ── Tablet Layout (Split Screen) ───────────────────────────────────────────
  Widget _buildTabletLayout(bool isDark) {
    final s = _slides[_currentIndex];

    return Row(
      children: [
        // Left side: Large Illustration Area
        Expanded(
          flex: 5,
          child: Container(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final dynamicSize =
                    (constraints.maxWidth < constraints.maxHeight
                        ? constraints.maxWidth
                        : constraints.maxHeight) *
                    0.8;
                return Center(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 400),
                    child: KeyedSubtree(
                      key: ValueKey(_currentIndex),
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: _AdaptiveImage(
                          assetPath: s.assetPath,
                          fallbackIcon: s.fallbackIcon,
                          size: dynamicSize,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),

        // Right side: Info Card and Navigation
        Expanded(
          flex: 4,
          child: Container(
            padding: const EdgeInsets.all(40),
            child: CustomScrollView(
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Skip Button
                      Align(
                        alignment: Alignment.topRight,
                        child: TextButton(
                          onPressed: _finish,
                          child: Text(
                            'Skip',
                            style: AppTypography.labelMedium.copyWith(
                              color: isDark
                                  ? AppColors.textSecondaryDark
                                  : AppColors.textSecondaryLight,
                            ),
                          ),
                        ),
                      ),

                      const Spacer(),

                      // Title & Subtitle
                      Text(
                            s.title,
                            style: AppTypography.headlineMedium.copyWith(
                              fontSize: 28.sp.clamp(20.0, 32.0),
                            ),
                          )
                          .animate()
                          .fadeIn(duration: 400.ms)
                          .slideX(begin: 0.1, end: 0),

                      const SizedBox(height: 16),

                      Text(
                        s.subtitle,
                        style: AppTypography.bodyMedium.copyWith(
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                          height: 1.6,
                          fontSize: 16.sp.clamp(14.0, 18.0),
                        ),
                      ).animate().fadeIn(delay: 100.ms, duration: 400.ms),

                      const SizedBox(height: 36),

                      // Page Indicator Dots
                      Row(
                        children: List.generate(_slides.length, (i) {
                          final isActive = i == _currentIndex;
                          return GestureDetector(
                            onTap: () => _goToPage(i),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              width: isActive ? 24 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: isActive
                                    ? (isDark
                                          ? AppColors.primaryDark
                                          : AppColors.primaryLight)
                                    : (isDark
                                          ? AppColors.dividerDark
                                          : AppColors.dividerDark.withValues(alpha: 0.3)),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          );
                        }),
                      ),

                      const Spacer(),

                      // Buttons
                      AppButton(
                        label: _currentIndex == _slides.length - 1
                            ? 'Get Started'
                            : 'Continue',
                        onPressed: _next,
                      ),

                      const SizedBox(height: 16),

                      _buildSignInLink(isDark),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Mobile Layout (Stacked Vertical) ───────────────────────────────────────
  Widget _buildMobileLayout(bool isDark) {
    final isLast = _currentIndex == _slides.length - 1;
    final isTablet = MediaQuery.of(context).size.width > 600;

    return Column(
      children: [
        // Skip Button
        Align(
          alignment: Alignment.topRight,
          child: Padding(
            padding: const EdgeInsets.only(right: 16, top: 8),
            child: TextButton(
              onPressed: _finish,
              child: Text(
                'Skip',
                style: AppTypography.labelMedium.copyWith(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                ),
              ),
            ),
          ),
        ),

        // Page Content containing Illustration & Text
        Expanded(
          child: PageView.builder(
            controller: _controller,
            onPageChanged: (i) => setState(() => _currentIndex = i),
            itemCount: _slides.length,
            itemBuilder: (context, index) {
              final s = _slides[index];
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 20),
                    _AdaptiveImage(
                      assetPath: s.assetPath,
                      fallbackIcon: s.fallbackIcon,
                      size: isTablet ? 320 : 240,
                    ),
                    const SizedBox(height: 32),
                    Text(
                      s.title,
                      style: AppTypography.headlineMedium.copyWith(
                        fontSize: isTablet ? 26 : 22,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      s.subtitle,
                      style: AppTypography.bodyMedium.copyWith(
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                        height: 1.5,
                        fontSize: isTablet ? 15 : 13,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              );
            },
          ),
        ),

        // Dots & CTA Buttons
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Page Indicator Dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_slides.length, (i) {
                  final isActive = i == _currentIndex;
                  return GestureDetector(
                    onTap: () => _goToPage(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: isActive ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isActive
                            ? (isDark
                                  ? AppColors.primaryDark
                                  : AppColors.primaryLight)
                            : (isDark
                                  ? AppColors.dividerDark
                                  : AppColors.dividerLight),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  );
                }),
              ),

              const SizedBox(height: 24),

              AppButton(
                label: isLast ? 'Get Started' : 'Continue',
                onPressed: _next,
              ),

              const SizedBox(height: 16),

              _buildSignInLink(isDark),

              const SizedBox(height: 8),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSignInLink(bool isDark) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          'Already have an account? ',
          style: AppTypography.bodySmall.copyWith(
            color: isDark
                ? AppColors.textSecondaryDark
                : AppColors.textSecondaryLight,
            fontSize: 13,
          ),
        ),
        GestureDetector(
          onTap: _signIn,
          child: Text(
            'Sign In',
            style: AppTypography.bodySmall.copyWith(
              color: isDark ? AppColors.primaryDark : AppColors.primaryLight,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Adaptive Onboarding Image Fallback ───────────────────────────────────────
class _AdaptiveImage extends StatelessWidget {
  const _AdaptiveImage({
    required this.assetPath,
    required this.fallbackIcon,
    required this.size,
  });

  final String assetPath;
  final IconData fallbackIcon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetPath,
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        // Fallback vector icon styling if the PNG is not yet placed in assets
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.primaryLight.withValues(alpha: 0.08),
            shape: BoxShape.circle,
          ),
          child: Icon(
            fallbackIcon,
            size: size * 0.45,
            color: AppColors.primaryLight,
          ),
        );
      },
    );
  }
}
