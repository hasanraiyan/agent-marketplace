import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_file_item.freezed.dart';
part 'persona_file_item.g.dart';

@freezed
abstract class PersonaFileItem with _$PersonaFileItem {
  const factory PersonaFileItem({
    required String id,
    required String originalName,
    required String mimeType,
    required int size,
    String? agentId,
    String? threadId,
    required String createdAt,
  }) = _PersonaFileItem;

  factory PersonaFileItem.fromJson(Map<String, dynamic> json) => _$PersonaFileItemFromJson(json);
}
