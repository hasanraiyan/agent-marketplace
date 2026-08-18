import 'package:flutter/material.dart';
import 'package:persona_agent_client/persona_agent_client.dart';

import '../theme/persona_chat_theme.dart';

/// Side panel showing the agent's virtual workspace files, its plan
/// (todos), and (optionally) uploaded files / long-term memory, if those
/// controllers are wired in. Mirrors `PersonaFilesDrawer.tsx`, scoped to a
/// Flutter `Drawer`/end-drawer instead of a slide-over panel.
class PersonaFilesDrawer extends StatefulWidget {
  const PersonaFilesDrawer({
    super.key,
    required this.workspaceFiles,
    required this.todos,
    this.files = const [],
    this.memory,
    this.onOpenWorkspaceFile,
    this.isFilesLoading = false,
    this.isMemoryLoading = false,
  });

  final Map<String, PersonaWorkspaceFile> workspaceFiles;
  final List<PersonaTodo> todos;
  final List<PersonaFileItem> files;
  final PersonaMemoryList? memory;
  final ValueChanged<String>? onOpenWorkspaceFile;
  final bool isFilesLoading;
  final bool isMemoryLoading;

  @override
  State<PersonaFilesDrawer> createState() => _PersonaFilesDrawerState();
}

class _PersonaFilesDrawerState extends State<PersonaFilesDrawer> with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = PersonaChatTheme.of(context);

    return Drawer(
      backgroundColor: theme.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TabBar(
              controller: _tabController,
              labelColor: theme.text,
              unselectedLabelColor: theme.text.withValues(alpha: 0.4),
              indicatorColor: theme.primary,
              tabs: const [
                Tab(text: 'Workspace'),
                Tab(text: 'Files'),
                Tab(text: 'Memory'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [_buildWorkspace(theme), _buildFiles(theme), _buildMemory(theme)],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkspace(PersonaChatTheme theme) {
    if (widget.workspaceFiles.isEmpty && widget.todos.isEmpty) {
      return _EmptyState(theme: theme, icon: Icons.folder_open_outlined, label: 'No workspace files yet');
    }
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        if (widget.todos.isNotEmpty) ...[
          Text('PLAN', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          for (final todo in widget.todos)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Icon(
                    todo.status == 'completed' ? Icons.check_circle : Icons.circle_outlined,
                    size: 14,
                    color: todo.status == 'completed' ? Colors.green : theme.text.withValues(alpha: 0.3),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(todo.content, style: TextStyle(color: theme.text, fontSize: 12))),
                ],
              ),
            ),
          const SizedBox(height: 16),
        ],
        if (widget.workspaceFiles.isNotEmpty) ...[
          Text('FILES', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          for (final entry in widget.workspaceFiles.entries)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.description_outlined, size: 18, color: theme.text.withValues(alpha: 0.6)),
              title: Text(entry.key, style: TextStyle(color: theme.text, fontSize: 12)),
              subtitle: Text('${entry.value.size} bytes', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10)),
              onTap: () => widget.onOpenWorkspaceFile?.call(entry.key),
            ),
        ],
      ],
    );
  }

  Widget _buildFiles(PersonaChatTheme theme) {
    if (widget.isFilesLoading) return const Center(child: CircularProgressIndicator());
    if (widget.files.isEmpty) return _EmptyState(theme: theme, icon: Icons.upload_file_outlined, label: 'No uploaded files');
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: widget.files.length,
      itemBuilder: (context, index) {
        final file = widget.files[index];
        return ListTile(
          dense: true,
          leading: Icon(Icons.insert_drive_file_outlined, size: 18, color: theme.text.withValues(alpha: 0.6)),
          title: Text(file.originalName, style: TextStyle(color: theme.text, fontSize: 12)),
          subtitle: Text('${(file.size / 1024).toStringAsFixed(1)} KB', style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10)),
        );
      },
    );
  }

  Widget _buildMemory(PersonaChatTheme theme) {
    if (widget.isMemoryLoading) return const Center(child: CircularProgressIndicator());
    final memory = widget.memory;
    if (memory == null || (memory.userFiles.isEmpty && memory.agentMemories.isEmpty)) {
      return _EmptyState(theme: theme, icon: Icons.psychology_outlined, label: 'No memory files yet');
    }
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        for (final file in memory.userFiles)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.psychology_outlined, size: 18, color: theme.text.withValues(alpha: 0.6)),
            title: Text(file.path, style: TextStyle(color: theme.text, fontSize: 12)),
          ),
        for (final group in memory.agentMemories) ...[
          Text(
            (group.agentName ?? group.agentId).toUpperCase(),
            style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 10, fontWeight: FontWeight.bold),
          ),
          for (final file in group.files)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.psychology_outlined, size: 18, color: theme.text.withValues(alpha: 0.6)),
              title: Text(file.path, style: TextStyle(color: theme.text, fontSize: 12)),
            ),
        ],
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.theme, required this.icon, required this.label});

  final PersonaChatTheme theme;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 32, color: theme.text.withValues(alpha: 0.25)),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: theme.text.withValues(alpha: 0.4), fontSize: 12)),
        ],
      ),
    );
  }
}
