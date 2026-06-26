class MessageModel {
  const MessageModel({
    required this.id,
    required this.role,
    required this.content,
    this.name,
    required this.timestamp,
  });

  final String id;
  final String role; // 'user', 'assistant', 'system', 'tool'
  final String content;
  final String? name;
  final DateTime timestamp;

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    final rawContent = json['content'];
    String parsedContent = '';
    
    if (rawContent is String) {
      parsedContent = rawContent;
    } else if (rawContent is List) {
      // Content parts from multimodal/tool messages
      final parts = rawContent.map((e) {
        if (e is String) return e;
        if (e is Map) {
          return e['text'] ?? e['content'] ?? '';
        }
        return '';
      }).join('');
      parsedContent = parts;
    }

    // Role mapping: type is often used in LangChain models (e.g. 'human', 'ai', 'system', 'tool')
    final type = json['type'] as String? ?? json['role'] as String? ?? 'user';
    String roleStr = 'user';
    if (type == 'ai' || type == 'assistant') {
      roleStr = 'assistant';
    } else if (type == 'system') {
      roleStr = 'system';
    } else if (type == 'tool') {
      roleStr = 'tool';
    }

    return MessageModel(
      id: json['id']?.toString() ?? '',
      role: roleStr,
      content: parsedContent,
      name: json['name'] as String?,
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': role,
      'content': content,
      if (name != null) 'name': name,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
