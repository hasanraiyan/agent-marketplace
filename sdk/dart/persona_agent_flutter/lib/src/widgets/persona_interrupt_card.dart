import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';

/// Renders a paused run — either a human-in-the-loop tool-call approval
/// prompt, or a clarification question form — and calls [onRespond] with
/// the resume payload once the user answers. Mirrors
/// `PersonaInterruptCard.tsx`.
class PersonaInterruptCard extends StatefulWidget {
  const PersonaInterruptCard({
    super.key,
    required this.interrupt,
    required this.onRespond,
    this.isStreaming = false,
  });

  final PersonaInterrupt interrupt;
  final void Function(PersonaResumeValue resume, String displayContent) onRespond;
  final bool isStreaming;

  @override
  State<PersonaInterruptCard> createState() => _PersonaInterruptCardState();
}

class _PersonaInterruptCardState extends State<PersonaInterruptCard> {
  int _currentQuestion = 0;
  String? _selectedOption;
  final _customController = TextEditingController();

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    final interrupt = widget.interrupt;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.border),
      ),
      child: switch (interrupt) {
        PersonaHitlInterrupt() => _buildHitl(theme, interrupt),
        PersonaClarificationInterrupt() => _buildClarification(theme, interrupt),
      },
    );
  }

  Widget _buildHitl(PersonaChatTheme theme, PersonaHitlInterrupt interrupt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(Icons.pan_tool_alt_outlined, size: 18, color: theme.text),
            const SizedBox(width: 8),
            Text(
              'Approval needed',
              style: TextStyle(color: theme.text, fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final request in interrupt.actionRequests)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              '${request.name}${request.args != null ? ' — ${request.args}' : ''}',
              style: TextStyle(color: theme.text.withValues(alpha: 0.8), fontSize: 12, fontFamily: 'monospace'),
            ),
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: widget.isStreaming ? null : () => _respondHitl(reject: true),
                child: const Text('Reject'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: widget.isStreaming ? null : () => _respondHitl(reject: false),
                style: FilledButton.styleFrom(backgroundColor: theme.primary, foregroundColor: theme.primaryText),
                child: const Text('Approve'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _respondHitl({required bool reject}) {
    final decisions = List.generate(
      widget.interrupt is PersonaHitlInterrupt
          ? (widget.interrupt as PersonaHitlInterrupt).actionRequests.length
          : 0,
      (_) => PersonaHitlDecision(
        type: reject ? PersonaHitlDecisionType.reject : PersonaHitlDecisionType.approve,
      ),
    );
    widget.onRespond(PersonaDecisionsResume(decisions), reject ? 'Rejected' : 'Approved');
  }

  Widget _buildClarification(PersonaChatTheme theme, PersonaClarificationInterrupt interrupt) {
    final question = interrupt.questions[_currentQuestion];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(Icons.help_outline_rounded, size: 18, color: theme.text),
            const SizedBox(width: 8),
            Text(
              'Question ${_currentQuestion + 1} of ${interrupt.questions.length}',
              style: TextStyle(color: theme.text.withValues(alpha: 0.6), fontSize: 11),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(question.text, style: TextStyle(color: theme.text, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 10),
        for (final option in question.options)
          _OptionRow(
            label: option,
            selected: _selectedOption == option,
            onTap: () => setState(() => _selectedOption = option),
          ),
        if (question.allowCustom)
          TextField(
            controller: _customController,
            style: TextStyle(color: theme.text, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Or type your own answer...',
              hintStyle: TextStyle(color: theme.text.withValues(alpha: 0.4)),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: theme.border),
              ),
            ),
          ),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: widget.isStreaming || (_selectedOption == null && _customController.text.isEmpty)
                ? null
                : () => _submitClarification(interrupt),
            style: FilledButton.styleFrom(backgroundColor: theme.primary, foregroundColor: theme.primaryText),
            child: Text(_currentQuestion < interrupt.questions.length - 1 ? 'Next' : 'Submit'),
          ),
        ),
      ],
    );
  }

  final List<Object?> _answers = [];

  void _submitClarification(PersonaClarificationInterrupt interrupt) {
    final answer = _customController.text.isNotEmpty ? _customController.text : _selectedOption;
    _answers.add(answer);

    if (_currentQuestion < interrupt.questions.length - 1) {
      setState(() {
        _currentQuestion += 1;
        _selectedOption = null;
        _customController.clear();
      });
      return;
    }

    widget.onRespond(PersonaAnswersResume(_answers), _answers.join(', '));
  }
}

/// A single-select option row — avoids `RadioListTile`'s `groupValue`/
/// `onChanged` (deprecated in favor of an ambient `RadioGroup` ancestor
/// introduced after this package's declared minimum Flutter version).
class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              size: 18,
              color: selected ? theme.primary : theme.text.withValues(alpha: 0.4),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: TextStyle(color: theme.text, fontSize: 13))),
          ],
        ),
      ),
    );
  }
}
