class KnowledgeDocumentModel {
  const KnowledgeDocumentModel({
    required this.fileName,
    required this.fileSize,
    required this.mimeType,
    required this.chunkCount,
    this.uploadedAt,
  });

  final String fileName;
  final int fileSize;
  final String mimeType;
  final int chunkCount;
  final DateTime? uploadedAt;

  String get id => fileName;
  String get sourceName => fileName;
  String get fileType {
    final parts = fileName.split('.');
    return parts.length > 1 ? parts.last.toLowerCase() : mimeType;
  }

  factory KnowledgeDocumentModel.fromJson(Map<String, dynamic> json) {
    final fallbackName =
        (json['sourceName'] ?? json['name'] ?? json['id'])?.toString() ?? '';
    return KnowledgeDocumentModel(
      fileName: (json['fileName'] ?? fallbackName).toString(),
      fileSize: (json['fileSize'] ?? json['size'] ?? 0) as int? ?? 0,
      mimeType: (json['mimeType'] ?? json['fileType'] ?? '').toString(),
      chunkCount: (json['chunkCount'] ?? 0) as int? ?? 0,
      uploadedAt: json['uploadedAt'] != null || json['createdAt'] != null
          ? DateTime.tryParse(
              (json['uploadedAt'] ?? json['createdAt']).toString(),
            )
          : null,
    );
  }
}

class KnowledgeBaseModel {
  const KnowledgeBaseModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.description,
    required this.documentCount,
    required this.chunkCount,
    required this.embeddingModel,
    required this.chunkSize,
    required this.chunkOverlap,
    required this.topK,
    this.providerId,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String description;
  final int documentCount;
  final int chunkCount;
  final String embeddingModel;
  final String? providerId;
  final int chunkSize;
  final int chunkOverlap;
  final int topK;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory KnowledgeBaseModel.fromJson(Map<String, dynamic> json) {
    return KnowledgeBaseModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      documentCount: json['documentCount'] as int? ?? 0,
      chunkCount: json['chunkCount'] as int? ?? 0,
      embeddingModel:
          json['embeddingModel'] as String? ?? 'text-embedding-3-small',
      providerId: json['providerId']?.toString(),
      chunkSize: json['chunkSize'] as int? ?? 800,
      chunkOverlap: json['chunkOverlap'] as int? ?? 100,
      topK: json['topK'] as int? ?? 5,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  KnowledgeBaseModel copyWith({
    String? id,
    String? ownerId,
    String? name,
    String? description,
    int? documentCount,
    int? chunkCount,
    String? embeddingModel,
    String? providerId,
    int? chunkSize,
    int? chunkOverlap,
    int? topK,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return KnowledgeBaseModel(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      name: name ?? this.name,
      description: description ?? this.description,
      documentCount: documentCount ?? this.documentCount,
      chunkCount: chunkCount ?? this.chunkCount,
      embeddingModel: embeddingModel ?? this.embeddingModel,
      providerId: providerId ?? this.providerId,
      chunkSize: chunkSize ?? this.chunkSize,
      chunkOverlap: chunkOverlap ?? this.chunkOverlap,
      topK: topK ?? this.topK,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
