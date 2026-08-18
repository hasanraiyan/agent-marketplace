// Smoke test — the example app builds without crashing. No network call
// happens on construction (PersonaChatController only auto-loads history
// when a threadId is supplied, which this example doesn't pass), so this
// is safe to run without a live backend.

import 'package:flutter_test/flutter_test.dart';

import 'package:example/main.dart';

void main() {
  testWidgets('PersonaExampleApp builds and shows the composer', (WidgetTester tester) async {
    await tester.pumpWidget(const PersonaExampleApp());
    await tester.pump();

    expect(find.text('Persona'), findsOneWidget);
    expect(find.text('Ask anything...'), findsOneWidget);
  });
}
