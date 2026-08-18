import 'package:flutter/material.dart';

import '../theme/persona_chat_theme.dart';

/// A pulsing placeholder box — mirrors `PersonaSkeleton.tsx`'s CSS
/// `animate-pulse` box, used while thread history/files/memory are loading.
class PersonaSkeleton extends StatefulWidget {
  const PersonaSkeleton({super.key, this.width, this.height = 14, this.borderRadius = 8});

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<PersonaSkeleton> createState() => _PersonaSkeletonState();
}

class _PersonaSkeletonState extends State<PersonaSkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.4, end: 0.9).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    return FadeTransition(
      opacity: _opacity,
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(color: theme.border, borderRadius: BorderRadius.circular(widget.borderRadius)),
      ),
    );
  }
}

/// A placeholder row for one message bubble — matches the size/position a
/// real [PersonaMessageBubble] would occupy, so the message feed doesn't
/// visibly jump when real content replaces it.
class PersonaMessageSkeleton extends StatelessWidget {
  const PersonaMessageSkeleton({super.key, this.isUser = false});

  final bool isUser;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [PersonaSkeleton(width: isUser ? 140 : 220, height: 40, borderRadius: 16)],
      ),
    );
  }
}

/// A placeholder row for one file/memory list item.
class PersonaFileSkeletonRow extends StatelessWidget {
  const PersonaFileSkeletonRow({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          PersonaSkeleton(width: 24, height: 24, borderRadius: 6),
          SizedBox(width: 10),
          Expanded(child: PersonaSkeleton(height: 12)),
        ],
      ),
    );
  }
}
