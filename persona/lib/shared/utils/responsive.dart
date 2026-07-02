import 'package:flutter/material.dart';

/// Responsive layout helper.
///
/// Usage:
/// ```dart
/// final r = Responsive.of(context);
/// if (r.isTablet) { ... }
/// columns: r.gridColumns
/// ```
class Responsive {
  const Responsive._({
    required this.width,
    required this.height,
  });

  final double width;
  final double height;

  static Responsive of(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return Responsive._(width: size.width, height: size.height);
  }

  // ── Breakpoints ─────────────────────────────────────────────────────────────
  bool get isPhone => width < 600;
  bool get isTablet => width >= 600;
  bool get isLandscape => width > height;
  bool get isPortrait => !isLandscape;

  // ── Columns ─────────────────────────────────────────────────────────────────
  /// General purpose grid columns.
  int get gridColumns {
    if (isTablet && isLandscape) return 3;
    if (isTablet) return 2;
    if (isLandscape) return 2;
    return 1;
  }

  /// Agent card grid — cards are compact, so 2 columns even on phones.
  int get agentGridColumns {
    if (isTablet && isLandscape) return 4;
    if (isTablet) return 3;
    if (isLandscape) return 3;
    return 2;
  }

  // ── Spacing ─────────────────────────────────────────────────────────────────
  double get horizontalPadding => isTablet ? 32.0 : 16.0;
  double get verticalPadding => isTablet ? 24.0 : 16.0;

  // ── Max-width centering for forms / detail pages ─────────────────────────────
  double get formMaxWidth => isTablet ? 640.0 : double.infinity;
  double get contentMaxWidth => isTablet ? 960.0 : double.infinity;
}

/// Wraps [child] in a centred, width-capped container when on a tablet.
///
/// Use for form pages and detail screens so content doesn't stretch
/// wall-to-wall on large screens.
class ResponsiveCenter extends StatelessWidget {
  const ResponsiveCenter({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
  });

  final Widget child;
  final double? maxWidth;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final r = Responsive.of(context);
    final limit = maxWidth ?? r.formMaxWidth;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: limit),
        child: padding != null ? Padding(padding: padding!, child: child) : child,
      ),
    );
  }
}
