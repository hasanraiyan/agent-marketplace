import 'dart:async';

import 'package:meta/meta.dart';

/// Framework-agnostic base for every stateful controller in this package
/// (`PersonaChatController` and the six simpler CRUD controllers). Built
/// only on `dart:async` — deliberately NOT `ChangeNotifier`, which lives in
/// `package:flutter/foundation.dart` and would make this package unusable
/// outside Flutter.
///
/// Any UI layer subscribes via `stream` (a `StreamBuilder` works directly);
/// a Riverpod `Notifier`/`StreamProvider`, a Bloc, or a plain `Provider` can
/// all wrap this trivially by forwarding `controller.stream` into their own
/// state — no hard dependency on any particular state-management framework.
abstract class PersonaController<S> {
  PersonaController(S initialState) : _state = initialState;

  S _state;
  final StreamController<S> _controller = StreamController<S>.broadcast();

  /// The current state snapshot.
  S get state => _state;

  /// Emits every new state snapshot as it happens. Broadcast — supports any
  /// number of listeners (e.g. multiple widgets watching the same
  /// controller), and late subscribers simply see [state] via their own
  /// initial read rather than through the stream.
  Stream<S> get stream => _controller.stream;

  /// Updates [state] and notifies every listener. Subclasses call this
  /// instead of assigning `_state` directly, so the stream stays in sync.
  @protected
  void emit(S next) {
    _state = next;
    if (!_controller.isClosed) _controller.add(next);
  }

  /// Releases the underlying stream. Call when this controller is no
  /// longer needed (e.g. a widget's `dispose()`).
  @mustCallSuper
  void dispose() {
    _controller.close();
  }
}
