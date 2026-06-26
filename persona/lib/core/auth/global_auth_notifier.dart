import 'package:flutter/foundation.dart';

/// Single source of truth for Clerk authentication status that the GoRouter
/// [refreshListenable] can observe.
///
/// Updated by [ClerkAuthBridge] whenever [ClerkAuthState] notifies.
/// GoRouter re-evaluates its redirect guard every time this notifier fires.
final ValueNotifier<bool> globalAuthNotifier = ValueNotifier<bool>(false);
