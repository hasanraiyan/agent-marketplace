import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_health_info.freezed.dart';
part 'persona_health_info.g.dart';

@freezed
abstract class PersonaHealthInfo with _$PersonaHealthInfo {
  const factory PersonaHealthInfo({
    required String status,
    String? version,
    Map<String, dynamic>? capabilities,
  }) = _PersonaHealthInfo;

  factory PersonaHealthInfo.fromJson(Map<String, dynamic> json) => _$PersonaHealthInfoFromJson(json);
}
