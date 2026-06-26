class KnowledgeDocumentModel {
  const KnowledgeDocumentModel({
    required this.id,
    required this.sourceName,
    required this.fileType,
    required this.createdAt,
    this.size,
  });

  final String id;
  final String sourceName;
  final String fileType;
  final DateTime createdAt;
  final int? size; // bytes

  factory KnowledgeDocumentModel.fromJson(Map<String, dynamic> json) {
    return KnowledgeDocumentModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      sourceName: json['sourceName'] as String? ?? '',
      fileType: json['fileType'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      size: json['size'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sourceName': sourceName,
        'fileType': fileType,
        'createdAt': createdAt.toIso8601String(),
        if (size != null) 'size': size,
      };
}

class KnowledgeBaseModel {
  const KnowledgeBaseModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.description,
    required this.documentCount,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String description;
  final int documentCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory KnowledgeBaseModel.fromJson(Map<String, dynamic> json) {
    return KnowledgeBaseModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      documentCount: json['documentCount'] as int? ?? 0,
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
      'name': name,
      'description': description,
      'documentCount': documentCount,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
