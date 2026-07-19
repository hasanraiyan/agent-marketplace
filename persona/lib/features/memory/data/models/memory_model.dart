/// File-based memory models.
///
/// Backend returns:
/// ```json
/// {
///   userFiles: [{ scope, path, content, mimeType, createdAt, updatedAt }],
///   agentMemories: [{ agentId, agentName, files: [...] }]
/// }
/// ```
/// Single file write -> PUT /memory/file with { scope, agentId?, path, content }
// ignore_for_file: comment_references
//
library;

class MemoryFileModel {
  const MemoryFileModel({
    required this.scope,
    this.agentId,
    required this.path,
    required this.content,
    this.mimeType = 'text/markdown',
    this.createdAt,
    this.updatedAt,
  });

  final String scope; // 'user' | 'agent'
  final String? agentId;
  final String path;
  final String content;
  final String mimeType;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory MemoryFileModel.fromJson(Map<String, dynamic> json) {
    return MemoryFileModel(
      scope: json['scope']?.toString() ?? 'user',
      agentId: json['agentId']?.toString(),
      path: json['path']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? 'text/markdown',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  String get fileId => '$scope:${agentId ?? ""}:$path';

  MemoryFileModel copyWith({
    String? scope,
    String? agentId,
    String? path,
    String? content,
    String? mimeType,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return MemoryFileModel(
      scope: scope ?? this.scope,
      agentId: agentId ?? this.agentId,
      path: path ?? this.path,
      content: content ?? this.content,
      mimeType: mimeType ?? this.mimeType,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class AgentMemoryGroupModel {
  const AgentMemoryGroupModel({
    required this.agentId,
    this.agentName,
    required this.files,
  });

  final String agentId;
  final String? agentName;
  final List<MemoryFileModel> files;

  factory AgentMemoryGroupModel.fromJson(Map<String, dynamic> json) {
    final rawFiles = json['files'] as List? ?? [];
    return AgentMemoryGroupModel(
      agentId: json['agentId']?.toString() ?? '',
      agentName: json['agentName']?.toString(),
      files: rawFiles
          .map((f) => MemoryFileModel.fromJson(f as Map<String, dynamic>))
          .toList(),
    );
  }

  int get fileCount => files.length;

  AgentMemoryGroupModel copyWith({
    String? agentId,
    String? agentName,
    List<MemoryFileModel>? files,
  }) {
    return AgentMemoryGroupModel(
      agentId: agentId ?? this.agentId,
      agentName: agentName ?? this.agentName,
      files: files ?? this.files,
    );
  }
}

class AllMemoryDataModel {
  const AllMemoryDataModel({
    required this.userFiles,
    required this.agentMemories,
  });

  final List<MemoryFileModel> userFiles;
  final List<AgentMemoryGroupModel> agentMemories;

  factory AllMemoryDataModel.fromJson(Map<String, dynamic> json) {
    final rawUserFiles = json['userFiles'] as List? ?? [];
    final rawAgentMemories = json['agentMemories'] as List? ?? [];
    return AllMemoryDataModel(
      userFiles: rawUserFiles
          .map((f) => MemoryFileModel.fromJson(f as Map<String, dynamic>))
          .toList(),
      agentMemories: rawAgentMemories
          .map((g) => AgentMemoryGroupModel.fromJson(g as Map<String, dynamic>))
          .toList(),
    );
  }

  int get userFileCount => userFiles.length;

  int get agentFileCount =>
      agentMemories.fold(0, (sum, g) => sum + g.files.length);

  int get totalCount => userFileCount + agentFileCount;

  int get agentCount => agentMemories.length;

  /// All memory files flattened into a single list (user files + agent files).
  List<MemoryFileModel> get allFiles => [
        ...userFiles.map((f) => f),
        ...agentMemories.expand((g) => g.files.map(
              (f) => f.copyWith(scope: 'agent', agentId: g.agentId),
            )),
      ];

  /// Whether the given memory file exists (by fileId).
  bool hasFile(MemoryFileModel file) => allFiles.any((f) => f.fileId == file.fileId);
}
