import 'dart:convert';

class MemoryProfileModel {
  const MemoryProfileModel({required this.summary, required this.preferences});

  final String summary;
  final Map<String, dynamic> preferences;

  factory MemoryProfileModel.fromJson(Map<String, dynamic> json) {
    final prefs = json['preferences'];
    return MemoryProfileModel(
      summary: json['summary']?.toString() ?? '',
      preferences: prefs is Map
          ? prefs.map((key, value) => MapEntry(key.toString(), value))
          : const {},
    );
  }

  int get itemCount => (summary.trim().isEmpty ? 0 : 1) + preferences.length;
}

class AgentMemoryEntryModel {
  const AgentMemoryEntryModel({
    required this.agentId,
    required this.agentName,
    required this.key,
    required this.value,
    this.createdAt,
    this.updatedAt,
  });

  final String agentId;
  final String agentName;
  final String key;
  final dynamic value;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory AgentMemoryEntryModel.fromJson(Map<String, dynamic> json) {
    return AgentMemoryEntryModel(
      agentId: json['agentId']?.toString() ?? '',
      agentName: json['agentName']?.toString() ?? 'Unknown Agent',
      key: json['key']?.toString() ?? '',
      value: json['value'],
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  String get valueText {
    final current = value;
    if (current == null) return '';
    if (current is String) return current;
    const encoder = JsonEncoder.withIndent('  ');
    return encoder.convert(current);
  }

  AgentMemoryEntryModel copyWith({
    String? agentId,
    String? agentName,
    String? key,
    dynamic value = _keep,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return AgentMemoryEntryModel(
      agentId: agentId ?? this.agentId,
      agentName: agentName ?? this.agentName,
      key: key ?? this.key,
      value: value == _keep ? this.value : value,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  static const Object _keep = Object();
}

class MemoryDataModel {
  const MemoryDataModel({required this.profile, required this.agentMemories});

  final MemoryProfileModel profile;
  final List<AgentMemoryEntryModel> agentMemories;

  factory MemoryDataModel.fromJson(Map<String, dynamic> json) {
    final memories = json['agentMemories'] as List? ?? [];
    return MemoryDataModel(
      profile: MemoryProfileModel.fromJson(
        json['profile'] as Map<String, dynamic>? ?? const {},
      ),
      agentMemories: memories
          .map(
            (item) =>
                AgentMemoryEntryModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  int get totalCount => profile.itemCount + agentMemories.length;
}
