import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';
import 'persona_chat_view.dart';

/// A floating action button that toggles a [PersonaChatView] panel —
/// mirrors `PersonaChatLauncher.tsx`. Unlike the web version (which
/// portals its panel to `document.body`), this returns `Positioned`
/// widgets meant to be the last child of a `Stack` wrapping your app's main
/// content (e.g. `Stack(children: [YourScaffold(), PersonaChatLauncher(...)])`)
/// — there's no DOM-portal equivalent needed since Flutter's own widget
/// tree already composes this way.
class PersonaChatLauncher extends StatefulWidget {
  const PersonaChatLauncher({
    super.key,
    required this.controller,
    this.initiallyOpen = false,
    this.panelWidth = 380,
    this.panelHeight = 560,
  });

  final PersonaChatController controller;
  final bool initiallyOpen;
  final double panelWidth;
  final double panelHeight;

  @override
  State<PersonaChatLauncher> createState() => _PersonaChatLauncherState();
}

class _PersonaChatLauncherState extends State<PersonaChatLauncher> {
  late bool _isOpen = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final media = MediaQuery.of(context);
    final isFullScreen = media.size.width < 640;

    return Stack(
      children: [
        if (_isOpen)
          Positioned(
            right: isFullScreen ? 0 : 24,
            bottom: isFullScreen ? 0 : 88,
            left: isFullScreen ? 0 : null,
            top: isFullScreen ? 0 : null,
            child: Material(
              elevation: 12,
              borderRadius: isFullScreen ? BorderRadius.zero : BorderRadius.circular(20),
              clipBehavior: Clip.antiAlias,
              child: SizedBox(
                width: isFullScreen ? media.size.width : widget.panelWidth,
                height: isFullScreen ? media.size.height : widget.panelHeight,
                child: Stack(
                  children: [
                    PersonaChatView(controller: widget.controller),
                    Positioned(
                      top: isFullScreen ? 40 : 8,
                      right: 8,
                      child: IconButton(
                        icon: const Icon(Icons.close),
                        color: theme.text,
                        style: IconButton.styleFrom(backgroundColor: theme.card),
                        onPressed: () => setState(() => _isOpen = false),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        Positioned(
          right: 24,
          bottom: 24,
          child: FloatingActionButton(
            backgroundColor: theme.primary,
            foregroundColor: theme.primaryText,
            onPressed: () => setState(() => _isOpen = !_isOpen),
            child: Icon(_isOpen ? Icons.close : Icons.chat_bubble_outline),
          ),
        ),
      ],
    );
  }
}
