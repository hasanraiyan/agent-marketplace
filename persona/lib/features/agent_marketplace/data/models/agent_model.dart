class AgentModel {
  const AgentModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.slug,
    required this.description,
    required this.avatar,
    required this.tags,
    required this.systemPrompt,
    required this.providerId,
    required this.modelName,
    required this.webSearchEnabled,
    required this.skills,
    required this.mcps,
    required this.knowledgeBases,
    required this.interruptOn,
    required this.visibility,
    required this.category,
    required this.messageCount,
    required this.isActive,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String slug;
  final String description;
  final String avatar;
  final List<String> tags;
  final String systemPrompt;
  final String providerId;
  final String modelName;
  final bool webSearchEnabled;
  final List<String> skills;
  final List<String> mcps;
  final List<String> knowledgeBases;
  final Map<String, bool> interruptOn;
  final String visibility;
  final String category;
  final int messageCount;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory AgentModel.fromJson(Map<String, dynamic> json) {
    // Parse tags
    final tagsList = json['tags'] as List? ?? [];
    final List<String> parsedTags = tagsList.map((e) => e.toString()).toList();

    // Parse lists of ObjectIds/IDs
    final skillsList = json['skills'] as List? ?? [];
    final List<String> parsedSkills = skillsList.map((e) => e.toString()).toList();

    final mcpsList = json['mcps'] as List? ?? [];
    final List<String> parsedMcps = mcpsList.map((e) => e.toString()).toList();

    final kbList = json['knowledgeBases'] as List? ?? [];
    final List<String> parsedKbs = kbList.map((e) => e.toString()).toList();

    // Parse interruptOn
    final interruptMap = json['interruptOn'];
    final Map<String, bool> parsedInterrupts = {};
    if (interruptMap is Map) {
      interruptMap.forEach((key, value) {
        if (value is bool) {
          parsedInterrupts[key.toString()] = value;
        }
      });
    }

    return AgentModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      ownerId: json['ownerId']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String? ?? '',
      avatar: json['avatarUrl'] as String? ?? json['avatar'] as String? ?? '',
      tags: parsedTags,
      systemPrompt: json['systemPrompt'] as String? ?? '',
      providerId: json['providerId']?.toString() ?? '',
      modelName: json['modelName'] as String? ?? '',
      webSearchEnabled: json['webSearchEnabled'] as bool? ?? false,
      skills: parsedSkills,
      mcps: parsedMcps,
      knowledgeBases: parsedKbs,
      interruptOn: parsedInterrupts,
      visibility: json['visibility'] as String? ?? 'private',
      category: json['category'] as String? ?? 'other',
      messageCount: json['messageCount'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ownerId': ownerId,
      'name': name,
      'slug': slug,
      'description': description,
      'avatar': avatar,
      'tags': tags,
      'systemPrompt': systemPrompt,
      'providerId': providerId,
      'modelName': modelName,
      'webSearchEnabled': webSearchEnabled,
      'skills': skills,
      'mcps': mcps,
      'knowledgeBases': knowledgeBases,
      'interruptOn': interruptOn,
      'visibility': visibility,
      'category': category,
      'messageCount': messageCount,
      'isActive': isActive,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
