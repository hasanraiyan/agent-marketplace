class ThreadModel {
  const ThreadModel({
    required this.id,
    required this.agentId,
    required this.userId,
    required this.threadId,
    required this.title,
    required this.lastMessageAt,
    required this.isArchived,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String agentId;
  final String userId;
  final String threadId;
  final String title;
  final DateTime lastMessageAt;
  final bool isArchived;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory ThreadModel.fromJson(Map<String, dynamic> json) {
    // Sometimes agentId is populated as an object, sometimes it is a String ID
    final agentData = json['agentId'];
    final String parsedAgentId = (agentData is Map)
        ? (agentData['id'] ?? agentData['_id'] ?? '').toString()
        : (agentData ?? '').toString();

    // Sometimes userId is populated as an object
    final userData = json['userId'];
    final String parsedUserId = (userData is Map)
        ? (userData['id'] ?? userData['_id'] ?? '').toString()
        : (userData ?? '').toString();

    return ThreadModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      agentId: parsedAgentId,
      userId: parsedUserId,
      threadId: json['threadId'] as String? ?? '',
      title: json['title'] as String? ?? 'New Conversation',
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.tryParse(json['lastMessageAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isArchived: json['isArchived'] as bool? ?? false,
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
      'agentId': agentId,
      'userId': userId,
      'threadId': threadId,
      'title': title,
      'lastMessageAt': lastMessageAt.toIso8601String(),
      'isArchived': isArchived,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
