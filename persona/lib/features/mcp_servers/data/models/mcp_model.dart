class McpToolModel {
  const McpToolModel({required this.name, required this.description});

  final String name;
  final String description;

  factory McpToolModel.fromJson(Map<String, dynamic> json) {
    return McpToolModel(
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
    );
  }
}

class McpResourceModel {
  const McpResourceModel({
    required this.uri,
    required this.name,
    required this.description,
    required this.mimeType,
  });

  final String uri;
  final String name;
  final String description;
  final String mimeType;

  factory McpResourceModel.fromJson(Map<String, dynamic> json) {
    return McpResourceModel(
      uri: json['uri']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? '',
    );
  }
}

class McpResourceTemplateModel {
  const McpResourceTemplateModel({
    required this.uriTemplate,
    required this.name,
    required this.description,
    required this.mimeType,
    required this.toolName,
  });

  final String uriTemplate;
  final String name;
  final String description;
  final String mimeType;
  final String toolName;

  factory McpResourceTemplateModel.fromJson(Map<String, dynamic> json) {
    return McpResourceTemplateModel(
      uriTemplate: json['uriTemplate']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? '',
      toolName: json['toolName']?.toString() ?? '',
    );
  }
}

class McpOauthModel {
  const McpOauthModel({
    this.clientId,
    this.hasClientSecret = false,
    this.authorizationEndpoint,
    this.tokenEndpoint,
    this.scopes = const [],
    this.dynamicallyRegistered = false,
    this.ownerConnected = false,
  });

  final String? clientId;
  final bool hasClientSecret;
  final String? authorizationEndpoint;
  final String? tokenEndpoint;
  final List<String> scopes;
  final bool dynamicallyRegistered;
  final bool ownerConnected;

  factory McpOauthModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const McpOauthModel();
    final scopes = json['scopes'] as List? ?? [];
    return McpOauthModel(
      clientId: json['clientId']?.toString(),
      hasClientSecret: json['hasClientSecret'] as bool? ?? false,
      authorizationEndpoint: json['authorizationEndpoint']?.toString(),
      tokenEndpoint: json['tokenEndpoint']?.toString(),
      scopes: scopes.map((item) => item.toString()).toList(),
      dynamicallyRegistered: json['dynamicallyRegistered'] as bool? ?? false,
      ownerConnected: json['ownerConnected'] as bool? ?? false,
    );
  }
}

class McpModel {
  const McpModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.description,
    required this.transport,
    required this.url,
    required this.authType,
    required this.authMode,
    required this.isEnabled,
    required this.hasApiKey,
    required this.oauth,
    required this.tools,
    required this.resources,
    required this.resourceTemplates,
    this.lastTestedAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String description;
  final String transport;
  final String url;
  final String authType; // none | apiKey | oauth
  final String authMode; // owner | user
  final bool isEnabled;
  final bool hasApiKey;
  final McpOauthModel oauth;
  final List<McpToolModel> tools;
  final List<McpResourceModel> resources;
  final List<McpResourceTemplateModel> resourceTemplates;
  final DateTime? lastTestedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get serverUrl => url;
  bool get ownerOauthConnected => oauth.ownerConnected;

  factory McpModel.fromJson(Map<String, dynamic> json) {
    final tools = json['tools'] as List? ?? [];
    final resources = json['resources'] as List? ?? [];
    final templates = json['resourceTemplates'] as List? ?? [];
    return McpModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      transport: json['transport'] as String? ?? 'http',
      url: (json['url'] ?? json['serverUrl'])?.toString() ?? '',
      authType: json['authType'] as String? ?? 'none',
      authMode: json['authMode'] as String? ?? 'owner',
      isEnabled: json['isEnabled'] as bool? ?? true,
      hasApiKey: json['hasApiKey'] as bool? ?? false,
      oauth: McpOauthModel.fromJson(json['oauth'] as Map<String, dynamic>?),
      tools: tools
          .map((item) => McpToolModel.fromJson(item as Map<String, dynamic>))
          .toList(),
      resources: resources
          .map(
            (item) => McpResourceModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      resourceTemplates: templates
          .map(
            (item) =>
                McpResourceTemplateModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      lastTestedAt: json['lastTestedAt'] != null
          ? DateTime.tryParse(json['lastTestedAt'].toString())
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  McpModel copyWith({
    String? id,
    String? ownerId,
    String? name,
    String? description,
    String? transport,
    String? url,
    String? authType,
    String? authMode,
    bool? isEnabled,
    bool? hasApiKey,
    McpOauthModel? oauth,
    List<McpToolModel>? tools,
    List<McpResourceModel>? resources,
    List<McpResourceTemplateModel>? resourceTemplates,
    DateTime? lastTestedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return McpModel(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      name: name ?? this.name,
      description: description ?? this.description,
      transport: transport ?? this.transport,
      url: url ?? this.url,
      authType: authType ?? this.authType,
      authMode: authMode ?? this.authMode,
      isEnabled: isEnabled ?? this.isEnabled,
      hasApiKey: hasApiKey ?? this.hasApiKey,
      oauth: oauth ?? this.oauth,
      tools: tools ?? this.tools,
      resources: resources ?? this.resources,
      resourceTemplates: resourceTemplates ?? this.resourceTemplates,
      lastTestedAt: lastTestedAt ?? this.lastTestedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class McpTestResult {
  const McpTestResult({
    required this.tools,
    required this.resources,
    required this.resourceTemplates,
  });

  final List<McpToolModel> tools;
  final List<McpResourceModel> resources;
  final List<McpResourceTemplateModel> resourceTemplates;

  factory McpTestResult.fromJson(Map<String, dynamic> json) {
    final tools = json['tools'] as List? ?? [];
    final resources = json['resources'] as List? ?? [];
    final templates = json['resourceTemplates'] as List? ?? [];
    return McpTestResult(
      tools: tools
          .map((item) => McpToolModel.fromJson(item as Map<String, dynamic>))
          .toList(),
      resources: resources
          .map(
            (item) => McpResourceModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      resourceTemplates: templates
          .map(
            (item) =>
                McpResourceTemplateModel.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
