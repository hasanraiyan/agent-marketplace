class ProviderModel {
  const ProviderModel({
    required this.id,
    required this.ownerId,
    required this.label,
    required this.baseURL,
    required this.defaultModel,
    required this.isDefault,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String label;
  final String baseURL;
  final String defaultModel;
  final bool isDefault;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory ProviderModel.fromJson(Map<String, dynamic> json) {
    return ProviderModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      label: json['label'] as String? ?? '',
      baseURL: json['baseURL'] as String? ?? '',
      defaultModel: json['defaultModel'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
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
      'label': label,
      'baseURL': baseURL,
      'defaultModel': defaultModel,
      'isDefault': isDefault,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
