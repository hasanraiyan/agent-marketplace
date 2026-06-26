class McpModel {
  const McpModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.serverUrl,
    required this.authType,
    this.apiKey,
    this.oauthConnected = false,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String serverUrl;
  final String authType; // 'none' | 'apiKey' | 'oauth'
  final String? apiKey;
  final bool oauthConnected;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory McpModel.fromJson(Map<String, dynamic> json) {
    return McpModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      serverUrl: json['serverUrl'] as String? ?? '',
      authType: json['authType'] as String? ?? 'none',
      apiKey: json['apiKey'] as String?,
      oauthConnected: json['oauthConnected'] as bool? ?? false,
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
      'serverUrl': serverUrl,
      'authType': authType,
      if (apiKey != null) 'apiKey': apiKey,
      'oauthConnected': oauthConnected,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
