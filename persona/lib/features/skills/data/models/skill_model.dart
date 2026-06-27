class SkillCodeSnippet {
  const SkillCodeSnippet({
    required this.filename,
    required this.code,
    required this.language,
  });

  final String filename;
  final String code;
  final String language;

  factory SkillCodeSnippet.fromJson(Map<String, dynamic> json) {
    return SkillCodeSnippet(
      filename: json['filename'] as String? ?? '',
      code: json['code'] as String? ?? '',
      language: json['language'] as String? ?? 'python',
    );
  }

  Map<String, dynamic> toJson() => {
    'filename': filename,
    'code': code,
    'language': language,
  };
}

class SkillModel {
  const SkillModel({
    required this.id,
    required this.ownerId,
    required this.ownerName,
    required this.name,
    required this.description,
    required this.instructions,
    required this.codeSnippets,
    required this.isPublic,
    required this.isOwner,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String ownerName;
  final String name;
  final String description;
  final String instructions;
  final List<SkillCodeSnippet> codeSnippets;
  final bool isPublic;
  final bool isOwner;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory SkillModel.fromJson(Map<String, dynamic> json) {
    final snippetList = json['codeSnippets'] as List? ?? [];
    final owner = json['ownerId'];
    final ownerId = owner is Map
        ? (owner['_id'] ?? owner['id'])?.toString() ?? ''
        : owner?.toString() ?? '';
    final ownerName = owner is Map
        ? (owner['username'] ??
                  owner['name'] ??
                  owner['email'] ??
                  owner['firstName'] ??
                  'Community')
              .toString()
        : '';
    return SkillModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: ownerId,
      ownerName: ownerName,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      instructions: json['instructions'] as String? ?? '',
      codeSnippets: snippetList
          .map((e) => SkillCodeSnippet.fromJson(e as Map<String, dynamic>))
          .toList(),
      isPublic: json['isPublic'] as bool? ?? false,
      isOwner: json['isOwner'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ownerId': ownerId,
      'ownerName': ownerName,
      'name': name,
      'description': description,
      'instructions': instructions,
      'codeSnippets': codeSnippets.map((s) => s.toJson()).toList(),
      'isPublic': isPublic,
      'isOwner': isOwner,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  SkillModel copyWith({
    String? id,
    String? ownerId,
    String? ownerName,
    String? name,
    String? description,
    String? instructions,
    List<SkillCodeSnippet>? codeSnippets,
    bool? isPublic,
    bool? isOwner,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return SkillModel(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      ownerName: ownerName ?? this.ownerName,
      name: name ?? this.name,
      description: description ?? this.description,
      instructions: instructions ?? this.instructions,
      codeSnippets: codeSnippets ?? this.codeSnippets,
      isPublic: isPublic ?? this.isPublic,
      isOwner: isOwner ?? this.isOwner,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
