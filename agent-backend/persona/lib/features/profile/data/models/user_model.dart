class UserModel {
  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.age,
    required this.isActive,
    required this.role,
    required this.clerkId,
    required this.preferences,
    required this.summary,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String email;
  final int? age;
  final bool isActive;
  final String role;
  final String clerkId;
  final Map<String, String> preferences;
  final String summary;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final profileJson = json['profile'] as Map<String, dynamic>?;
    final prefsJson = profileJson?['preferences'];
    
    Map<String, String> parsedPrefs = {};
    if (prefsJson is Map) {
      prefsJson.forEach((key, value) {
        parsedPrefs[key.toString()] = value.toString();
      });
    }

    return UserModel(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      age: json['age'] as int?,
      isActive: json['isActive'] as bool? ?? true,
      role: json['role'] as String? ?? 'normal',
      clerkId: json['clerkId'] as String? ?? '',
      preferences: parsedPrefs,
      summary: profileJson?['summary'] as String? ?? '',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'age': age,
      'isActive': isActive,
      'role': role,
      'clerkId': clerkId,
      'profile': {
        'preferences': preferences,
        'summary': summary,
      },
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
